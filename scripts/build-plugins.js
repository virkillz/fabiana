#!/usr/bin/env node
// Compiles default plugins from plugins/<name>/index.ts → dist/plugins/<name>/index.js
// Run as part of the build step so default plugins are included in the npm package.

import { build } from 'esbuild';
import { readdir, readFile, copyFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const root        = fileURLToPath(new URL('..', import.meta.url));
const pluginsSrc  = join(root, 'plugins');
const pluginsDest = join(root, 'dist', 'plugins');

// Mark fabiana's own deps as external — they resolve from the package's node_modules at runtime.
const selfPkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf-8'));
const external = Object.keys({
  ...(selfPkg.dependencies ?? {}),
  ...(selfPkg.devDependencies ?? {}),
});

let entries;
try {
  entries = await readdir(pluginsSrc, { withFileTypes: true });
} catch {
  console.log('No plugins/ directory found — skipping plugin build.');
  process.exit(0);
}

const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
if (dirs.length === 0) {
  console.log('No plugins to build.');
  process.exit(0);
}

let failed = false;
for (const dir of dirs) {
  const srcDir  = join(pluginsSrc, dir);
  const destDir = join(pluginsDest, dir);
  await mkdir(destDir, { recursive: true });

  try {
    await build({
      entryPoints: [join(srcDir, 'index.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: join(destDir, 'index.js'),
      external,
      absWorkingDir: srcDir,
      logLevel: 'silent',
    });

    for (const file of ['plugin.json', 'package.json']) {
      try { await copyFile(join(srcDir, file), join(destDir, file)); } catch { /* optional */ }
    }

    console.log(`  ✓ ${dir}`);
  } catch (err) {
    console.error(`  ✗ ${dir}: ${err.message}`);
    failed = true;
  }
}

if (failed) process.exit(1);
