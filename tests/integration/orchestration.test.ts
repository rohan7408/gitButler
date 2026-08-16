import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { GitService, GitExecutor } from '@git-butler/git';
import { WorktreeManager } from '@git-butler/worktrees';
import { TaskManager } from '@git-butler/tasks';
import { GitButlerOrchestrator, GitButlerError } from '@git-butler/core';

describe('GitButlerOrchestrator Integration Tests', () => {
  let tempBaseDir: string;
  let mainRepoDir: string;
  let worktreeBaseDir: string;
  let executor: GitExecutor;
  let git: GitService;
  let worktreeManager: WorktreeManager;
  let taskManager: TaskManager;
  let orchestrator: GitButlerOrchestrator;

  beforeEach(async () => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-orch-test-'));
    mainRepoDir = path.join(tempBaseDir, 'main-repo');
    worktreeBaseDir = path.join(tempBaseDir, 'worktrees');
    fs.mkdirSync(mainRepoDir, { recursive: true });
    fs.mkdirSync(worktreeBaseDir, { recursive: true });

    executor = new GitExecutor(mainRepoDir);
    git = new GitService(executor);
    worktreeManager = new WorktreeManager(git, executor);
    taskManager = new TaskManager();
    orchestrator = new GitButlerOrchestrator(taskManager, worktreeManager, git);

    // Initialize main repo with commit and author
    await git.init({ initialBranch: 'main' }, mainRepoDir);
    await executor.exec(['config', 'user.name', 'Orchestrator Test'], { cwd: mainRepoDir });
    await executor.exec(['config', 'user.email', 'orchestrator@test.local'], { cwd: mainRepoDir });

    fs.writeFileSync(path.join(mainRepoDir, 'main.txt'), 'Initial main file\n');
    await git.add('main.txt', mainRepoDir);
    await git.commit('chore: init main', {}, mainRepoDir);
  });

  afterEach(() => {
    fs.rmSync(tempBaseDir, { recursive: true, force: true });
  });

  it('runs complete multi-task, isolation, disposal, and continuation lifecycle', async () => {
    // Step 1: Create 3 tasks concurrently
    const orderWtPath = path.join(worktreeBaseDir, 'order-page');
    const dashWtPath = path.join(worktreeBaseDir, 'dashboard');
    const salesWtPath = path.join(worktreeBaseDir, 'sales-report');

    const orderTask = await orchestrator.startTask(
      { name: 'Order Page', worktreePath: orderWtPath },
      mainRepoDir
    );
    const dashTask = await orchestrator.startTask(
      { name: 'Dashboard', worktreePath: dashWtPath },
      mainRepoDir
    );
    const salesTask = await orchestrator.startTask(
      { name: 'Sales Report', worktreePath: salesWtPath },
      mainRepoDir
    );

    expect(orderTask.branch).toBe('feature/order-page');
    expect(dashTask.branch).toBe('feature/dashboard');
    expect(salesTask.branch).toBe('feature/sales-report');
    expect(orderTask.isExisting).toBe(false);

    // Step 2: Isolation Test — Make independent commits in all 3 worktrees
    fs.writeFileSync(path.join(orderWtPath, 'order.ts'), 'export const order = 1;\n');
    await git.add('order.ts', orderWtPath);
    await git.commit('feat: add order', {}, orderWtPath);

    fs.writeFileSync(path.join(dashWtPath, 'dashboard.ts'), 'export const dash = 2;\n');
    await git.add('dashboard.ts', dashWtPath);
    await git.commit('feat: add dashboard', {}, dashWtPath);

    fs.writeFileSync(path.join(salesWtPath, 'sales.ts'), 'export const sales = 3;\n');
    await git.add('sales.ts', salesWtPath);
    await git.commit('feat: add sales', {}, salesWtPath);

    // Verify file isolation
    expect(fs.existsSync(path.join(dashWtPath, 'order.ts'))).toBe(false);
    expect(fs.existsSync(path.join(salesWtPath, 'order.ts'))).toBe(false);
    expect(fs.existsSync(path.join(orderWtPath, 'dashboard.ts'))).toBe(false);

    // Step 3: Complete Order Page & Dispose worktree
    const completedOrderTask = await orchestrator.closeTask('Order Page', {}, mainRepoDir);
    expect(completedOrderTask.status).toBe('COMPLETED');
    expect(fs.existsSync(orderWtPath)).toBe(false);

    // Step 4: Continue / Reopen Order Page (Iteration 2)
    const continuedOrderTask = await orchestrator.continueTask(
      'Order Page',
      { worktreePath: orderWtPath },
      mainRepoDir
    );
    expect(continuedOrderTask.isExisting).toBe(true);
    expect(continuedOrderTask.task.status).toBe('IN_PROGRESS');
    expect(continuedOrderTask.task.iterations).toBe(2);

    // Verify previous code was restored
    expect(fs.existsSync(path.join(orderWtPath, 'order.ts'))).toBe(true);
    expect(fs.readFileSync(path.join(orderWtPath, 'order.ts'), 'utf-8').trim()).toBe('export const order = 1;');

    // Step 5: Add Iteration 2 code and commit
    fs.appendFileSync(path.join(orderWtPath, 'order.ts'), '\nexport const orderUI = "v2";\n');
    await git.add('order.ts', orderWtPath);
    await git.commit('feat: update order UI for iteration 2', {}, orderWtPath);

    const logs = await git.log({ maxCount: 5 }, orderWtPath);
    expect(logs[0].message).toBe('feat: update order UI for iteration 2');
    expect(logs[1].message).toBe('feat: add order');

    // Step 6: startTask with reuseExisting should automatically continue existing task
    const restartedTask = await orchestrator.startTask(
      { name: 'Order Page', reuseExisting: true },
      mainRepoDir
    );
    expect(restartedTask.isExisting).toBe(true);
    expect(restartedTask.task.id).toBe(orderTask.task.id);
  });

  it('blocks closeTask when worktree contains uncommitted modifications unless force is used', async () => {
    const wtPath = path.join(worktreeBaseDir, 'dirty-task');
    await orchestrator.startTask({ name: 'Dirty Task', worktreePath: wtPath }, mainRepoDir);

    fs.writeFileSync(path.join(wtPath, 'dirty.txt'), 'uncommitted modifications\n');

    try {
      await orchestrator.closeTask('Dirty Task', { removeWorktree: true, force: false }, mainRepoDir);
      expect.fail('Should block closing task with dirty worktree');
    } catch (err) {
      expect(err).toBeInstanceOf(GitButlerError);
      expect((err as GitButlerError).code).toBe('WORKTREE_DIRTY');
    }

    // Force close succeeds
    await orchestrator.closeTask('Dirty Task', { removeWorktree: true, force: true }, mainRepoDir);
    expect(fs.existsSync(wtPath)).toBe(false);
  });

  it('retrieves active tasks list', async () => {
    await orchestrator.startTask(
      { name: 'Task A', worktreePath: path.join(worktreeBaseDir, 'task-a') },
      mainRepoDir
    );
    await orchestrator.startTask(
      { name: 'Task B', worktreePath: path.join(worktreeBaseDir, 'task-b') },
      mainRepoDir
    );

    const active = await orchestrator.getActiveTasks(mainRepoDir);
    expect(active).toHaveLength(2);
    expect(active.map((a) => a.task.name)).toContain('Task A');
    expect(active.map((a) => a.task.name)).toContain('Task B');
  });
});
