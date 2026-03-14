import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import readline from 'readline';
import { DATA_DIR } from './paths.js';

const execFileAsync = promisify(execFile);

function makeFilename(): string {
  const now = new Date();
  const iso = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  return `fabiana-${iso}.tar.gz`;
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

export async function runBackup(options: { output?: string }): Promise<void> {
  // Verify data directory exists
  try {
    await fs.access(DATA_DIR);
  } catch {
    console.error(chalk.red(`✗ ${DATA_DIR} not found — nothing to back up`));
    process.exit(1);
  }

  const filename = options.output ?? makeFilename();
  const outPath = path.resolve(filename);

  console.log(chalk.bold('\nBacking up Fabiana data...'));
  console.log(chalk.dim(`  Source: ${DATA_DIR}`));
  console.log(chalk.dim(`  Output: ${outPath}`));

  try {
    await execFileAsync('tar', ['-czf', outPath, DATA_DIR]);
    const stat = await fs.stat(outPath);
    const kb = (stat.size / 1024).toFixed(1);
    console.log(`\n${chalk.green('✓')} Backup saved: ${chalk.cyan(path.basename(outPath))} ${chalk.dim(`(${kb} KB)`)}\n`);
  } catch (e: any) {
    console.error(chalk.red(`✗ Backup failed: ${e.message}`));
    process.exit(1);
  }
}

export async function runRestore(filepath: string, options: { force?: boolean }): Promise<void> {
  const absPath = path.resolve(filepath);

  // Verify archive exists
  try {
    await fs.access(absPath);
  } catch {
    console.error(chalk.red(`✗ File not found: ${absPath}`));
    process.exit(1);
  }

  console.log(chalk.bold('\nRestoring Fabiana data...'));
  console.log(chalk.dim(`  Archive: ${absPath}`));

  // Warn if data directory already exists
  let dataExists = false;
  try {
    await fs.access(DATA_DIR);
    dataExists = true;
  } catch {
    // doesn't exist — no conflict
  }

  if (dataExists) {
    console.log(`\n${chalk.yellow('⚠')} ${chalk.yellow(`${DATA_DIR} already exists and will be overwritten.`)}`);

    if (!options.force) {
      const ok = await confirm('  Continue? (y/N) ');
      if (!ok) {
        console.log(chalk.dim('  Restore cancelled.\n'));
        return;
      }
    }

    await fs.rm(DATA_DIR, { recursive: true, force: true });
  }

  try {
    await execFileAsync('tar', ['-xzf', absPath, '-C', '/']);
    console.log(`\n${chalk.green('✓')} Data restored to ${chalk.cyan(DATA_DIR)}\n`);
  } catch (e: any) {
    console.error(chalk.red(`✗ Restore failed: ${e.message}`));
    process.exit(1);
  }
}
