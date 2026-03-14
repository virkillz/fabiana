import { config as dotenvConfig } from 'dotenv';
import { paths } from './paths.js';
dotenvConfig({ path: paths.envFile }); // ~/.fabiana/.env (production)
dotenvConfig();                         // .env in cwd (dev fallback)

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { startDaemon, runInitiativeOnce, runConsolidateOnce } from './daemon/index.js';
import { runDoctor } from './doctor.js';
import { runBackup, runRestore } from './backup.js';
import { pluginsAdd, pluginsList } from './plugins-cmd.js';
import { runSetup } from './setup/index.js';

const C = '\x1b[96m';   // cyan — name
const D = '\x1b[2m';    // dim  — subtitle
const R = '\x1b[0m';    // reset

function printBanner() {
  let asciiLines: string[] = [];
  try {
    const asciiPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'ascii.txt');
    asciiLines = readFileSync(asciiPath, 'utf8').trimEnd().split('\n');
  } catch {
    // ascii.txt not found — skip the big title
  }

  console.log();
  if (asciiLines.length) {
    asciiLines.forEach(line => console.log(`${C}${line}${R}`));
  }
  console.log(`\n${D} AI companion who texts you first.${R}\n`);
}

printBanner();

const program = new Command();

program
  .name('fabiana')
  .description('She remembers. She reaches out. She cares.')
  .version('0.1.0')
  .addHelpText('after', `
  She's not waiting to be asked. She'll message you first.
  Run \`fabiana start\` and get out of her way.`);

program
  .command('init')
  .description('First time? Let\'s get acquainted')
  .action(runSetup);

program
  .command('start', { isDefault: true })
  .description('Wake her up — she\'ll take it from there')
  .action(startDaemon);

program
  .command('initiative')
  .description('Make her think. Just once. (good for testing)')
  .action(runInitiativeOnce);

program
  .command('consolidate')
  .description('Tidy up the mind palace')
  .action(runConsolidateOnce);

program
  .command('doctor')
  .description('Is everything okay in there? Let\'s check')
  .action(runDoctor);

program
  .command('backup')
  .description('Save her brain to a zip file')
  .option('-o, --output <filename>', 'override output filename')
  .action((opts) => runBackup(opts));

program
  .command('restore <filepath>')
  .description('Bring her back from the archive')
  .option('-f, --force', 'skip confirmation prompt if data directory exists')
  .action((filepath, opts) => runRestore(filepath, opts));

const plugins = new Command('plugins').description('Teach her new tricks');

plugins
  .command('add <repo>')
  .description('Install a plugin from GitHub (format: username/reponame)')
  .action((repo: string) => pluginsAdd(repo));

plugins
  .command('list')
  .description('What can she do?')
  .action(pluginsList);

program.addCommand(plugins);

program.addHelpCommand(
  new Command('help')
    .argument('[command]', 'command to show help for')
    .description('Show help for fabiana or a specific command')
);

program.parse();
