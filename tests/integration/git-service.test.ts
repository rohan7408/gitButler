import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { GitService, GitExecutor } from '@git-butler/git';
import { GitButlerError } from '@git-butler/core';

describe('GitService Integration Tests', () => {
  let tempDir: string;
  let git: GitService;
  let executor: GitExecutor;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-service-test-'));
    executor = new GitExecutor(tempDir);
    git = new GitService(executor);

    // Initialize repo and set test git author
    await git.init({ initialBranch: 'main' }, tempDir);
    await executor.exec(['config', 'user.name', 'Git Butler Test'], { cwd: tempDir });
    await executor.exec(['config', 'user.email', 'test@gitbutler.local'], { cwd: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('runs complete lifecycle: add, commit, status, branch, checkout, diff, and log', async () => {
    // 1. Initial status in empty repo
    let status = await git.status(tempDir);
    expect(status.isClean).toBe(true);
    expect(status.currentBranch).toBe('main');

    // 2. Create a file and check untracked status
    const filePath = path.join(tempDir, 'README.md');
    fs.writeFileSync(filePath, '# Git Butler Test Repo\nInitial content\n');

    status = await git.status(tempDir);
    expect(status.isClean).toBe(false);
    expect(status.files).toHaveLength(1);
    expect(status.files[0].path).toBe('README.md');
    expect(status.files[0].untracked).toBe(true);
    expect(status.files[0].staged).toBe(false);

    // 3. Stage the file and check staged status
    await git.add('README.md', tempDir);
    status = await git.status(tempDir);
    expect(status.files[0].staged).toBe(true);
    expect(status.files[0].untracked).toBe(false);

    // 4. Commit and verify commit hash
    const commitHash1 = await git.commit('feat: initial commit', {}, tempDir);
    expect(commitHash1).toMatch(/^[0-9a-f]{40}$/);

    status = await git.status(tempDir);
    expect(status.isClean).toBe(true);

    // 5. Branch operations
    await git.branchCreate('feature/order-page', undefined, tempDir);
    const branches = await git.branchList(tempDir);
    expect(branches.map((b) => b.name)).toContain('main');
    expect(branches.map((b) => b.name)).toContain('feature/order-page');

    const exists = await git.branchExists('feature/order-page', tempDir);
    expect(exists).toBe(true);

    // 6. Checkout branch
    await git.checkout('feature/order-page', {}, tempDir);
    const currentBranch = await git.branchCurrent(tempDir);
    expect(currentBranch).toBe('feature/order-page');

    // 7. Make changes and verify diff
    fs.appendFileSync(filePath, 'New line for order page\n');
    const diff = await git.diff({}, tempDir);
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0].path).toBe('README.md');
    expect(diff.totalInsertions).toBe(1);
    expect(diff.patch).toContain('+New line for order page');

    // 8. Commit second change
    await git.add('README.md', tempDir);
    const commitHash2 = await git.commit('feat: update order page', {}, tempDir);
    expect(commitHash2).toMatch(/^[0-9a-f]{40}$/);
    expect(commitHash2).not.toBe(commitHash1);

    // 9. Inspect log
    const logs = await git.log({ maxCount: 10 }, tempDir);
    expect(logs).toHaveLength(2);
    expect(logs[0].hash).toBe(commitHash2);
    expect(logs[0].message).toBe('feat: update order page');
    expect(logs[1].hash).toBe(commitHash1);
    expect(logs[1].message).toBe('feat: initial commit');
  });

  describe('Critical Anti-Hallucination & Error Tests', () => {
    it('throws structured GitButlerError on non-existent branch checkout', async () => {
      try {
        await git.checkout('branch-that-definitely-does-not-exist', {}, tempDir);
        expect.fail('Should not succeed on non-existent branch');
      } catch (err) {
        expect(err).toBeInstanceOf(GitButlerError);
        const gitErr = err as GitButlerError;
        expect(gitErr.code).toBe('COMMAND_FAILED');
        expect(gitErr.details?.exitCode).not.toBe(0);
        expect(gitErr.message).toMatch(/pathspec .* did not match any file/i);
      }
    });

    it('throws structured GitButlerError when committing with nothing staged', async () => {
      // Empty commit without --allow-empty
      try {
        await git.commit('empty commit', {}, tempDir);
        expect.fail('Should not succeed on empty commit');
      } catch (err) {
        expect(err).toBeInstanceOf(GitButlerError);
        const gitErr = err as GitButlerError;
        expect(gitErr.code).toBe('COMMAND_FAILED');
        expect(gitErr.details?.exitCode).not.toBe(0);
      }
    });

    it('throws structured GitButlerError when trying to delete the current branch', async () => {
      // Create initial commit so branch exists
      fs.writeFileSync(path.join(tempDir, 'init.txt'), 'init');
      await git.add('init.txt', tempDir);
      await git.commit('init', {}, tempDir);

      try {
        await git.branchDelete('main', true, tempDir);
        expect.fail('Should not delete checked-out branch');
      } catch (err) {
        expect(err).toBeInstanceOf(GitButlerError);
        const gitErr = err as GitButlerError;
        expect(gitErr.code).toBe('COMMAND_FAILED');
        expect(gitErr.message).toMatch(/cannot delete branch .* checked out/i);
      }
    });

    it('never reports success on invalid revParse ref', async () => {
      try {
        await git.revParse('refs/heads/invalid-ref-xyz', tempDir);
        expect.fail('revParse should fail on invalid ref');
      } catch (err) {
        expect(err).toBeInstanceOf(GitButlerError);
      }
    });
  });
});
