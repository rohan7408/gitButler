import { Command } from 'commander';
import pc from 'picocolors';
import { defaultCheckpointManager } from '@git-butler/checkpoints';

export function createCheckpointCommand(): Command {
  const checkpoint = new Command('checkpoint').description('Manage instant safe snapshots and recovery rollbacks');

  checkpoint
    .command('create <name>')
    .description('Create an instant snapshot checkpoint of current changes')
    .option('-t, --task <taskId>', 'Link checkpoint to specific task ID')
    .option('-s, --summary <summary>', 'Context summary description')
    .option('-C <path>', 'Working directory path', process.cwd())
    .action(async (name, options) => {
      try {
        const cp = await defaultCheckpointManager.create(
          {
            name,
            taskId: options.task,
            contextSummary: options.summary,
          },
          options.C,
          options.C
        );

        console.log(pc.green(pc.bold(`\n✓ Checkpoint created: "${cp.name}"`)));
        console.log(`  ID:     ${pc.cyan(cp.id)}`);
        console.log(`  Commit: ${pc.yellow(cp.commitHash.substring(0, 7))}`);
        console.log(`  Branch: ${cp.branch}`);
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Failed to create checkpoint: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  checkpoint
    .command('list')
    .description('List saved checkpoints')
    .option('-t, --task <taskId>', 'Filter by task ID')
    .option('-C <path>', 'Repository root directory', process.cwd())
    .action((options) => {
      try {
        const list = defaultCheckpointManager.list(options.task, options.C);
        if (list.length === 0) {
          console.log(pc.dim('\nNo checkpoints found.\n'));
          return;
        }

        console.log(pc.bold(`\n📸 Checkpoints (${list.length}):\n`));
        for (const cp of list) {
          console.log(` • [${pc.cyan(cp.id)}] ${pc.bold(cp.name)}`);
          console.log(`   Commit: ${pc.yellow(cp.commitHash.substring(0, 7))} | Branch: ${cp.branch} | Date: ${pc.dim(cp.timestamp)}`);
          if (cp.taskId) {
            console.log(`   Task:   ${pc.dim(cp.taskId)}`);
          }
        }
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Failed to list checkpoints: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  checkpoint
    .command('restore <id>')
    .description('Roll back workspace to a prior checkpoint commit')
    .option('-f, --force', 'Force overwrite uncommitted changes')
    .option('-C <path>', 'Working directory path', process.cwd())
    .action(async (id, options) => {
      try {
        const cp = await defaultCheckpointManager.restore(
          id,
          { force: Boolean(options.force) },
          options.C,
          options.C
        );

        console.log(pc.green(pc.bold(`\n✓ Workspace rolled back to checkpoint: "${cp.name}"`)));
        console.log(`  Commit: ${pc.yellow(cp.commitHash.substring(0, 7))}`);
        console.log(`  Branch: ${cp.branch}`);
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Failed to restore checkpoint: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  return checkpoint;
}
