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
import { loadChannels, type ChannelsConfig } from '../channels/index.js';
import type { ChannelAdapter, IncomingMessage } from '../channels/types.js';
import { ConversationManager } from '../conversations/manager.js';
import type { ConversationState } from '../conversations/types.js';
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
  channels?: ChannelsConfig;
  initiative: {
    enabled: boolean;
    minHoursBetweenMessages: number;
    activeHoursStart: number;
    activeHoursEnd: number;
    checkIntervalMinutes: number;
  };
}

async function loadConfig(): Promise<Config> {
  const configPath = '.fabiana/config/config.json';
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    throw new Error(
      `Config not found at ${configPath}. Run 'fabiana init' to set up your companion.`
    );
  }
}

export async function runPiSession(
  mode: SessionMode,
  incomingMessage?: string,
  channel?: ChannelAdapter,
  incomingMsg?: IncomingMessage,
  conversationState?: ConversationState,
  allChannels?: ChannelAdapter[],
  conversationManager?: ConversationManager
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
    // Both external-outreach and external-reply share system-external.md
    const modeKey = mode.startsWith('external-') ? 'external' : mode;
    const modeSystemPrompt = await fs.readFile(`.fabiana/config/system-${modeKey}.md`, 'utf-8').catch(() => '');
    let systemPromptContent = modeSystemPrompt
      ? `${baseSystemPrompt}\n\n---\n\n${modeSystemPrompt}`
      : baseSystemPrompt;

    // Inject owner name and conversation purpose into external system prompt
    if (mode.startsWith('external-')) {
      const identity = await fs.readFile('.fabiana/data/memory/identity.md', 'utf-8').catch(() => '');
      const ownerNameMatch = identity.match(/(?:my name is|I am|name:\s*)([A-Z][a-z]+)/i);
      const ownerName = ownerNameMatch ? ownerNameMatch[1] : 'the owner';
      systemPromptContent = systemPromptContent.replace('{owner_name}', ownerName);
      if (conversationState) {
        systemPromptContent = systemPromptContent.replace('{purpose}', conversationState.purpose);
      }
    }

    const loader = new DefaultResourceLoader({
      cwd: process.cwd(),
      systemPromptOverride: () => systemPromptContent,
    });
    await loader.reload();

    const isExternalSession = mode === 'external-outreach' || mode === 'external-reply';
    const toolset = isExternalSession ? 'external' : 'full';

    const sendMessage = async (text: string) => {
      console.log(`      📤 Sending [${channel?.name ?? 'no-channel'}]: "${text.slice(0, 40)}..."`);
      if (channel) {
        await channel.send(text, incomingMsg?.channelId, incomingMsg?.threadId);
        await channel.logConversation('fabiana', text, incomingMsg?.source ?? channel.name);
      }
      if (conversationState && conversationManager) {
        await conversationManager.append(conversationState.id, 'fabiana', text);
      }
    };

    console.log('[6/8] Creating tools...');
    const fabianaTools = createFabianaTools(permissions, sendMessage, {
      toolset,
      channels: allChannels,
      conversationManager,
    });
    const bashTool = toolset === 'full' ? createBashTool(process.cwd()) : null;
    const pluginTools = toolset === 'full' ? await loadPlugins('./plugins') : [];

    console.log('[7/8] Creating agent session...');
    const { session } = await createAgentSession({
      cwd: process.cwd(),
      model,
      thinkingLevel: config.model.thinkingLevel as any,
      authStorage,
      modelRegistry,
      resourceLoader: loader,
      customTools: [...fabianaTools, ...(bashTool ? [bashTool] : []), ...pluginTools],
      sessionManager: SessionManager.create(process.cwd(), '.fabiana/data/sessions'),
    });
    console.log('      ✓ Session created');

    console.log('[8/8] Setting up event handlers...');

    let sendMessageCalled = false;
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
        if (event.toolName === 'send_message') {
          sendMessageCalled = true;
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
    const context = await loadContext(mode, incomingMessage, conversationState);
    const prompt = buildPrompt(context);
    console.log(`      Context loaded: ${prompt.length} chars`);

    console.log('\n💭 Sending prompt to agent...');
    await session.prompt(prompt);

    console.log('\n⏳ Waiting for agent to complete...');
    await session.agent.waitForIdle();

    // Auto-send fallback: chat mode only, if agent didn't call send_message
    if (mode === 'chat' && channel && !sendMessageCalled && accumulatedResponse.trim()) {
      console.log('\n⚠️  Agent did not call send_message - auto-sending accumulated response');
      const cleanResponse = accumulatedResponse.trim();
      await channel.send(cleanResponse, incomingMsg?.channelId, incomingMsg?.threadId);
      await channel.logConversation('fabiana', cleanResponse, incomingMsg?.source ?? channel.name);
      console.log('📤 Auto-sent response');
    }

    // Auto-log full reasoning to silence log when initiative runs silently
    if (mode === 'initiative' && !sendMessageCalled && accumulatedResponse.trim()) {
      const timestamp = new Date().toISOString();
      const entry = `\n--- ${timestamp} ---\n${accumulatedResponse.trim()}\n`;
      await fs.appendFile('.fabiana/data/logs/initiative-silence.log', entry, 'utf-8');
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
  const { all: channels, primary: primaryChannel } = await loadChannels(config.channels);
  const conversationManager = new ConversationManager();

  for (const ch of channels) {
    await ch.start();
  }

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
        await runPiSession('initiative', undefined, primaryChannel, undefined, undefined, channels, conversationManager);
        console.log('✅ [SCHEDULED] Initiative complete');
      } catch (err: any) {
        console.error('❌ [SCHEDULED] Initiative failed:', err.message);
      }
    });
  }

  cron.schedule('0 0 * * *', async () => {
    console.log('\n🌙 [SCHEDULED] Running midnight consolidation...');
    try {
      await runPiSession('consolidate', undefined, primaryChannel, undefined, undefined, channels, conversationManager);
      console.log('✅ [SCHEDULED] Consolidation complete');
    } catch (err: any) {
      console.error('❌ [SCHEDULED] Consolidation failed:', err.message);
    }
  });

  // Hourly check: expire stale external conversations (> 4 days inactive)
  cron.schedule('0 * * * *', async () => {
    const expired = await conversationManager.expireStale();
    for (const conv of expired) {
      console.log(`\n⏳ External conversation expired: ${conv.id}`);
      await primaryChannel.send(
        `My conversation with **${conv.externalDisplayName}** about "${conv.purpose}" has gone quiet for 4 days. Want me to follow up?`
      );
    }
  });

  console.log('👂 Listening for messages...');
  console.log(`🌱 Initiative: every ${config.initiative.checkIntervalMinutes}min (${config.initiative.activeHoursStart}:00–${config.initiative.activeHoursEnd}:00)`);
  console.log('🌙 Consolidation: midnight daily');
  console.log(`📡 Active channels: ${channels.map((c) => c.name).join(', ')} (primary: ${primaryChannel.name})`);
  console.log('Press Ctrl+C to stop\n');

  const processLoop = async () => {
    let tickCount = 0;
    while (true) {
      // Drain all channels and merge messages by timestamp
      const allMessages = channels
        .flatMap((c) => c.drainQueue())
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      for (const msg of allMessages) {
        const msgChannel = channels.find((c) => c.name === msg.source)!;

        if (!msgChannel.isOwner(msg.senderId)) {
          // Non-owner message — look up an active external conversation
          const conv = await conversationManager.find(msg.source, msg.senderId, msg.threadId ?? '');
          if (!conv) {
            console.log(`\n⚠️  Unknown external message from ${msg.senderId} on ${msg.source}`);
            await primaryChannel.send(
              `📬 Unknown message from \`${msg.senderId}\` on ${msg.source}:\n> ${msg.text.slice(0, 200)}\n\nNo active conversation found. Use \`start_external_conversation\` if you want to engage.`
            );
            continue;
          }
          console.log(`\n📨 [${msg.source}] External reply from ${conv.externalDisplayName}: "${msg.text.slice(0, 50)}..."`);
          await conversationManager.append(conv.id, conv.externalDisplayName, msg.text);
          try {
            await runPiSession('external-reply', msg.text, msgChannel, msg, conv, channels, conversationManager);
          } catch (err: any) {
            console.error('   ❌ External reply session error:', err.message);
          }
        } else {
          // Owner message — full chat session on the channel it arrived on
          console.log(`\n📨 [${msg.source}] Message: "${msg.text.slice(0, 50)}..."`);
          await msgChannel.logConversation('user', msg.text, msg.source);
          try {
            await runPiSession('chat', msg.text, msgChannel, msg, undefined, channels, conversationManager);
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
    for (const ch of channels) {
      await ch.stop();
    }
    process.exit(0);
  });
}

export async function runInitiativeOnce(): Promise<void> {
  console.log('\n🌸 Fabiana - Initiative check');
  console.log('━'.repeat(50));

  const config = await loadConfig();
  const { all: channels, primary: primaryChannel } = await loadChannels(config.channels);
  for (const ch of channels) await ch.start();
  const conversationManager = new ConversationManager();
  await runPiSession('initiative', undefined, primaryChannel, undefined, undefined, channels, conversationManager);
  for (const ch of channels) await ch.stop();
  process.exit(0);
}

export async function runConsolidateOnce(): Promise<void> {
  console.log('\n🌸 Fabiana - Memory consolidation');
  console.log('━'.repeat(50));

  const config = await loadConfig();
  const { all: channels, primary: primaryChannel } = await loadChannels(config.channels);
  for (const ch of channels) await ch.start();
  const conversationManager = new ConversationManager();
  await runPiSession('consolidate', undefined, primaryChannel, undefined, undefined, channels, conversationManager);
  for (const ch of channels) await ch.stop();
  process.exit(0);
}
