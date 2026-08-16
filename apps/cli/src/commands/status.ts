import { Command } from 'commander';
import pc from 'picocolors';
import { defaultGitService } from '@git-butler/git';

export function createStatusCommand(): Command {
  const status = new Command('status')
    .description('Show structured Git status')
    .option('-C <path>', 'Working directory', process.cwd())
    .action(async (options) => {
      try {
        const result = await defaultGitService.status(options.C);
        console.log(pc.bold(`\nBranch: ${result.currentBranch ?? 'HEAD detached'}`));
        if (result.trackingBranch) {
          console.log(`Tracking: ${result.trackingBranch} (ahead: ${result.ahead}, behind: ${result.behind})`);
        }

        if (result.isClean) {
          console.log(pc.green('✓ Working tree clean\n'));
          return;
        }

        console.log(`\nChanges (${result.files.length}):`);
        for (const file of result.files) {
          let tag = file.indexStatus;
          if (file.untracked) tag = '?';
          console.log(`  ${pc.yellow(tag)} ${file.path}`);
        }
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Error getting status: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  return status;
}

export function createDiffCommand(): Command {
  const diff = new Command('diff')
    .description('Show diff statistics and patch')
    .option('--staged', 'Show staged changes', false)
    .option('-C <path>', 'Working directory', process.cwd())
    .action(async (options) => {
      try {
        const result = await defaultGitService.diff({ staged: options.staged }, options.C);
        console.log(
          pc.bold(
            `\nDiff (${result.files.length} files, +${result.totalInsertions} -${result.totalDeletions}):\n`
          )
        );
        for (const f of result.files) {
          console.log(`  ${f.path} (+${f.insertions} -${f.deletions})`);
        }
        if (result.patch) {
          console.log(pc.dim('\n--- Patch Preview ---'));
          console.log(result.patch.substring(0, 1000));
        }
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Error getting diff: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  return diff;
}
