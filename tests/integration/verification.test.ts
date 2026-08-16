import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { GitService, GitExecutor } from '@git-butler/git';
import { TaskManager } from '@git-butler/tasks';
import { VerificationEngine } from '@git-butler/verification';

describe('VerificationEngine Integration Tests', () => {
  let tempRepoDir: string;
  let executor: GitExecutor;
  let git: GitService;
  let taskManager: TaskManager;
  let verificationEngine: VerificationEngine;

  beforeEach(async () => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-verify-test-'));
    executor = new GitExecutor(tempRepoDir);
    git = new GitService(executor);
    taskManager = new TaskManager();
    verificationEngine = new VerificationEngine(git, taskManager);

    // Initialize git repository
    await git.init({ initialBranch: 'main' }, tempRepoDir);
    await executor.exec(['config', 'user.name', 'Verification Tester'], { cwd: tempRepoDir });
    await executor.exec(['config', 'user.email', 'tester@verify.local'], { cwd: tempRepoDir });

    fs.writeFileSync(path.join(tempRepoDir, 'main.txt'), 'base\n');
    await git.add('main.txt', tempRepoDir);
    await git.commit('chore: init main', {}, tempRepoDir);
  });

  afterEach(() => {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  });

  it('Test 1 — passing project: all git checks and test commands pass -> READY_FOR_REVIEW', async () => {
    await git.branchCreate('feature/order-page', undefined, tempRepoDir);
    const task = taskManager.create({ name: 'Order Page', branch: 'feature/order-page' }, tempRepoDir);

    const result = await verificationEngine.verifyTask(
      task.id,
      {
        testCommand: 'node -e "process.exit(0)"',
        buildCommand: 'node -e "process.exit(0)"',
        lintCommand: 'node -e "process.exit(0)"',
        requireCleanWorktree: true,
      },
      tempRepoDir
    );

    expect(result.passed).toBe(true);
    expect(result.status).toBe('READY_FOR_REVIEW');
    expect(result.checks).toHaveLength(5); // Branch, Worktree Git Status, Tests, Build, Lint
    expect(result.checks.every((c) => c.passed)).toBe(true);

    // Verify task status in store was updated
    const updatedTask = taskManager.get(task.id, tempRepoDir);
    expect(updatedTask?.status).toBe('READY_FOR_REVIEW');
  });

  it('Test 2 — failing tests: returns NOT_READY with failure details', async () => {
    await git.branchCreate('feature/failing-tests', undefined, tempRepoDir);
    const task = taskManager.create({ name: 'Failing Tests Task', branch: 'feature/failing-tests' }, tempRepoDir);

    const result = await verificationEngine.verifyTask(
      task.id,
      {
        testCommand: 'node -e "console.error(\\"AssertionError: expected 2 to equal 3\\"); process.exit(1)"',
      },
      tempRepoDir
    );

    expect(result.passed).toBe(false);
    expect(result.status).toBe('NOT_READY');
    const testCheck = result.checks.find((c) => c.name === 'Automated Tests');
    expect(testCheck).toBeDefined();
    expect(testCheck?.passed).toBe(false);
    expect(testCheck?.stderr).toContain('AssertionError: expected 2 to equal 3');
  });

  it('Test 3 — build failure: returns NOT_READY with build error', async () => {
    await git.branchCreate('feature/failing-build', undefined, tempRepoDir);
    const task = taskManager.create({ name: 'Failing Build Task', branch: 'feature/failing-build' }, tempRepoDir);

    const result = await verificationEngine.verifyTask(
      task.id,
      {
        buildCommand: 'node -e "console.error(\\"TS2304: Cannot find name foo\\"); process.exit(1)"',
      },
      tempRepoDir
    );

    expect(result.passed).toBe(false);
    expect(result.status).toBe('NOT_READY');
    const buildCheck = result.checks.find((c) => c.name === 'Build Check');
    expect(buildCheck).toBeDefined();
    expect(buildCheck?.passed).toBe(false);
    expect(buildCheck?.stderr).toContain('TS2304: Cannot find name foo');
  });

  it('Test 4 — missing branch: returns VERIFICATION_FAILED', async () => {
    const task = taskManager.create({ name: 'Ghost Task', branch: 'feature/deleted-branch' }, tempRepoDir);

    const result = await verificationEngine.verifyTask(task.id, {}, tempRepoDir);

    expect(result.passed).toBe(false);
    expect(result.status).toBe('VERIFICATION_FAILED');
    expect(result.summary).toContain('does not exist');
  });

  it('Test 5 — hallucination simulation: AI claims task complete, but verification rejects false claim', async () => {
    await git.branchCreate('feature/broken-feature', undefined, tempRepoDir);
    const task = taskManager.create({ name: 'Broken Feature', branch: 'feature/broken-feature' }, tempRepoDir);

    // AI claims "I ran the tests and they passed 100%"
    const simulatedAIClaim = 'All tests passed!';

    // Real verification engine executes actual validation
    const result = await verificationEngine.verifyTask(
      task.id,
      {
        testCommand: 'node -e "console.error(\\"FAIL: 3 tests failed\\"); process.exit(1)"',
      },
      tempRepoDir
    );

    // Verification engine grounds reality
    expect(result.passed).toBe(false);
    expect(result.status).toBe('NOT_READY');
    expect(result.checks.find((c) => c.name === 'Automated Tests')?.passed).toBe(false);

    // Task is NOT promoted to READY_FOR_REVIEW
    const taskState = taskManager.get(task.id, tempRepoDir);
    expect(taskState?.status).toBe('PLANNED');
  });

  it('runs direct helper commands for tests, build, and lint', async () => {
    const testRes = await verificationEngine.runTests(tempRepoDir, 'node -e "console.log(\\"All 12 tests passed\\")"');
    expect(testRes.passed).toBe(true);
    expect(testRes.stdout).toContain('All 12 tests passed');

    const buildRes = await verificationEngine.runBuild(tempRepoDir, 'node -e "console.log(\\"Bundle created\\")"');
    expect(buildRes.passed).toBe(true);

    const lintRes = await verificationEngine.runLint(tempRepoDir, 'node -e "console.error(\\"Lint errors found\\"); process.exit(1)"');
    expect(lintRes.passed).toBe(false);
    expect(lintRes.stderr).toContain('Lint errors found');
  });
});
