import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { paths } from '../paths.js';

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function runSql(sql: string): void {
  execSync(`sqlite3 "${paths.memoryDb}"`, { input: sql, stdio: ['pipe', 'inherit', 'inherit'] });
}

function capitalizeName(filename: string): string {
  return filename
    .split(/[-_\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function runMigration(): Promise<void> {
  try {
    execSync('sqlite3 --version', { stdio: 'ignore' });
  } catch {
    console.error('❌ sqlite3 not found. Install with: sudo apt install sqlite3 (Linux) or brew install sqlite3 (Mac)');
    process.exit(1);
  }

  if (!existsSync(paths.memoryDb)) {
    console.error(`❌ memory.db not found at ${paths.memoryDb}. Run \`fabiana init\` first.`);
    process.exit(1);
  }

  const memoryRoot = paths.memory();
  let peopleCount = 0;
  let interestCount = 0;
  let factCount = 0;

  console.log('\n🗄️  Migrating flat memory files → SQLite\n');

  // ── 1. People ────────────────────────────────────────────────────────────
  const peopleDir = join(memoryRoot, 'people');
  if (existsSync(peopleDir)) {
    const files = readdirSync(peopleDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const raw = basename(file, '.md');
      const name = capitalizeName(raw);
      const bio = readFileSync(join(peopleDir, file), 'utf-8').trim();

      // Best-effort relationship guess from the file content
      let relationship: string | null = null;
      const lowerBio = bio.toLowerCase();
      if (/\bfamily\b|\bmother\b|\bfather\b|\bsister\b|\bbrother\b|\bwife\b|\bhusband\b|\bchild\b|\bchildren\b/.test(lowerBio)) {
        relationship = 'family';
      } else if (/\bfriend\b/.test(lowerBio)) {
        relationship = 'friend';
      } else if (/\bcolleague\b|\bworks\b|\bteam\b|\bmanager\b|\breport\b|\bco-worker\b/.test(lowerBio)) {
        relationship = 'colleague';
      }

      const relVal = relationship ? `'${relationship}'` : 'NULL';
      runSql(
        `INSERT INTO people (name, relationship, bio) VALUES ('${sqlEscape(name)}', ${relVal}, '${sqlEscape(bio)}') ON CONFLICT(name) DO UPDATE SET bio = excluded.bio, relationship = COALESCE(excluded.relationship, relationship);`
      );
      console.log(`  👤 ${name}`);
      peopleCount++;
    }
    console.log(`✓ People: ${peopleCount} imported\n`);
  } else {
    console.log('  People: no people/ dir — skipping\n');
  }

  // ── 2. Interests ─────────────────────────────────────────────────────────
  const topicsPath = join(memoryRoot, 'interests', 'topics.md');
  if (existsSync(topicsPath)) {
    const content = readFileSync(topicsPath, 'utf-8');
    let currentSection = 'general';
    for (const line of content.split('\n')) {
      if (line.startsWith('## ')) {
        currentSection = line.replace(/^## /, '').trim().toLowerCase().replace(/\s+/g, '_');
      } else if (line.startsWith('- ')) {
        const topic = line.replace(/^- /, '').trim();
        if (!topic) continue;
        runSql(
          `INSERT OR IGNORE INTO memories (content, category, subject, tier) VALUES ('${sqlEscape(topic)}', 'interest', '${sqlEscape(currentSection)}', 'warm');`
        );
        interestCount++;
      }
    }
    console.log(`✓ Interests: ${interestCount} imported\n`);
  } else {
    console.log('  Interests: no topics.md — skipping\n');
  }

  // ── 3. This week ─────────────────────────────────────────────────────────
  const thisWeekPath = join(memoryRoot, 'recent', 'this-week.md');
  if (existsSync(thisWeekPath)) {
    const content = readFileSync(thisWeekPath, 'utf-8').trim();
    if (content) {
      runSql(
        `INSERT OR IGNORE INTO memories (content, category, subject, tier) VALUES ('${sqlEscape(content)}', 'fact', 'this_week', 'hot');`
      );
      factCount++;
      console.log(`✓ This-week: imported\n`);
    }
  }

  // ── 4. Upcoming dates ────────────────────────────────────────────────────
  // The format is too variable for structured parsing — import as a single fact row.
  // Fabiana can use the memory-db skill to normalise these into proper events rows herself.
  const upcomingPath = join(memoryRoot, 'dates', 'upcoming.md');
  if (existsSync(upcomingPath)) {
    const content = readFileSync(upcomingPath, 'utf-8').trim();
    if (content) {
      runSql(
        `INSERT OR IGNORE INTO memories (content, category, subject, tier) VALUES ('${sqlEscape(content)}', 'fact', 'upcoming_dates', 'warm');`
      );
      factCount++;
      console.log(`✓ Upcoming dates: imported as fact row (let Fabiana normalise into events table)\n`);
    }
  }

  console.log('━'.repeat(50));
  console.log(`✅ Migration complete`);
  console.log(`   People: ${peopleCount}  |  Interests: ${interestCount}  |  Facts: ${factCount}`);
  console.log(`\n   The flat .md files are unchanged — DB is the canonical store going forward.`);
}
