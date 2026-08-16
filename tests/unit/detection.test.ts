import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { GitExecutor, detectGitVersion, isInsideGitRepo, getRepoRoot } from '@git-butler/git';
import { GitButlerError } from '@git-butler/core';

describe('Git Detection & Executor', () => {
  const executor = new GitExecutor();

  it('detects installed git version', async () => {
    const info = await detectGitVersion(executor);
    expect(info.installed).toBe(true);
    expect(info.versionString).toBeDefined();
    expect(info.parsedVersion).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+/);
    expect(info.isCompatible).toBe(true);
  });

  it('executes a basic git command successfully', async () => {
    const result = await executor.exec(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('git version');
  });

  it('throws GitButlerError with structured details on git failure', async () => {
    try {
      await executor.exec(['non-existent-subcommand-12345']);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(GitButlerError);
      const gitError = error as GitButlerError;
      expect(gitError.code).toBe('COMMAND_FAILED');
      expect(gitError.details?.exitCode).not.toBe(0);
      expect(gitError.message).toBeTruthy();
    }
  });

  it('returns non-zero exit code without throwing when throwOnError is false', async () => {
    const result = await executor.exec(['non-existent-subcommand-12345'], { throwOnError: false });
    expect(result.exitCode).not.toBe(0);
  });

  it('correctly identifies git repository status in a temp dir vs git dir', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-test-'));
    try {
      // In a fresh non-git directory
      const isRepo = await isInsideGitRepo(tempDir, executor);
      expect(isRepo).toBe(false);

      const root = await getRepoRoot(tempDir, executor);
      expect(root).toBeNull();

      // Initialize git repo in the temp directory
      await executor.exec(['init'], { cwd: tempDir });

      const isRepoAfterInit = await isInsideGitRepo(tempDir, executor);
      expect(isRepoAfterInit).toBe(true);

      const rootAfterInit = await getRepoRoot(tempDir, executor);
      expect(rootAfterInit).toBe(path.resolve(tempDir));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
