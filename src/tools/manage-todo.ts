import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { PermissionValidator } from '../utils/permissions.js';
import fs from 'fs/promises';
import path from 'path';
import { paths } from '../paths.js';

const TODO_DIR = paths.agentTodo;

export function createManageTodoTool(validator: PermissionValidator): ToolDefinition {
  return {
    name: 'manage_todo',
    label: 'Manage Agent TODO',
    description: `Manage the agent's own TODO list. Create tasks (reminders, questions, follow-ups), complete them, or list pending ones.`,
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal('create'),
        Type.Literal('complete'),
        Type.Literal('list'),
      ], { description: 'Action to perform' }),
      id: Type.Optional(Type.String({ description: 'TODO ID (filename without .md) — required for complete' })),
      title: Type.Optional(Type.String({ description: 'Short title for the TODO — required for create' })),
      content: Type.Optional(Type.String({ description: 'Full TODO content in markdown — required for create' })),
      scheduledFor: Type.Optional(Type.String({ description: 'ISO datetime string for scheduled TODOs' })),
    }),
    execute: async (_toolCallId, params: { action: string; id?: string; title?: string; content?: string; scheduledFor?: string }) => {
      const { action, id, title, content, scheduledFor } = params;

      if (action === 'list') {
        try {
          const files = await fs.readdir(`${TODO_DIR}/pending`);
          const mdFiles = files.filter(f => f.endsWith('.md'));
          if (mdFiles.length === 0) {
            return {
              content: [{ type: 'text' as const, text: '📋 No pending TODOs.' }],
              details: { count: 0 },
            };
          }
          const items = mdFiles.map(f => `- ${f.replace('.md', '')}`).join('\n');
          return {
            content: [{ type: 'text' as const, text: `📋 Pending TODOs:\n${items}` }],
            details: { count: mdFiles.length, files: mdFiles },
          };
        } catch {
          return {
            content: [{ type: 'text' as const, text: '📋 No pending TODOs.' }],
            details: { count: 0 },
          };
        }
      }

      if (action === 'create') {
        if (!title || !content) {
          return {
            content: [{ type: 'text' as const, text: '❌ create requires title and content' }],
            details: { error: 'missing_params' },
          };
        }

        const safeId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
        const timestamp = Date.now();
        const filename = `${safeId}-${timestamp}`;

        const targetDir = scheduledFor
          ? `${TODO_DIR}/scheduled/${scheduledFor.slice(0, 10)}`
          : `${TODO_DIR}/pending`;

        const filePath = `${targetDir}/${filename}.md`;

        if (!validator.canWrite(filePath)) {
          return {
            content: [{ type: 'text' as const, text: `❌ PERMISSION DENIED writing TODO` }],
            details: { error: 'permission_denied' },
          };
        }

        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');

        return {
          content: [{ type: 'text' as const, text: `✅ TODO created: ${filename}` }],
          details: { id: filename, path: filePath },
        };
      }

      if (action === 'complete') {
        if (!id) {
          return {
            content: [{ type: 'text' as const, text: '❌ complete requires id' }],
            details: { error: 'missing_params' },
          };
        }

        const pendingPath = `${TODO_DIR}/pending/${id}.md`;
        const today = new Date().toISOString().slice(0, 10);
        const completedDir = `${TODO_DIR}/completed/${today}`;
        const completedPath = `${completedDir}/${id}.md`;

        try {
          await fs.mkdir(completedDir, { recursive: true });
          await fs.rename(pendingPath, completedPath);
          return {
            content: [{ type: 'text' as const, text: `✅ TODO completed: ${id}` }],
            details: { id, completedPath },
          };
        } catch (err: any) {
          return {
            content: [{ type: 'text' as const, text: `❌ Could not complete TODO ${id}: ${err.message}` }],
            details: { error: err.message },
          };
        }
      }

      return {
        content: [{ type: 'text' as const, text: `❌ Unknown action: ${action}` }],
        details: { error: 'unknown_action' },
      };
    },
  };
}
