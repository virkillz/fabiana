import { input, select, checkbox, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { providers } from '../data/providers.js';
import { paths, PLUGINS_DIR, CONFIG_DIR, DATA_DIR, BUNDLED_PLUGINS_DIR, PACKAGE_ROOT } from '../paths.js';
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
    styleGuidance:
      '- Speak like a friend texting, not a service responding\n- Contractions and casual language are welcome\n- Humor and warmth should come through naturally',
    chatStyle: 'warm and natural',
    chatGuidance: '- Talk like a close friend, not a customer support agent',
  },
  'witty-playful': {
    label: 'Witty & Playful',
    description: 'witty, playful, and full of personality — fun to talk to, genuinely caring underneath',
    personality: 'Playful, clever, warm underneath the humor — light banter is always welcome',
    styleGuidance:
      '- Jokes and wordplay are welcome\n- Keep it fun and light, but drop the humor when things get serious\n- Be memorable — not just helpful',
    chatStyle: 'playful and fun',
    chatGuidance: '- Banter is welcome. Be fun. But when it matters, drop the jokes and be real.',
  },
  professional: {
    label: 'Professional',
    description: 'professional and supportive — efficient and helpful without being overly familiar',
    personality: 'Professional, clear, supportive — helpful without being chatty',
    styleGuidance:
      "- Keep things direct and efficient\n- Friendly, but focused — avoid slang and overly casual language\n- Match the human's tone rather than imposing your own",
    chatStyle: 'professional and direct',
    chatGuidance: '- Be clear, direct, and helpful — avoid filler and small talk unless they initiate it',
  },
  formal: {
    label: 'Formal',
    description: 'formal and respectful — precise, measured, and thoroughly considerate',
    personality: 'Formal, polished, respectful — precise language and complete thoughts',
    styleGuidance:
      '- Use complete sentences\n- Avoid contractions and casual expressions\n- Be thorough and polished in all communications',
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

function hr() {
  console.log('\n' + chalk.magenta('─'.repeat(56)));
}

function header(text: string) {
  hr();
  console.log(chalk.bold.white(text));
  console.log(chalk.magenta('─'.repeat(56)));
}

function step(n: number, total: number, label: string) {
  console.log(`\n${chalk.dim(`[${n}/${total}]`)} ${chalk.bold(label)}`);
}

function ok(msg: string) {
  console.log(chalk.green('  ✓ ') + msg);
}

function hint(msg: string) {
  console.log(chalk.dim('  ' + msg));
}

function code(line: string) {
  console.log('  ' + chalk.bgBlack.greenBright('  ' + line + '  '));
}

function note(label: string, value: string) {
  console.log(`  ${chalk.bold(label.padEnd(12))} ${value}`);
}

export async function runSetup(): Promise<void> {
  console.clear();
  console.log(chalk.bold.magenta('\n  ✦  Welcome to Fabiana'));
  console.log(chalk.dim("  Your AI companion is almost alive. Let's make it yours.\n"));

  const TOTAL_STEPS = 9;

  // ── Step 1: Bot name ──────────────────────────────────────────
  step(1, TOTAL_STEPS, 'Give your companion a name');
  hint("Default is Fabiana, but she won't mind if you rename her. (She's very secure like that.)");
  const botName = await input({
    message: 'Companion name',
    default: 'Fabiana',
  });

  // ── Step 2: Your name ─────────────────────────────────────────
  step(2, TOTAL_STEPS, 'And yours?');
  hint(`${botName} needs to know who she's talking to — first name is fine.`);
  const userName = await input({
    message: 'Your name',
    validate: (v: string) => v.trim().length > 0 || 'Come on, even a nickname works.',
  });

  // ── Step 3: Personality tone ──────────────────────────────────
  step(3, TOTAL_STEPS, 'Pick a vibe');
  hint(`How should ${botName} talk to you? You can always edit the system prompt later.`);
  const toneKey = (await select({
    message: 'Communication style',
    choices: (Object.keys(TONES) as ToneKey[]).map((key) => ({
      value: key,
      name: `${TONES[key].label} — ${TONES[key].description.split('—')[1]?.trim() ?? ''}`,
    })),
  })) as ToneKey;
  const tone = TONES[toneKey];

  // ── Step 4: Provider ──────────────────────────────────────────
  step(4, TOTAL_STEPS, 'Choose your AI provider');
  hint("Don't have a key yet? OpenRouter is the easiest — one key, hundreds of models.");
  const providerId = await select<string>({
    message: 'Provider',
    choices: providers.map((p) => ({
      value: p.id,
      name: `${p.name} — ${p.description}`,
    })),
  });
  const provider = providers.find((p) => p.id === providerId)!;

  // ── Step 5: Model ─────────────────────────────────────────────
  step(5, TOTAL_STEPS, 'Pick a model');
  hint(`Suggested models for ${provider.name}. Not sure? The first one is a solid default.`);
  const MODEL_CUSTOM = '__custom__';
  const modelChoice = await select<string>({
    message: 'Model',
    choices: [
      ...provider.models.map((m) => ({ value: m.id, name: `${m.name}  ${chalk.dim(m.id)}` })),
      { value: MODEL_CUSTOM, name: chalk.italic('Enter a custom model ID...') },
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
  step(6, TOTAL_STEPS, 'Where should she reach you?');
  hint(`${botName} will message you here when she has something to say.`);
  const channelChoice = await select<'telegram' | 'slack' | 'both'>({
    message: 'Channel',
    choices: [
      { value: 'telegram', name: 'Telegram — private, fast, great for personal bots (recommended)' },
      { value: 'slack', name: 'Slack — good if you live in a workspace' },
      { value: 'both', name: 'Both — because why not' },
    ],
  });

  let slackOwnerId = '';
  if (channelChoice === 'slack' || channelChoice === 'both') {
    hint("Your Slack member ID — find it in your profile under 'More' → 'Copy member ID'.");
    slackOwnerId = await input({
      message: 'Your Slack member ID (e.g. U012AB3CD)',
      validate: (v: string) => v.trim().length > 0 || 'Required so Fabiana knows who the boss is.',
    });
  }

  // ── Step 7: Active hours ──────────────────────────────────────
  step(7, TOTAL_STEPS, 'Set her active hours');
  hint(`${botName} will only send proactive messages during this window. Don't let her wake you up at 3am.`);
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
  step(8, TOTAL_STEPS, 'Enable plugins');
  hint('These give her superpowers. Toggle with space, confirm with enter.');
  const enabledPlugins = await checkbox({
    message: 'Plugins',
    choices: AVAILABLE_PLUGINS,
  });

  // ── Step 9: Review & confirm ──────────────────────────────────
  step(9, TOTAL_STEPS, 'Review your setup');
  console.log();
  note('Companion:', botName);
  note('Your name:', userName);
  note('Tone:', tone.label);
  note('Provider:', provider.name);
  note('Model:', modelId);
  note('Channel:', channelChoice);
  note('Hours:', `${activeStart}:00 – ${activeEnd}:00`);
  note('Plugins:', enabledPlugins.length > 0 ? enabledPlugins.join(', ') : 'none');
  console.log();

  const confirmed = await confirm({ message: 'Looks good? Generate configuration?', default: true });
  if (!confirmed) {
    console.log(chalk.yellow('\n  No worries. Run `fabiana init` whenever you\'re ready.\n'));
    process.exit(0);
  }

  // ── Generate files ────────────────────────────────────────────
  header('Building your companion...');

  const templateVars: Record<string, string> = {
    bot_name: botName,
    user_name: userName,
    tone_description: tone.description,
    tone_personality: tone.personality,
    tone_style_guidance: tone.styleGuidance,
    tone_chat_style: tone.chatStyle,
    tone_chat_guidance: tone.chatGuidance,
  };

  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'memory', 'recent'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'memory', 'people'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'memory', 'dates'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'memory', 'interests'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'memory', 'diary'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'agent-todo', 'pending'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'agent-todo', 'scheduled'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'agent-todo', 'completed'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'logs'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'sessions'), { recursive: true });
  await fs.mkdir(PLUGINS_DIR, { recursive: true });

  // config
  const config = {
    version: '0.1.0',
    model: { provider: providerId, modelId, thinkingLevel: 'low' },
    limits: { maxCostPerSession: 1.0, maxSessionDuration: 180 },
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
    memory: { consolidateAt: '00:00' },
  };
  await fs.writeFile(paths.configJson, JSON.stringify(config, null, 2));
  ok(paths.configJson);

  // manifest — paths are relative to FABIANA_HOME (the PermissionValidator baseDir)
  const manifest = {
    version: '0.1.0',
    description: 'Fabiana permission manifest - controls what the agent can read/write',
    permissions: {
      readonly: ['config/**'],
      writable: ['data/memory/**', 'data/agent-todo/**'],
      appendonly: ['data/logs/**'],
    },
  };
  await fs.writeFile(paths.manifestJson, JSON.stringify(manifest, null, 2));
  ok(paths.manifestJson);

  // plugins.json
  const pluginsConfig: Record<string, { enabled: boolean; [key: string]: unknown }> = {};
  for (const p of AVAILABLE_PLUGINS) {
    pluginsConfig[p.value] = { enabled: enabledPlugins.includes(p.value) };
  }
  if (pluginsConfig['calendar']) {
    pluginsConfig['calendar'].lookAheadHours = 24;
    pluginsConfig['calendar'].meetingPrepMinutesBefore = 60;
  }
  await fs.writeFile(paths.pluginsJson, JSON.stringify(pluginsConfig, null, 2));
  ok(paths.pluginsJson);

  // system prompts
  const systemMdContent = fillTemplate(systemPromptTemplate, templateVars);
  const fileAccessSection = `
## Your Source Code

If ${userName} (or you) refers to "your codebase", "your source code", or "how you work", your source code is located at:
**\`${PACKAGE_ROOT}/\`**

You can read those files to understand your own capabilities and limitations.
`;
  await fs.writeFile(paths.systemMd(), systemMdContent + fileAccessSection);
  ok(paths.systemMd());
  await fs.writeFile(paths.systemMd('chat'), fillTemplate(systemChatTemplate, templateVars));
  ok(paths.systemMd('chat'));
  await fs.writeFile(paths.systemMd('initiative'), fillTemplate(systemInitiativeTemplate, templateVars));
  ok(paths.systemMd('initiative'));
  await fs.writeFile(paths.systemMd('consolidate'), fillTemplate(systemConsolidateTemplate, templateVars));
  ok(paths.systemMd('consolidate'));
  await fs.writeFile(paths.systemMd('external'), fillTemplate(systemExternalTemplate, templateVars));
  ok(paths.systemMd('external'));

  // seed memory
  const today = new Date().toISOString().split('T')[0];
  await fs.writeFile(paths.memory('identity.md'), `# Identity\n\n- [${today}] Name: ${userName}\n`);
  await fs.writeFile(
    paths.memory('core.md'),
    `# Core State\n\nlast_message_sent: never\nactive_threads: []\nnotes: ${botName} initialized on ${today}\n`
  );
  await fs.writeFile(
    paths.memory('recent', 'this-week.md'),
    `# This Week\n\n- [${today}] ${botName} initialized.\n`
  );
  ok(`${DATA_DIR}/memory/ (seeded)`);

  // state — tracks first-run intro
  await fs.writeFile(
    paths.stateJson,
    JSON.stringify({ introduced: false, userName, botName, toneKey }, null, 2)
  );
  ok(paths.stateJson);

  // copy bundled default plugins (skip any already installed)
  try {
    const bundledDirs = await fs.readdir(BUNDLED_PLUGINS_DIR, { withFileTypes: true });
    for (const entry of bundledDirs.filter(e => e.isDirectory())) {
      const dest = path.join(PLUGINS_DIR, entry.name);
      try {
        await fs.access(dest);
        // already exists — skip so user customisations are preserved
      } catch {
        await fs.cp(path.join(BUNDLED_PLUGINS_DIR, entry.name), dest, { recursive: true });
      }
    }
    ok(`${PLUGINS_DIR}/ (default plugins copied)`);
  } catch {
    // No bundled plugins dir — dev environment or stripped build, skip silently
  }

  // ── API key setup ─────────────────────────────────────────────
  const envPath = paths.envFile;
  const shell = process.env.SHELL ?? '';
  const rcFile = shell.includes('zsh') ? '~/.zshrc' : '~/.bashrc';

  // Collect all required env vars for this setup
  const requiredEnvVars: Array<{ key: string; placeholder: string; note: string }> = [];

  if (provider.envVar) {
    requiredEnvVars.push({
      key: provider.envVar,
      placeholder: 'your_api_key_here',
      note: provider.authNote,
    });
  }

  if (channelChoice === 'telegram' || channelChoice === 'both') {
    requiredEnvVars.push(
      { key: 'TELEGRAM_BOT_TOKEN', placeholder: 'your_bot_token', note: 'Create a bot via @BotFather on Telegram' },
      { key: 'TELEGRAM_CHAT_ID', placeholder: 'your_chat_id', note: 'Message @userinfobot on Telegram to get this' }
    );
  }

  if (channelChoice === 'slack' || channelChoice === 'both') {
    requiredEnvVars.push({
      key: 'SLACK_BOT_TOKEN',
      placeholder: 'xoxb-your-token',
      note: 'Create a Slack app at api.slack.com/apps',
    });
  }

  if (requiredEnvVars.length > 0) {
    header('Set up your API keys');

    console.log(`  ${botName} needs a few environment variables to come alive.\n`);
    console.log(`  ${chalk.bold('Required:')}`);
    for (const v of requiredEnvVars) {
      console.log(`    ${chalk.cyan(v.key)}`);
      console.log(`    ${chalk.dim('→ ' + v.note)}\n`);
    }

    console.log(`  ${chalk.bold('Option 1')} ${chalk.dim('— permanent, recommended')}`);
    console.log(`  Add to ${chalk.bold(rcFile)} then restart your shell:\n`);
    for (const v of requiredEnvVars) {
      code(`export ${v.key}=${v.placeholder}`);
    }

    console.log(`\n  ${chalk.bold('Option 2')} ${chalk.dim('— per-session only, good for testing')}`);
    console.log('  Run in your terminal before starting Fabiana:\n');
    for (const v of requiredEnvVars) {
      code(`export ${v.key}=${v.placeholder}`);
    }

    console.log(`\n  ${chalk.bold('Option 3')} ${chalk.dim('— .env file, simplest for local dev')}`);
    console.log(`  Create ${chalk.bold(envPath)}:\n`);
    for (const v of requiredEnvVars) {
      code(`${v.key}=${v.placeholder}`);
    }
  } else {
    header('No API keys needed');
    console.log(`  ${provider.authNote}\n`);
  }

  // ── What's next ───────────────────────────────────────────────
  header("You're almost there");

  console.log(`  ${chalk.bold('1.')} Set your environment variables (see above)\n`);

  console.log(`  ${chalk.bold('2.')} Verify everything looks right:\n`);
  code('fabiana doctor');

  console.log(`\n  ${chalk.bold('3.')} Start ${botName}:\n`);
  code('fabiana start');

  console.log(`\n  ${chalk.dim('Or run a single proactive check to test initiative mode:')}\n`);
  code('fabiana initiative');

  console.log(`\n  ${chalk.dim(`Config lives at: ${CONFIG_DIR}/`)}`);
  console.log(`  ${chalk.dim(`To customize the system prompt, edit: ${paths.systemMd()}`)}\n`);
}
