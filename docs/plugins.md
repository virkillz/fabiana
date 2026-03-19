# Plugin Development

A plugin is a self-contained directory with three files. You can place it directly in `plugins/` for local use, or publish it as a GitHub repo for others to install with `fabiana plugins add`.

> **Path convention:** `<agent-home>` refers to `~/.fabiana/agents/<name>/` (e.g. `~/.fabiana/agents/default/` for the default agent). Plugins themselves live at `~/.fabiana/plugins/` and are **shared across all agents** — each agent controls which ones are active via its own `<agent-home>/config/plugins.json`.

## Skills vs. plugins

Fabiana has two extension mechanisms. Choose the right one before you start:

| | Skill | Plugin |
|---|---|---|
| **What it adds** | Specialized instructions and context | A new tool the agent can call |
| **Requires code?** | No — just Markdown | Yes — TypeScript `execute()` function |
| **Use when** | The agent needs to *know how* to do something with existing tools | The agent needs to *call an external API* or system it can't reach otherwise |

**Use a skill** when the task is achievable with the tools Fabiana already has (`safe_read`, `safe_write`, `send_telegram`, etc.) and you just want to give the agent better instructions, templates, or domain knowledge. See [skills.md](./skills.md).

**Use a plugin** when you need to call an external API, run a CLI tool, or add a capability that doesn't exist in the current tool set. Keep reading.

---

Fabiana ships with several built-in plugins:

- **`brave_search`** — Web search for news and facts
- **`calendar`** — Google Calendar awareness via `gccli`
- **`hackernews`** — Top stories from HN
- **`stable-diffusion`** — Generate and send images via Stable Diffusion
- **`tts`** — Convert text to speech and send voice messages via Telegram

---

## File structure

```
plugins/my-plugin/
├── index.ts       ← tool implementation (required)
├── package.json   ← must have "type": "module" (required)
└── plugin.json    ← manifest: metadata, env vars, default config (required for publishing)
```

---

## `ToolDefinition`

Each plugin exports a `tool` constant that satisfies the `ToolDefinition` interface, which is defined by the Pi SDK (`@mariozechner/pi-coding-agent`). This is a Pi standard — not something specific to Fabiana.

```ts
interface ToolDefinition<TParams extends TSchema = TSchema, TDetails = unknown> {
  name: string;              // identifier used in LLM tool calls
  label: string;             // human-readable label shown in logs/UI
  description: string;       // description sent to the LLM — write this as instructions
  promptSnippet?: string;    // one-line blurb in the system prompt "Available tools" section
  promptGuidelines?: string[]; // extra guideline bullets injected into the system prompt
  parameters: TParams;       // TypeBox schema describing the tool's inputs
  execute(
    toolCallId: string,
    params: Static<TParams>,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
    ctx: ExtensionContext
  ): Promise<AgentToolResult<TDetails>>;
  renderCall?: (args: Static<TParams>, theme: Theme) => Component | undefined;
  renderResult?: (result: AgentToolResult<TDetails>, options: ToolRenderResultOptions, theme: Theme) => Component | undefined;
}
```

Key points:

- **Parameters use [TypeBox](https://github.com/sinclairzx81/typebox)** (`TSchema`) for JSON Schema definitions — use `Type.Object(...)`, `Type.String(...)`, etc.
- **`description`** is what the agent reads to decide when and how to use your tool — write it as clear instructions, not a one-liner.
- **`promptSnippet`** and **`promptGuidelines`** let your tool inject text directly into the system prompt, extending the agent's built-in instructions.
- **`execute`** receives an `ExtensionContext` (`ctx`) with access to session state. For most plugins you only need `params`.

---

## `index.ts`

Export a `tool` constant that satisfies `ToolDefinition`:

```typescript
import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';

export const tool: ToolDefinition = {
  name: 'my_tool',
  label: 'My Tool',
  description: 'What your tool does. Include when to use it.',
  parameters: Type.Object({
    query: Type.String({ description: 'The search query' }),
  }),
  execute: async (_toolCallId, params) => {
    const apiKey = process.env.MY_API_KEY;
    if (!apiKey) {
      return {
        content: [{ type: 'text' as const, text: '❌ MY_API_KEY not set.' }],
        details: { error: 'Missing API key' },
      };
    }
    const result = await doSomething(params.query, apiKey);
    return {
      content: [{ type: 'text' as const, text: result }],
      details: { success: true },
    };
  },
};
```

---

## `package.json`

```json
{
  "name": "fabiana-plugin-my-plugin",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "some-library": "^1.0.0"
  },
  "devDependencies": {
    "@mariozechner/pi-coding-agent": "latest",
    "@sinclair/typebox": "^0.34.0",
    "typescript": "^5.4.0"
  }
}
```

`"type": "module"` is required — Fabiana uses ESM throughout.

**Dependencies:** Any packages listed under `dependencies` are automatically installed and **bundled** into the plugin at install time using esbuild — no manual `npm install` required on the user's side. Fabiana's own packages (`@sinclair/typebox`, `@mariozechner/pi-coding-agent`, etc.) are always available at runtime and should be listed under `devDependencies` only (they won't be bundled, they resolve from Fabiana's own `node_modules`).

---

## `plugin.json`

The manifest is what makes your plugin installable via `fabiana plugins add`. It declares metadata, required environment variables, and default config that gets written into `<agent-home>/config/plugins.json` on install.

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Short description of what this plugin does",
  "env": [
    {
      "key": "MY_API_KEY",
      "required": true,
      "description": "API key from example.com/api"
    },
    {
      "key": "MY_OPTIONAL_SETTING",
      "required": false,
      "description": "Optional override (defaults to 'auto')"
    }
  ],
  "config": {
    "enabled": true,
    "someDefault": 10
  }
}
```

- **`env`** — declares which environment variables your plugin needs. `fabiana doctor` will check these automatically for any installed plugin that has a `plugin.json`.
- **`config`** — default values merged into `.fabiana/config/plugins.json` on install. Behavioral settings only — never put secrets here.

---

## Installing locally

Fabiana loads plugins from `~/.fabiana/plugins/` at runtime — not from the project's `plugins/` directory. Plugins must be compiled and copied there before Fabiana can use them.

**Step 1 — Write your plugin** in `plugins/my-plugin/index.ts` (see above).

**Step 2 — Build all plugins:**

```bash
node scripts/build-plugins.js
```

This compiles every plugin in `plugins/` to `dist/plugins/` using esbuild, bundling any third-party dependencies.

**Step 3 — Copy the compiled plugin to Fabiana's home:**

```bash
cp -r dist/plugins/my-plugin ~/.fabiana/plugins/my-plugin
```

**Step 4 — Restart the daemon.** You should see this line in the startup logs:

```
[PLUGINS] ✓ my_tool v1.0.0
```

> Repeat steps 2–3 any time you update the plugin source. The `dist/` output is what gets deployed — never copy the raw `index.ts` to `~/.fabiana/plugins/`.

To configure or disable it, add an entry to `<agent-home>/config/plugins.json`:

```json
{
  "my-plugin": {
    "enabled": true,
    "someDefault": 20
  }
}
```

---

## Publishing and installing from GitHub

Push your plugin as a GitHub repo with `index.ts` at the root (not nested in a subfolder). Then anyone can install it with:

```bash
fabiana plugins add your-username/my-plugin
```

What happens under the hood:
1. Clones the repo to a temp directory
2. Validates the plugin structure
3. Runs `npm install` for any `dependencies` declared in `package.json`
4. Bundles `index.ts` (or `index.js`) into a single `plugins/<name>/index.js` using esbuild — your deps are inlined, Fabiana's own deps stay external
5. Copies `plugin.json` alongside the bundle
6. Merges default config from `plugin.json` into `<agent-home>/config/plugins.json`
7. Prints any environment variables the plugin needs

**You do not need to pre-compile or commit built files.** Ship TypeScript source — Fabiana handles the rest.

To see what's installed:

```bash
fabiana plugins list
```
