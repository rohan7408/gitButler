import { Command } from 'commander';
import pc from 'picocolors';
import { defaultGitHubService } from '@git-butler/github';

export function createPrCommand(): Command {
  const pr = new Command('pr').description('Manage GitHub Pull Requests, CI checks, and merges');

  pr
    .command('create')
    .description('Create a GitHub Pull Request')
    .requiredOption('--title <title>', 'Pull Request title')
    .requiredOption('--body <body>', 'Pull Request description')
    .option('--head <branch>', 'Source feature branch')
    .option('--base <branch>', 'Target base branch', 'main')
    .option('--draft', 'Create as draft PR', false)
    .option('-t, --task <taskId>', 'Link PR to task ID')
    .option('-C <path>', 'Repository root directory', process.cwd())
    .action(async (options) => {
      try {
        const result = await defaultGitHubService.prCreate(
          {
            title: options.title,
            body: options.body,
            headBranch: options.head,
            baseBranch: options.base,
            draft: Boolean(options.draft),
            taskId: options.task,
          },
          options.C,
          options.C
        );

        console.log(pc.green(pc.bold(`\n✓ Pull Request #${result.number} created!`)));
        console.log(`  URL:    ${pc.cyan(result.url)}`);
        console.log(`  Title:  ${result.title}`);
        console.log(`  Branch: ${result.headBranch} -> ${result.baseBranch}`);
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Failed to create PR: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  pr
    .command('status <prNumberOrBranch>')
    .description('View status and CI checks for a Pull Request')
    .option('-C <path>', 'Repository root directory', process.cwd())
    .action(async (target, options) => {
      try {
        const prNumber = Number.parseInt(target, 10);
        const query = Number.isNaN(prNumber) ? target : prNumber;

        const info = await defaultGitHubService.prStatus(query, options.C);
        const ci = await defaultGitHubService.ciStatus(query, options.C).catch(() => null);

        console.log(pc.bold(`\nPull Request #${info.number}: ${info.title}`));
        console.log(`  State:  ${info.state === 'OPEN' ? pc.green(info.state) : pc.magenta(info.state)}`);
        console.log(`  Branch: ${info.headBranch} -> ${info.baseBranch}`);
        console.log(`  URL:    ${pc.cyan(info.url)}`);

        if (ci) {
          console.log(`\n  CI Status: ${ci.state === 'SUCCESS' ? pc.green(ci.state) : pc.yellow(ci.state)}`);
          console.log(`  Checks:    ${ci.passedChecks}/${ci.totalChecks} passed`);
          for (const c of ci.checks) {
            const icon = c.conclusion === 'success' ? pc.green('✓') : pc.yellow('•');
            console.log(`    ${icon} ${c.name} (${c.status})`);
          }
        }
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Failed to get PR status: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  pr
    .command('merge <prNumber>')
    .description('Merge a GitHub Pull Request')
    .option('-m, --method <method>', 'Merge method: squash, merge, rebase', 'squash')
    .option('-t, --task <taskId>', 'Associated task ID')
    .option('--delete-branch', 'Delete remote branch after merge', false)
    .option('-C <path>', 'Repository root directory', process.cwd())
    .action(async (prNumberStr, options) => {
      try {
        const prNumber = Number.parseInt(prNumberStr, 10);
        const merged = await defaultGitHubService.prMerge(
          prNumber,
          {
            method: options.method,
            deleteBranch: Boolean(options.deleteBranch),
          },
          options.C,
          options.C,
          options.task
        );

        console.log(pc.green(pc.bold(`\n✓ PR #${merged.number} merged successfully!`)));
        console.log(`  State: ${pc.green(merged.state)}`);
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Failed to merge PR: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  return pr;
}
