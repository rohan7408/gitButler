import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { TaskManager } from '@git-butler/tasks';
import { GitHubService, MockGitHubProvider } from '@git-butler/github';
import { GitButlerError } from '@git-butler/core';

describe('GitHubService & PR Integration Tests', () => {
  let tempRepoDir: string;
  let taskManager: TaskManager;
  let mockProvider: MockGitHubProvider;
  let githubService: GitHubService;

  beforeEach(() => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-gh-test-'));
    taskManager = new TaskManager();
    mockProvider = new MockGitHubProvider();
    githubService = new GitHubService(mockProvider, taskManager);
  });

  afterEach(() => {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  });

  it('Test 1 — creates PR and returns strongly typed PullRequest object', async () => {
    const pr = await githubService.prCreate(
      {
        title: 'feat: add user authentication',
        body: 'Implements JWT auth and session handlers.',
        headBranch: 'feature/user-auth',
        baseBranch: 'main',
      },
      tempRepoDir
    );

    expect(pr.number).toBe(1);
    expect(pr.title).toBe('feat: add user authentication');
    expect(pr.state).toBe('OPEN');
    expect(pr.url).toBe('https://github.com/example/repo/pull/1');
    expect(pr.headBranch).toBe('feature/user-auth');
    expect(pr.baseBranch).toBe('main');
  });

  it('Test 2 — queries PR & CI status', async () => {
    const pr = await githubService.prCreate(
      {
        title: 'feat: order tracking page',
        body: 'Live tracking component',
        headBranch: 'feature/order-tracking',
      },
      tempRepoDir
    );

    // Query PR by number
    const statusByNumber = await githubService.prStatus(pr.number, tempRepoDir);
    expect(statusByNumber.number).toBe(pr.number);
    expect(statusByNumber.state).toBe('OPEN');

    // Query PR by branch
    const statusByBranch = await githubService.prStatus('feature/order-tracking', tempRepoDir);
    expect(statusByBranch.number).toBe(pr.number);

    // Query CI status
    const ci = await githubService.ciStatus(pr.number, tempRepoDir);
    expect(ci.state).toBe('SUCCESS');
    expect(ci.totalChecks).toBe(2);
    expect(ci.passedChecks).toBe(2);
    expect(ci.failedChecks).toBe(0);

    // Inject failure check into mock provider
    mockProvider.setChecks(pr.number, [
      { name: 'unit-tests', status: 'completed', conclusion: 'failure' },
    ]);
    const failedCi = await githubService.ciStatus(pr.number, tempRepoDir);
    expect(failedCi.state).toBe('FAILURE');
    expect(failedCi.failedChecks).toBe(1);
  });

  it('Test 3 — merges PR and updates state to MERGED', async () => {
    const pr = await githubService.prCreate(
      {
        title: 'feat: payment gateway integration',
        body: 'Stripe webhook listener',
        headBranch: 'feature/stripe-integration',
      },
      tempRepoDir
    );

    const mergedPr = await githubService.prMerge(pr.number, { method: 'squash' }, tempRepoDir);
    expect(mergedPr.state).toBe('MERGED');

    const statusAfterMerge = await githubService.prStatus(pr.number, tempRepoDir);
    expect(statusAfterMerge.state).toBe('MERGED');
  });

  it('Test 4 — non-existent PR query throws PR_NOT_FOUND', async () => {
    try {
      await githubService.prStatus(9999, tempRepoDir);
      expect.fail('Should throw on non-existent PR');
    } catch (err) {
      expect(err).toBeInstanceOf(GitButlerError);
      expect((err as GitButlerError).code).toBe('PR_NOT_FOUND');
    }
  });

  it('Test 5 — task linkage: creating PR updates task and logs activity', async () => {
    const task = taskManager.create({ name: 'User Profile Page' }, tempRepoDir);

    const pr = await githubService.prCreate(
      {
        title: 'feat: user profile page',
        body: 'Edit avatar and bio',
        headBranch: task.branch,
        taskId: task.id,
      },
      tempRepoDir,
      tempRepoDir
    );

    // Verify task record updated with PR url
    const updatedTask = taskManager.get(task.id, tempRepoDir);
    expect(updatedTask?.pullRequest).toBe(pr.url);

    // Merge PR with taskId and verify task status becomes MERGED
    await githubService.prMerge(pr.number, { method: 'squash' }, tempRepoDir, tempRepoDir, task.id);
    const mergedTask = taskManager.get(task.id, tempRepoDir);
    expect(mergedTask?.status).toBe('MERGED');
  });

  it('Test 6 — lists and filters PRs', async () => {
    await githubService.prCreate({ title: 'PR 1', body: '', headBranch: 'feat/1' });
    const pr2 = await githubService.prCreate({ title: 'PR 2', body: '', headBranch: 'feat/2' });
    await githubService.prMerge(pr2.number);

    const openList = await githubService.prList({ state: 'OPEN' });
    expect(openList).toHaveLength(1);
    expect(openList[0].title).toBe('PR 1');

    const mergedList = await githubService.prList({ state: 'MERGED' });
    expect(mergedList).toHaveLength(1);
    expect(mergedList[0].title).toBe('PR 2');
  });
});
