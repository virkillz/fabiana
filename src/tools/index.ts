import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { PermissionValidator } from '../utils/permissions.js';
import { createSafeReadTool } from './safe-read.js';
import { createSendMessageTool } from './send-message.js';
import { createManageTodoTool } from './manage-todo.js';
import { createFetchUrlTool } from './fetch-url.js';
import { createStartExternalConversationTool } from './start-external-conversation.js';
import type { ChannelAdapter } from '../channels/types.js';
import type { ConversationManager } from '../conversations/manager.js';

export interface CreateToolsOpts {
  toolset: 'full' | 'external';
  channels?: ChannelAdapter[];
  conversationManager?: ConversationManager;
}

export function createFabianaTools(
  validator: PermissionValidator,
  sendMessage: (text: string) => Promise<void>,
  opts: CreateToolsOpts = { toolset: 'full' }
): ToolDefinition[] {
  if (opts.toolset === 'external') {
    // Restricted toolset for external (non-owner) sessions:
    // send_message, safe_read (read-only), manage_todo (append-only via permissions)
    return [
      createSendMessageTool(sendMessage),
      createSafeReadTool(),
      createManageTodoTool(validator),
    ];
  }

  // Full toolset for owner sessions
  const tools: ToolDefinition[] = [
    createSendMessageTool(sendMessage),
    createManageTodoTool(validator),
    createFetchUrlTool(),
  ];

  if (opts.channels && opts.conversationManager) {
    tools.push(createStartExternalConversationTool(opts.channels, opts.conversationManager));
  }

  return tools;
}
