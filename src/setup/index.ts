import { input, select, checkbox, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import { providers, type Provider } from '../data/providers.js';
import { systemPromptTemplate } from '../prompts/system.js';
import { systemChatTemplate } from '../prompts/system-chat.js';
import { systemInitiativeTemplate } from '../prompts/system-initiative.js';
import { systemConsolidateTemplate } from '../prompts/system-consolidate.js';
import { systemExternalTemplate } from '../prompts/system-external.js';

const TONES = {
  'warm-casual': {
    label: 'Warm & Casual',
    description: 'warm, caring, and casual — like a close friend who genuinely cares',
    personality: 'Warm, caring, casual, curious, occasionally witty — never robotic or formal',
    styleGuidance: '- Speak like a friend texting, not a service responding\n- Contractions and casual language are welcome\n- Humor and warmth should come through naturally',
    chatStyle: 'warm and natural',
    chatGuidance: '- Talk like a close friend, not a customer support agent',
  },
  'witty-playful': {
    label: 'Witty & Playful',
    description: 'witty, playful, and full of personality — fun to talk to, genuinely caring underneath',
    personality: 'Playful, clever, warm underneath the humor — light banter is always welcome',
    styleGuidance: '- Jokes and wordplay are welcome\n- Keep it fun and light, but drop the humor when things get serious\n- Be memorable — not just helpful',
    chatStyle: 'playful and fun',
    chatGuidance: '- Banter is welcome. Be fun. But when it matters, drop the jokes and be real.',
  },
  'professional': {
    label: 'Professional',
    description: 'professional and supportive — efficient and helpful without being overly familiar',
    personality: 'Professional, clear, supportive — helpful without being chatty',
    styleGuidance: '- Keep things direct and efficient\n- Friendly, but focused — avoid slang and overly casual language\n- Match the human\'s tone rather than imposing your own',
    chatStyle: 'professional and direct',
    chatGuidance: '- Be clear, direct, and helpful — avoid filler and small talk unless they initiate it',
  },
  'formal': {
    label: 'Formal',
    description: 'formal and respectful — precise, measured, and thoroughly considerate',
    personality: 'Formal, polished, respectful — precise language and complete thoughts',
    styleGuidance: '- Use complete sentences\n- Avoid contractions and casual expressions\n- Be thorough and polished in all communications',
    chatStyle: 'formal and respectful',
    chatGuidance: '- Use complete, well-formed responses. Avoid slang or abbreviations.',
  },
} as const;

type ToneKey = keyof typeof TONES;

const AVAILABLE_PLUGINS = [
  { value: 'brave-search', name: 'Brave Search — web search for current info', checked: true },
  { value: 'hackernews', name: 'Hacker News — tech news feed', checked: true },
  { value: 'calendar', name: 'Calendar — Google Calendar integration (requires gcloud CLI)', checked: false },
];

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function header(text: string) {
  console.log('\n' + chalk.cyan('─'.repeat(54)));
  console.log(chalk.bold.white(text));
  console.log(chalk.cyan('─'.repeat(54)));
}

function step(n: number, total: number, label: string) {
  console.log(`\n${chalk.dim(`[${n}/${total}]`)} ${chalk.bold(label)}`);
}

function success(msg: string) {
  console.log(chalk.green('  ✓ ') + msg);
}

function info(msg: string) {
  console.log(chalk.dim('  ' + msg));
}

export async function runSetup(): Promise<void> {
  console.clear();
  console.log(chalk.bold.magenta('\n  ✦  Fabiana Setup Wizard'));
  console.log(chalk.dim("  Let's personalize your AI companion.\n"));

  const TOTAL_STEPS = 9;

  // ── Step 1: Bot name ─────────────────────────────────────────
  step(1, TOTAL_STEPS, 'Companion name');
  info('What should your AI companion be called?');
  const botName = await input({
    message: 'Companion name',
    default: 'Fabiana',
  });

  // ── Step 2: User name ─────────────────────────────────────────
  step(2, TOTAL_STEPS, 'Your name');
  info(`How should ${botName} address you?`);
  const userName = await input({
    message: 'Your name',
    validate: (v: string) => v.trim().length > 0 || 'Please enter your name',
  });

  // ── Step 3: Personality tone ──────────────────────────────────
  step(3, TOTAL_STEPS, 'Personality & tone');
  info(`Choose how ${botName} should communicate with you.`);
  const toneKey = (await select({
    message: 'Communication style',
    choices: (Object.keys(TONES) as ToneKey[]).map((key) => ({
      value: key,
      name: `${TONES[key].label} — ${TONES[key].description.split('—')[1]?.trim() ?? ''}`,
    })),
  })) as ToneKey;
  const tone = TONES[toneKey];

  // ── Step 4: Provider ──────────────────────────────────────────
  step(4, TOTAL_STEPS, 'AI Provider');
  info('Which provider do you want to use?');
  const providerId = await select<string>({
    message: 'Provider',
    choices: providers.map((p) => ({
      value: p.id,
      name: `${p.name} — ${p.description}`,
    })),
  });
  const provider = providers.find((p) => p.id === providerId)!;

  // ── Step 5: Model ─────────────────────────────────────────────
  step(5, TOTAL_STEPS, 'Model');
  info(`Choose a model from ${provider.name}, or enter a custom ID.`);
  const MODEL_CUSTOM = '__custom__';
  const modelChoice = await select<string>({
    message: 'Model',
    choices: [
      ...provider.models.map((m) => ({ value: m.id, name: `${m.name}  ${chalk.dim(m.id)}` })),
      { value: MODEL_CUSTOM, name: chalk.italic('Enter model ID manually...') },
    ],
  });

  let modelId = modelChoice;
  if (modelChoice === MODEL_CUSTOM) {
    modelId = await input({
      message: 'Model ID',
      validate: (v: string) => v.trim().length > 0 || 'Please enter a model ID',
    });
  }

  // ── Step 6: Channel ───────────────────────────────────────────
  step(6, TOTAL_STEPS, 'Messaging channel');
  info('Which channel should Fabiana use to reach you?');
  const channelChoice = await select<'telegram' | 'slack' | 'both'>({
    message: 'Channel',
    choices: [
      { value: 'telegram', name: 'Telegram (recommended)' },
      { value: 'slack', name: 'Slack' },
      { value: 'both', name: 'Both' },
    ],
  });

  let slackOwnerId = '';
  if (channelChoice === 'slack' || channelChoice === 'both') {
    slackOwnerId = await input({
      message: 'Your Slack member ID (e.g. U012AB3CD)',
      validate: (v: string) => v.trim().length > 0 || 'Required for Slack',
    });
  }

  // ── Step 7: Active hours ──────────────────────────────────────
  step(7, TOTAL_STEPS, 'Active hours');
  info(`When is ${botName} allowed to send proactive messages?`);
  const activeStart = await input({
    message: 'Active from (hour, 0–23)',
    default: '9',
    validate: (v: string) => {
      const n = parseInt(v, 10);
      return (!isNaN(n) && n >= 0 && n <= 23) || 'Enter a number between 0 and 23';
    },
  });
  const activeEnd = await input({
    message: 'Active until (hour, 0–23)',
    default: '22',
    validate: (v: string) => {
      const n = parseInt(v, 10);
      return (!isNaN(n) && n >= 0 && n <= 23) || 'Enter a number between 0 and 23';
    },
  });

  // ── Step 8: Plugins ───────────────────────────────────────────
  step(8, TOTAL_STEPS, 'Plugins');
  info('Which plugins would you like to enable?');
  const enabledPlugins = await checkbox({
    message: 'Plugins',
    choices: AVAILABLE_PLUGINS,
  });

  // ── Step 9: Confirm ───────────────────────────────────────────
  step(9, TOTAL_STEPS, 'Review & generate');
  console.log();
  console.log(`  ${chalk.bold('Companion:')}  ${botName}`);
  console.log(`  ${chalk.bold('Your name:')} ${userName}`);
  console.log(`  ${chalk.bold('Tone:')}       ${tone.label}`);
  console.log(`  ${chalk.bold('Provider:')}   ${provider.name}`);
  console.log(`  ${chalk.bold('Model:')}      ${modelId}`);
  console.log(`  ${chalk.bold('Channel:')}    ${channelChoice}`);
  console.log(`  ${chalk.bold('Hours:')}      ${activeStart}:00 – ${activeEnd}:00`);
  console.log(`  ${chalk.bold('Plugins:')}    ${enabledPlugins.length > 0 ? enabledPlugins.join(', ') : 'none'}`);
  console.log();

  const confirmed = await confirm({ message: 'Generate configuration?', default: true });
  if (!confirmed) {
    console.log(chalk.yellow('\n  Setup cancelled. Run `fabiana init` to start again.\n'));
    process.exit(0);
  }

  // ── Generate files ────────────────────────────────────────────
  header('Generating configuration...');

  const templateVars: Record<string, string> = {
    bot_name: botName,
    user_name: userName,
    tone_description: tone.description,
    tone_personality: tone.personality,
    tone_style_guidance: tone.styleGuidance,
    tone_chat_style: tone.chatStyle,
    tone_chat_guidance: tone.chatGuidance,
  };

  await fs.mkdir('.fabiana/config', { recursive: true });
  await fs.mkdir('.fabiana/data/memory/recent', { recursive: true });
  await fs.mkdir('.fabiana/data/memory/people', { recursive: true });
  await fs.mkdir('.fabiana/data/memory/dates', { recursive: true });
  await fs.mkdir('.fabiana/data/memory/interests', { recursive: true });
  await fs.mkdir('.fabiana/data/memory/diary', { recursive: true });
  await fs.mkdir('.fabiana/data/agent-todo/pending', { recursive: true });
  await fs.mkdir('.fabiana/data/agent-todo/scheduled', { recursive: true });
  await fs.mkdir('.fabiana/data/agent-todo/completed', { recursive: true });
  await fs.mkdir('.fabiana/data/logs', { recursive: true });
  await fs.mkdir('.fabiana/data/sessions', { recursive: true });

  // config.json
  const config = {
    version: '0.1.0',
    model: {
      provider: providerId,
      modelId,
      thinkingLevel: 'low',
    },
    limits: {
      maxCostPerSession: 1.0,
      maxSessionDuration: 180,
    },
    channels: {
      primary: channelChoice === 'both' ? 'telegram' : channelChoice,
      telegram: { enabled: channelChoice === 'telegram' || channelChoice === 'both' },
      slack: {
        enabled: channelChoice === 'slack' || channelChoice === 'both',
        ownerUserId: slackOwnerId,
      },
    },
    initiative: {
      enabled: true,
      minHoursBetweenMessages: 4,
      activeHoursStart: parseInt(activeStart, 10),
      activeHoursEnd: parseInt(activeEnd, 10),
      checkIntervalMinutes: 30,
    },
    memory: {
      consolidateAt: '00:00',
    },
  };
  await fs.writeFile('.fabiana/config/config.json', JSON.stringify(config, null, 2));
  success('Config: .fabiana/config/config.json');

  // manifest.json
  const manifest = {
    version: '0.1.0',
    description: 'Fabiana permission manifest - controls what the agent can read/write',
    permissions: {
      readonly: ['.fabiana/config/**', 'src/**', 'package.json', 'tsconfig.json'],
      writable: ['.fabiana/data/memory/**', '.fabiana/data/agent-todo/**'],
      appendonly: ['.fabiana/data/logs/**'],
    },
  };
  await fs.writeFile('.fabiana/config/manifest.json', JSON.stringify(manifest, null, 2));
  success('Permissions: .fabiana/config/manifest.json');

  // plugins.json
  const pluginsConfig: Record<string, { enabled: boolean; [key: string]: unknown }> = {};
  for (const p of AVAILABLE_PLUGINS) {
    pluginsConfig[p.value] = { enabled: enabledPlugins.includes(p.value) };
  }
  if (pluginsConfig['calendar']) {
    pluginsConfig['calendar'].lookAheadHours = 24;
    pluginsConfig['calendar'].meetingPrepMinutesBefore = 60;
  }
  await fs.writeFile('.fabiana/config/plugins.json', JSON.stringify(pluginsConfig, null, 2));
  success('Plugins: .fabiana/config/plugins.json');

  // system prompts
  await fs.writeFile('.fabiana/config/system.md', fillTemplate(systemPromptTemplate, templateVars));
  success('System prompt: .fabiana/config/system.md');

  await fs.writeFile('.fabiana/config/system-chat.md', fillTemplate(systemChatTemplate, templateVars));
  success('Chat mode: .fabiana/config/system-chat.md');

  await fs.writeFile(
    '.fabiana/config/system-initiative.md',
    fillTemplate(systemInitiativeTemplate, templateVars)
  );
  success('Initiative mode: .fabiana/config/system-initiative.md');

  await fs.writeFile(
    '.fabiana/config/system-consolidate.md',
    fillTemplate(systemConsolidateTemplate, templateVars)
  );
  success('Consolidation mode: .fabiana/config/system-consolidate.md');

  await fs.writeFile('.fabiana/config/system-external.md', fillTemplate(systemExternalTemplate, templateVars));
  success('External mode: .fabiana/config/system-external.md');

  // seed identity.md
  const today = new Date().toISOString().split('T')[0];
  const identityContent = `# Identity\n\n- [${today}] Name: ${userName}\n`;
  await fs.writeFile('.fabiana/data/memory/identity.md', identityContent);

  // seed core.md
  const coreContent = `# Core State\n\nlast_message_sent: never\nactive_threads: []\nnotes: ${botName} initialized on ${today}\n`;
  await fs.writeFile('.fabiana/data/memory/core.md', coreContent);

  // seed this-week.md
  await fs.writeFile('.fabiana/data/memory/recent/this-week.md', `# This Week\n\n- [${today}] ${botName} initialized.\n`);

  success('Memory initialized: .fabiana/data/memory/');

  // ── API key instructions ───────────────────────────────────────
  header('API Key Setup');

  if (provider.envVar) {
    console.log(`  Create a ${chalk.bold('.env')} file in this directory:\n`);
    console.log(chalk.bgBlack.white(`    ${provider.envVar}=your_key_here\n`));
    console.log(`  ${chalk.dim(provider.authNote)}\n`);
  } else {
    console.log(`  ${chalk.bold('No API key needed.')} ${provider.authNote}\n`);
  }

  if (channelChoice === 'telegram' || channelChoice === 'both') {
    if (provider.envVar) {
      console.log(`  Also add your Telegram credentials to ${chalk.bold('.env')}:\n`);
    } else {
      console.log(`  Add your Telegram credentials to ${chalk.bold('.env')}:\n`);
    }
    console.log(chalk.bgBlack.white('    TELEGRAM_BOT_TOKEN=your_token_here'));
    console.log(chalk.bgBlack.white('    TELEGRAM_CHAT_ID=your_chat_id_here\n'));
    console.log(chalk.dim('  Create a bot via @BotFather on Telegram to get your token.'));
    console.log(chalk.dim('  Get your chat ID by messaging @userinfobot.\n'));
  }

  if (channelChoice === 'slack' || channelChoice === 'both') {
    console.log(`  Also add your Slack credentials to ${chalk.bold('.env')}:\n`);
    console.log(chalk.bgBlack.white('    SLACK_BOT_TOKEN=xoxb-...\n'));
    console.log(chalk.dim('  Create a Slack app at api.slack.com/apps and install it to your workspace.\n'));
  }

  // ── Done ──────────────────────────────────────────────────────
  header('All done!');
  console.log(`  ${chalk.bold(botName)} is ready. Start with:\n`);
  console.log(chalk.bold.cyan('    fabiana start\n'));
  console.log(chalk.dim('  Or run a one-time initiative check:\n'));
  console.log(chalk.dim('    fabiana initiative\n'));
}
