import path from 'node:path';
import {
  type PullRequest,
  type CreatePROptions,
  type MergePROptions,
  type CIStatusResult,
  type CICheck,
  GitButlerError,
} from '@git-butler/core';
import { TaskManager, defaultTaskManager } from '@git-butler/tasks';
import { type IGitHubProvider, type ListPROptions } from './types.js';
import { GhCliProvider } from './providers/gh-cli.js';

export class GitHubService {
  constructor(
    private readonly provider: IGitHubProvider = new GhCliProvider(),
    private readonly taskManager: TaskManager = defaultTaskManager
  ) {}

  public async prCreate(
    options: CreatePROptions,
    cwd: string = process.cwd(),
    repoRoot: string = cwd
  ): Promise<PullRequest> {
    const pr = await this.provider.createPR(options, cwd);

    if (options.taskId) {
      const root = path.resolve(repoRoot);
      try {
        const task = this.taskManager.get(options.taskId, root);
        if (task) {
          this.taskManager.update(options.taskId, { pullRequest: pr.url }, root);
        }
      } catch {
        // Non-critical
      }
    }

    return pr;
  }

  public async prStatus(prNumberOrBranch: number | string, cwd?: string): Promise<PullRequest> {
    const pr = await this.provider.getPR(prNumberOrBranch, cwd);
    if (!pr) {
      throw new GitButlerError(`Pull request not found for "${prNumberOrBranch}".`, 'PR_NOT_FOUND', {
        prNumberOrBranch,
      });
    }
    return pr;
  }

  public async ciStatus(branchOrPr: string | number, cwd?: string): Promise<CIStatusResult> {
    return this.provider.getCIStatus(branchOrPr, cwd);
  }

  public async prChecks(prNumber: number, cwd?: string): Promise<CICheck[]> {
    return this.provider.getChecks(prNumber, cwd);
  }

  public async prMerge(
    prNumber: number,
    options?: MergePROptions,
    cwd: string = process.cwd(),
    repoRoot: string = cwd,
    taskId?: string
  ): Promise<PullRequest> {
    const pr = await this.provider.mergePR(prNumber, options, cwd);

    if (taskId) {
      const root = path.resolve(repoRoot);
      try {
        const task = this.taskManager.get(taskId, root);
        if (task) {
          this.taskManager.update(taskId, { status: 'MERGED' }, root);
        }
      } catch {
        // Non-critical
      }
    }

    return pr;
  }

  public async prList(options?: ListPROptions, cwd?: string): Promise<PullRequest[]> {
    return this.provider.listPRs(options, cwd);
  }
}

export const defaultGitHubService = new GitHubService();
