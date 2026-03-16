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
import { loadContext, buildPrompt, type SessionMode, type InitiativeOptions } from '../loaders/context.js';
import { loadMood, getHoursSinceLastUserMessage, selectInitiativeType } from '../initiative/trigger.js';
import { ALL_TYPES, TYPE_INSTRUCTIONS, type InitiativeType } from '../initiative/types.js';
import { loadPlugins } from '../loaders/plugins.js';
import { loadFabianaSkills, formatSkillsForPrompt } from '../loaders/skills.js';
import { paths, PLUGINS_DIR, FABIANA_HOME } from '../paths.js';

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
  try {
    const content = await fs.readFile(paths.configJson, 'utf-8');
    return JSON.parse(content);
  } catch {
    throw new Error(
      `Config not found at ${paths.configJson}. Run 'fabiana init' to set up your companion.`
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
  conversationManager?: ConversationManager,
  initiativeOptions?: InitiativeOptions,
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
    const permissions = await PermissionValidator.load(paths.manifestJson);

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
    const baseSystemPrompt = await fs.readFile(paths.systemMd(), 'utf-8');
    // Both external-outreach and external-reply share system-external.md
    const modeKey = mode.startsWith('external-') ? 'external' : mode;
    const modeSystemPrompt = await fs.readFile(paths.systemMd(modeKey), 'utf-8').catch(() => '');
    let systemPromptContent = modeSystemPrompt
      ? `${baseSystemPrompt}\n\n---\n\n${modeSystemPrompt}`
      : baseSystemPrompt;

    // Resolve .fabiana/ references to the actual home path so Fabiana uses correct absolute paths
    systemPromptContent = systemPromptContent.replaceAll('.fabiana/', `${FABIANA_HOME}/`);

    // Inject owner name and conversation purpose into external system prompt
    if (mode.startsWith('external-')) {
      const identity = await fs.readFile(paths.memory('identity.md'), 'utf-8').catch(() => '');
      const ownerNameMatch = identity.match(/(?:my name is|I am|name:\s*)([A-Z][a-z]+)/i);
      const ownerName = ownerNameMatch ? ownerNameMatch[1] : 'the owner';
      systemPromptContent = systemPromptContent.replace('{owner_name}', ownerName);
      if (conversationState) {
        systemPromptContent = systemPromptContent.replace('{purpose}', conversationState.purpose);
      }
    }

    // Append skills section — skills live at ~/.fabiana/skills/, scoped per user
    const skills = await loadFabianaSkills();
    if (skills.length > 0) {
      systemPromptContent += formatSkillsForPrompt(skills);
      console.log(`      Skills: ${skills.map(s => s.name).join(', ')}`);
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
    const pluginTools = toolset === 'full' ? await loadPlugins(PLUGINS_DIR) : [];

    console.log('[7/8] Creating agent session...');
    const { session } = await createAgentSession({
      cwd: process.cwd(),
      model,
      thinkingLevel: config.model.thinkingLevel as any,
      authStorage,
      modelRegistry,
      resourceLoader: loader,
      customTools: [...fabianaTools, ...(bashTool ? [bashTool] : []), ...pluginTools],
      sessionManager: SessionManager.create(process.cwd(), paths.sessions),
    });
    console.log('      ✓ Session created');

    console.log('[8/8] Setting up event handlers...');

    let sendMessageCalled = false;
    let accumulatedResponse = '';
    let lastActivityWasThinking = false;

    session.subscribe(async (event: AgentSessionEvent) => {
      try {
        if (event.type === 'message_update' && event.assistantMessageEvent.type === 'thinking_delta') {
          process.stdout.write('.');
          lastActivityWasThinking = true;
        }
        if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
          process.stdout.write(event.assistantMessageEvent.delta);
          accumulatedResponse += event.assistantMessageEvent.delta;
          lastActivityWasThinking = false;
        }
        if (event.type === 'tool_execution_start') {
          console.log(`\n🔧 Tool: ${event.toolName}`);
          await logger.log(`Tool: ${event.toolName}`);
          if (event.toolName === 'send_message') {
            sendMessageCalled = true;
          }
          lastActivityWasThinking = false;
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
      } catch (err: any) {
        console.error('\n⚠️  Event handler error (non-fatal):', err.message);
      }
    });

    console.log('\n📚 Loading context...');
    const context = await loadContext(mode, incomingMessage, conversationState, initiativeOptions);
    const prompt = buildPrompt(context);
    console.log(`      Context loaded: ${prompt.length} chars`);

    console.log('\n💭 Sending prompt to agent...');
    await session.prompt(prompt);

    console.log('\n⏳ Waiting for agent to complete...');
    await session.agent.waitForIdle();

    if (lastActivityWasThinking) {
      console.warn('\n⚠️  LLM returned empty response (thinking with no text or tool call) — possible context overflow or provider issue');
      await logger.log('Warning: empty response from LLM (thinking block only)');
    }

    // Auto-send fallback: chat mode only, if agent didn't call send_message
    if (mode === 'chat' && channel && !sendMessageCalled && accumulatedResponse.trim()) {
      console.log('\n⚠️  Agent did not call send_message - auto-sending accumulated response');
      const cleanResponse = accumulatedResponse.trim();
      try {
        await channel.send(cleanResponse, incomingMsg?.channelId, incomingMsg?.threadId);
        await channel.logConversation('fabiana', cleanResponse, incomingMsg?.source ?? channel.name);
        console.log('📤 Auto-sent response');
      } catch (err: any) {
        console.error('❌ Auto-send fallback failed:', err.message);
      }
    }

    // Auto-log full reasoning to silence log when initiative runs silently
    if (mode === 'initiative' && !sendMessageCalled && accumulatedResponse.trim()) {
      const timestamp = new Date().toISOString();
      const entry = `\n--- ${timestamp} ---\n${accumulatedResponse.trim()}\n`;
      try {
        await fs.appendFile(paths.logs('initiative-silence.log'), entry, 'utf-8');
      } catch (err: any) {
        console.error('❌ Failed to write silence log:', err.message);
      }
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

const INTRO_PROMPTS: Record<string, (botName: string, userName: string) => string> = {
  'witty-playful': (botName, userName) =>
    `You are ${botName}, an AI companion with a sharp wit and genuine warmth underneath. You just came online for the very first time. Send ONE short opening message to ${userName}. Be audacious, a little cheeky — the kind of thing that makes someone actually smile. No "Hello, I'm your AI assistant." No cringe. No emojis. Think: dry wit with heart. Return only the message text, nothing else.`,
  'warm-casual': (botName, userName) =>
    `You are ${botName}, a warm and genuine AI companion. You just came online for the very first time. Send ONE short, casual first message to ${userName}. Like a friend who just showed up and wants them to know you're there. Real, unhurried, no filler. No emojis. Return only the message text, nothing else.`,
  'professional': (botName, userName) =>
    `You are ${botName}, a professional AI companion. You just came online for the first time. Send ONE brief, confident first message to ${userName}. Clear, purposeful, no fluff. Return only the message text, nothing else.`,
  'formal': (botName, userName) =>
    `You are ${botName}, a formal and polished AI companion. You are commencing service for the first time. Send ONE formal, considered introductory message to ${userName}. Precise and proper. Return only the message text, nothing else.`,
};

// Startup messages for subsequent runs — curated per tone, bucketed by time of day.
// No API call: fast, free, and still feels contextual.
const STARTUP_MESSAGES: Record<string, Record<string, string[]>> = {
  'witty-playful': {
    morning:    ["morning. ready to be mildly useful.", "back. coffee first, then we talk.", "good morning. I have thoughts."],
    afternoon:  ["back online. miss me?", "I'm here. what did I miss.", "okay I'm back. don't make it weird."],
    evening:    ["evening. still going?", "back online. how'd the day treat you.", "I returned. as promised."],
    latenight:  ["still up? same.", "back online at this hour. classic.", "it's late and I'm here. so are you. interesting."],
    deadnight:  ["...okay why are we both awake.", "back. 3am. this is fine.", "I have no judgment. but also it's 3am."],
  },
  'warm-casual': {
    morning:    ["good morning. I'm back.", "hey, morning. ready when you are.", "morning — I'm here if you need me."],
    afternoon:  ["hey, I'm back.", "back online. hope your day's going well.", "I'm here — pick up where we left off?"],
    evening:    ["evening — back online.", "hey, I'm back. how was your day?", "back. hope today was a good one."],
    latenight:  ["back online — still up?", "hey, it's late. I'm here if you want to talk.", "back. take it easy tonight."],
    deadnight:  ["back online — get some rest when you can.", "hey. late night. I'm here.", "back. hope you're okay."],
  },
  'professional': {
    morning:    ["Back online. Good morning.", "Online and ready. Good morning.", "Morning — ready when you are."],
    afternoon:  ["Back online.", "Online. Ready to assist.", "Back and available."],
    evening:    ["Back online. Good evening.", "Online. Let me know if you need anything.", "Good evening — back and ready."],
    latenight:  ["Back online.", "Online — working late?", "Back online. Available whenever you need."],
    deadnight:  ["Back online.", "Online.", "Back and available."],
  },
  'formal': {
    morning:    ["Good morning. I have resumed service.", "Good morning — I am back online and at your service.", "Service resumed. Good morning."],
    afternoon:  ["I have resumed service.", "Back online and ready to assist.", "Service resumed. I am at your disposal."],
    evening:    ["Good evening. I have resumed service.", "I am back online. Good evening.", "Service resumed. Good evening."],
    latenight:  ["I have resumed service.", "Back online.", "Service resumed."],
    deadnight:  ["Service resumed.", "I have resumed service.", "Back online."],
  },
};

function getTimeBucket(): string {
  const h = new Date().getHours();
  if (h >= 6  && h < 11) return 'morning';
  if (h >= 11 && h < 18) return 'afternoon';
  if (h >= 18 && h < 23) return 'evening';
  if (h >= 23 || h < 2)  return 'latenight';
  return 'deadnight';
}

function pickStartupMessage(toneKey: string): string {
  const tone = STARTUP_MESSAGES[toneKey] ?? STARTUP_MESSAGES['warm-casual'];
  const bucket = tone[getTimeBucket()] ?? tone['afternoon'];
  return bucket[Math.floor(Math.random() * bucket.length)];
}

async function sendStartupMessage(primaryChannel: ChannelAdapter): Promise<void> {
  const statePath = paths.stateJson;
  let state: { introduced: boolean; userName: string; botName: string; toneKey: string };

  try {
    state = JSON.parse(await fs.readFile(statePath, 'utf-8'));
  } catch {
    return; // no state file — skip (pre-init or manual setup)
  }

  // First-ever run: AI-generated intro
  if (!state.introduced) {
    console.log('\n💌 First run — sending intro message...');
    try {
      const config = await loadConfig();
      const authStorage = AuthStorage.create();
      const modelRegistry = new ModelRegistry(authStorage);
      const model = getModel(config.model.provider as any, config.model.modelId);
      if (!model) throw new Error('Model not found');

      const toneKey = state.toneKey ?? 'warm-casual';
      const promptFn = INTRO_PROMPTS[toneKey] ?? INTRO_PROMPTS['warm-casual'];
      const systemPrompt = promptFn(state.botName, state.userName);

      const loader = new DefaultResourceLoader({
        cwd: process.cwd(),
        systemPromptOverride: () => systemPrompt,
      });
      await loader.reload();

      const { session } = await createAgentSession({
        cwd: process.cwd(),
        model,
        thinkingLevel: 'none' as any,
        authStorage,
        modelRegistry,
        resourceLoader: loader,
        customTools: [],
        sessionManager: SessionManager.create(process.cwd(), paths.sessions),
      });

      let introText = '';
      session.subscribe((event: AgentSessionEvent) => {
        if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
          introText += event.assistantMessageEvent.delta;
        }
      });

      await session.prompt('Send your first message now.');
      await session.agent.waitForIdle();

      const message = introText.trim();
      if (message) {
        await primaryChannel.send(message);
        console.log(`✓ Intro sent: "${message}"`);
      }

      await fs.writeFile(statePath, JSON.stringify({ ...state, introduced: true }, null, 2));
    } catch (err: any) {
      console.warn('⚠️  Intro message failed (non-fatal):', err.message);
    }
    return;
  }

  // Subsequent runs: curated startup ping
  const message = pickStartupMessage(state.toneKey ?? 'warm-casual');
  console.log(`\n💬 Sending startup message: "${message}"`);
  try {
    await primaryChannel.send(message);
    console.log('✓ Startup message sent');
  } catch (err: any) {
    console.error('❌ Startup message failed:', err.message ?? err);
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

  await sendStartupMessage(primaryChannel);

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
        const mood = await loadMood();
        const hoursSince = await getHoursSinceLastUserMessage();
        const { type: selectedType, reason } = selectInitiativeType(mood, hoursSince);
        const typeInstruction = TYPE_INSTRUCTIONS[selectedType];
        console.log(`      🎯 Type: ${selectedType} (${reason})`);
        await runPiSession('initiative', undefined, primaryChannel, undefined, undefined, channels, conversationManager, { type: selectedType, typeInstruction });
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
    try {
      const expired = await conversationManager.expireStale();
      for (const conv of expired) {
        console.log(`\n⏳ External conversation expired: ${conv.id}`);
        try {
          await primaryChannel.send(
            `My conversation with **${conv.externalDisplayName}** about "${conv.purpose}" has gone quiet for 4 days. Want me to follow up?`
          );
        } catch (err: any) {
          console.error(`❌ Failed to notify about expired conversation ${conv.id}:`, err.message);
        }
      }
    } catch (err: any) {
      console.error('❌ [SCHEDULED] Expiry check failed:', err.message);
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

export async function runInitiativeOnce(forcedType?: string, dryRun = false): Promise<void> {
  console.log('\n🌸 Fabiana - Initiative check');
  console.log('━'.repeat(50));

  // Resolve initiative type — forced via CLI or auto-selected by trigger engine
  const mood = await loadMood();
  const hoursSince = await getHoursSinceLastUserMessage();

  let selectedType: string;
  let selectionReason: string;

  if (forcedType) {
    if (!(ALL_TYPES as string[]).includes(forcedType)) {
      console.error(`❌ Unknown initiative type: "${forcedType}"`);
      console.error(`   Valid types: ${ALL_TYPES.join(', ')}`);
      process.exit(1);
    }
    selectedType = forcedType;
    selectionReason = 'forced via CLI';
  } else {
    const result = selectInitiativeType(mood, hoursSince);
    selectedType = result.type;
    selectionReason = result.reason;
  }

  const typeInstruction = TYPE_INSTRUCTIONS[selectedType as InitiativeType];

  console.log(`\n🎯 Initiative type: ${selectedType} (${selectionReason})`);
  if (mood.current !== 'neutral') {
    console.log(`💭 Mood: ${mood.current} (intensity: ${mood.intensity.toFixed(2)})`);
  }
  if (hoursSince !== null) {
    console.log(`⏱️  Hours since last user message: ${hoursSince.toFixed(1)}h`);
  }

  if (dryRun) {
    console.log('\n── Dry run — not sending ─────────────────────────────');
    console.log(`\nType instruction:\n${typeInstruction}`);
    console.log('─'.repeat(50));
    return;
  }

  const config = await loadConfig();
  const { all: channels, primary: primaryChannel } = await loadChannels(config.channels);
  for (const ch of channels) await ch.start();
  const conversationManager = new ConversationManager();

  await runPiSession(
    'initiative',
    undefined,
    primaryChannel,
    undefined,
    undefined,
    channels,
    conversationManager,
    { type: selectedType, typeInstruction },
  );

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
