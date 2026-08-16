import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { GitService, GitExecutor } from '@git-butler/git';
import { WorktreeManager } from '@git-butler/worktrees';
import { GitButlerError } from '@git-butler/core';

describe('WorktreeManager Integration Tests', () => {
  let tempBaseDir: string;
  let mainRepoDir: string;
  let worktreeBaseDir: string;
  let executor: GitExecutor;
  let git: GitService;
  let worktreeManager: WorktreeManager;

  beforeEach(async () => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-wt-test-'));
    mainRepoDir = path.join(tempBaseDir, 'main-repo');
    worktreeBaseDir = path.join(tempBaseDir, 'worktrees');
    fs.mkdirSync(mainRepoDir, { recursive: true });
    fs.mkdirSync(worktreeBaseDir, { recursive: true });

    executor = new GitExecutor(mainRepoDir);
    git = new GitService(executor);
    worktreeManager = new WorktreeManager(git, executor);

    // Initialize main repo with an initial commit
    await git.init({ initialBranch: 'main' }, mainRepoDir);
    await executor.exec(['config', 'user.name', 'Git Butler Worktree Test'], { cwd: mainRepoDir });
    await executor.exec(['config', 'user.email', 'test@worktrees.local'], { cwd: mainRepoDir });

    fs.writeFileSync(path.join(mainRepoDir, 'main.txt'), 'Initial main file\n');
    await git.add('main.txt', mainRepoDir);
    await git.commit('chore: initial commit', {}, mainRepoDir);
  });

  afterEach(() => {
    fs.rmSync(tempBaseDir, { recursive: true, force: true });
  });

  it('Test 1 — creates a worktree with a new branch and verifies in list', async () => {
    const wtPath = path.join(worktreeBaseDir, 'order-page');
    const wt = await worktreeManager.create(
      {
        path: wtPath,
        newBranch: 'feature/order-page',
      },
      mainRepoDir
    );

    expect(wt.path).toBe(path.resolve(wtPath));
    expect(wt.branch).toBe('feature/order-page');

    const list = await worktreeManager.list(mainRepoDir);
    expect(list.some((w) => path.resolve(w.path) === path.resolve(wtPath))).toBe(true);

    // Verify worktree file system exists and contains main repo files
    expect(fs.existsSync(path.join(wtPath, 'main.txt'))).toBe(true);
  });

  it('Test 2 — verifies isolation between multiple concurrent worktrees', async () => {
    const orderPagePath = path.join(worktreeBaseDir, 'order-page');
    const dashboardPath = path.join(worktreeBaseDir, 'dashboard');

    await worktreeManager.create({ path: orderPagePath, newBranch: 'feature/order-page' }, mainRepoDir);
    await worktreeManager.create({ path: dashboardPath, newBranch: 'feature/dashboard' }, mainRepoDir);

    // Modify file only in order-page
    fs.writeFileSync(path.join(orderPagePath, 'order.txt'), 'Order Page Content\n');

    // Modify file only in dashboard
    fs.writeFileSync(path.join(dashboardPath, 'dashboard.txt'), 'Dashboard Content\n');

    // Verify order.txt is NOT in dashboard or main
    expect(fs.existsSync(path.join(dashboardPath, 'order.txt'))).toBe(false);
    expect(fs.existsSync(path.join(mainRepoDir, 'order.txt'))).toBe(false);

    // Verify dashboard.txt is NOT in order-page or main
    expect(fs.existsSync(path.join(orderPagePath, 'dashboard.txt'))).toBe(false);
    expect(fs.existsSync(path.join(mainRepoDir, 'dashboard.txt'))).toBe(false);

    // Check status in order-page
    const orderStatus = await worktreeManager.status(orderPagePath);
    expect(orderStatus.isClean).toBe(false);
    expect(orderStatus.files[0].path).toBe('order.txt');

    // Check status in dashboard
    const dashStatus = await worktreeManager.status(dashboardPath);
    expect(dashStatus.isClean).toBe(false);
    expect(dashStatus.files[0].path).toBe('dashboard.txt');
  });

  it('Test 3 — removes a clean worktree safely', async () => {
    const wtPath = path.join(worktreeBaseDir, 'clean-wt');
    await worktreeManager.create({ path: wtPath, newBranch: 'feature/clean' }, mainRepoDir);

    await worktreeManager.remove(wtPath, {}, mainRepoDir);

    const list = await worktreeManager.list(mainRepoDir);
    expect(list.some((w) => path.resolve(w.path) === path.resolve(wtPath))).toBe(false);
    expect(fs.existsSync(wtPath)).toBe(false);
  });

  it('Test 4 — blocks removal of dirty worktree to protect user work', async () => {
    const wtPath = path.join(worktreeBaseDir, 'dirty-wt');
    await worktreeManager.create({ path: wtPath, newBranch: 'feature/dirty' }, mainRepoDir);

    // Create an uncommitted file
    fs.writeFileSync(path.join(wtPath, 'uncommitted.ts'), 'export const secret = 42;\n');

    // Attempt removal without force
    try {
      await worktreeManager.remove(wtPath, {}, mainRepoDir);
      expect.fail('Should block removal of dirty worktree');
    } catch (err) {
      expect(err).toBeInstanceOf(GitButlerError);
      const gbErr = err as GitButlerError;
      expect(gbErr.code).toBe('WORKTREE_DIRTY');
      expect(gbErr.message).toContain('uncommitted or untracked changes');
    }

    // Verify worktree still exists and was not deleted
    expect(fs.existsSync(path.join(wtPath, 'uncommitted.ts'))).toBe(true);

    // Force removal succeeds when explicitly specified
    await worktreeManager.remove(wtPath, { force: true }, mainRepoDir);
    expect(fs.existsSync(wtPath)).toBe(false);
  });

  it('Test 5 — recovery: preserves branch commits when worktree is recreated', async () => {
    const wtPath1 = path.join(worktreeBaseDir, 'recover-wt');
    await worktreeManager.create({ path: wtPath1, newBranch: 'feature/recovery' }, mainRepoDir);

    // Commit a change in the worktree
    fs.writeFileSync(path.join(wtPath1, 'feature.ts'), 'export const version = "1.0.0";\n');
    await git.add('feature.ts', wtPath1);
    const commitHash = await git.commit('feat: add recovery feature', {}, wtPath1);

    // Remove clean worktree (keeps the branch)
    await worktreeManager.remove(wtPath1, {}, mainRepoDir);
    expect(fs.existsSync(wtPath1)).toBe(false);

    // Recreate/restore worktree from existing branch
    const wtPath2 = path.join(worktreeBaseDir, 'recovered-wt');
    const restored = await worktreeManager.restore('feature/recovery', wtPath2, mainRepoDir);
    expect(restored.branch).toBe('feature/recovery');
    expect(fs.existsSync(path.join(wtPath2, 'feature.ts'))).toBe(true);
    expect(fs.readFileSync(path.join(wtPath2, 'feature.ts'), 'utf-8').trim()).toBe('export const version = "1.0.0";');

    // Verify commit history is intact
    const logs = await git.log({ maxCount: 5 }, wtPath2);
    expect(logs[0].hash).toBe(commitHash);
  });

  it('handles worktree lock and unlock', async () => {
    const wtPath = path.join(worktreeBaseDir, 'locked-wt');
    await worktreeManager.create({ path: wtPath, newBranch: 'feature/locked' }, mainRepoDir);

    await worktreeManager.lock(wtPath, 'AI agent actively compiling', mainRepoDir);
    const wt = await worktreeManager.get(wtPath, mainRepoDir);
    expect(wt?.locked).toBe(true);

    // Block removal of locked worktree without force
    try {
      await worktreeManager.remove(wtPath, {}, mainRepoDir);
      expect.fail('Should block removal of locked worktree');
    } catch (err) {
      expect(err).toBeInstanceOf(GitButlerError);
      expect((err as GitButlerError).code).toBe('PERMISSION_DENIED');
    }

    // Unlock and remove
    await worktreeManager.unlock(wtPath, mainRepoDir);
    await worktreeManager.remove(wtPath, {}, mainRepoDir);
    expect(fs.existsSync(wtPath)).toBe(false);
  });
});
