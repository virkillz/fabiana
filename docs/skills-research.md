# Agent Skills Research: Replacing Fabiana's Plugin System

**Date:** 2026-03-15
**Status:** Research / Feasibility Study

---

## Summary

Pi SDK already has a complete, production-ready skills system that is fully compatible with the Agent Skills standard shared by Claude Code, Codex CLI, Amp, and Droid. Fabiana can tap into this ecosystem — including the existing `pi-skills` library — with a small, focused change to how skills are injected into the system prompt. Skills and plugins are **not competing mechanisms**: they serve different roles and are best used together.

---

## Background: Two Different Ecosystems

### Claude's Agent Skills (platform.claude.com)

The standard is filesystem-based with three progressive disclosure levels:

| Level | Content | Token cost | When loaded |
|-------|---------|-----------|-------------|
| 1 — Metadata | `name` + `description` from YAML frontmatter | ~100 tokens/skill | Always, at startup |
| 2 — Instructions | Body of `SKILL.md` | <5k tokens | When agent judges it relevant |
| 3 — Resources | Scripts, reference docs, templates in subdirectory | Unlimited | Agent reads via bash as needed |

Skills live at:
- **User-level**: `~/.claude/skills/`
- **Project-level**: `.claude/skills/`

### Pi's Skills System (`@mariozechner/pi-coding-agent`)

Pi implements the same standard. Key paths (from `config.js`):
- **User-level**: `~/.pi/agent/skills/`
- **Project-level**: `<cwd>/.pi/skills/`

The loader (`core/skills.js`) scans these directories recursively for `SKILL.md` files, validates frontmatter, and resolves symlinks. Skills are injected into the system prompt as:

```xml
<available_skills>
  <skill>
    <name>brave-search</name>
    <description>Web search and content extraction via Brave Search...</description>
    <location>/path/to/SKILL.md</location>
  </skill>
</available_skills>
```

The agent is instructed to `read` the `SKILL.md` file when it judges the skill relevant — this is the progressive disclosure trigger.

### The `pi-skills` Ecosystem

The `pi-skills` repo (`github.com/badlogic/pi-skills`) is a shared skill library compatible with Pi, Claude Code, Codex CLI, Amp, and Droid. Available skills today:

| Skill | What it does | Fabiana relevance |
|-------|-------------|-------------------|
| `brave-search` | Web search + content extraction | Replaces `brave_search` plugin |
| `browser-tools` | Chrome DevTools automation | New capability |
| `gccli` | Google Calendar CLI | Replaces `calendar` plugin |
| `gdcli` | Google Drive CLI | New capability |
| `gmcli` | Gmail CLI | New capability |
| `transcribe` | Speech-to-text via Groq | New capability |
| `vscode` | VS Code diff integration | New capability |
| `youtube-transcript` | YouTube transcript fetching | New capability |

---

## Current State: Is Pi's Skills System Active in Fabiana?

**Short answer: No. Skills are loaded but silently discarded.**

Here is what Pi does internally when `systemPromptOverride` is used (which Fabiana does in `daemon/index.ts`):

```javascript
// From Pi's system-prompt.js buildSystemPrompt():
if (customPrompt) {
    let prompt = customPrompt;
    // ...
    // Append skills section (only if read tool is available)
    const customPromptHasRead = !selectedTools || selectedTools.includes("read");
    if (customPromptHasRead && skills.length > 0) {
        prompt += formatSkillsForPrompt(skills);
    }
    return prompt;
}
```

Pi *does* append skills to custom prompts. **However**, Fabiana bypasses `buildSystemPrompt` entirely. In `daemon/index.ts`:

```typescript
const loader = new DefaultResourceLoader({
    cwd: process.cwd(),
    systemPromptOverride: () => systemPromptContent,  // ← raw string, skills never appended
});
```

`systemPromptOverride` is a function that returns the raw string directly. Pi's session calls this function and uses it as-is, bypassing `buildSystemPrompt`. The `DefaultResourceLoader` **does** scan and load skills from `.pi/skills/` — they sit in `loader.getSkills()` — but they never reach the system prompt because Fabiana's override function ignores them.

**Result:** Place a `SKILL.md` in `.pi/skills/my-skill/` right now and Fabiana will not see it.

---

## The Fix: One Small Change

The `systemPromptOverride` function receives the loaded skills via `getSkills()`. The simplest fix is to make Fabiana's override function skill-aware:

```typescript
import { loadSkills, formatSkillsForPrompt } from '@mariozechner/pi-coding-agent';

// In runPiSession(), replace the static override:
const loader = new DefaultResourceLoader({
    cwd: process.cwd(),
    systemPromptOverride: () => {
        const { skills } = loadSkills({ cwd: process.cwd() });
        const skillsSection = formatSkillsForPrompt(skills);
        return systemPromptContent + skillsSection;
    },
});
```

Both `loadSkills` and `formatSkillsForPrompt` are already exported from `@mariozechner/pi-coding-agent` (confirmed in `core/index.js` exports and `core/skills.js`). No new dependencies needed.

After this change, Fabiana will:
1. Discover skills in `.pi/skills/` and `~/.pi/agent/skills/`
2. See skill names and descriptions in her system prompt
3. Autonomously `read` the SKILL.md when she judges it relevant
4. Run scripts in skill subdirectories via bash

---

## Skills vs Plugins: The Fundamental Difference

They are not alternatives — they are different tools for different jobs:

| | Plugins | Skills |
|-|---------|--------|
| **Form** | TypeScript `ToolDefinition` | Markdown `SKILL.md` |
| **What they add** | New structured tool calls (new verbs for the agent) | Workflow knowledge (how to use existing tools) |
| **Invocation** | Agent calls `tool_name(params)` with structured args | Agent reads SKILL.md then acts with bash/read/write |
| **Good for** | API integrations needing auth, parsing, or typed I/O | Workflow documentation, bash-based operations |
| **Ecosystem** | Fabiana-specific | Shared across Claude Code, Pi, Codex, Amp, Droid |
| **Maintenance** | TypeScript code | Markdown files |

### When a plugin is the right choice

- Complex authentication (OAuth flows, API key management)
- Response parsing that requires code (HTML scraping like `hackernews`, structured API responses)
- Operations that need typed input validation
- Real-time streaming or event-based integrations

### When a skill is the right choice

- Anything expressible as shell commands (CLI tools, git, gh)
- Workflow sequences: "when you get a Jira ticket, do X then Y then Z"
- Wrapping external CLI tools (gccli, gh, git)
- Cross-plugin orchestration (the Jira → code → PR flow)

---

## Migration Analysis: Which Plugins Can Become Skills?

### `calendar` plugin → **Replace with `gccli` skill from pi-skills**

The existing `calendar` plugin is a thin wrapper around `gccli`. The `pi-skills/gccli` skill already exists and does exactly this — it teaches the agent to use `gccli` via bash. Drop the TypeScript plugin entirely.

Migration: delete `plugins/calendar/`, clone or symlink `pi-skills/gccli` to `.pi/skills/gccli/`.

### `brave_search` plugin → **Replace with `brave-search` skill from pi-skills**

`pi-skills/brave-search` has a Node.js script (`search.js`) that the agent invokes via bash. It covers the same Brave Search API. The skill handles progressive disclosure: the agent reads `SKILL.md` then runs the bundled script.

Migration: delete `plugins/brave-search/`, symlink `pi-skills/brave-search` to `.pi/skills/brave-search/`.

### `hackernews` plugin → **Keep as plugin**

This one parses HTML with regex — it needs code. A pure skill could invoke a bash one-liner or a bundled script, but the current TypeScript implementation is clean and fast. Keep it as a plugin; the value of the TypeScript is the parsing logic.

### GitHub workflow (future) → **Skill, not a plugin**

No TypeScript needed at all. `gh` CLI covers everything:

```markdown
---
name: github-workflow
description: Create branches, commit code, and open pull requests on GitHub. Use when working on a code task that requires pushing changes or creating a PR.
---

# GitHub Workflow

## Prerequisites
- `gh` CLI installed and authenticated (`gh auth login`)
- Workspace path from config.json

## Creating a PR from a Jira ticket

1. Clone the repository into the workspace path
2. Create a branch: `git checkout -b feat/TICKET-ID`
3. Make changes using read/write/edit tools
4. Commit: `git add -A && git commit -m "feat: description (TICKET-ID)"`
5. Push: `git push origin feat/TICKET-ID`
6. Open PR: `gh pr create --title "..." --body "Closes TICKET-ID"`
7. Report the PR URL via send_message
```

### Jira workflow (future) → **Plugin for API + Skill for workflow**

The Jira plugin handles auth and API calls (structured). A separate `jira-workflow` skill handles the agent's decision-making: "when asked to work on a ticket, fetch it with the jira tool, understand the acceptance criteria, then follow the github-workflow skill."

---

## Storage Decision: Global (`~/.fabiana/skills/`)

Skills are stored globally at `~/.fabiana/skills/`, not per-project.

Unlike Claude Code (optimised as a per-project coding agent), Fabiana is a personal companion. There is no meaningful "per-project" scope. The user installs Fabiana once; their skills should be available everywhere without re-installing. The `~/.fabiana/` home already scopes everything per-user — consistent with how config, memory, and plugins are stored.

---

## Proposed Directory Structure After Migration

```
~/.fabiana/
└── skills/
    ├── gccli/              ← installed via: fabiana skills add badlogic/pi-skills/gccli
    │   └── SKILL.md
    ├── brave-search/       ← installed via: fabiana skills add badlogic/pi-skills/brave-search
    │   ├── SKILL.md
    │   └── search.js
    ├── github-workflow/    ← installed via: fabiana skills add username/github-workflow
    │   └── SKILL.md
    └── jira-workflow/      ← installed via: fabiana skills add username/jira-workflow
        └── SKILL.md

fabiana/
└── plugins/
    └── hackernews/         ← kept as TypeScript plugin (HTML parsing needs code)
        └── index.ts
```

---

## Technical Implementation Plan

### Step 1: Wire skills into Fabiana's system prompt (required)

**File**: `src/daemon/index.ts`

Import `loadSkills` and `formatSkillsForPrompt` from the Pi SDK, then modify the `DefaultResourceLoader` instantiation to append the skills section to the custom system prompt. This is the only code change needed to unlock the entire skills ecosystem.

**Effort**: ~10 lines of code change, low risk.

### Step 2: Create the `.pi/skills/` directory and add Fabiana-specific skills

Create `.pi/skills/github-workflow/SKILL.md` with the bash-based GitHub workflow instructions. Create `.pi/skills/jira-workflow/SKILL.md` for the end-to-end ticket workflow orchestration.

**Effort**: Markdown writing, zero code.

### Step 3: Replace `calendar` and `brave_search` plugins with pi-skills

Clone or symlink `pi-skills` into `.pi/skills/`. Update `.fabiana/config/plugins.json` to disable the replaced plugins. Test that Fabiana uses the skill-based versions correctly.

**Effort**: One `git clone`, one config edit, testing.

### Step 4: Add `workspacePath` to `config.json`

Add `"workspacePath": "~/code/fabiana-workspace"` to `config.json`. Reference it in the `github-workflow` skill so Fabiana knows where to clone repos. Add the workspace path to `manifest.json` as writable.

**Effort**: Config edit + skill doc update.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Skills not injected into Fabiana's custom prompt | Confirmed issue today | High | Step 1 fix above |
| `formatSkillsForPrompt` not exported from Pi SDK | Low (verified in source) | High | Fallback: copy the XML format manually |
| Skill-based brave-search performs differently from plugin | Medium | Low | Keep plugin as fallback, test parity |
| Pi SDK update changes `CONFIG_DIR_NAME` or skill paths | Low | Medium | Pin Pi SDK version |
| Skills add context overhead | Low (100 tokens/skill at level 1) | Low | Progressive disclosure prevents bulk loading |

---

## Conclusion

**Yes, Fabiana can and should adopt the standard skills system.** The migration is:

1. **One code change** to wire skills into the system prompt
2. **Two new skill files** for GitHub and Jira workflows (pure markdown)
3. **Two plugin deletions** (calendar, brave-search) replaced by pi-skills
4. **Access to a growing shared ecosystem** compatible with pi-skills and other agents

Plugins remain relevant for capabilities that require TypeScript (hackernews, Jira API, any complex auth or parsing). The right mental model going forward:

> **Plugins** add new tools. **Skills** teach Fabiana how to use them.
