import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';

interface BraveSearchResult {
  title: string;
  url: string;
  description?: string;
  age?: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveSearchResult[];
  };
}

export const tool: ToolDefinition = {
  name: 'brave_search',
  label: 'Brave Search',
  description: `Search the web using Brave Search API. Use for:
- Finding current news, facts, or information
- Researching topics the user mentions
- Checking updates on interests (crypto, tech, etc.)
- Finding documentation or references
- Conversation starters based on current events`,
  parameters: Type.Object({
    query: Type.String({ description: 'Search query' }),
    count: Type.Number({ default: 5, description: 'Number of results (1-20)' }),
    freshness: Type.Optional(Type.String({
      description: 'Time filter: pd (past day), pw (past week), pm (past month), py (past year)',
    })),
  }),
  execute: async (_toolCallId, params: { query: string; count?: number; freshness?: string }) => {
    const { query, count = 5, freshness } = params;

    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      return {
        content: [{ type: 'text' as const, text: '❌ BRAVE_API_KEY not set in environment.' }],
        details: { error: 'Missing API key' },
      };
    }

    try {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(Math.min(Math.max(count, 1), 20)));
      if (freshness) url.searchParams.set('freshness', freshness);

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          content: [{ type: 'text' as const, text: `❌ Brave Search API error ${response.status}: ${body}` }],
          details: { error: body },
        };
      }

      const data = await response.json() as BraveSearchResponse;
      const results = data.web?.results ?? [];

      if (results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No results found.' }],
          details: { query, count: 0 },
        };
      }

      const formatted = results.map((r, i) =>
        `${i + 1}. **${r.title}**\n   ${r.url}${r.description ? `\n   ${r.description}` : ''}${r.age ? ` (${r.age})` : ''}`
      ).join('\n\n');

      return {
        content: [{ type: 'text' as const, text: formatted }],
        details: { query, count: results.length },
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `❌ Search failed: ${err.message}` }],
        details: { error: err.message },
      };
    }
  },
};

export const metadata = {
  name: 'brave-search',
  version: '1.0.0',
  description: 'Web search via Brave Search API',
  author: 'fabiana-core',
};
