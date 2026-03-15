import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

export const FABIANA_HOME = process.env.FABIANA_HOME ?? join(homedir(), '.fabiana');
export const CONFIG_DIR   = join(FABIANA_HOME, 'config');
export const DATA_DIR     = join(FABIANA_HOME, 'data');
export const PLUGINS_DIR  = join(FABIANA_HOME, 'plugins');

export const paths = {
  configJson:   join(CONFIG_DIR, 'config.json'),
  manifestJson: join(CONFIG_DIR, 'manifest.json'),
  pluginsJson:  join(CONFIG_DIR, 'plugins.json'),
  stateJson:    join(CONFIG_DIR, 'state.json'),
  systemMd:     (suffix?: string) =>
    suffix ? join(CONFIG_DIR, `system-${suffix}.md`) : join(CONFIG_DIR, 'system.md'),
  memory:       (...parts: string[]) => join(DATA_DIR, 'memory', ...parts),
  logs:         (filename: string)   => join(DATA_DIR, 'logs', filename),
  sessions:     join(DATA_DIR, 'sessions'),
  agentTodo:    join(DATA_DIR, 'agent-todo'),
  conversations: join(DATA_DIR, 'conversations'),
  envFile:      join(FABIANA_HOME, '.env'),
};

// Default plugins bundled with the package.
// Dev:  src/paths.ts → __dir = src/ → no src/plugins/ → falls back to ../plugins (root)
// Prod: dist/paths.js → __dir = dist/ → dist/plugins/ exists → uses dist/plugins/
const __dir = fileURLToPath(new URL('.', import.meta.url));
const distPlugins = join(__dir, 'plugins');
const srcPlugins  = join(__dir, '..', 'plugins');
export const BUNDLED_PLUGINS_DIR = existsSync(distPlugins) ? distPlugins : srcPlugins;

// Root of the installed/dev package (one level above src/ or dist/)
export const PACKAGE_ROOT = join(__dir, '..');
