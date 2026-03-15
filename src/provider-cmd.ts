import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import { providers } from './data/providers.js';
import { paths } from './paths.js';

interface Config {
  model: { provider: string; modelId: string; thinkingLevel: string };
  [key: string]: unknown;
}

async function readConfig(): Promise<Config> {
  const content = await fs.readFile(paths.configJson, 'utf-8');
  return JSON.parse(content);
}

async function writeConfig(cfg: Config): Promise<void> {
  await fs.writeFile(paths.configJson, JSON.stringify(cfg, null, 2));
}

function code(line: string) {
  console.log('  ' + chalk.bgBlack.greenBright('  ' + line + '  '));
}

function ok(msg: string) {
  console.log(chalk.green('  ✓ ') + msg);
}

export async function providerStatus(): Promise<void> {
  let cfg: Config;
  try {
    cfg = await readConfig();
  } catch {
    console.log(chalk.red('\n  Config not found. Run fabiana init first.\n'));
    return;
  }

  const currentProvider = providers.find(p => p.id === cfg.model.provider);

  console.log();
  console.log(
    `  ${chalk.bold('Active')}  ${chalk.cyan(currentProvider?.name ?? cfg.model.provider)} / ${chalk.cyan(cfg.model.modelId)}`
  );
  console.log();
  console.log(chalk.dim('  Provider                    Env Var                  Status'));
  console.log(chalk.dim('  ' + '─'.repeat(66)));

  for (const p of providers) {
    const isActive = p.id === cfg.model.provider;
    const bullet = isActive ? chalk.cyan('→') : ' ';
    const namePad = ' '.repeat(Math.max(1, 28 - p.name.length));
    const nameStr = isActive ? chalk.bold.cyan(p.name) : p.name;

    let envCol: string;
    let statusStr: string;
    if (!p.envVar) {
      envCol = chalk.dim('—') + ' '.repeat(25);
      statusStr = chalk.dim('no key needed');
    } else {
      const isSet = !!process.env[p.envVar];
      const envPad = ' '.repeat(Math.max(1, 25 - p.envVar.length));
      envCol = chalk.dim(p.envVar) + envPad;
      statusStr = isSet ? chalk.green('✓ configured') : chalk.dim('✗ not set');
    }

    console.log(`  ${bullet} ${nameStr}${namePad}${envCol}${statusStr}`);
  }

  console.log();
  console.log(chalk.dim('  fabiana provider use    — switch active provider'));
  console.log(chalk.dim('  fabiana provider add    — show credential setup instructions'));
  console.log();
}

export async function providerUse(): Promise<void> {
  let cfg: Config;
  try {
    cfg = await readConfig();
  } catch {
    console.log(chalk.red('\n  Config not found. Run fabiana init first.\n'));
    return;
  }

  console.log();

  const providerId = await select<string>({
    message: 'Choose provider',
    choices: providers.map(p => ({
      value: p.id,
      name: `${p.id === cfg.model.provider ? '→ ' : '  '}${p.name}  ${chalk.dim(p.description)}`,
    })),
  });

  const provider = providers.find(p => p.id === providerId)!;

  const MODEL_CUSTOM = '__custom__';
  const modelChoice = await select<string>({
    message: `Choose a model for ${provider.name}`,
    choices: [
      ...provider.models.map(m => ({
        value: m.id,
        name: `${m.name}  ${chalk.dim(m.id)}`,
      })),
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

  cfg.model.provider = providerId;
  cfg.model.modelId = modelId;
  await writeConfig(cfg);

  console.log();
  ok(`Provider: ${chalk.cyan(provider.name)}`);
  ok(`Model:    ${chalk.cyan(modelId)}`);

  // Warn if env var is missing
  if (provider.envVar && !process.env[provider.envVar]) {
    console.log();
    console.log(chalk.yellow(`  ⚠  ${provider.envVar} is not set.`));
    console.log(chalk.dim(`  Run fabiana provider add to see setup instructions.`));
  }

  console.log(chalk.dim('\n  Restart the daemon for the change to take effect.\n'));
}

export async function providerAdd(): Promise<void> {
  console.log();

  const providerId = await select<string>({
    message: 'Which provider do you want to set up?',
    choices: providers.map(p => ({
      value: p.id,
      name: `${p.name}  ${chalk.dim('— ' + p.description)}`,
    })),
  });

  const provider = providers.find(p => p.id === providerId)!;
  const envPath = paths.envFile;
  const shell = process.env.SHELL ?? '';
  const rcFile = shell.includes('zsh') ? '~/.zshrc' : '~/.bashrc';

  console.log();

  if (!provider.envVar) {
    console.log(`  ${chalk.bold(provider.name)} requires no API key.`);
    console.log(chalk.dim(`  ${provider.authNote}\n`));
    return;
  }

  if (process.env[provider.envVar]) {
    console.log(chalk.green(`  ✓ ${provider.envVar} is already set.\n`));
    return;
  }

  console.log(`  ${chalk.bold(provider.name)} requires ${chalk.cyan(provider.envVar)}.`);
  console.log(chalk.dim(`  ${provider.authNote}\n`));

  console.log(`  ${chalk.bold('Option 1')} ${chalk.dim('— permanent (recommended)')}`);
  console.log(`  Add to ${chalk.bold(rcFile)}, then restart your shell:\n`);
  code(`export ${provider.envVar}=your_api_key_here`);

  console.log(`\n  ${chalk.bold('Option 2')} ${chalk.dim('— .env file')}`);
  console.log(`  Add to ${chalk.bold(envPath)}:\n`);
  code(`${provider.envVar}=your_api_key_here`);

  console.log(`\n  ${chalk.bold('Option 3')} ${chalk.dim('— per-session only')}`);
  console.log('  Run in your terminal before starting Fabiana:\n');
  code(`export ${provider.envVar}=your_api_key_here`);
  console.log();
}
