import path from 'node:path';
import fs from 'node:fs';
import {
  GitButlerError,
  type WorktreeInfo,
  type WorktreeCreateOptions,
  type WorktreeRemoveOptions,
  type GitStatusResult,
} from '@git-butler/core';
import { GitExecutor, GitService, defaultGitExecutor, defaultGitService } from '@git-butler/git';
import { parseWorktreeListPorcelain } from './parser.js';

export class WorktreeManager {
  constructor(
    private readonly gitService: GitService = defaultGitService,
    private readonly executor: GitExecutor = defaultGitExecutor
  ) {}

  public async list(cwd?: string): Promise<WorktreeInfo[]> {
    const result = await this.executor.exec(['worktree', 'list', '--porcelain'], { cwd });
    return parseWorktreeListPorcelain(result.stdout);
  }

  public async get(worktreePath: string, cwd?: string): Promise<WorktreeInfo | null> {
    const target = path.resolve(worktreePath);
    const worktrees = await this.list(cwd);
    return worktrees.find((w) => path.resolve(w.path) === target) ?? null;
  }

  public async create(options: WorktreeCreateOptions, cwd?: string): Promise<WorktreeInfo> {
    const targetPath = path.resolve(options.path);

    const existing = await this.get(targetPath, cwd);
    if (existing) {
      throw new GitButlerError(
        `Worktree already exists at path: ${targetPath}`,
        'WORKTREE_EXISTS',
        { path: targetPath }
      );
    }

    const args = ['worktree', 'add'];

    if (options.newBranch) {
      args.push('-b', options.newBranch);
      args.push(targetPath);
      if (options.startPoint) {
        args.push(options.startPoint);
      }
    } else if (options.branch) {
      args.push(targetPath, options.branch);
    } else if (options.detach) {
      args.push('--detach', targetPath);
    } else {
      args.push(targetPath);
    }

    await this.executor.exec(args, { cwd });

    const created = await this.get(targetPath, cwd);
    if (!created) {
      throw new GitButlerError(
        `Failed to verify worktree creation at: ${targetPath}`,
        'INTERNAL_ERROR',
        { path: targetPath }
      );
    }

    return created;
  }

  public async status(worktreePath: string): Promise<GitStatusResult> {
    const targetPath = path.resolve(worktreePath);
    return this.gitService.status(targetPath);
  }

  public async remove(
    worktreePath: string,
    options?: WorktreeRemoveOptions,
    cwd?: string
  ): Promise<void> {
    const targetPath = path.resolve(worktreePath);
    const worktree = await this.get(targetPath, cwd);

    if (!worktree) {
      throw new GitButlerError(
        `Worktree not found at path: ${targetPath}`,
        'WORKTREE_NOT_FOUND',
        { path: targetPath }
      );
    }

    // Safety check 1: Locked worktree
    if (worktree.locked && !options?.force) {
      throw new GitButlerError(
        `Worktree is locked (${worktree.lockReason || 'no reason provided'}). Unlock or use force to remove.`,
        'PERMISSION_DENIED',
        { path: targetPath, lockReason: worktree.lockReason }
      );
    }

    // Safety check 2: Dirty worktree (uncommitted / untracked changes)
    if (fs.existsSync(targetPath)) {
      try {
        const status = await this.status(targetPath);
        if (!status.isClean && !options?.force) {
          throw new GitButlerError(
            `Worktree contains uncommitted or untracked changes (${status.files.length} modified files). Removal blocked to prevent data loss.`,
            'WORKTREE_DIRTY',
            { path: targetPath, files: status.files }
          );
        }
      } catch (err) {
        if (err instanceof GitButlerError && err.code === 'WORKTREE_DIRTY') {
          throw err;
        }
        // If status fails because directory is already partially removed, proceed with git worktree remove
      }
    }

    const args = ['worktree', 'remove'];
    if (options?.force) {
      args.push('--force');
    }
    args.push(targetPath);

    await this.executor.exec(args, { cwd });

    // Optionally delete branch
    if (options?.deleteBranch && worktree.branch) {
      await this.gitService.branchDelete(worktree.branch, options.force, cwd);
    }
  }

  public async restore(branch: string, worktreePath: string, cwd?: string): Promise<WorktreeInfo> {
    return this.create({ branch, path: worktreePath }, cwd);
  }

  public async lock(worktreePath: string, reason?: string, cwd?: string): Promise<void> {
    const targetPath = path.resolve(worktreePath);
    const args = ['worktree', 'lock'];
    if (reason) {
      args.push('--reason', reason);
    }
    args.push(targetPath);
    await this.executor.exec(args, { cwd });
  }

  public async unlock(worktreePath: string, cwd?: string): Promise<void> {
    const targetPath = path.resolve(worktreePath);
    await this.executor.exec(['worktree', 'unlock', targetPath], { cwd });
  }

  public async prune(cwd?: string): Promise<void> {
    await this.executor.exec(['worktree', 'prune'], { cwd });
  }
}

export const defaultWorktreeManager = new WorktreeManager();
