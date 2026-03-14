import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { loadPluginsConfig, savePluginsConfig } from './loaders/plugins.js';
import { PLUGINS_DIR, paths } from './paths.js';

const execFileAsync = promisify(execFile);

const PLUGINS_CONFIG_PATH = paths.pluginsJson;

interface PluginManifest {
  name: string;
  version?: string;
  description?: string;
  env?: Array<{ key: string; required: boolean; description: string }>;
  config?: Record<string, unknown>;
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationResult {
  ok: boolean;
  errors: string[];
}

async function validatePluginDir(dir: string): Promise<ValidationResult> {
  const errors: string[] = [];

  // Must have index.ts or index.js
  let hasEntry = false;
  for (const entry of ['index.ts', 'index.js']) {
    try {
      await fs.access(path.join(dir, entry));
      hasEntry = true;
      break;
    } catch { /* try next */ }
  }
  if (!hasEntry) {
    errors.push('Missing index.ts or index.js at repository root — this is the plugin entry point');
  }

  // Must have package.json with "type": "module"
  try {
    const raw = await fs.readFile(path.join(dir, 'package.json'), 'utf-8');
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(raw);
    } catch {
      errors.push('package.json is not valid JSON');
      return { ok: false, errors };
    }
    if (pkg.type !== 'module') {
      errors.push('package.json must have "type": "module" — Fabiana uses ESM');
    }
  } catch {
    errors.push('Missing package.json — must include at minimum: { "type": "module" }');
  }

  // Validate plugin.json structure if present
  try {
    const raw = await fs.readFile(path.join(dir, 'plugin.json'), 'utf-8');
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(raw);
    } catch {
      errors.push('plugin.json is not valid JSON');
      return { ok: false, errors };
    }
    if (typeof manifest.name !== 'string' || !manifest.name) {
      errors.push('plugin.json: "name" field is required and must be a string');
    }
    if (manifest.env !== undefined) {
      if (!Array.isArray(manifest.env)) {
        errors.push('plugin.json: "env" must be an array');
      } else {
        for (const [i, item] of (manifest.env as unknown[]).entries()) {
          const e = item as Record<string, unknown>;
          if (typeof e?.key !== 'string') errors.push(`plugin.json: env[${i}].key must be a string`);
          if (typeof e?.required !== 'boolean') errors.push(`plugin.json: env[${i}].required must be a boolean`);
          if (typeof e?.description !== 'string') errors.push(`plugin.json: env[${i}].description must be a string`);
        }
      }
    }
  } catch {
    // No plugin.json — optional, skip
  }

  return { ok: errors.length === 0, errors };
}

// ─── Build ────────────────────────────────────────────────────────────────────

async function buildPlugin(srcDir: string, destDir: string): Promise<void> {
  // Determine entry point (prefer TypeScript source)
  let entryFile: string;
  try {
    await fs.access(path.join(srcDir, 'index.ts'));
    entryFile = 'index.ts';
  } catch {
    entryFile = 'index.js';
  }

  // Install plugin's own deps if it has any
  const pluginPkgRaw = await fs.readFile(path.join(srcDir, 'package.json'), 'utf-8');
  const pluginPkg = JSON.parse(pluginPkgRaw) as Record<string, unknown>;
  const ownDeps = Object.keys({
    ...(pluginPkg.dependencies as object ?? {}),
    ...(pluginPkg.optionalDependencies as object ?? {}),
  });
  if (ownDeps.length > 0) {
    console.log(`  Installing ${ownDeps.length} plugin dependency(ies)...`);
    await execFileAsync('npm', ['install', '--omit=dev'], { cwd: srcDir, timeout: 60_000 });
  }

  // Load fabiana's own deps so we can mark them as external (they resolve from
  // fabiana's node_modules at runtime — no need to bundle them)
  const selfPkg = JSON.parse(
    await fs.readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8')
  ) as Record<string, unknown>;
  const external = Object.keys({
    ...(selfPkg.dependencies as object ?? {}),
    ...(selfPkg.devDependencies as object ?? {}),
  });

  await fs.mkdir(destDir, { recursive: true });

  const { build } = await import('esbuild');
  await build({
    entryPoints: [path.join(srcDir, entryFile)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: path.join(destDir, 'index.js'),
    external,
    absWorkingDir: srcDir,
    logLevel: 'silent',
  });
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export async function pluginsAdd(repo: string): Promise<void> {
  const parts = repo.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.error(chalk.red('✗ Invalid format. Use: fabiana plugins add username/reponame'));
    process.exit(1);
  }

  const [username, reponame] = parts;
  const pluginName = reponame;
  const destDir = path.join(PLUGINS_DIR, pluginName);
  const tmpDir = `/tmp/fabiana-plugin-${pluginName}-${Date.now()}`;
  let destCreated = false;

  console.log(`\n${chalk.bold('Installing plugin:')} ${chalk.cyan(repo)}`);

  // Check if already installed
  try {
    await fs.access(destDir);
    console.error(chalk.red(`✗ Plugin "${pluginName}" already exists at ${destDir}`));
    console.log(chalk.dim('  Remove the directory to reinstall'));
    process.exit(1);
  } catch { /* not found — proceed */ }

  try {
    // Clone from GitHub
    console.log(`  Cloning ${chalk.dim(`https://github.com/${username}/${reponame}`)}...`);
    try {
      await execFileAsync('git', [
        'clone', '--depth', '1',
        `https://github.com/${username}/${reponame}.git`,
        tmpDir,
      ], { timeout: 30000 });
    } catch (err: any) {
      const hint = err.message.includes('not found') || err.message.includes('Repository')
        ? `repository github.com/${username}/${reponame} not found`
        : err.message;
      console.error(chalk.red(`✗ Clone failed: ${hint}`));
      process.exit(1);
    }

    // Validate plugin structure
    console.log('  Validating plugin structure...');
    const validation = await validatePluginDir(tmpDir);
    if (!validation.ok) {
      console.error(chalk.red('\n✗ Plugin validation failed:'));
      for (const e of validation.errors) {
        console.error(`  ${chalk.red('·')} ${e}`);
      }
      console.error(chalk.dim('\n  See README.md#plugin-development for the required structure.'));
      process.exit(1);
    }
    console.log(`  ${chalk.green('✓')} Structure valid`);

    // Read plugin.json manifest if present
    let manifest: PluginManifest | null = null;
    try {
      const raw = await fs.readFile(path.join(tmpDir, 'plugin.json'), 'utf-8');
      manifest = JSON.parse(raw);
    } catch {
      console.log(chalk.yellow('  ⚠ No plugin.json — env vars and default config will not be set automatically'));
    }

    // Bundle the plugin into plugins/<name>/index.js
    console.log('  Bundling plugin...');
    await buildPlugin(tmpDir, destDir);
    destCreated = true;

    // Copy plugin.json manifest alongside the bundle (needed by pluginsList / doctor)
    try {
      await fs.copyFile(path.join(tmpDir, 'plugin.json'), path.join(destDir, 'plugin.json'));
    } catch {
      // No plugin.json — optional, skip
    }

    // Merge default config into plugins.json
    const pluginsConfig = await loadPluginsConfig(PLUGINS_CONFIG_PATH);
    const defaultConfig: Record<string, unknown> = manifest?.config ?? { enabled: true };

    if (pluginsConfig[pluginName]) {
      pluginsConfig[pluginName] = { ...defaultConfig, ...pluginsConfig[pluginName] };
    } else {
      pluginsConfig[pluginName] = defaultConfig;
    }

    await savePluginsConfig(pluginsConfig, PLUGINS_CONFIG_PATH);

    // Print result
    const nameLabel = manifest?.name ?? pluginName;
    const versionLabel = manifest?.version ? ` v${manifest.version}` : '';
    console.log(`\n  ${chalk.green('✓')} Installed: ${chalk.bold(nameLabel)}${versionLabel}`);
    if (manifest?.description) {
      console.log(`  ${chalk.dim(manifest.description)}`);
    }

    // Print env vars
    if (manifest?.env && manifest.env.length > 0) {
      console.log(`\n  ${chalk.bold('Environment variables:')}`);
      for (const envVar of manifest.env) {
        const tag = envVar.required ? chalk.red('required') : chalk.dim('optional');
        const icon = envVar.required ? chalk.red('✗') : chalk.yellow('○');
        console.log(`  ${icon} ${chalk.cyan(envVar.key)} (${tag}) — ${envVar.description}`);
      }
      console.log(`\n  Add missing vars to your .env file or shell environment.`);
    }

    console.log(`\n  ${chalk.dim('Run')} ${chalk.cyan('fabiana doctor')} ${chalk.dim('to verify.')}\n`);

  } catch (err: any) {
    // Clean up partial install
    if (destCreated) {
      await fs.rm(destDir, { recursive: true, force: true }).catch(() => {});
      console.error(chalk.red(`\n✗ Installation failed — removed ${destDir}`));
    }
    console.error(chalk.red(`✗ ${err.message}`));
    process.exit(1);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function pluginsList(): Promise<void> {
  const pluginsConfig = await loadPluginsConfig(PLUGINS_CONFIG_PATH);

  let dirs: string[] = [];
  try {
    const entries = await fs.readdir(PLUGINS_DIR, { withFileTypes: true });
    dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    // No plugins directory
  }

  if (dirs.length === 0 && Object.keys(pluginsConfig).length === 0) {
    console.log('\n  No plugins installed.\n');
    return;
  }

  console.log(`\n${chalk.bold('Installed plugins:')}\n`);

  for (const dir of dirs) {
    const cfg = pluginsConfig[dir];
    const isEnabled = cfg === undefined || cfg.enabled !== false;

    let version = '';
    let description = '';
    try {
      const raw = await fs.readFile(path.join(PLUGINS_DIR, dir, 'plugin.json'), 'utf-8');
      const manifest: PluginManifest = JSON.parse(raw);
      version = manifest.version ? `v${manifest.version}` : '';
      description = manifest.description ?? '';
    } catch { /* no manifest */ }

    const statusIcon = isEnabled ? chalk.green('✓') : chalk.dim('⊘');
    const statusLabel = isEnabled ? '' : chalk.dim(' (disabled)');
    const versionLabel = version ? chalk.dim(` ${version}`) : '';
    console.log(`  ${statusIcon} ${chalk.bold(dir)}${versionLabel}${statusLabel}`);
    if (description) console.log(`    ${chalk.dim(description)}`);
  }

  console.log('');
}
