import { Command } from 'commander';
import pc from 'picocolors';
import { defaultVerificationEngine } from '@git-butler/verification';

export function createVerifyCommand(): Command {
  const verify = new Command('verify')
    .description('Run independent quality gates (Git checks, automated tests, build, lint)')
    .argument('<taskIdOrQuery>', 'Task ID or name query')
    .option('-t, --test <command>', 'Automated test suite command')
    .option('-b, --build <command>', 'Build / compilation command')
    .option('-l, --lint <command>', 'Linting command')
    .option('--allow-dirty', 'Allow uncommitted changes in worktree', false)
    .option('-C <path>', 'Repository root directory', process.cwd())
    .action(async (taskIdOrQuery, options) => {
      console.log(pc.cyan(pc.bold(`\n🧪 Running verification checks for task "${taskIdOrQuery}"...\n`)));

      try {
        const result = await defaultVerificationEngine.verifyTask(
          taskIdOrQuery,
          {
            testCommand: options.test,
            buildCommand: options.build,
            lintCommand: options.lint,
            requireCleanWorktree: !options.allowDirty,
          },
          options.C
        );

        for (const check of result.checks) {
          const icon = check.passed ? pc.green('✓') : pc.red('✗');
          console.log(` ${icon} ${pc.bold(check.name)} (${check.durationMs}ms)`);
          if (check.error) {
            console.log(`   ${pc.red(check.error)}`);
          }
        }

        console.log();
        if (result.passed) {
          console.log(pc.green(pc.bold(`✓ ${result.summary}`)));
        } else {
          console.log(pc.red(pc.bold(`✗ ${result.summary}`)));
          process.exitCode = 1;
        }
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Verification error: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  return verify;
}
