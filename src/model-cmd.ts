import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  DefaultResourceLoader,
  SessionManager,
  type AgentSessionEvent,
} from '@mariozechner/pi-coding-agent';
import { getModel } from '@mariozechner/pi-ai';
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

function ok(msg: string) { console.log(chalk.green('  ✓ ') + msg); }
function warn(msg: string) { console.log(chalk.yellow('  ⚠  ') + msg); }
function fail(msg: string) { console.log(chalk.red('  ✗ ') + msg); }

export async function modelStatus(): Promise<void> {
  let cfg: Config;
  try {
    cfg = await readConfig();
  } catch {
    console.log(chalk.red('\n  Config not found. Run fabiana init first.\n'));
    return;
  }

  const { provider, modelId, thinkingLevel } = cfg.model;
  const providerData = providers.find(p => p.id === provider);

  console.log();
  console.log(`  ${chalk.bold('Provider')}    ${chalk.cyan(providerData?.name ?? provider)}`);
  console.log(`  ${chalk.bold('Model')}       ${chalk.cyan(modelId)}`);
  console.log(`  ${chalk.bold('Thinking')}    ${chalk.dim(thinkingLevel ?? 'low')}`);

  if (providerData?.envVar) {
    const isSet = !!process.env[providerData.envVar];
    const status = isSet ? chalk.green('✓ set') : chalk.red('✗ not set');
    console.log(`  ${chalk.bold('API Key')}     ${chalk.dim(providerData.envVar)} — ${status}`);
  } else {
    console.log(`  ${chalk.bold('Auth')}        ${chalk.dim('no API key required')}`);
  }

  console.log();
  console.log(chalk.dim('  fabiana model use     — switch model'));
  console.log(chalk.dim('  fabiana model test    — live connection test'));
  console.log();
}

export async function modelUse(): Promise<void> {
  let cfg: Config;
  try {
    cfg = await readConfig();
  } catch {
    console.log(chalk.red('\n  Config not found. Run fabiana init first.\n'));
    return;
  }

  const providerData = providers.find(p => p.id === cfg.model.provider);
  if (!providerData) {
    console.log(chalk.red(`\n  Unknown provider: ${cfg.model.provider}. Run fabiana provider use to fix this.\n`));
    return;
  }

  console.log();
  console.log(chalk.dim(`  Current: ${cfg.model.provider} / ${cfg.model.modelId}`));
  console.log();

  const MODEL_CUSTOM = '__custom__';
  const modelChoice = await select<string>({
    message: `Model for ${providerData.name}`,
    choices: [
      ...providerData.models.map(m => ({
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

  cfg.model.modelId = modelId;
  await writeConfig(cfg);

  console.log();
  ok(`Model set to ${chalk.cyan(modelId)}`);
  console.log(chalk.dim('\n  Restart the daemon for the change to take effect.\n'));
}

export async function modelTest(): Promise<void> {
  let cfg: Config;
  try {
    cfg = await readConfig();
  } catch {
    console.log(chalk.red('\n  Config not found. Run fabiana init first.\n'));
    return;
  }

  const { provider, modelId } = cfg.model;
  const providerData = providers.find(p => p.id === provider);

  console.log();
  console.log(`  Testing ${chalk.cyan(providerData?.name ?? provider)} / ${chalk.cyan(modelId)}`);

  // Check env var before making the network call
  if (providerData?.envVar && !process.env[providerData.envVar]) {
    fail(`${providerData.envVar} is not set`);
    console.log(chalk.dim(`  Run fabiana provider add for setup instructions.\n`));
    return;
  }

  const model = getModel(provider as any, modelId);
  if (!model) {
    fail(`Model not found: ${provider}/${modelId}`);
    console.log(chalk.dim('  Check provider and model ID in your config.\n'));
    return;
  }

  process.stdout.write('  Sending ping... ');

  try {
    const authStorage = AuthStorage.create();
    const modelRegistry = new ModelRegistry(authStorage);
    const loader = new DefaultResourceLoader({
      cwd: process.cwd(),
      systemPromptOverride: () => "You are a test assistant. Respond only with the word 'pong'.",
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

    let response = '';
    session.subscribe((event: AgentSessionEvent) => {
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
        response += event.assistantMessageEvent.delta;
      }
    });

    const start = Date.now();
    await session.prompt('ping');
    await session.agent.waitForIdle();
    const elapsed = Date.now() - start;

    process.stdout.write('\r');
    if (response.trim()) {
      ok(`${elapsed}ms — ${chalk.dim('"' + response.trim().slice(0, 80) + '"')}`);
    } else {
      warn(`Connected but received empty response (${elapsed}ms)`);
    }
  } catch (e: any) {
    process.stdout.write('\r');
    fail(e.message ?? String(e));
  }

  console.log();
}
