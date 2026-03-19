import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// ─── Root directory ───────────────────────────────────────────────────────────
// All fabiana data lives under FABIANA_ROOT. Can be overridden with FABIANA_ROOT
// or the legacy FABIANA_HOME env var.
export const FABIANA_ROOT =
  process.env.FABIANA_ROOT ?? process.env.FABIANA_HOME ?? join(homedir(), '.fabiana');

// Backward-compat alias.
export const FABIANA_HOME = FABIANA_ROOT;

// ─── Shared directories (not per-agent) ───────────────────────────────────────
// Plugins and skills live at the root, shared across all agents.
// `fabiana sync` copies bundled plugins/skills here.
// Each agent's config/plugins.json and config/skills.json control which are active.
export const SHARED_PLUGINS_DIR = join(FABIANA_ROOT, 'plugins');
export const SHARED_SKILLS_DIR  = join(FABIANA_ROOT, 'skills');

// Legacy names — kept for backward compat (sync-cmd, plugins-cmd, skills-cmd, etc.)
export const PLUGINS_DIR = SHARED_PLUGINS_DIR;
export const SKILLS_DIR  = SHARED_SKILLS_DIR;

// ─── Per-agent paths ──────────────────────────────────────────────────────────

export interface AgentPaths {
  agentHome:           string;
  configJson:          string;
  manifestJson:        string;
  pluginsJson:         string;
  skillsJson:          string;
  stateJson:           string;
  envFile:             string;
  systemMd:            (suffix?: string) => string;
  memory:              (...parts: string[]) => string;
  logs:                (filename: string) => string;
  sessions:            string;
  agentTodo:           string;
  imagesDir:           string;
  images:              (filename: string) => string;
  conversations:       string;
  moodMd:              string;
  memoryDb:            string;
  lastInteractionJson: string;
}

export function createAgentPaths(agentHome: string): AgentPaths {
  const configDir = join(agentHome, 'config');
  const dataDir   = join(agentHome, 'data');
  return {
    agentHome,
    configJson:          join(configDir, 'config.json'),
    manifestJson:        join(configDir, 'manifest.json'),
    pluginsJson:         join(configDir, 'plugins.json'),
    skillsJson:          join(configDir, 'skills.json'),
    stateJson:           join(configDir, 'state.json'),
    envFile:             join(agentHome, '.env'),
    systemMd:   (suffix?: string) =>
      suffix ? join(configDir, `system-${suffix}.md`) : join(configDir, 'system.md'),
    memory:     (...parts: string[]) => join(dataDir, 'memory', ...parts),
    logs:       (filename: string)   => join(dataDir, 'logs', filename),
    sessions:            join(dataDir, 'sessions'),
    agentTodo:           join(dataDir, 'agent-todo'),
    imagesDir:           join(dataDir, 'images'),
    images:     (filename: string)   => join(dataDir, 'images', filename),
    conversations:       join(dataDir, 'conversations'),
    moodMd:              join(dataDir, 'memory', 'mood.md'),
    memoryDb:            join(dataDir, 'memory.db'),
    lastInteractionJson: join(dataDir, 'last_interaction.json'),
  };
}

/** Returns the home directory for a named agent in the multi-agent layout. */
export function getAgentHome(agentName: string): string {
  return join(FABIANA_ROOT, 'agents', agentName);
}

// ─── Default agent detection (backward compat) ───────────────────────────────
// • agents.json present  → new multi-agent layout, default agent = agents/default/
// • config/config.json present → old single-agent layout, treat root as agent home
// • Neither present      → fresh install, use new layout
function resolveDefaultAgentHome(): string {
  if (existsSync(join(FABIANA_ROOT, 'agents.json'))) {
    return join(FABIANA_ROOT, 'agents', 'default');
  }
  const oldStyleConfig = join(FABIANA_ROOT, 'config', 'config.json');
  if (existsSync(oldStyleConfig)) {
    return FABIANA_ROOT;
  }
  return join(FABIANA_ROOT, 'agents', 'default');
}

export const DEFAULT_AGENT_HOME = resolveDefaultAgentHome();

// Legacy flat exports for non-daemon CLI code (plugins-cmd, skills-cmd, doctor, backup…).
// These point to the default agent's directories.
export const paths     = createAgentPaths(DEFAULT_AGENT_HOME);
export const CONFIG_DIR = join(DEFAULT_AGENT_HOME, 'config');
export const DATA_DIR   = join(DEFAULT_AGENT_HOME, 'data');

// ─── Package-bundled directories ─────────────────────────────────────────────
// Dev:  src/paths.ts → __dir = src/ → no src/plugins/ → falls back to ../plugins (root)
// Prod: dist/paths.js → __dir = dist/ → dist/plugins/ exists → uses dist/plugins/
const __dir = fileURLToPath(new URL('.', import.meta.url));
const distPlugins = join(__dir, 'plugins');
const srcPlugins  = join(__dir, '..', 'plugins');
export const BUNDLED_PLUGINS_DIR = existsSync(distPlugins) ? distPlugins : srcPlugins;
export const BUNDLED_SKILLS_DIR  = join(__dir, 'skills');
export const PACKAGE_ROOT        = join(__dir, '..');
