import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export function createFetchUrlTool(): ToolDefinition {
  return {
    name: 'fetch_url',
    label: 'Fetch URL',
    description: `Fetch and read the content of a web page URL. Use when:
- User shares a link and wants a summary or info from it
- You need to read the actual content of an article or page
- Following up on Hacker News or search results to get full details
- User asks "what does this page say" or "can you read this for me"`,
    parameters: Type.Object({
      url: Type.String({ description: 'The URL to fetch' }),
      max_length: Type.Optional(Type.Number({
        default: 8000,
        description: 'Max characters of content to return (default 8000)',
      })),
    }),
    execute: async (_toolCallId, params: { url: string; max_length?: number }) => {
      const { url, max_length = 8000 } = params;

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; fabiana-bot/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
        });

        if (!response.ok) {
          return {
            content: [{ type: 'text' as const, text: `❌ Failed to fetch URL (${response.status} ${response.statusText})` }],
            details: { error: `HTTP ${response.status}`, url },
          };
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          if (contentType.includes('text/')) {
            // Plain text — return as-is
            const text = await response.text();
            const truncated = text.length > max_length;
            return {
              content: [{ type: 'text' as const, text: truncated ? text.slice(0, max_length) + '\n\n[... content truncated]' : text }],
              details: { url, length: text.length, truncated },
            };
          }
          return {
            content: [{ type: 'text' as const, text: `❌ Unsupported content type: ${contentType}` }],
            details: { error: 'Unsupported content type', contentType, url },
          };
        }

        const html = await response.text();
        const { document } = parseHTML(html);

        const reader = new Readability(document as any);
        const article = reader.parse();

        let text: string;
        if (article?.textContent) {
          const title = article.title ? `# ${article.title}\n\n` : '';
          text = (title + article.textContent).replace(/\n{3,}/g, '\n\n').trim();
        } else {
          // Readability couldn't extract — fallback to basic tag strip
          text = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        }

        const truncated = text.length > max_length;
        const output = truncated ? text.slice(0, max_length) + '\n\n[... content truncated]' : text;

        return {
          content: [{ type: 'text' as const, text: output }],
          details: { url, title: article?.title, length: text.length, truncated },
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `❌ Failed to fetch URL: ${err.message}` }],
          details: { error: err.message, url },
        };
      }
    },
  };
}
