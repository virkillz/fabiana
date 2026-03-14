import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';

export function createSendMessageTool(
  sendMessage: (text: string) => Promise<void>
): ToolDefinition {
  return {
    name: 'send_message',
    label: 'Send Message',
    description: 'Send a message to the recipient. Use for responses and initiative messages. Supports Markdown formatting.',
    parameters: Type.Object({
      message: Type.String({ description: 'The message to send. Supports Markdown formatting.' }),
    }),
    execute: async (_toolCallId, params: { message: string }) => {
      const { message } = params;
      try {
        await sendMessage(message);
        return {
          content: [{ type: 'text' as const, text: `✅ Message sent` }],
          details: { sent: true, length: message.length },
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `❌ Failed to send message: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  };
}
