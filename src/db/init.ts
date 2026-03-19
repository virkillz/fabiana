import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { paths } from '../paths.js';

function schemaPath(): string {
  // Works in both dev (src/db/init.ts) and prod (dist/db/init.js)
  const __dir = dirname(fileURLToPath(import.meta.url));
  return join(__dir, 'schema.sql');
}

export function initDb(dbPath?: string): void {
  const targetDb = dbPath ?? paths.memoryDb;

  // Check sqlite3 is available
  try {
    execSync('sqlite3 --version', { stdio: 'ignore' });
  } catch {
    console.warn(
      '[memory-db] sqlite3 not found — structured memory will not be available.\n' +
      '           Install with: sudo apt install sqlite3 (Linux) or brew install sqlite3 (Mac)'
    );
    return;
  }

  if (existsSync(targetDb)) return;

  const schema = schemaPath();
  if (!existsSync(schema)) {
    console.warn(`[memory-db] Schema file not found at ${schema} — skipping DB init`);
    return;
  }

  try {
    execSync(`sqlite3 "${targetDb}" < "${schema}"`);
    console.log(`[memory-db] Initialized ${targetDb}`);
  } catch (err: any) {
    console.warn(`[memory-db] Failed to initialize DB: ${err.message}`);
  }
}
