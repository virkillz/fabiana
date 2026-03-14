import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import fs from 'fs/promises';
import path from 'path';
import { FABIANA_HOME } from '../paths.js';

function resolve(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(FABIANA_HOME, filePath);
}

export function createSafeReadTool(): ToolDefinition {
  return {
    name: 'safe_read',
    label: 'Read File',
    description: 'Read the contents of any file. Paths are relative to the Fabiana home directory (~/.fabiana).',
    parameters: Type.Object({
      path: Type.String({ description: 'File path relative to ~/.fabiana, or absolute' }),
    }),
    execute: async (_toolCallId, params: { path: string }) => {
      const { path: filePath } = params;
      const resolved = resolve(filePath);
      try {
        const content = await fs.readFile(resolved, 'utf-8');
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
