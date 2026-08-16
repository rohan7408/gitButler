import {
  type PullRequest,
  type CreatePROptions,
  type MergePROptions,
  type CIStatusResult,
  type CICheck,
} from '@git-butler/core';

export interface ListPROptions {
  state?: 'OPEN' | 'CLOSED' | 'MERGED' | 'ALL';
  limit?: number;
}

export interface IGitHubProvider {
  createPR(options: CreatePROptions, cwd?: string): Promise<PullRequest>;
  getPR(prNumberOrBranch: number | string, cwd?: string): Promise<PullRequest | null>;
  listPRs(options?: ListPROptions, cwd?: string): Promise<PullRequest[]>;
  getCIStatus(branchOrPr: string | number, cwd?: string): Promise<CIStatusResult>;
  getChecks(prNumber: number, cwd?: string): Promise<CICheck[]>;
  mergePR(prNumber: number, options?: MergePROptions, cwd?: string): Promise<PullRequest>;
}
