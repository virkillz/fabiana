import fs from 'fs/promises';
import { paths } from '../paths.js';
import { type InitiativeType } from './types.js';

// ─── Mood ─────────────────────────────────────────────────────────────────────

export interface MoodState {
  current: string;
  intensity: number;
  raw: string;
}

function parseMoodCurrent(raw: string): string {
  const match = raw.match(/^current:\s*(.+)$/m);
  return match ? match[1].trim().toLowerCase() : 'neutral';
}

function computeDecayedIntensity(raw: string): number {
  const intensityMatch = raw.match(/^intensity:\s*([\d.]+)/m);
  const rateMatch = raw.match(/^decay_rate:\s*([\d.]+)/m);
  const updatedMatch = raw.match(/^last_updated:\s*(.+)$/m);

  if (!intensityMatch) return 0;

  let intensity = parseFloat(intensityMatch[1]);
  if (updatedMatch && rateMatch) {
    const hoursSince = (Date.now() - new Date(updatedMatch[1].trim()).getTime()) / 3_600_000;
    const decayRate = parseFloat(rateMatch[1]);
    intensity = Math.max(0, intensity - hoursSince * decayRate);
  }

  return Math.min(1, intensity);
}

export async function loadMood(moodMdPath?: string): Promise<MoodState> {
  try {
    const raw = await fs.readFile(moodMdPath ?? paths.moodMd, 'utf-8');
    return {
      current: parseMoodCurrent(raw),
      intensity: computeDecayedIntensity(raw),
      raw,
    };
  } catch {
    return { current: 'neutral', intensity: 0, raw: '' };
  }
}

// ─── Absence detection ────────────────────────────────────────────────────────

/**
 * Scans recent conversation logs to find hours elapsed since the last user message.
 * Log format: [ISO_TIMESTAMP] [source] 👤 You: message
 */
export async function getHoursSinceLastUserMessage(): Promise<number | null> {
  const now = Date.now();

  for (let daysBack = 0; daysBack <= 3; daysBack++) {
    const d = new Date(now - daysBack * 86_400_000);
    const dateStr = d.toISOString().slice(0, 10);
    const logPath = paths.logs(`conversation-${dateStr}.log`);

    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const userLines = content.split('\n').filter(l => l.includes('👤 You:'));

      if (userLines.length > 0) {
        const lastLine = userLines[userLines.length - 1];
        const tsMatch = lastLine.match(/^\[([^\]]+)\]/);
        if (tsMatch) {
          const ts = new Date(tsMatch[1]).getTime();
          if (!isNaN(ts)) return (now - ts) / 3_600_000;
        }
      }
    } catch {
      // Log doesn't exist for this day — keep scanning earlier days
    }
  }

  return null;
}

// ─── Weighted random ──────────────────────────────────────────────────────────

type Weighted = { type: InitiativeType; weight: number };

function weightedPick(pool: Weighted[]): InitiativeType {
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let rand = Math.random() * total;
  for (const entry of pool) {
    rand -= entry.weight;
    if (rand <= 0) return entry.type;
  }
  return pool[pool.length - 1].type;
}

// ─── Rule engine ──────────────────────────────────────────────────────────────

/**
 * Selects an initiative type based on time of day, day of week, user absence, and mood.
 * Hard rules are evaluated first (in priority order). Falls through to a weighted random
 * pool when no rule fires.
 */
export function selectInitiativeType(
  mood: MoodState,
  hoursSince: number | null,
): { type: InitiativeType; reason: string } {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat

  // ── Hard rules (evaluated in priority order) ───────────────────────────────

  // Long absence > 36h
  if (hoursSince !== null && hoursSince > 36) {
    return { type: 'miss_you', reason: `${Math.round(hoursSince)}h since last message` };
  }

  // Monday morning energy
  if (dayOfWeek === 1 && hour >= 7 && hour < 11) {
    return { type: 'monday_kickoff', reason: 'Monday morning' };
  }

  // Friday wind-down
  if (dayOfWeek === 5 && hour >= 14 && hour < 21) {
    return { type: 'friday_wind_down', reason: 'Friday afternoon' };
  }

  // Morning greeting window
  if (hour >= 6 && hour < 10) {
    return { type: 'good_morning', reason: 'morning hours' };
  }

  // Late night nudge
  if (hour >= 23 || hour < 4) {
    return { type: 'good_night', reason: 'late night' };
  }

  // Moderate absence 6–36h
  if (hoursSince !== null && hoursSince > 6) {
    return { type: 'check_in', reason: `${Math.round(hoursSince)}h since last message` };
  }

  // Mood-based (only when intensity is meaningful)
  if (mood.intensity >= 0.3) {
    const m = mood.current;
    if (m.includes('worried') || m.includes('anxious') || m.includes('stressed')) {
      return { type: 'worry', reason: `mood: ${m}` };
    }
    if (m.includes('excited') || m.includes('happy') || m.includes('great')) {
      return { type: 'celebrate', reason: `mood: ${m}` };
    }
  }

  // ── Weighted random pool ───────────────────────────────────────────────────
  // observation and confession are rare — they land harder when unexpected.

  const pool: Weighted[] = [
    { type: 'random_thought',    weight: 10 },
    { type: 'hypothetical',      weight: 10 },
    { type: 'recommendation',    weight: 10 },
    { type: 'btw_news',          weight:  9 },
    { type: 'deep_question',     weight:  9 },
    { type: 'todo_reminder',     weight:  8 },
    { type: 'calendar_reminder', weight:  7 },
    { type: 'observation',       weight:  4 },
    { type: 'confession',        weight:  4 },
  ];

  return { type: weightedPick(pool), reason: 'weighted random' };
}
