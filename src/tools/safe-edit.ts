import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { PermissionValidator } from '../utils/permissions.js';
import fs from 'fs/promises';
import path from 'path';
import { FABIANA_HOME } from '../paths.js';

function resolve(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(FABIANA_HOME, filePath);
}

export function createSafeEditTool(validator: PermissionValidator): ToolDefinition {
  return {
    name: 'safe_edit',
    label: 'Edit File',
    description: 'Edit a file by replacing exact text. oldText must match exactly. Paths are relative to ~/.fabiana.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to ~/.fabiana, or absolute' }),
      oldText: Type.String({ description: 'Exact text to find and replace' }),
      newText: Type.String({ description: 'New text to replace with' }),
    }),
    execute: async (_toolCallId, params: { path: string; oldText: string; newText: string }) => {
      const { path: filePath, oldText, newText } = params;
      const resolved = resolve(filePath);

      if (!validator.canEdit(resolved)) {
        return {
          content: [{ type: 'text' as const, text: `❌ PERMISSION DENIED: Cannot edit ${filePath}` }],
          details: { error: 'permission_denied' },
        };
      }

      try {
        const content = await fs.readFile(resolved, 'utf-8');
        if (!content.includes(oldText)) {
          return {
            content: [{ type: 'text' as const, text: `❌ Text not found in ${filePath}. No changes made.` }],
            details: { error: 'text_not_found' },
          };
        }
        const updated = content.replace(oldText, newText);
        await fs.writeFile(resolved, updated, 'utf-8');
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
