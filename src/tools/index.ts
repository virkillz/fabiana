import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { PermissionValidator } from '../utils/permissions.js';
import { createSafeReadTool } from './safe-read.js';
import { createSafeWriteTool } from './safe-write.js';
import { createSafeEditTool } from './safe-edit.js';
import { createSendTelegramTool } from './send-telegram.js';
import { createManageTodoTool } from './manage-todo.js';
import { createFetchUrlTool } from './fetch-url.js';

export function createFabianaTools(
  validator: PermissionValidator,
  sendMessage: (text: string) => Promise<void>
): ToolDefinition[] {
  return [
    createSafeReadTool(),
    createSafeWriteTool(validator),
    createSafeEditTool(validator),
    createSendTelegramTool(sendMessage),
    createManageTodoTool(validator),
    createFetchUrlTool(),
  ];
}
