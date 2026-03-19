import fs from 'fs/promises';
import { paths } from '../paths.js';

interface InteractionState {
  lastInteraction: string | null;
  lastSolitude: string | null;
}

async function readState(statePath: string): Promise<InteractionState> {
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { lastInteraction: null, lastSolitude: null };
  }
}

async function writeState(statePath: string, state: InteractionState): Promise<void> {
  await fs.mkdir(statePath.replace(/\/[^/]+$/, ''), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function updateLastInteraction(statePath?: string): Promise<void> {
  const p = statePath ?? paths.lastInteractionJson;
  const state = await readState(p);
  state.lastInteraction = new Date().toISOString();
  await writeState(p, state);
}

export async function updateLastSolitude(statePath?: string): Promise<void> {
  const p = statePath ?? paths.lastInteractionJson;
  const state = await readState(p);
  state.lastSolitude = new Date().toISOString();
  await writeState(p, state);
}

export async function getLastInteractionHoursAgo(statePath?: string): Promise<number | null> {
  const state = await readState(statePath ?? paths.lastInteractionJson);
  if (!state.lastInteraction) return null;
  const ms = Date.now() - new Date(state.lastInteraction).getTime();
  return ms / 3_600_000;
}

export async function getLastSolitudeHoursAgo(statePath?: string): Promise<number | null> {
  const state = await readState(statePath ?? paths.lastInteractionJson);
  if (!state.lastSolitude) return null;
  const ms = Date.now() - new Date(state.lastSolitude).getTime();
  return ms / 3_600_000;
}
