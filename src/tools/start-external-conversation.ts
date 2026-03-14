import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import type { ChannelAdapter } from '../channels/types.js';
import type { ConversationManager } from '../conversations/manager.js';

export function createStartExternalConversationTool(
  channels: ChannelAdapter[],
  conversationManager: ConversationManager
): ToolDefinition {
  return {
    name: 'start_external_conversation',
    label: 'Start External Conversation',
    description:
      'Initiate a DM conversation with an external person on Slack. ' +
      'Creates the conversation state file, sends the opening message, and records the thread. ' +
      'Only works on enabled Slack channels.',
    parameters: Type.Object({
      channel: Type.String({
        description: 'Which channel adapter to use. Currently only "slack" is supported.',
      }),
      userId: Type.String({
        description: 'The Slack user ID of the person to message (e.g. U0123456).',
      }),
      displayName: Type.String({
        description: 'Human-readable name of the person (used in conversation records).',
      }),
      purpose: Type.String({
        description:
          'What this conversation is about. This is injected into the external system prompt.',
      }),
      message: Type.String({
        description: 'The opening message to send.',
      }),
    }),
    execute: async (
      _toolCallId,
      params: {
        channel: string;
        userId: string;
        displayName: string;
        purpose: string;
        message: string;
      }
    ) => {
      try {
        const adapter = channels.find((c) => c.name === params.channel) as any;
        if (!adapter) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `❌ Channel "${params.channel}" is not enabled. Available: ${channels.map((c) => c.name).join(', ')}`,
              },
            ],
            details: { error: 'channel_not_found' },
          };
        }

        const boltApp = adapter.getBoltApp?.();
        if (!boltApp) {
          return {
            content: [{ type: 'text' as const, text: `❌ Channel "${params.channel}" does not support start_external_conversation` }],
            details: { error: 'unsupported_channel' },
          };
        }

        // Open a DM channel with the user
        const dmResult = await boltApp.client.conversations.open({ users: params.userId });
        const channelId: string = dmResult.channel.id;

        // Send the opening message
        const msgResult = await boltApp.client.chat.postMessage({
          channel: channelId,
          text: params.message,
        });
        const threadId: string = msgResult.ts;

        // Create conversation state file
        const state = await conversationManager.create({
          channel: params.channel,
          externalUserId: params.userId,
          externalDisplayName: params.displayName,
          threadId,
          channelId,
          purpose: params.purpose,
          initiatedBy: 'owner-initiative',
        });

        // Record the opening message in the exchange log
        await conversationManager.append(state.id, 'fabiana', params.message);

        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ Conversation started with ${params.displayName} (${params.userId}).\nConversation ID: ${state.id}\nThread: ${threadId}`,
            },
          ],
          details: { conversationId: state.id, threadId, channelId },
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `❌ Failed to start external conversation: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  };
}
