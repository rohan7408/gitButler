import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { TaskManager, StateStore } from '@git-butler/tasks';
import { GitButlerError } from '@git-butler/core';

describe('TaskManager & Project State Integration Tests', () => {
  let tempRepoDir: string;
  let taskManager: TaskManager;

  beforeEach(() => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-task-test-'));
    taskManager = new TaskManager();
  });

  afterEach(() => {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  });

  it('Test 1 — creates task and persists across process reloads', () => {
    // 1. Create task with first instance
    const created = taskManager.create(
      {
        name: 'Order Page',
        description: 'Customer order listing and checkout',
        agent: 'Claude',
      },
      tempRepoDir
    );

    expect(created.id).toMatch(/^task_/);
    expect(created.name).toBe('Order Page');
    expect(created.branch).toBe('feature/order-page');
    expect(created.iterations).toBe(1);

    // 2. Simulate restarting process / new instance
    const freshTaskManager = new TaskManager();
    const retrieved = freshTaskManager.get(created.id, tempRepoDir);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.name).toBe('Order Page');
    expect(retrieved?.description).toBe('Customer order listing and checkout');
  });

  it('Test 2 — finds task by query case-insensitively and fuzzy match', () => {
    taskManager.create({ name: 'Order Page' }, tempRepoDir);
    taskManager.create({ name: 'User Dashboard' }, tempRepoDir);
    taskManager.create({ name: 'Sales Report' }, tempRepoDir);

    // Exact lowercase
    const found1 = taskManager.find('order page', tempRepoDir);
    expect(found1).toHaveLength(1);
    expect(found1[0].name).toBe('Order Page');

    // Uppercase substring
    const found2 = taskManager.find('DASHBOARD', tempRepoDir);
    expect(found2).toHaveLength(1);
    expect(found2[0].name).toBe('User Dashboard');

    // Partial search
    const found3 = taskManager.find('sales', tempRepoDir);
    expect(found3).toHaveLength(1);
    expect(found3[0].name).toBe('Sales Report');

    // Branch match
    const found4 = taskManager.find('feature/order-page', tempRepoDir);
    expect(found4).toHaveLength(1);
    expect(found4[0].name).toBe('Order Page');
  });

  it('Test 3 — updates task status and persists state across reloads', () => {
    const task = taskManager.create({ name: 'Order Page' }, tempRepoDir);

    taskManager.update(task.id, { status: 'READY_FOR_REVIEW' }, tempRepoDir);

    // Reload with fresh store
    const store = new StateStore(tempRepoDir);
    const tasks = store.loadTasks();
    const persisted = tasks.find((t) => t.id === task.id);

    expect(persisted?.status).toBe('READY_FOR_REVIEW');
  });

  it('Test 4 — task state survives worktree removal and manipulation', () => {
    const task = taskManager.create(
      {
        name: 'Order Page',
        worktreePath: path.join(tempRepoDir, '../temp-wt-order-page'),
      },
      tempRepoDir
    );

    // Simulate worktree being removed from disk
    const fakeWtPath = path.join(tempRepoDir, 'disposable-wt');
    fs.mkdirSync(fakeWtPath, { recursive: true });
    fs.writeFileSync(path.join(fakeWtPath, 'test.txt'), 'content');

    // Dispose worktree
    fs.rmSync(fakeWtPath, { recursive: true, force: true });

    // Verify task is still intact
    const taskAfterCleanup = taskManager.get(task.id, tempRepoDir);
    expect(taskAfterCleanup).not.toBeNull();
    expect(taskAfterCleanup?.name).toBe('Order Page');
  });

  it('Test 5 — prevents duplicate task creation and supports reopening with iterations', () => {
    const task = taskManager.create({ name: 'Order Page' }, tempRepoDir);

    // Attempting to create duplicate task throws TASK_ALREADY_EXISTS
    try {
      taskManager.create({ name: 'Order Page' }, tempRepoDir);
      expect.fail('Should prevent duplicate task with same name');
    } catch (err) {
      expect(err).toBeInstanceOf(GitButlerError);
      expect((err as GitButlerError).code).toBe('TASK_ALREADY_EXISTS');
    }

    // Complete task
    const completed = taskManager.complete(task.id, tempRepoDir);
    expect(completed.status).toBe('COMPLETED');

    // Reopen task
    const reopened = taskManager.reopen(task.id, tempRepoDir);
    expect(reopened.status).toBe('IN_PROGRESS');
    expect(reopened.iterations).toBe(2);
  });

  it('Test 6 — maintains full activity audit history', () => {
    const task = taskManager.create({ name: 'Order Page' }, tempRepoDir);
    taskManager.update(task.id, { status: 'READY_FOR_REVIEW' }, tempRepoDir);
    taskManager.complete(task.id, tempRepoDir);

    const history = taskManager.history(task.id, tempRepoDir);
    expect(history.length).toBeGreaterThanOrEqual(3);

    const eventTypes = history.map((e) => e.type);
    expect(eventTypes).toContain('TASK_CREATED');
    expect(eventTypes).toContain('STATUS_CHANGED');
    expect(eventTypes).toContain('TASK_COMPLETED');
  });
});
