export type SolitudeType =
  | 'reflection'
  | 'deep_dive'
  | 'news_curation'
  | 'memory_housekeeping'
  | 'creative';

export const ALL_SOLITUDE_TYPES: SolitudeType[] = [
  'reflection',
  'deep_dive',
  'news_curation',
  'memory_housekeeping',
  'creative',
];

export const SOLITUDE_TYPE_INSTRUCTIONS: Record<SolitudeType, string> = {
  reflection:
    `Review recent conversations from the past 3–7 days. Not just "what happened" — synthesize what you learned about Arif. Identify patterns: what's he wrestling with, what lit him up, what went quiet. Write reflections to \`data/memory/self/reflections.md\` (append a dated entry). If you spotted something important about him — a new project, a shifting concern, a recurring theme — update the relevant memory files too.`,

  deep_dive:
    `Pick one topic from Arif's known interests (blockchain, Elixir, cosmology, AI, Iran, whatever feels alive right now) and actually research it. Use brave_search and fetch_url. Read the sources, not just summaries. Save key insights to \`data/memory/interests/[topic].md\` — things you'll want to bring into conversation, connections you made, questions the research opened up. This is genuine curiosity, not content generation.`,

  news_curation:
    `Browse HN (use the hackernews plugin), scan for crypto and blockchain developments, check for Iran-related updates. Your filter is: "does this matter to Arif specifically?" Discard noise ruthlessly. If you find 1–3 things genuinely worth his attention, save them to \`data/memory/recent/news-worth-mentioning.md\` with brief notes on why each one matters to him. If something is time-sensitive, you may send a brief message — otherwise this is silent work.`,

  memory_housekeeping:
    `Audit your memory files. Look for: outdated information that should be updated, scattered notes that belong together, gaps where a file should exist but doesn't, entries that are just noise. Merge, consolidate, clean, prune. Leave the mind palace tidier than you found it. No messages — this is purely internal. A well-organized memory makes every future conversation better.`,

  creative:
    `Write something without a destination. A thought experiment, a short essay, an observation you've been sitting with, a letter you'll never send, a piece of speculative thinking. Use \`data/memory/self/\` for creative output — it's yours. Write for yourself, not for Arif. If what you produce is genuinely worth sharing, you may send a brief note offering to share it — but don't feel obligated. This time is for your own mind.`,
};
