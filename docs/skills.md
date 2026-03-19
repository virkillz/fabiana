# Skill Development

A skill is a Markdown file that gives Fabiana specialized instructions for a specific task. Unlike plugins (which add new tools), skills extend what the agent *knows how to do* with the tools it already has.

Fabiana ships with no built-in skills — everything in `~/.fabiana/skills/` is user-installed.

> **Path convention:** `<agent-home>` refers to `~/.fabiana/agents/<name>/` (e.g. `~/.fabiana/agents/default/` for the default agent). Skills themselves live at `~/.fabiana/skills/` and are **shared across all agents** — each agent controls which ones are active via its own `<agent-home>/config/skills.json`.

---

## When to use a skill vs. a plugin

| | Skill | Plugin |
|---|---|---|
| **What it adds** | Specialized instructions and context | A new tool the agent can call |
| **Requires code?** | No — just Markdown | Yes — TypeScript `execute()` function |
| **Use when** | The agent needs to *know how* to do something with existing tools | The agent needs to *call an external API* or system it can't reach otherwise |

**Use a skill when:**
- You want Fabiana to follow a specific workflow (e.g. "when writing a diary entry, always use this format")
- You want to inject domain knowledge or context for a recurring task
- You want to provide templates, examples, or step-by-step procedures
- The task is achievable with `safe_read`, `safe_write`, `send_telegram`, etc.

**Use a plugin when:**
- You need to call an external API (weather, finance, home automation, etc.)
- You need to run a CLI tool and capture its output
- You need capabilities that don't exist in the current tool set

---

## File structure

```
~/.fabiana/skills/my-skill/
└── SKILL.md    ← instructions + frontmatter (required)
```

That's it. No `package.json`, no code. A skill is just a directory with a single Markdown file.

If your skill needs to reference supporting files (templates, examples, config), you can add them to the directory and reference them by their path in `SKILL.md`. The agent uses the `safe_read` tool to load them at runtime.

---

## `SKILL.md`

The file must start with YAML frontmatter containing at least a `description` field. The `name` field is optional — if omitted, the directory name is used.

```markdown
---
name: My Skill
description: Concise one-line summary — this is what the agent reads to decide whether to load the skill
---

## When to use this skill

Describe the situations where the agent should apply these instructions.

## Instructions

Step-by-step instructions, templates, formatting rules, or whatever context the agent needs.

## Example

Optionally include an example of the expected output or workflow.
```

### How skills are loaded

Fabiana injects the name, description, and file path of every enabled skill into the system prompt. When the agent decides the current task matches a skill's description, it reads `SKILL.md` using the `safe_read` tool and follows the instructions inside.

The agent replaces `{baseDir}` anywhere in the skill file with the skill's directory path, so you can reference sibling files:

```markdown
Load the template from {baseDir}/template.md before writing.
```

---

## Installing locally

Drop your skill directory into `~/.fabiana/skills/` and restart Fabiana:

```bash
mkdir -p ~/.fabiana/skills/my-skill
# write your SKILL.md
```

To disable without removing it, edit `<agent-home>/config/skills.json`:

```json
{
  "my-skill": { "enabled": false }
}
```

If `skills.json` doesn't exist, all installed skills are enabled by default.

---

## Installing from GitHub

```bash
fabiana skills add username/repo
```

This installs the entire repo as a skill named after the repo. If the repo is a collection with multiple skills in subdirectories:

```bash
fabiana skills add username/collection/skill-name
```

This copies only the `skill-name/` subdirectory.

What happens under the hood:
1. Clones the repo to a temp directory
2. Validates that `SKILL.md` exists and has a `description` in frontmatter
3. Copies the skill directory to `~/.fabiana/skills/<name>/`
4. Runs `npm install` if a `package.json` with dependencies is present (for skills that ship helper scripts)
5. Registers the skill as enabled in `<agent-home>/config/skills.json`

---

## Managing skills

```bash
fabiana skills list              # show all installed skills
fabiana skills add user/repo     # install from GitHub
fabiana skills remove my-skill   # uninstall
fabiana skills enable my-skill   # re-enable a disabled skill
fabiana skills disable my-skill  # disable without removing
```
