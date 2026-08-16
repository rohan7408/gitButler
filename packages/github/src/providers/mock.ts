import {
  type PullRequest,
  type CreatePROptions,
  type MergePROptions,
  type CIStatusResult,
  type CICheck,
  GitButlerError,
} from '@git-butler/core';
import { type IGitHubProvider, type ListPROptions } from '../types.js';

export class MockGitHubProvider implements IGitHubProvider {
  private prs: PullRequest[] = [];
  private checks: Map<number, CICheck[]> = new Map();
  private nextPrNumber: number = 1;

  public async createPR(options: CreatePROptions): Promise<PullRequest> {
    const now = new Date().toISOString();
    const prNumber = this.nextPrNumber++;
    const head = options.headBranch ?? 'feature/branch';
    const base = options.baseBranch ?? 'main';

    const pr: PullRequest = {
      number: prNumber,
      title: options.title,
      body: options.body,
      state: 'OPEN',
      headBranch: head,
      baseBranch: base,
      url: `https://github.com/example/repo/pull/${prNumber}`,
      isDraft: options.draft ?? false,
      mergeable: true,
      author: 'ai-agent',
      createdAt: now,
      updatedAt: now,
    };

    this.prs.push(pr);

    // Default mock checks
    this.checks.set(prNumber, [
      { name: 'build', status: 'completed', conclusion: 'success', url: 'https://ci.example.com/build/1' },
      { name: 'test', status: 'completed', conclusion: 'success', url: 'https://ci.example.com/test/1' },
    ]);

    return pr;
  }

  public async getPR(prNumberOrBranch: number | string): Promise<PullRequest | null> {
    if (typeof prNumberOrBranch === 'number') {
      return this.prs.find((p) => p.number === prNumberOrBranch) ?? null;
    }
    return this.prs.find((p) => p.headBranch === prNumberOrBranch) ?? null;
  }

  public async listPRs(options?: ListPROptions): Promise<PullRequest[]> {
    let result = [...this.prs];
    if (options?.state && options.state !== 'ALL') {
      result = result.filter((p) => p.state === options.state);
    }
    if (options?.limit) {
      result = result.slice(0, options.limit);
    }
    return result;
  }

  public async getChecks(prNumber: number): Promise<CICheck[]> {
    const pr = await this.getPR(prNumber);
    if (!pr) {
      throw new GitButlerError(`Pull request #${prNumber} not found.`, 'PR_NOT_FOUND', { prNumber });
    }
    return this.checks.get(prNumber) ?? [];
  }

  public setChecks(prNumber: number, checks: CICheck[]): void {
    this.checks.set(prNumber, checks);
  }

  public async getCIStatus(branchOrPr: string | number): Promise<CIStatusResult> {
    let pr: PullRequest | null = null;
    if (typeof branchOrPr === 'number') {
      pr = await this.getPR(branchOrPr);
    } else {
      pr = await this.getPR(branchOrPr);
    }

    if (!pr) {
      throw new GitButlerError(`Pull request not found for "${branchOrPr}".`, 'PR_NOT_FOUND', {
        branchOrPr,
      });
    }

    const checks = await this.getChecks(pr.number);
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

  public async mergePR(prNumber: number, _options?: MergePROptions): Promise<PullRequest> {
    const pr = await this.getPR(prNumber);
    if (!pr) {
      throw new GitButlerError(`Pull request #${prNumber} not found.`, 'PR_NOT_FOUND', { prNumber });
    }

    if (pr.state === 'MERGED') {
      return pr;
    }

    const updated: PullRequest = {
      ...pr,
      state: 'MERGED',
      updatedAt: new Date().toISOString(),
    };

    const index = this.prs.findIndex((p) => p.number === prNumber);
    this.prs[index] = updated;
    return updated;
  }
}
