import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { GitService, GitExecutor, runDoctorFix } from '@git-butler/git';
import { TaskManager, StateStore } from '@git-butler/tasks';
import { WorktreeManager } from '@git-butler/worktrees';
import { GitButlerOrchestrator } from '@git-butler/core';

describe('Phase 12: Resilience & Failure Recovery Tests', () => {
  let tempRepoDir: string;
  let executor: GitExecutor;
  let git: GitService;
  let taskManager: TaskManager;
  let worktreeManager: WorktreeManager;
  let orchestrator: GitButlerOrchestrator;

  beforeEach(async () => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-resilience-test-'));
    executor = new GitExecutor(tempRepoDir);
    git = new GitService(executor);
    taskManager = new TaskManager();
    worktreeManager = new WorktreeManager(git, executor);
    orchestrator = new GitButlerOrchestrator(taskManager, worktreeManager, git);

    // Initialize repo
    await git.init({ initialBranch: 'main' }, tempRepoDir);
    await executor.exec(['config', 'user.name', 'Resilience Tester'], { cwd: tempRepoDir });
    await executor.exec(['config', 'user.email', 'resilience@gitbutler.ai'], { cwd: tempRepoDir });

    fs.writeFileSync(path.join(tempRepoDir, 'main.txt'), 'hello');
    await git.add('main.txt', tempRepoDir);
    await git.commit('chore: init', {}, tempRepoDir);
  });

  afterEach(() => {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  });

  it('Test 1 — detects and cleans up stale index.lock file', async () => {
    const lockFile = path.join(tempRepoDir, '.git', 'index.lock');
    fs.writeFileSync(lockFile, 'STALE_LOCK');
    expect(fs.existsSync(lockFile)).toBe(true);

    const unlocked = await git.unlockIndex(tempRepoDir);
    expect(unlocked).toBe(true);
    expect(fs.existsSync(lockFile)).toBe(false);
  });

  it('Test 2 — recovers from corrupted tasks.json using .bak snapshot', () => {
    const store = new StateStore(tempRepoDir);
    store.ensureInitialized();

    // Create task
    const task = taskManager.create({ name: 'Critical Payment Task' }, tempRepoDir);
    expect(taskManager.list({}, tempRepoDir)).toHaveLength(1);

    // Verify .bak exists
    const tasksJson = path.join(tempRepoDir, '.ai-git', 'tasks.json');
    const tasksBak = path.join(tempRepoDir, '.ai-git', 'tasks.json.bak');
    expect(fs.existsSync(tasksBak)).toBe(true);

    // Simulate crash corruption: write invalid truncated JSON
    fs.writeFileSync(tasksJson, '{"broken_json": [');

    // Load tasks — StateStore automatically self-heals from tasks.json.bak
    const recoveredTasks = taskManager.list({}, tempRepoDir);
    expect(recoveredTasks).toHaveLength(1);
    expect(recoveredTasks[0].id).toBe(task.id);
    expect(recoveredTasks[0].name).toBe('Critical Payment Task');

    // Verify tasks.json was repaired with valid JSON
    const repairedContent = fs.readFileSync(tasksJson, 'utf-8');
    expect(() => JSON.parse(repairedContent)).not.toThrow();
  });

  it('Test 3 — continues task and re-provisions worktree when physical path was externally removed', async () => {
    // 1. Start task
    const orchestrated = await orchestrator.startTask({ name: 'Inventory Sync' }, tempRepoDir);
    expect(fs.existsSync(orchestrated.worktreePath)).toBe(true);

    // 2. Commit a file in worktree
    fs.writeFileSync(path.join(orchestrated.worktreePath, 'sync.ts'), 'export const sync = true;\n');
    await git.add('.', orchestrated.worktreePath);
    await git.commit('feat: add sync logic', {}, orchestrated.worktreePath);

    // 3. User / OS deletes worktree directory outside Git Butler
    fs.rmSync(orchestrated.worktreePath, { recursive: true, force: true });
    await worktreeManager.prune(tempRepoDir);
    expect(fs.existsSync(orchestrated.worktreePath)).toBe(false);

    // 4. Continue task re-provisions fresh worktree from the existing branch
    const continued = await orchestrator.continueTask(orchestrated.task.id, {}, tempRepoDir);
    expect(fs.existsSync(continued.worktreePath)).toBe(true);

    // Verify branch commit is preserved in the restored worktree
    const fileContent = fs.readFileSync(path.join(continued.worktreePath, 'sync.ts'), 'utf-8');
    expect(fileContent).toContain('export const sync = true;');

    // Clean up
    await orchestrator.closeTask(orchestrated.task.id, { removeWorktree: true }, tempRepoDir);
  });

  it('Test 4 — runDoctorFix repairs stale index lock and prunes worktrees', async () => {
    const lockFile = path.join(tempRepoDir, '.git', 'index.lock');
    fs.writeFileSync(lockFile, 'STALE_LOCK');

    const result = await runDoctorFix(tempRepoDir);
    expect(result.fixed.length).toBeGreaterThan(0);
    expect(fs.existsSync(lockFile)).toBe(false);
  });
});
