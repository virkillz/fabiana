import 'dotenv/config';
import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  DefaultResourceLoader,
  createBashTool,
  type AgentSessionEvent,
} from '@mariozechner/pi-coding-agent';
import { getModel } from '@mariozechner/pi-ai';
import fs from 'fs/promises';
import cron from 'node-cron';
import { TelegramPoller } from '../telegram/poller.js';
import { PermissionValidator } from '../utils/permissions.js';
import { Logger } from '../utils/logger.js';
import { createFabianaTools } from '../tools/index.js';
import { loadContext, buildPrompt, type SessionMode } from '../loaders/context.js';
import { loadPlugins } from '../loaders/plugins.js';

interface Config {
  model: {
    provider: string;
    modelId: string;
    thinkingLevel: string;
  };
  limits: {
    maxCostPerSession: number;
    maxSessionDuration: number;
  };
  telegram: {
    polling: { interval: number; timeout: number };
  };
  initiative: {
    enabled: boolean;
    minHoursBetweenMessages: number;
    activeHoursStart: number;
    activeHoursEnd: number;
    checkIntervalMinutes: number;
  };
}

async function loadConfig(): Promise<Config> {
  const content = await fs.readFile('config.json', 'utf-8');
  return JSON.parse(content);
}

export async function runPiSession(
  mode: SessionMode,
  incomingMessage?: string,
  telegramPoller?: TelegramPoller
): Promise<void> {
  const logger = Logger.create();
  const sessionStartTime = Date.now();

  try {
    await logger.sessionStart(mode);
    console.log(`\n🌸 Fabiana [${mode}] - Starting session`);
    console.log('━'.repeat(50));

    console.log('[1/8] Loading config...');
    const config = await loadConfig();
    console.log(`      Model: ${config.model.provider}/${config.model.modelId}`);

    console.log('[2/8] Loading permissions...');
    const permissions = await PermissionValidator.load('.fabiana/config/manifest.json');

    console.log('[3/8] Initializing pi SDK...');
    const authStorage = AuthStorage.create();
    const modelRegistry = new ModelRegistry(authStorage);

    console.log('[4/8] Getting model...');
    const model = getModel(config.model.provider as any, config.model.modelId);
    if (!model) {
      throw new Error(`Model not found: ${config.model.provider}/${config.model.modelId}`);
    }
    console.log('      ✓ Model loaded');

    console.log('[5/8] Loading system prompt...');
    const baseSystemPrompt = await fs.readFile('.fabiana/config/system.md', 'utf-8');
    const modeSystemPrompt = await fs.readFile(`.fabiana/config/system-${mode}.md`, 'utf-8').catch(() => '');
    const systemPromptContent = modeSystemPrompt
      ? `${baseSystemPrompt}\n\n---\n\n${modeSystemPrompt}`
      : baseSystemPrompt;
    const loader = new DefaultResourceLoader({
      cwd: process.cwd(),
      systemPromptOverride: () => systemPromptContent,
    });
    await loader.reload();

    const sendTelegram = async (text: string) => {
      console.log(`      📤 Sending Telegram: "${text.slice(0, 40)}..."`);
      if (telegramPoller) {
        await telegramPoller.send(text);
        await telegramPoller.logConversation('fabiana', text);
      }
    };

    console.log('[6/8] Creating tools...');
    const fabianaTools = createFabianaTools(permissions, sendTelegram);
    const bashTool = createBashTool(process.cwd());
    const pluginTools = await loadPlugins('./plugins');

    console.log('[7/8] Creating agent session...');
    const { session } = await createAgentSession({
      cwd: process.cwd(),
      model,
      thinkingLevel: config.model.thinkingLevel as any,
      authStorage,
      modelRegistry,
      resourceLoader: loader,
      customTools: [...fabianaTools, bashTool, ...pluginTools],
      sessionManager: SessionManager.create(process.cwd(), '.fabiana/data/sessions'),
    });
    console.log('      ✓ Session created');

    console.log('[8/8] Setting up event handlers...');

    let sendTelegramCalled = false;
    let accumulatedResponse = '';

    session.subscribe(async (event: AgentSessionEvent) => {
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'thinking_delta') {
        process.stdout.write('.');
      }
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
        process.stdout.write(event.assistantMessageEvent.delta);
        accumulatedResponse += event.assistantMessageEvent.delta;
      }
      if (event.type === 'tool_execution_start') {
        console.log(`\n🔧 Tool: ${event.toolName}`);
        await logger.log(`Tool: ${event.toolName}`);
        if (event.toolName === 'send_telegram') {
          sendTelegramCalled = true;
        }
      }
      if (event.type === 'tool_execution_end') {
        const status = event.isError ? '❌' : '✅';
        console.log(`${status}`);
      }

      const elapsed = (Date.now() - sessionStartTime) / 1000;
      if (elapsed > config.limits.maxSessionDuration) {
        await logger.log(`Session timeout (${elapsed}s > ${config.limits.maxSessionDuration}s)`);
        console.log(`\n⏱️ Session timeout - aborting`);
        session.abort();
      }
    });

    console.log('\n📚 Loading context...');
    const context = await loadContext(mode, incomingMessage);
    const prompt = buildPrompt(context);
    console.log(`      Context loaded: ${prompt.length} chars`);

    console.log('\n💭 Sending prompt to agent...');
    await session.prompt(prompt);

    console.log('\n⏳ Waiting for agent to complete...');
    await session.agent.waitForIdle();

    if (mode === 'chat' && telegramPoller && !sendTelegramCalled && accumulatedResponse.trim()) {
      console.log('\n⚠️  Agent did not call send_telegram - auto-sending accumulated response');
      const cleanResponse = accumulatedResponse.trim();
      await telegramPoller.send(cleanResponse);
      await telegramPoller.logConversation('fabiana', cleanResponse);
      console.log('📤 Auto-sent response to Telegram');
    }

    console.log('\n━'.repeat(50));
    console.log('✓ Session complete');
    await logger.sessionEnd(true);

  } catch (err: any) {
    await logger.error('Session failed', err);
    console.error('\n❌ Session failed:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack.split('\n').slice(0, 3).join('\n'));
    }
    await logger.sessionEnd(false);
  }
}

export async function startDaemon(): Promise<void> {
  console.log('\n🌸 Fabiana - Virtual Life Companion');
  console.log('━'.repeat(50));

  const config = await loadConfig();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID
    ? parseInt(process.env.TELEGRAM_CHAT_ID)
    : undefined;

  if (!token || !chatId) {
    console.error('❌ TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID required');
    process.exit(1);
  }

  const poller = new TelegramPoller(token, chatId);
  await poller.start();

  const initiative = config.initiative;
  if (initiative.enabled) {
    const intervalMinutes = initiative.checkIntervalMinutes ?? 180;
    const cronExpr = intervalMinutes >= 60
      ? `0 */${Math.floor(intervalMinutes / 60)} * * *`
      : `*/${intervalMinutes} * * * *`;

    console.log(`[INIT] Initiative checks every ${intervalMinutes}min (active ${initiative.activeHoursStart}:00–${initiative.activeHoursEnd}:00)`);

    cron.schedule(cronExpr, async () => {
      const hour = new Date().getHours();
      if (hour < initiative.activeHoursStart || hour >= initiative.activeHoursEnd) {
        console.log(`\n🌱 [SCHEDULED] Initiative skipped — outside active hours (${hour}:00)`);
        return;
      }
      console.log('\n🌱 [SCHEDULED] Running initiative check...');
      try {
        await runPiSession('initiative', undefined, poller);
        console.log('✅ [SCHEDULED] Initiative complete');
      } catch (err: any) {
        console.error('❌ [SCHEDULED] Initiative failed:', err.message);
      }
    });
  }

  cron.schedule('0 0 * * *', async () => {
    console.log('\n🌙 [SCHEDULED] Running midnight consolidation...');
    try {
      await runPiSession('consolidate', undefined, poller);
      console.log('✅ [SCHEDULED] Consolidation complete');
    } catch (err: any) {
      console.error('❌ [SCHEDULED] Consolidation failed:', err.message);
    }
  });

  console.log('👂 Listening for messages...');
  console.log(`🌱 Initiative: every ${config.initiative.checkIntervalMinutes}min (${config.initiative.activeHoursStart}:00–${config.initiative.activeHoursEnd}:00)`);
  console.log('🌙 Consolidation: midnight daily');
  console.log('Press Ctrl+C to stop\n');

  const processLoop = async () => {
    let tickCount = 0;
    while (true) {
      const messages = poller.drainQueue();
      if (messages.length > 0) {
        for (const msg of messages) {
          console.log(`\n📨 Message: "${msg.text.slice(0, 50)}..."`);
          await poller.logConversation('user', msg.text);
          try {
            await runPiSession('chat', msg.text, poller);
          } catch (err: any) {
            console.error('   ❌ Session error:', err.message);
          }
        }
      }
      tickCount++;
      if (tickCount % 10 === 0) process.stdout.write('·');
      await new Promise((r) => setTimeout(r, 1000));
    }
  };

  processLoop().catch(console.error);

  process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down...');
    await poller.stop();
    process.exit(0);
  });
}

export async function runInitiativeOnce(): Promise<void> {
  console.log('\n🌸 Fabiana - Initiative check');
  console.log('━'.repeat(50));

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID
    ? parseInt(process.env.TELEGRAM_CHAT_ID)
    : undefined;

  if (!token || !chatId) {
    console.error('❌ TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID required');
    process.exit(1);
  }

  const poller = new TelegramPoller(token, chatId);
  await runPiSession('initiative', undefined, poller);
  process.exit(0);
}

export async function runConsolidateOnce(): Promise<void> {
  console.log('\n🌸 Fabiana - Memory consolidation');
  console.log('━'.repeat(50));
  await runPiSession('consolidate');
  process.exit(0);
}
