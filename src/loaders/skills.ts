import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { SHARED_SKILLS_DIR, paths, type AgentPaths } from '../paths.js';

interface Skill {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
}

interface SkillsConfig {
  [name: string]: { enabled: boolean };
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key && value) fm[key] = value;
  }
  return fm;
}

export async function loadFabianaSkills(agentPaths?: AgentPaths): Promise<Skill[]> {
  const skills: Skill[] = [];
  const skillsConfigPath = agentPaths?.skillsJson ?? paths.skillsJson;

  // Skills directory: use shared dir (synced from package)
  const skillsDir = SHARED_SKILLS_DIR;
  if (!existsSync(skillsDir)) return skills;

  let config: SkillsConfig = {};
  try {
    const raw = await fs.readFile(skillsConfigPath, 'utf-8');
    config = JSON.parse(raw);
  } catch { /* no config — all enabled by default */ }

  let entries: string[] = [];
  try {
    const dirEntries = await fs.readdir(skillsDir, { withFileTypes: true });
    entries = dirEntries.filter(e => e.isDirectory()).map(e => e.name);
  } catch { return skills; }

  for (const dir of entries) {
    const cfg = config[dir];
    if (cfg?.enabled === false) continue;

    const skillFile = path.join(skillsDir, dir, 'SKILL.md');
    try {
      const content = await fs.readFile(skillFile, 'utf-8');
      const fm = parseFrontmatter(content);
      if (!fm.description) continue;

      skills.push({
        name: fm.name || dir,
        description: fm.description,
        filePath: skillFile,
        baseDir: path.join(skillsDir, dir),
      });
    } catch { continue; }
  }

  return skills;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';

  const lines = [
    '\n\nThe following skills provide specialized instructions for specific tasks.',
    'Use the read tool to load a skill\'s SKILL.md file when the task matches its description.',
    'When a skill file references {baseDir}, replace it with the skill\'s directory (parent of SKILL.md).',
    '',
    '<available_skills>',
  ];

  for (const skill of skills) {
    lines.push('  <skill>');
    lines.push(`    <name>${escapeXml(skill.name)}</name>`);
    lines.push(`    <description>${escapeXml(skill.description)}</description>`);
    lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
    lines.push('  </skill>');
  }

  lines.push('</available_skills>');
  return lines.join('\n');
}
