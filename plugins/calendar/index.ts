import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const getCalendarEmail = () => process.env.GOOGLE_CALENDAR_EMAIL || 'primary';

export const tool: ToolDefinition = {
  name: 'calendar',
  label: 'Google Calendar',
  description: `Access Google Calendar to check events, schedule, and availability. Use for:
- Checking today's or upcoming events
- Getting meeting details
- Finding free time slots
- Context for conversations ("How was your meeting?")`,
  parameters: Type.Object({
    action: Type.String({
      enum: ['today', 'upcoming', 'event', 'freebusy'],
      description: 'Action to perform'
    }),
    days: Type.Optional(Type.Number({ default: 7, description: 'Number of days to look ahead (for upcoming)' })),
    eventId: Type.Optional(Type.String({ description: 'Event ID (for event details)' })),
    date: Type.Optional(Type.String({ description: 'Specific date YYYY-MM-DD (for that day)' })),
  }),
  execute: async (_toolCallId, params: { action: string; days?: number; eventId?: string; date?: string }) => {
    const { action, days = 7, eventId, date } = params;
    const email = getCalendarEmail();

    try {
      let args: string[] = [];

      switch (action) {
        case 'today': {
          const targetDate = date || new Date().toISOString().split('T')[0];
          const from = `${targetDate}T00:00:00Z`;
          const to = `${targetDate}T23:59:59Z`;
          args = [email, 'events', 'primary', '--from', from, '--to', to];
          break;
        }

        case 'upcoming': {
          const from = new Date().toISOString();
          const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          args = [email, 'events', 'primary', '--from', from, '--to', to];
          break;
        }

        case 'event': {
          if (!eventId) {
            return {
              content: [{ type: 'text' as const, text: '❌ eventId required for event action' }],
              details: { error: 'Missing eventId' },
            };
          }
          args = [email, 'event', 'primary', eventId];
          break;
        }

        case 'freebusy': {
          const from = new Date().toISOString();
          const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          args = [email, 'freebusy', 'primary', '--from', from, '--to', to];
          break;
        }

        default:
          return {
            content: [{ type: 'text' as const, text: `❌ Unknown action: ${action}` }],
            details: { error: 'Invalid action' },
          };
      }

      const { stdout, stderr } = await execFileAsync('gccli', args, { timeout: 15000 });

      if (stderr && !stdout) {
        if (stderr.includes('auth') || stderr.includes('credentials') || stderr.includes('token')) {
          return {
            content: [{ type: 'text' as const, text: `❌ Google Calendar not authenticated. Run: gccli accounts add ${email}` }],
            details: { error: 'Not authenticated', stderr },
          };
        }
      }

      return {
        content: [{ type: 'text' as const, text: stdout || 'No events found' }],
        details: { action, email, result: stdout?.length || 0 },
      };
    } catch (err: any) {
      const errorMsg = err.message || '';
      const stderr = err.stderr || '';

      if (errorMsg.includes('not found') || errorMsg.includes('ENOENT')) {
        return {
          content: [{ type: 'text' as const, text: `❌ gccli not installed. Run: npm install -g @mariozechner/gccli` }],
          details: { error: 'gccli not found' },
        };
      }

      if (stderr.includes('auth') || stderr.includes('credentials') || errorMsg.includes('auth')) {
        return {
          content: [{ type: 'text' as const, text: `❌ Google Calendar not authenticated. Run: gccli accounts add ${email}` }],
          details: { error: 'Authentication required', stderr },
        };
      }

      return {
        content: [{ type: 'text' as const, text: `❌ Calendar error: ${errorMsg}` }],
        details: { error: errorMsg, stderr },
      };
    }
  },
};

export const metadata = {
  name: 'calendar',
  version: '1.0.0',
  description: 'Google Calendar integration via gccli',
  author: 'fabiana-core',
};
