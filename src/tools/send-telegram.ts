import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';

export function createSendTelegramTool(
  sendMessage: (text: string) => Promise<void>
): ToolDefinition {
  return {
    name: 'send_telegram',
    label: 'Send Telegram Message',
    description: 'Send a message to the human via Telegram. Use for responses and initiative messages.',
    parameters: Type.Object({
      message: Type.String({ description: 'The message to send. Supports Markdown formatting.' }),
    }),
    execute: async (_toolCallId, params: { message: string }) => {
      const { message } = params;
      try {
        await sendMessage(message);
        return {
          content: [{ type: 'text' as const, text: `✅ Message sent via Telegram` }],
          details: { sent: true, length: message.length },
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `❌ Failed to send Telegram message: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  };
}
