import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { PermissionValidator } from '../utils/permissions.js';
import fs from 'fs/promises';
import path from 'path';

export function createSafeWriteTool(validator: PermissionValidator): ToolDefinition {
  return {
    name: 'safe_write',
    label: 'Write File',
    description: 'Write content to a writable file. Creates file if it does not exist.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to project root' }),
      content: Type.String({ description: 'Content to write' }),
    }),
    execute: async (_toolCallId, params: { path: string; content: string }) => {
      const { path: filePath, content } = params;

      if (!validator.canWrite(filePath)) {
        return {
          content: [{ type: 'text' as const, text: `❌ PERMISSION DENIED: Cannot write to ${filePath}` }],
          details: { error: 'permission_denied' },
        };
      }

      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return {
          content: [{ type: 'text' as const, text: `✅ Written to ${filePath}` }],
          details: { path: filePath },
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error writing ${filePath}: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  };
}
