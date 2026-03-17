// Rough token estimator: ~4 chars per token (good enough for context window planning)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface TokenSection {
  label: string;
  tokens: number;
}

const CONTEXT_WINDOWS: Array<{ name: string; size: number }> = [
  { name: 'GPT-4o   128k', size: 128_000 },
  { name: 'Claude   200k', size: 200_000 },
  { name: 'Gemini     1M', size: 1_000_000 },
];

const BAR_WIDTH = 20;

function bar(fraction: number): string {
  const filled = Math.round(Math.min(fraction, 1) * BAR_WIDTH);
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
}

function pct(tokens: number, window: number): string {
  const p = (tokens / window) * 100;
  return p < 0.1 ? '<0.1%' : `${p.toFixed(1)}%`;
}

export function formatTokenReport(sections: TokenSection[]): string {
  const total = sections.reduce((s, r) => s + r.tokens, 0);
  const maxLabel = Math.max(...sections.map(r => r.label.length));
  const maxTokens = Math.max(...sections.map(r => r.tokens));
  const tokenWidth = maxTokens.toLocaleString().length;

  const lines: string[] = [];
  const thinBar = '─'.repeat(60);

  lines.push('');
  lines.push(thinBar);
  lines.push('  TOKEN ESTIMATE  (rough · ~4 chars/token)');
  lines.push(thinBar);

  for (const { label, tokens } of sections) {
    const pctOfTotal = total > 0 ? ((tokens / total) * 100).toFixed(1) : '0.0';
    lines.push(
      `  ${label.padEnd(maxLabel)}  ${tokens.toLocaleString().padStart(tokenWidth + 2)} tk  (${pctOfTotal.padStart(5)}% of total)`,
    );
  }

  lines.push(thinBar);
  lines.push(`  ${'TOTAL'.padEnd(maxLabel)}  ${total.toLocaleString().padStart(tokenWidth + 2)} tk`);
  lines.push('');
  lines.push('  Context window fit:');

  for (const { name, size } of CONTEXT_WINDOWS) {
    const fraction = total / size;
    lines.push(`    ${name}  ${bar(fraction)}  ${pct(total, size).padStart(6)}`);
  }

  lines.push(thinBar);
  return lines.join('\n');
}
