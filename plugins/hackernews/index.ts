import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';

interface HNStory {
  rank: number;
  title: string;
  url: string;
  points: number;
  comments: number;
  itemId: string;
}

async function fetchHNPage(page: number = 1): Promise<HNStory[]> {
  const url = `https://news.ycombinator.com/news${page > 1 ? `?p=${page}` : ''}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; fabiana-bot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch HN: ${response.status}`);
  }

  const html = await response.text();
  const stories: HNStory[] = [];

  // Find all story rows and their associated subtext
  // Story row: <tr class="athing submission" id="ITEM_ID">...</tr>
  // Subtext row: <tr><td colspan="2"></td><td class="subtext">...</td></tr>
  const storyRegex = /<tr class="athing submission" id="(\d+)">[\s\S]*?<\/tr>\s*<tr>[\s\S]*?<td class="subtext">([\s\S]*?)<\/td>/g;
  const titleRegex = /<span class="titleline"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
  const rankRegex = /<span class="rank">(\d+)\.<\/span>/;
  const scoreRegex = /<span class="score" id="score_\d+">(\d+) points?<\/span>/;
  const commentsRegex = />(\d+)&nbsp;comments?|>discuss</;

  let match;
  while ((match = storyRegex.exec(html)) !== null) {
    const itemId = match[1];
    const storyBlock = match[0];
    const subtextBlock = match[2];

    const rankMatch = storyBlock.match(rankRegex);
    const rank = rankMatch ? parseInt(rankMatch[1]) : stories.length + 1;

    const titleMatch = storyBlock.match(titleRegex);
    if (!titleMatch) continue;
    let url = titleMatch[1];
    const title = titleMatch[2].replace(/<[^>]+>/g, '');

    if (url.startsWith('item?id=')) {
      url = `https://news.ycombinator.com/${url}`;
    }

    const scoreMatch = subtextBlock.match(scoreRegex);
    const points = scoreMatch ? parseInt(scoreMatch[1]) : 0;

    const commentsMatch = subtextBlock.match(commentsRegex);
    const comments = commentsMatch && commentsMatch[1] ? parseInt(commentsMatch[1]) : 0;

    stories.push({ rank, title, url, points, comments, itemId });
  }

  return stories;
}

export const tool: ToolDefinition = {
  name: 'hackernews',
  label: 'Hacker News',
  description: 'Fetch top stories from Hacker News front page. Returns up to 30 stories with title, URL, points, and comment count.',
  parameters: Type.Object({
    page: Type.Optional(Type.Number({
      description: 'Page number to fetch (1-3). Default is 1.',
      minimum: 1,
      maximum: 3,
    })),
  }),
  execute: async (_toolCallId: string, params: { page?: number }) => {
    try {
      const page = params.page ?? 1;
      const stories = await fetchHNPage(page);
      
      if (stories.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No stories found.' }],
          details: { count: 0, page },
        };
      }

      const formatted = stories.map(s =>
        `${s.rank}. **${s.title}**\n   🔗 ${s.url}\n   ▲ ${s.points} points · 💬 ${s.comments} comments · [HN](https://news.ycombinator.com/item?id=${s.itemId})`
      ).join('\n\n');

      return {
        content: [{ type: 'text' as const, text: `**Hacker News — Top Stories (page ${page})**\n\n${formatted}` }],
        details: { count: stories.length, page },
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `❌ Failed to fetch Hacker News: ${err.message}` }],
        details: { error: err.message },
      };
    }
  },
};

export const metadata = {
  name: 'hackernews',
  version: '1.0.0',
  description: 'Fetch top stories from Hacker News',
  author: 'fabiana-core',
};
