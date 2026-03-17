import fs from 'fs/promises';
import { paths } from '../paths.js';

interface InteractionState {
  lastInteraction: string | null;
  lastSolitude: string | null;
}

async function readState(): Promise<InteractionState> {
  try {
    const content = await fs.readFile(paths.lastInteractionJson, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { lastInteraction: null, lastSolitude: null };
  }
}

async function writeState(state: InteractionState): Promise<void> {
  await fs.mkdir(paths.lastInteractionJson.replace(/\/[^/]+$/, ''), { recursive: true });
  await fs.writeFile(paths.lastInteractionJson, JSON.stringify(state, null, 2), 'utf-8');
}

export async function updateLastInteraction(): Promise<void> {
  const state = await readState();
  state.lastInteraction = new Date().toISOString();
  await writeState(state);
}

export async function updateLastSolitude(): Promise<void> {
  const state = await readState();
  state.lastSolitude = new Date().toISOString();
  await writeState(state);
}

export async function getLastInteractionHoursAgo(): Promise<number | null> {
  const state = await readState();
  if (!state.lastInteraction) return null;
  const ms = Date.now() - new Date(state.lastInteraction).getTime();
  return ms / 3_600_000;
}

export async function getLastSolitudeHoursAgo(): Promise<number | null> {
  const state = await readState();
  if (!state.lastSolitude) return null;
  const ms = Date.now() - new Date(state.lastSolitude).getTime();
  return ms / 3_600_000;
}
