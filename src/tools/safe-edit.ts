import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { PermissionValidator } from '../utils/permissions.js';
import fs from 'fs/promises';

export function createSafeEditTool(validator: PermissionValidator): ToolDefinition {
  return {
    name: 'safe_edit',
    label: 'Edit File',
    description: 'Edit a file by replacing exact text. oldText must match exactly.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to project root' }),
      oldText: Type.String({ description: 'Exact text to find and replace' }),
      newText: Type.String({ description: 'New text to replace with' }),
    }),
    execute: async (_toolCallId, params: { path: string; oldText: string; newText: string }) => {
      const { path: filePath, oldText, newText } = params;

      if (!validator.canEdit(filePath)) {
        return {
          content: [{ type: 'text' as const, text: `❌ PERMISSION DENIED: Cannot edit ${filePath}` }],
          details: { error: 'permission_denied' },
        };
      }

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        if (!content.includes(oldText)) {
          return {
            content: [{ type: 'text' as const, text: `❌ Text not found in ${filePath}. No changes made.` }],
            details: { error: 'text_not_found' },
          };
        }
        const updated = content.replace(oldText, newText);
        await fs.writeFile(filePath, updated, 'utf-8');
        return {
          content: [{ type: 'text' as const, text: `✅ Edited ${filePath}` }],
          details: { path: filePath },
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error editing ${filePath}: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  };
}
