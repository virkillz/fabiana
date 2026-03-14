import fs from 'fs/promises';
import path from 'path';
import { paths, PLUGINS_DIR, DATA_DIR } from './paths.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { getModel } from '@mariozechner/pi-ai';
import { AuthStorage, ModelRegistry } from '@mariozechner/pi-coding-agent';

const execFileAsync = promisify(execFile);

// ─── Output helpers ───────────────────────────────────────────────────────────

let totalFails = 0;
let totalWarns = 0;

function pass(label: string, note = '') {
  const text = note ? `${label} ${chalk.dim(`(${note})`)}` : label;
  console.log(`  ${chalk.green('✓')} ${text}`);
}

function advisory(label: string, hint = '') {
  const text = hint ? `${label} ${chalk.dim(`— ${hint}`)}` : label;
  console.log(`  ${chalk.yellow('⚠')} ${text}`);
  totalWarns++;
}

function error(label: string, hint = '') {
  const text = hint ? `${label} ${chalk.dim(`— ${hint}`)}` : label;
  console.log(`  ${chalk.red('✗')} ${text}`);
  totalFails++;
}

function section(title: string) {
  console.log(`\n${chalk.bold(title)}`);
}

// ─── Checks ──────────────────────────────────────────────────────────────────

async function checkEnvironment() {
  section('Environment');

  const [major] = process.versions.node.split('.').map(Number);
  if (major >= 22) {
    pass(`Node ${process.versions.node}`);
  } else {
    error(`Node ${process.versions.node}`, 'requires ≥22');
  }

  try {
    await fs.access(paths.envFile);
    pass('.env file found');
  } catch {
    advisory('.env file not found', 'env vars must be set via export or shell profile');
  }

  // Read config to know which env vars are actually required
  let providerEnvVar: string | null = null;
  let telegramEnabled = true;
  let slackEnabled = false;

  try {
    const raw = await fs.readFile(paths.configJson, 'utf-8');
    const cfg = JSON.parse(raw);
    telegramEnabled = cfg.channels?.telegram?.enabled ?? true;
    slackEnabled = cfg.channels?.slack?.enabled ?? false;

    // Look up env var for this provider
    const { providers } = await import('./data/providers.js');
    const p = providers.find((p) => p.id === cfg.model?.provider);
    providerEnvVar = p?.envVar ?? null;
  } catch {
    // Config not found — fall through, checkConfig() will report it
  }

  if (providerEnvVar) {
    if (process.env[providerEnvVar]) {
      pass(providerEnvVar);
    } else {
      error(providerEnvVar, 'not set');
    }
  }

  if (telegramEnabled) {
    for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']) {
      if (process.env[key]) {
        pass(key);
      } else {
        error(key, 'not set');
      }
    }
  }

  if (slackEnabled) {
    if (process.env['SLACK_BOT_TOKEN']) {
      pass('SLACK_BOT_TOKEN');
    } else {
      error('SLACK_BOT_TOKEN', 'not set');
    }
  }
}

async function checkConfig() {
  section('Configuration');

  try {
    const raw = await fs.readFile(paths.configJson, 'utf-8');
    const cfg = JSON.parse(raw);
    pass(paths.configJson, `model: ${cfg.model?.provider}/${cfg.model?.modelId}`);
  } catch (e: any) {
    error(paths.configJson, 'not found — run `fabiana init` to set up');
  }

  try {
    const raw = await fs.readFile(paths.manifestJson, 'utf-8');
    JSON.parse(raw);
    pass(paths.manifestJson);
  } catch (e: any) {
    error(paths.manifestJson, e.message);
  }

  for (const file of [
    paths.systemMd(),
    paths.systemMd('chat'),
    paths.systemMd('initiative'),
    paths.systemMd('consolidate'),
  ]) {
    try {
      const stat = await fs.stat(file);
      pass(path.basename(file), `${stat.size} bytes`);
    } catch {
      error(file, 'not found');
    }
  }
}

async function checkPiSdk() {
  section('Pi SDK');

  let modelId = 'unknown';
  try {
    const raw = await fs.readFile(paths.configJson, 'utf-8');
    const cfg = JSON.parse(raw);
    modelId = `${cfg.model?.provider}/${cfg.model?.modelId}`;
    const model = getModel(cfg.model?.provider, cfg.model?.modelId);
    if (!model) {
      error(`Model not found: ${modelId}`);
      return;
    }
    pass(`Model resolved: ${modelId}`);
  } catch (e: any) {
    error(`Model check failed (${modelId})`, e.message);
    return;
  }

  try {
    AuthStorage.create();
    new ModelRegistry(AuthStorage.create());
    pass('AuthStorage + ModelRegistry initialized');
  } catch (e: any) {
    error('Pi SDK initialization failed', e.message);
  }
}

async function checkTelegram() {
  section('Telegram');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    advisory('Skipped', 'TELEGRAM_BOT_TOKEN not set');
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json() as any;
    if (data.ok) {
      pass(`Connected as @${data.result.username}`, data.result.first_name);
    } else {
      error('Bot API error', data.description ?? 'unknown error');
    }
  } catch (e: any) {
    error('Telegram unreachable', e.message);
  }
}

async function checkExternalTools() {
  section('External Tools');

  try {
    const { stdout } = await execFileAsync('gccli', ['--version'], { timeout: 5000 });
    pass(`gccli ${stdout.trim()}`);
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      advisory('gccli not installed', 'calendar plugin will not work — npm install -g @mariozechner/gccli');
    } else {
      pass('gccli found');
    }
  }
}

async function checkPlugins() {
  section('Plugins');

  const pluginsConfigPath = paths.pluginsJson;
  type PluginsConfig = Record<string, Record<string, unknown>>;
  let pluginsConfig: PluginsConfig = {};
  let hasConfig = false;

  try {
    const raw = await fs.readFile(pluginsConfigPath, 'utf-8');
    pluginsConfig = JSON.parse(raw);
    hasConfig = true;
  } catch {
    // No plugins.json — all plugins enabled by default
  }

  try {
    await fs.access(PLUGINS_DIR);
  } catch {
    advisory('No plugins/ directory found');
    return;
  }

  const entries = await fs.readdir(PLUGINS_DIR, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  if (dirs.length === 0) {
    advisory('No plugins found');
    return;
  }

  for (const dir of dirs) {
    const pluginCfg = pluginsConfig[dir];
    const isEnabled = !hasConfig || (pluginCfg !== undefined && pluginCfg.enabled !== false);

    const tsPath = path.join(PLUGINS_DIR, dir, 'index.ts');
    const jsPath = path.join(PLUGINS_DIR, dir, 'index.js');

    let entryPath: string | null = null;
    for (const p of [tsPath, jsPath]) {
      try { await fs.access(p); entryPath = p; break; } catch { /* try next */ }
    }

    if (!entryPath) {
      error(dir, 'no index.ts or index.js found');
      continue;
    }

    try {
      const mod = await import(path.resolve(entryPath));
      const toolName: string = mod.tool?.name ?? dir;
      const version: string = mod.metadata?.version ? `v${mod.metadata.version}` : '';
      const label = `${toolName} ${version}`.trim();

      if (!mod.tool) {
        error(dir, 'missing `export const tool`');
        continue;
      } else if (!mod.tool.execute) {
        error(dir, 'tool.execute not defined');
        continue;
      } else if (!isEnabled) {
        advisory(label, `disabled in ${chalk.cyan(pluginsConfigPath)}`);
        continue;
      } else {
        pass(label);
      }

      // Check env vars declared in plugin.json
      const manifestPath = path.join(PLUGINS_DIR, dir, 'plugin.json');
      try {
        const raw = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(raw);
        for (const envVar of (manifest.env ?? [])) {
          if (process.env[envVar.key]) {
            pass(`  ${envVar.key}`);
          } else if (envVar.required) {
            error(`  ${envVar.key}`, envVar.description);
          } else {
            advisory(`  ${envVar.key} not set`, envVar.description);
          }
        }
      } catch {
        // No plugin.json — skip env checks
      }

    } catch (e: any) {
      error(dir, e.message);
    }
  }
}

async function checkDataDirectories() {
  section('Data Directories');

  const required = [
    path.join(DATA_DIR, 'memory'),
    path.join(DATA_DIR, 'agent-todo', 'pending'),
    path.join(DATA_DIR, 'agent-todo', 'scheduled'),
    path.join(DATA_DIR, 'agent-todo', 'completed'),
    path.join(DATA_DIR, 'logs'),
  ];

  for (const dir of required) {
    try {
      await fs.access(dir);
      pass(dir);
    } catch {
      advisory(dir, 'missing — will be created on first run');
    }
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function runDoctor(): Promise<void> {
  console.log(`\n${chalk.magenta('🌸 Fabiana Doctor')}`);
  console.log(chalk.dim('━'.repeat(50)));

  await checkEnvironment();
  await checkConfig();
  await checkPiSdk();
  await checkTelegram();
  await checkExternalTools();
  await checkPlugins();
  await checkDataDirectories();

  console.log(`\n${chalk.dim('━'.repeat(50))}`);

  if (totalFails > 0) {
    const errPart = chalk.red(`${totalFails} error(s)`);
    const warnPart = totalWarns > 0 ? `, ${chalk.yellow(`${totalWarns} warning(s)`)}` : '';
    console.log(`${chalk.red('✗')} ${errPart}${warnPart} — fix the errors above before starting Fabiana`);
    process.exit(1);
  } else if (totalWarns > 0) {
    console.log(`${chalk.yellow('⚠')} ${chalk.yellow(`${totalWarns} warning(s)`)} — Fabiana will start but some features may not work`);
    console.log(`\n  ${chalk.bold('Ready to go:')}  fabiana start`);
  } else {
    console.log(`${chalk.green('✓')} ${chalk.green('All checks passed')} — Fabiana is ready!`);
    console.log(`\n  ${chalk.bold('Start her up:')}  ${chalk.cyan('fabiana start')}`);
  }

  console.log('');
}
