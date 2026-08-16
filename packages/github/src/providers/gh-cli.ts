import spawn from 'cross-spawn';
import {
  type PullRequest,
  type CreatePROptions,
  type MergePROptions,
  type CIStatusResult,
  type CICheck,
  GitButlerError,
} from '@git-butler/core';
import { type IGitHubProvider, type ListPROptions } from '../types.js';

interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class GhCliProvider implements IGitHubProvider {
  private async execGh(args: string[], cwd?: string): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn('gh', args, {
        cwd: cwd ?? process.cwd(),
        env: {
          ...process.env,
          NO_COLOR: '1',
        },
      });

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(
            new GitButlerError('GitHub CLI (`gh`) was not found in PATH.', 'COMMAND_NOT_FOUND', {
              cause: err,
            })
          );
        } else {
          reject(new GitButlerError(`Failed to execute gh CLI: ${err.message}`, 'INTERNAL_ERROR', { cause: err }));
        }
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code ?? 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });
    });
  }

  public async createPR(options: CreatePROptions, cwd?: string): Promise<PullRequest> {
    const args = [
      'pr',
      'create',
      '--title',
      options.title,
      '--body',
      options.body,
      '--base',
      options.baseBranch ?? 'main',
    ];

    if (options.headBranch) {
      args.push('--head', options.headBranch);
    }
    if (options.draft) {
      args.push('--draft');
    }

    const result = await this.execGh(args, cwd);
    if (result.exitCode !== 0) {
      throw new GitButlerError(result.stderr || 'Failed to create PR via gh CLI', 'COMMAND_FAILED', {
        command: `gh ${args.join(' ')}`,
        exitCode: result.exitCode,
        stderr: result.stderr,
      });
    }

    // After creation, query details
    const created = await this.getPR(options.headBranch ?? 'HEAD', cwd);
    if (!created) {
      throw new GitButlerError('PR created but unable to fetch PR details from GitHub.', 'STATE_CORRUPT');
    }
    return created;
  }

  public async getPR(prNumberOrBranch: number | string, cwd?: string): Promise<PullRequest | null> {
    const target = prNumberOrBranch.toString();
    const args = [
      'pr',
      'view',
      target,
      '--json',
      'number,title,body,state,headRefName,baseRefName,url,isDraft,mergeable,author,createdAt,updatedAt',
    ];

    const result = await this.execGh(args, cwd);
    if (result.exitCode !== 0) {
      if (result.stderr.includes('no pull requests found') || result.stderr.includes('Could not resolve to a PullRequest')) {
        return null;
      }
      throw new GitButlerError(result.stderr || `Failed to view PR #${target}`, 'COMMAND_FAILED', {
        command: `gh ${args.join(' ')}`,
        exitCode: result.exitCode,
      });
    }

    try {
      const data = JSON.parse(result.stdout);
      return {
        number: data.number,
        title: data.title,
        body: data.body,
        state: data.state as 'OPEN' | 'CLOSED' | 'MERGED',
        headBranch: data.headRefName,
        baseBranch: data.baseRefName,
        url: data.url,
        isDraft: Boolean(data.isDraft),
        mergeable: data.mergeable === 'MERGEABLE',
        author: data.author?.login,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    } catch (err) {
      throw new GitButlerError('Failed to parse gh PR view response JSON.', 'STATE_CORRUPT', { cause: err });
    }
  }

  public async listPRs(options?: ListPROptions, cwd?: string): Promise<PullRequest[]> {
    const args = [
      'pr',
      'list',
      '--json',
      'number,title,body,state,headRefName,baseRefName,url,isDraft,mergeable,author,createdAt,updatedAt',
    ];

    if (options?.state && options.state !== 'ALL') {
      args.push('--state', options.state.toLowerCase());
    }
    if (options?.limit) {
      args.push('--limit', options.limit.toString());
    }

    const result = await this.execGh(args, cwd);
    if (result.exitCode !== 0) {
      throw new GitButlerError(result.stderr || 'Failed to list PRs via gh CLI', 'COMMAND_FAILED', {
        command: `gh ${args.join(' ')}`,
        exitCode: result.exitCode,
      });
    }

    try {
      const list = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
      return list.map((data) => ({
        number: data.number as number,
        title: data.title as string,
        body: (data.body as string) || '',
        state: data.state as 'OPEN' | 'CLOSED' | 'MERGED',
        headBranch: data.headRefName as string,
        baseBranch: data.baseRefName as string,
        url: data.url as string,
        isDraft: Boolean(data.isDraft),
        mergeable: data.mergeable === 'MERGEABLE',
        author: (data.author as { login?: string })?.login,
        createdAt: data.createdAt as string,
        updatedAt: data.updatedAt as string,
      }));
    } catch (err) {
      throw new GitButlerError('Failed to parse gh PR list response JSON.', 'STATE_CORRUPT', { cause: err });
    }
  }

  public async getChecks(prNumber: number, cwd?: string): Promise<CICheck[]> {
    const args = ['pr', 'checks', prNumber.toString(), '--json', 'name,state,bucket,link'];
    const result = await this.execGh(args, cwd);
    if (result.exitCode !== 0) {
      return [];
    }

    try {
      const list = JSON.parse(result.stdout) as Array<Record<string, string>>;
      return list.map((c) => ({
        name: c.name,
        status: c.state === 'SUCCESS' || c.state === 'FAILURE' ? 'completed' : 'in_progress',
        conclusion: c.state === 'SUCCESS' ? 'success' : c.state === 'FAILURE' ? 'failure' : 'pending',
        url: c.link,
      }));
    } catch {
      return [];
    }
  }

  public async getCIStatus(branchOrPr: string | number, cwd?: string): Promise<CIStatusResult> {
    const pr = await this.getPR(branchOrPr, cwd);
    if (!pr) {
      throw new GitButlerError(`Pull request not found for "${branchOrPr}".`, 'PR_NOT_FOUND', { branchOrPr });
    }

    const checks = await this.getChecks(pr.number, cwd);
    const totalChecks = checks.length;
    const passedChecks = checks.filter((c) => c.conclusion === 'success').length;
    const failedChecks = checks.filter(
      (c) => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out'
    ).length;

    let state: 'PENDING' | 'SUCCESS' | 'FAILURE' | 'ERROR' = 'SUCCESS';
    if (failedChecks > 0) {
      state = 'FAILURE';
    } else if (checks.some((c) => c.status !== 'completed' || c.conclusion === 'pending')) {
      state = 'PENDING';
    }

    return {
      state,
      totalChecks,
      passedChecks,
      failedChecks,
      checks,
    };
  }

  public async mergePR(prNumber: number, options?: MergePROptions, cwd?: string): Promise<PullRequest> {
    const args = ['pr', 'merge', prNumber.toString()];
    const method = options?.method ?? 'squash';
    args.push(`--${method}`);

    if (options?.deleteBranch) {
      args.push('--delete-branch');
    }

    const result = await this.execGh(args, cwd);
    if (result.exitCode !== 0) {
      throw new GitButlerError(result.stderr || `Failed to merge PR #${prNumber}`, 'COMMAND_FAILED', {
        command: `gh ${args.join(' ')}`,
        exitCode: result.exitCode,
      });
    }

    const merged = await this.getPR(prNumber, cwd);
    if (!merged) {
      throw new GitButlerError(`PR #${prNumber} merged but unable to retrieve state.`, 'STATE_CORRUPT');
    }
    return merged;
  }
}
