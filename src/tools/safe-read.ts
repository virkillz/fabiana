import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import fs from 'fs/promises';

export function createSafeReadTool(): ToolDefinition {
  return {
    name: 'safe_read',
    label: 'Read File',
    description: 'Read the contents of any file.',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to project root' }),
    }),
    execute: async (_toolCallId, params: { path: string }) => {
      const { path: filePath } = params;
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').length;
        return {
          content: [{ type: 'text' as const, text: `File: ${filePath} (${lines} lines)\n\n${content}` }],
          details: { path: filePath, lines },
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `❌ Error reading ${filePath}: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  };
}
