import { Command } from 'commander';
import { startDaemon, runInitiativeOnce, runConsolidateOnce } from './daemon/index.js';
import { runDoctor } from './doctor.js';
import { runBackup, runRestore } from './backup.js';
import { pluginsAdd, pluginsList } from './plugins-cmd.js';

const program = new Command();

program
  .name('fabiana')
  .description('Virtual life companion — always on, always remembering')
  .version('0.1.0');

program
  .command('start', { isDefault: true })
  .description('Start daemon mode: Telegram polling + initiative checks + midnight consolidation')
  .action(startDaemon);

program
  .command('initiative')
  .description('Run a one-time initiative check (useful for testing)')
  .action(runInitiativeOnce);

program
  .command('consolidate')
  .description('Run a one-time memory consolidation')
  .action(runConsolidateOnce);

program
  .command('doctor')
  .description('Check configuration, environment, Pi SDK, Telegram, plugins, and data directories')
  .action(runDoctor);

program
  .command('backup')
  .description('Compress .fabiana/data into a timestamped archive in the current directory')
  .option('-o, --output <filename>', 'override output filename')
  .action((opts) => runBackup(opts));

program
  .command('restore <filepath>')
  .description('Restore .fabiana/data from a backup archive')
  .option('-f, --force', 'skip confirmation prompt if data directory exists')
  .action((filepath, opts) => runRestore(filepath, opts));

const plugins = new Command('plugins').description('Manage Fabiana plugins');

plugins
  .command('add <repo>')
  .description('Install a plugin from GitHub (format: username/reponame)')
  .action((repo: string) => pluginsAdd(repo));

plugins
  .command('list')
  .description('List installed plugins and their status')
  .action(pluginsList);

program.addCommand(plugins);

program.addHelpCommand(
  new Command('help')
    .argument('[command]', 'command to show help for')
    .description('Show help for fabiana or a specific command')
);

program.parse();
