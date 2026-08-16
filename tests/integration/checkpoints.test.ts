import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { GitService, GitExecutor } from '@git-butler/git';
import { TaskManager } from '@git-butler/tasks';
import { CheckpointManager } from '@git-butler/checkpoints';
import { GitButlerError } from '@git-butler/core';

describe('CheckpointManager Integration Tests', () => {
  let tempRepoDir: string;
  let executor: GitExecutor;
  let git: GitService;
  let taskManager: TaskManager;
  let checkpointManager: CheckpointManager;

  beforeEach(async () => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-cp-test-'));
    executor = new GitExecutor(tempRepoDir);
    git = new GitService(executor);
    taskManager = new TaskManager();
    checkpointManager = new CheckpointManager(git, executor, taskManager);

    // Initialize git repository
    await git.init({ initialBranch: 'main' }, tempRepoDir);
    await executor.exec(['config', 'user.name', 'Checkpoint Tester'], { cwd: tempRepoDir });
    await executor.exec(['config', 'user.email', 'tester@checkpoints.local'], { cwd: tempRepoDir });

    fs.writeFileSync(path.join(tempRepoDir, 'app.ts'), 'export const state = "initial";\n');
    await git.add('app.ts', tempRepoDir);
    await git.commit('chore: initial commit', {}, tempRepoDir);
  });

  afterEach(() => {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  });

  it('Test 1 — creates checkpoint, makes bad changes, and restores checkpoint safely', async () => {
    // 1. Create working change
    fs.writeFileSync(path.join(tempRepoDir, 'app.ts'), 'export const state = "v1_stable";\n');
    const cp1 = await checkpointManager.create({ name: 'Stable V1' }, tempRepoDir, tempRepoDir);

    expect(cp1.id).toMatch(/^cp_/);
    expect(cp1.name).toBe('Stable V1');

    // 2. Make bad / broken changes
    fs.writeFileSync(path.join(tempRepoDir, 'app.ts'), 'SYNTAX ERROR BROKEN CODE !!!');

    // 3. Restore checkpoint with force
    await checkpointManager.restore(cp1.id, { force: true }, tempRepoDir, tempRepoDir);

    // 4. Verify state restored
    const content = fs.readFileSync(path.join(tempRepoDir, 'app.ts'), 'utf-8').trim();
    expect(content).toBe('export const state = "v1_stable";');
  });

  it('Test 2 — creates multiple sequential checkpoints and restores each', async () => {
    // Checkpoint 1
    fs.writeFileSync(path.join(tempRepoDir, 'file1.txt'), 'version 1');
    const cp1 = await checkpointManager.create({ name: 'Stage 1' }, tempRepoDir, tempRepoDir);

    // Checkpoint 2
    fs.writeFileSync(path.join(tempRepoDir, 'file2.txt'), 'version 2');
    const cp2 = await checkpointManager.create({ name: 'Stage 2' }, tempRepoDir, tempRepoDir);

    // Checkpoint 3
    fs.writeFileSync(path.join(tempRepoDir, 'file3.txt'), 'version 3');
    const cp3 = await checkpointManager.create({ name: 'Stage 3' }, tempRepoDir, tempRepoDir);

    // Verify all 3 in list
    const all = checkpointManager.list(undefined, tempRepoDir);
    expect(all).toHaveLength(3);

    // Restore Checkpoint 1
    await checkpointManager.restore(cp1.id, { force: true }, tempRepoDir, tempRepoDir);
    expect(fs.existsSync(path.join(tempRepoDir, 'file1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tempRepoDir, 'file2.txt'))).toBe(false);
    expect(fs.existsSync(path.join(tempRepoDir, 'file3.txt'))).toBe(false);

    // Restore Checkpoint 2
    await checkpointManager.restore(cp2.id, { force: true }, tempRepoDir, tempRepoDir);
    expect(fs.existsSync(path.join(tempRepoDir, 'file1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tempRepoDir, 'file2.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tempRepoDir, 'file3.txt'))).toBe(false);

    // Restore Checkpoint 3
    await checkpointManager.restore(cp3.id, { force: true }, tempRepoDir, tempRepoDir);
    expect(fs.existsSync(path.join(tempRepoDir, 'file1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tempRepoDir, 'file2.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tempRepoDir, 'file3.txt'))).toBe(true);
  });

  it('Test 3 — blocks checkpoint restoration when uncommitted changes exist unless force is provided', async () => {
    fs.writeFileSync(path.join(tempRepoDir, 'feature.ts'), 'export const val = 10;\n');
    const cp = await checkpointManager.create({ name: 'Feature 10' }, tempRepoDir, tempRepoDir);

    // Make an uncommitted edit
    fs.writeFileSync(path.join(tempRepoDir, 'uncommitted.ts'), 'important uncommitted work\n');

    // Attempt restore without force -> should throw WORKTREE_DIRTY
    try {
      await checkpointManager.restore(cp.id, { force: false }, tempRepoDir, tempRepoDir);
      expect.fail('Should block restore on dirty worktree');
    } catch (err) {
      expect(err).toBeInstanceOf(GitButlerError);
      expect((err as GitButlerError).code).toBe('WORKTREE_DIRTY');
    }

    // Force restore overwrites
    await checkpointManager.restore(cp.id, { force: true }, tempRepoDir, tempRepoDir);
    expect(fs.existsSync(path.join(tempRepoDir, 'uncommitted.ts'))).toBe(false);
  });

  it('Test 4 — links checkpoints to tasks and updates task state', async () => {
    const task = taskManager.create({ name: 'Order Page' }, tempRepoDir);

    const cp = await checkpointManager.create(
      {
        name: 'Order page basic layout',
        taskId: task.id,
        contextSummary: 'Completed navigation and order table grid',
      },
      tempRepoDir,
      tempRepoDir
    );

    const taskCheckpoints = checkpointManager.list(task.id, tempRepoDir);
    expect(taskCheckpoints).toHaveLength(1);
    expect(taskCheckpoints[0].id).toBe(cp.id);
    expect(taskCheckpoints[0].contextSummary).toBe('Completed navigation and order table grid');

    // Verify task record has checkpoint ID
    const updatedTask = taskManager.get(task.id, tempRepoDir);
    expect(updatedTask?.checkpoints).toContain(cp.id);
  });
});
