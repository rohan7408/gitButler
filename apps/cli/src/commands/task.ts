import { Command } from 'commander';
import pc from 'picocolors';
import { GitButlerOrchestrator } from '@git-butler/core';
import { defaultTaskManager } from '@git-butler/tasks';
import { defaultWorktreeManager } from '@git-butler/worktrees';
import { defaultGitService } from '@git-butler/git';

export function createTaskCommand(): Command {
  const orchestrator = new GitButlerOrchestrator(
    defaultTaskManager,
    defaultWorktreeManager,
    defaultGitService
  );

  const task = new Command('task').description('Manage isolated development tasks, branches, and worktrees');

  task
    .command('start <name>')
    .description('Start a new task with an isolated feature branch and worktree')
    .option('-b, --branch <branch>', 'Custom branch name')
    .option('-w, --worktree <path>', 'Custom worktree path')
    .option('-a, --agent <agent>', 'Agent identifier')
    .option('-C <path>', 'Repository root directory', process.cwd())
    .action(async (name, options) => {
      try {
        const result = await orchestrator.startTask(
          {
            name,
            branch: options.branch,
            worktreePath: options.worktree,
            agent: options.agent,
          },
          options.C
        );

        console.log(pc.green(pc.bold(`\n✓ Task started successfully: "${result.task.name}"`)));
        console.log(`  ID:       ${pc.cyan(result.task.id)}`);
        console.log(`  Branch:   ${pc.yellow(result.branch)}`);
        console.log(`  Worktree: ${pc.dim(result.worktreePath)}`);
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Failed to start task: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  task
    .command('continue <queryOrId>')
    .description('Reopen or continue an existing task and restore its worktree')
    .option('-w, --worktree <path>', 'Custom worktree path')
    .option('-C <path>', 'Repository root directory', process.cwd())
    .action(async (queryOrId, options) => {
      try {
        const result = await orchestrator.continueTask(
          queryOrId,
          { worktreePath: options.worktree },
          options.C
        );

        console.log(pc.green(pc.bold(`\n✓ Task reopened: "${result.task.name}" (Iteration #${result.task.iterations})`)));
        console.log(`  ID:       ${pc.cyan(result.task.id)}`);
        console.log(`  Branch:   ${pc.yellow(result.branch)}`);
        console.log(`  Worktree: ${pc.dim(result.worktreePath)}`);
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Failed to continue task: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  task
    .command('list')
    .description('List tracked tasks')
    .option('-s, --status <status>', 'Filter by task status')
    .option('-a, --agent <agent>', 'Filter by agent ID')
    .option('-C <path>', 'Repository root directory', process.cwd())
    .action((options) => {
      try {
        const tasks = defaultTaskManager.list(
          {
            status: options.status,
            agent: options.agent,
          },
          options.C
        );

        if (tasks.length === 0) {
          console.log(pc.dim('\nNo tasks found.\n'));
          return;
        }

        console.log(pc.bold(`\n📋 Tasks (${tasks.length}):\n`));
        for (const t of tasks) {
          let statusColor = pc.cyan;
          if (t.status === 'IN_PROGRESS') statusColor = pc.yellow;
          if (t.status === 'READY_FOR_REVIEW') statusColor = pc.blue;
          if (t.status === 'COMPLETED' || t.status === 'MERGED') statusColor = pc.green;
          if (t.status === 'FAILED' || t.status === 'BLOCKED') statusColor = pc.red;

          console.log(` • [${statusColor(t.status)}] ${pc.bold(t.name)} (${pc.dim(t.id)})`);
          console.log(`   Branch: ${t.branch} | Iterations: ${t.iterations}`);
          if (t.worktreePath) {
            console.log(`   Worktree: ${pc.dim(t.worktreePath)}`);
          }
          if (t.pullRequest) {
            console.log(`   PR: ${pc.cyan(t.pullRequest)}`);
          }
        }
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Failed to list tasks: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  task
    .command('show <id>')
    .description('Show full task metadata')
    .option('-C <path>', 'Repository root directory', process.cwd())
    .action((id, options) => {
      try {
        const t = defaultTaskManager.get(id, options.C) ?? defaultTaskManager.findOne(id, options.C);
        if (!t) {
          console.error(pc.red(`\n✗ Task not found: "${id}"\n`));
          process.exitCode = 1;
          return;
        }

        console.log(pc.bold(`\nTask Details: ${t.name}`));
        console.log(`  ID:          ${pc.cyan(t.id)}`);
        console.log(`  Status:      ${t.status}`);
        console.log(`  Branch:      ${t.branch}`);
        console.log(`  Iterations:  ${t.iterations}`);
        console.log(`  Worktree:    ${t.worktreePath ?? 'None (closed)'}`);
        console.log(`  Checkpoints: ${t.checkpoints.length}`);
        if (t.pullRequest) {
          console.log(`  PR:          ${pc.cyan(t.pullRequest)}`);
        }
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Error showing task: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  task
    .command('close <queryOrId>')
    .description('Close task and remove temporary worktree')
    .option('-f, --force', 'Force close even if worktree has uncommitted modifications')
    .option('--keep-worktree', 'Preserve worktree directory on disk')
    .option('-C <path>', 'Repository root directory', process.cwd())
    .action(async (queryOrId, options) => {
      try {
        const task = await orchestrator.closeTask(
          queryOrId,
          {
            removeWorktree: !options.keepWorktree,
            force: Boolean(options.force),
          },
          options.C
        );

        console.log(pc.green(pc.bold(`\n✓ Task closed successfully: "${task.name}"`)));
        console.log(`  Status: ${pc.green(task.status)}`);
        console.log(`  Worktree removed: ${!options.keepWorktree ? 'Yes' : 'Preserved'}`);
        console.log();
      } catch (err: any) {
        console.error(pc.red(`\n✗ Failed to close task: ${err.message}\n`));
        process.exitCode = 1;
      }
    });

  return task;
}
