import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { paths } from '../paths.js';

function schemaPath(): string {
  // Works in both dev (src/db/init.ts) and prod (dist/db/init.js)
  const __dir = dirname(fileURLToPath(import.meta.url));
  return join(__dir, 'schema.sql');
}

export function initDb(): void {
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

  if (existsSync(paths.memoryDb)) return;

  const schema = schemaPath();
  if (!existsSync(schema)) {
    console.warn(`[memory-db] Schema file not found at ${schema} — skipping DB init`);
    return;
  }

  try {
    execSync(`sqlite3 "${paths.memoryDb}" < "${schema}"`);
    console.log(`[memory-db] Initialized ${paths.memoryDb}`);
  } catch (err: any) {
    console.warn(`[memory-db] Failed to initialize DB: ${err.message}`);
  }
}
