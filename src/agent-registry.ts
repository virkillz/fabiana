import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { FABIANA_ROOT, getAgentHome } from './paths.js';

const AGENTS_JSON = join(FABIANA_ROOT, 'agents.json');

const G = '\x1b[32m'; // green
const R = '\x1b[0m';  // reset
const D = '\x1b[2m';  // dim

/**
 * Returns the list of configured agent names.
 *
 * Detection order:
 *  1. agents.json exists  → new multi-agent layout
 *  2. config/config.json at root (no agents.json)  → old single-agent layout → ['default']
 *  3. Neither  → []  (not yet initialised)
 */
export async function listAgents(): Promise<string[]> {
  try {
    const content = await fs.readFile(AGENTS_JSON, 'utf-8');
    const names: string[] = JSON.parse(content);
    return names.filter((n) => typeof n === 'string' && n.length > 0);
  } catch {
    // No agents.json — check for old-style single-agent layout
    const oldStyleConfig = join(FABIANA_ROOT, 'config', 'config.json');
    if (existsSync(oldStyleConfig)) return ['default'];

    // Check for default agent in new layout (e.g. partial setup)
    const defaultConfigJson = join(getAgentHome('default'), 'config', 'config.json');
    if (existsSync(defaultConfigJson)) return ['default'];

    return [];
  }
}

/** Registers a new agent name in agents.json (creates the file if needed). */
export async function addAgent(name: string): Promise<void> {
  const agents = await listAgents();
  if (!agents.includes(name)) {
    agents.push(name);
    await saveAgents(agents);
  }
}

/** Removes an agent name from agents.json. Does not delete the agent's directory. */
export async function removeAgent(name: string): Promise<void> {
  const agents = await listAgents();
  await saveAgents(agents.filter((n) => n !== name));
}

async function saveAgents(names: string[]): Promise<void> {
  await fs.mkdir(FABIANA_ROOT, { recursive: true });
  await fs.writeFile(AGENTS_JSON, JSON.stringify(names, null, 2) + '\n', 'utf-8');
}

/**
 * Returns true if the current layout is the old single-agent style
 * (config.json at FABIANA_ROOT/config/, no agents.json).
 */
export function isOldLayout(): boolean {
  return (
    existsSync(join(FABIANA_ROOT, 'config', 'config.json')) &&
    !existsSync(AGENTS_JSON)
  );
}

/**
 * Resolves the filesystem home directory for a named agent.
 *
 * For the name 'default' in an old-style layout (no agents.json),
 * returns FABIANA_ROOT so existing data continues to work.
 */
export function resolveAgentHome(agentName: string): string {
  if (agentName === 'default' && isOldLayout()) {
    return FABIANA_ROOT;
  }
  return getAgentHome(agentName);
}

/**
 * Migrates the old single-agent layout to the new multi-agent layout.
 *
 * Old:  ~/.fabiana/{config,data,.env}
 * New:  ~/.fabiana/agents/default/{config,data,.env}   +  agents.json
 *
 * Plugins and skills remain at ~/.fabiana/plugins/ and ~/.fabiana/skills/
 * (they are shared across agents and are already in the right place).
 *
 * Returns true if migration was performed, false if already on new layout or nothing to migrate.
 */
export async function migrateToMultiAgent(): Promise<boolean> {
  const oldConfigJson = join(FABIANA_ROOT, 'config', 'config.json');
  if (!existsSync(oldConfigJson)) {
    console.log('Nothing to migrate — no single-agent config found at', oldConfigJson);
    return false;
  }
  if (existsSync(AGENTS_JSON)) {
    console.log('Already on multi-agent layout (agents.json exists). Nothing to do.');
    return false;
  }

  const defaultHome = getAgentHome('default');
  const newConfigJson = join(defaultHome, 'config', 'config.json');
  if (existsSync(newConfigJson)) {
    console.log('Default agent already exists at', defaultHome, '— writing agents.json only.');
    await saveAgents(['default']);
    return true;
  }

  console.log('\nMigrating single-agent layout to multi-agent...\n');

  const oldConfigDir = join(FABIANA_ROOT, 'config');
  const oldDataDir   = join(FABIANA_ROOT, 'data');
  const oldEnvFile   = join(FABIANA_ROOT, '.env');

  await fs.mkdir(join(defaultHome, 'config'), { recursive: true });
  await fs.mkdir(join(defaultHome, 'data'),   { recursive: true });

  if (existsSync(oldConfigDir)) {
    await fs.cp(oldConfigDir, join(defaultHome, 'config'), { recursive: true });
    console.log(`  ${G}✓${R} config/ → agents/default/config/`);
  }

  if (existsSync(oldDataDir)) {
    await fs.cp(oldDataDir, join(defaultHome, 'data'), { recursive: true });
    console.log(`  ${G}✓${R} data/ → agents/default/data/`);
  }

  if (existsSync(oldEnvFile)) {
    await fs.cp(oldEnvFile, join(defaultHome, '.env'));
    console.log(`  ${G}✓${R} .env → agents/default/.env`);
  }

  // plugins/ and skills/ stay at root — they're shared, already correct location.

  await saveAgents(['default']);
  console.log(`  ${G}✓${R} agents.json created`);

  console.log(`
${G}Migration complete!${R}

${D}The original files at ${FABIANA_ROOT}/config/ and ${FABIANA_ROOT}/data/ are still in place.
Once you've verified the daemon works, you can remove them:
  rm -rf ${FABIANA_ROOT}/config ${FABIANA_ROOT}/data ${FABIANA_ROOT}/.env${R}
`);

  return true;
}
