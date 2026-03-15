import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { SKILLS_DIR, paths } from './paths.js';

const execFileAsync = promisify(execFile);

interface SkillsConfig {
  [name: string]: { enabled: boolean };
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFrontmatter(content: string): SkillFrontmatter {
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

async function loadConfig(): Promise<SkillsConfig> {
  try {
    const raw = await fs.readFile(paths.skillsJson, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveConfig(config: SkillsConfig): Promise<void> {
  await fs.mkdir(path.dirname(paths.skillsJson), { recursive: true });
  await fs.writeFile(paths.skillsJson, JSON.stringify(config, null, 2) + '\n');
}

async function validateSkillDir(dir: string): Promise<{ ok: boolean; errors: string[]; fm: SkillFrontmatter }> {
  const errors: string[] = [];
  let fm: SkillFrontmatter = {};

  const skillFile = path.join(dir, 'SKILL.md');
  try {
    const content = await fs.readFile(skillFile, 'utf-8');
    fm = parseFrontmatter(content);
    if (!fm.description) {
      errors.push('SKILL.md must have a "description" field in YAML frontmatter');
    }
  } catch {
    errors.push('Missing SKILL.md — every skill requires this file');
  }

  return { ok: errors.length === 0, errors, fm };
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/**
 * Install a skill from GitHub.
 *
 * Supported formats:
 *   username/repo              — entire repo becomes the skill
 *   username/collection/skill  — copies <skill> subdirectory from <collection> repo
 */
export async function skillsAdd(source: string): Promise<void> {
  const parts = source.split('/').filter(Boolean);

  let repoOwner: string;
  let repoName: string;
  let subDir: string | null = null;
  let skillName: string;

  if (parts.length === 3) {
    [repoOwner, repoName, subDir] = parts;
    skillName = subDir;
  } else if (parts.length === 2) {
    [repoOwner, repoName] = parts;
    skillName = repoName;
  } else {
    console.error(chalk.red('✗ Invalid format. Use: username/reponame  or  username/collection/skill-name'));
    process.exit(1);
  }

  const destDir = path.join(SKILLS_DIR, skillName);
  const tmpDir = `/tmp/fabiana-skill-${skillName}-${Date.now()}`;

  console.log(`\n${chalk.bold('Installing skill:')} ${chalk.cyan(source)}`);

  // Check if already installed
  if (existsSync(destDir)) {
    console.error(chalk.red(`✗ Skill "${skillName}" already exists at ${destDir}`));
    console.log(chalk.dim('  Use "fabiana skills remove" first to reinstall'));
    process.exit(1);
  }

  try {
    // Clone the repo
    const repoUrl = `https://github.com/${repoOwner}/${repoName}.git`;
    console.log(`  Cloning ${chalk.dim(repoUrl)}...`);
    try {
      await execFileAsync('git', ['clone', '--depth', '1', repoUrl, tmpDir], { timeout: 30_000 });
    } catch (err: any) {
      const hint = err.message.includes('not found') || err.message.includes('Repository')
        ? `repository github.com/${repoOwner}/${repoName} not found`
        : err.message;
      console.error(chalk.red(`✗ Clone failed: ${hint}`));
      process.exit(1);
    }

    // Determine the source directory to copy from
    const srcDir = subDir ? path.join(tmpDir, subDir) : tmpDir;

    if (!existsSync(srcDir)) {
      console.error(chalk.red(`✗ Subdirectory "${subDir}" not found in ${repoOwner}/${repoName}`));
      process.exit(1);
    }

    // Validate
    console.log('  Validating skill structure...');
    const { ok, errors, fm } = await validateSkillDir(srcDir);
    if (!ok) {
      console.error(chalk.red('\n✗ Skill validation failed:'));
      for (const e of errors) {
        console.error(`  ${chalk.red('·')} ${e}`);
      }
      process.exit(1);
    }
    console.log(`  ${chalk.green('✓')} Structure valid`);

    // Copy to destination (exclude .git)
    await fs.mkdir(SKILLS_DIR, { recursive: true });
    await copyDir(srcDir, destDir);

    // Remove .git if it ended up in destDir (2-part install copies whole repo)
    await fs.rm(path.join(destDir, '.git'), { recursive: true, force: true });

    // Run npm install if skill has its own package.json
    const pkgFile = path.join(destDir, 'package.json');
    if (existsSync(pkgFile)) {
      try {
        const pkgRaw = await fs.readFile(pkgFile, 'utf-8');
        const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
        const depCount = Object.keys({
          ...(pkg.dependencies as object ?? {}),
          ...(pkg.optionalDependencies as object ?? {}),
        }).length;
        if (depCount > 0) {
          console.log(`  Installing ${depCount} skill dependency(ies)...`);
          await execFileAsync('npm', ['install', '--omit=dev'], { cwd: destDir, timeout: 60_000 });
          console.log(`  ${chalk.green('✓')} Dependencies installed`);
        }
      } catch {
        console.log(chalk.yellow('  ⚠ npm install failed — skill scripts may not work'));
      }
    }

    // Register in skills.json as enabled
    const config = await loadConfig();
    config[skillName] = { enabled: true };
    await saveConfig(config);

    const nameLabel = fm.name ?? skillName;
    console.log(`\n  ${chalk.green('✓')} Installed: ${chalk.bold(nameLabel)}`);
    if (fm.description) {
      console.log(`  ${chalk.dim(fm.description)}`);
    }
    console.log(`\n  ${chalk.dim('Run')} ${chalk.cyan('fabiana skills list')} ${chalk.dim('to see all installed skills.')}\n`);

  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function skillsList(): Promise<void> {
  const config = await loadConfig();

  let dirs: string[] = [];
  try {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    // No skills directory yet
  }

  if (dirs.length === 0) {
    console.log('\n  No skills installed.');
    console.log(chalk.dim('\n  Try: fabiana skills add badlogic/pi-skills/gccli\n'));
    return;
  }

  console.log(`\n${chalk.bold('Installed skills:')}\n`);

  for (const dir of dirs) {
    const cfg = config[dir];
    const isEnabled = cfg === undefined || cfg.enabled !== false;
    const statusIcon = isEnabled ? chalk.green('✓') : chalk.dim('⊘');
    const statusLabel = isEnabled ? '' : chalk.dim(' (disabled)');

    let description = '';
    let name = dir;
    try {
      const content = await fs.readFile(path.join(SKILLS_DIR, dir, 'SKILL.md'), 'utf-8');
      const fm = parseFrontmatter(content);
      if (fm.name) name = fm.name;
      if (fm.description) description = fm.description;
    } catch { /* no SKILL.md */ }

    console.log(`  ${statusIcon} ${chalk.bold(name)}${statusLabel}`);
    if (description) console.log(`    ${chalk.dim(description)}`);
  }

  console.log('');
}

export async function skillsRemove(name: string): Promise<void> {
  const destDir = path.join(SKILLS_DIR, name);

  if (!existsSync(destDir)) {
    console.error(chalk.red(`✗ Skill "${name}" is not installed`));
    process.exit(1);
  }

  await fs.rm(destDir, { recursive: true, force: true });

  const config = await loadConfig();
  delete config[name];
  await saveConfig(config);

  console.log(`\n  ${chalk.green('✓')} Removed: ${chalk.bold(name)}\n`);
}

export async function skillsEnable(name: string): Promise<void> {
  const destDir = path.join(SKILLS_DIR, name);
  if (!existsSync(destDir)) {
    console.error(chalk.red(`✗ Skill "${name}" is not installed`));
    process.exit(1);
  }
  const config = await loadConfig();
  config[name] = { ...(config[name] ?? {}), enabled: true };
  await saveConfig(config);
  console.log(`\n  ${chalk.green('✓')} Enabled: ${chalk.bold(name)}\n`);
}

export async function skillsDisable(name: string): Promise<void> {
  const destDir = path.join(SKILLS_DIR, name);
  if (!existsSync(destDir)) {
    console.error(chalk.red(`✗ Skill "${name}" is not installed`));
    process.exit(1);
  }
  const config = await loadConfig();
  config[name] = { ...(config[name] ?? {}), enabled: false };
  await saveConfig(config);
  console.log(`\n  ${chalk.dim('⊘')} Disabled: ${chalk.bold(name)}\n`);
}
