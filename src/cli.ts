import { config as dotenvConfig } from 'dotenv';
import { paths } from './paths.js';
dotenvConfig({ path: paths.envFile }); // ~/.fabiana/.env (production)
dotenvConfig();                         // .env in cwd (dev fallback)

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { spawnSync } from 'child_process';
import { startDaemon, runInitiativeOnce, runConsolidateOnce } from './daemon/index.js';
import { runDoctor } from './doctor.js';
import { runBackup, runRestore } from './backup.js';
import { pluginsAdd, pluginsList } from './plugins-cmd.js';
import { runSetup } from './setup/index.js';
import { providerStatus, providerUse, providerAdd } from './provider-cmd.js';
import { modelStatus, modelUse, modelTest } from './model-cmd.js';

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
  .command('start')
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
  .command('config')
  .description('Tweak her settings (opens config.json in your editor)')
  .action(() => {
    const editor = process.env.EDITOR ?? process.env.VISUAL ?? 'vi';
    spawnSync(editor, [paths.configJson], { stdio: 'inherit' });
  });

program
  .command('system-prompt')
  .description('Edit her system prompts — choose the mode')
  .action(async () => {
    const { select } = await import('@inquirer/prompts');
    const choice = await select({
      message: 'Which system prompt do you want to edit?',
      choices: [
        { name: 'system       — base identity prompt', value: 'system' },
        { name: 'chat         — chat mode override', value: 'chat' },
        { name: 'initiative   — initiative mode override', value: 'initiative' },
        { name: 'consolidate  — consolidation mode override', value: 'consolidate' },
        { name: 'external     — external mode override', value: 'external' },
      ],
    });
    const file = choice === 'system' ? paths.systemMd() : paths.systemMd(choice);
    const editor = process.env.EDITOR ?? process.env.VISUAL ?? 'vi';
    spawnSync(editor, [file], { stdio: 'inherit' });
  });

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

const provider = new Command('provider').description('Manage AI providers');

provider
  .command('use')
  .description('Switch active provider and model')
  .action(providerUse);

provider
  .command('add')
  .description('Show credential setup instructions for a provider')
  .action(providerAdd);

provider
  .action(providerStatus);

program.addCommand(provider);

const model = new Command('model').description('Manage the active model');

model
  .command('use')
  .description('Switch to a different model')
  .action(modelUse);

model
  .command('test')
  .description('Send a live ping to verify the model works')
  .action(modelTest);

model
  .action(modelStatus);

program.addCommand(model);

program.addHelpCommand(
  new Command('help')
    .argument('[command]', 'command to show help for')
    .description('Show help for fabiana or a specific command')
);

if (process.argv.length === 2) {
  program.help();
}

program.parse();
