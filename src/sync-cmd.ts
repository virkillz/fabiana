import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { PLUGINS_DIR, SKILLS_DIR, BUNDLED_PLUGINS_DIR, BUNDLED_SKILLS_DIR, PACKAGE_ROOT } from './paths.js';

const G = '\x1b[32m'; // green
const Y = '\x1b[33m'; // yellow
const R = '\x1b[0m';  // reset
const D = '\x1b[2m';  // dim

function ok(label: string, note = '')   { console.log(`  ${G}✓${R} ${label}${note ? ` ${D}${note}${R}` : ''}`); }
function skip(label: string, note = '') { console.log(`  ${D}– ${label}${note ? ` (${note})` : ''}${R}`); }
function warn(label: string)            { console.log(`  ${Y}⚠${R}  ${label}`); }

async function buildPlugins(): Promise<boolean> {
  const buildScript = path.join(PACKAGE_ROOT, 'scripts', 'build-plugins.js');
  if (!existsSync(buildScript)) return false;

  // Only needed if BUNDLED_PLUGINS_DIR contains .ts source files (dev environment)
  let needsBuild = false;
  try {
    const entries = await fs.readdir(BUNDLED_PLUGINS_DIR, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory())) {
      if (existsSync(path.join(BUNDLED_PLUGINS_DIR, entry.name, 'index.ts'))) {
        needsBuild = true;
        break;
      }
    }
  } catch {
    return false;
  }

  if (!needsBuild) return false;

  console.log(`  Compiling plugins...`);
  const { execSync } = await import('child_process');
  execSync(`node "${buildScript}"`, { stdio: 'inherit', cwd: PACKAGE_ROOT });
  return true;
}

async function syncDir(
  srcDir: string,
  destDir: string,
  label: string,
): Promise<{ updated: string[]; added: string[] }> {
  const updated: string[] = [];
  const added: string[] = [];

  let entries;
  try {
    entries = await fs.readdir(srcDir, { withFileTypes: true });
  } catch {
    warn(`${label} source not found — skipping`);
    return { updated, added };
  }

  await fs.mkdir(destDir, { recursive: true });

  for (const entry of entries.filter(e => e.isDirectory())) {
    const src  = path.join(srcDir,  entry.name);
    const dest = path.join(destDir, entry.name);
    const isNew = !existsSync(dest);

    await fs.cp(src, dest, { recursive: true, force: true });
    (isNew ? added : updated).push(entry.name);
  }

  return { updated, added };
}

export async function runSync(): Promise<void> {
  console.log('\nSyncing bundled plugins and skills to ~/.fabiana...\n');

  // Step 1: build plugins if in dev (source .ts files present)
  const compiled = await buildPlugins();
  if (compiled) {
    ok('Plugins compiled');
  }

  // Step 2: resolve the correct compiled plugins dir
  // After build, dist/plugins/ exists; use that if available
  let pluginsSrc = BUNDLED_PLUGINS_DIR;
  const distPlugins = path.join(PACKAGE_ROOT, 'dist', 'plugins');
  if (compiled && existsSync(distPlugins)) {
    pluginsSrc = distPlugins;
  }

  // Step 3: sync plugins
  const plugins = await syncDir(pluginsSrc, PLUGINS_DIR, 'Plugins');
  if (plugins.added.length)   ok(`Plugins added`,   plugins.added.join(', '));
  if (plugins.updated.length) ok(`Plugins updated`, plugins.updated.join(', '));
  if (!plugins.added.length && !plugins.updated.length) skip('Plugins', 'none found');

  // Step 4: sync skills
  const skills = await syncDir(BUNDLED_SKILLS_DIR, SKILLS_DIR, 'Skills');
  if (skills.added.length)   ok(`Skills added`,   skills.added.join(', '));
  if (skills.updated.length) ok(`Skills updated`, skills.updated.join(', '));
  if (!skills.added.length && !skills.updated.length) skip('Skills', 'none found');

  console.log('\nDone. Restart the daemon to apply changes.\n');
}
