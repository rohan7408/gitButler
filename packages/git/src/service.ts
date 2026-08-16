import fs from 'node:fs';
import path from 'node:path';
import {
  type GitStatusResult,
  type GitDiffResult,
  type GitCommitInfo,
  type GitBranchInfo,
  GitButlerError,
} from '@git-butler/core';
import { GitExecutor, defaultGitExecutor } from './executor.js';
import { parseGitStatus } from './parsers/status.js';
import { parseBranchForEachRef } from './parsers/branch.js';
import { parseGitLog, LOG_FORMAT } from './parsers/log.js';
import { parseGitDiffNumstat } from './parsers/diff.js';

export interface DiffOptions {
  staged?: boolean;
  baseRef?: string;
  targetRef?: string;
}

export interface LogOptions {
  maxCount?: number;
  branchOrRef?: string;
}

export interface CommitOptions {
  allowEmpty?: boolean;
  all?: boolean;
}

export interface CheckoutOptions {
  createBranch?: boolean;
}

export interface PushOptions {
  setUpstream?: boolean;
  force?: boolean;
}

export class GitService {
  constructor(private readonly executor: GitExecutor = defaultGitExecutor) {}

  public async init(options?: { initialBranch?: string }, cwd?: string): Promise<void> {
    const args = ['init'];
    if (options?.initialBranch) {
      args.push('-b', options.initialBranch);
    }
    await this.executor.exec(args, { cwd });
  }

  public async status(cwd?: string): Promise<GitStatusResult> {
    const result = await this.executor.exec(['status', '--porcelain=v1', '-b', '-uall'], { cwd });
    return parseGitStatus(result.stdout);
  }

  public async diff(options?: DiffOptions, cwd?: string): Promise<GitDiffResult> {
    const numstatArgs = ['diff', '--numstat'];
    const patchArgs = ['diff'];

    if (options?.staged) {
      numstatArgs.push('--staged');
      patchArgs.push('--staged');
    }

    if (options?.baseRef && options?.targetRef) {
      numstatArgs.push(`${options.baseRef}...${options.targetRef}`);
      patchArgs.push(`${options.baseRef}...${options.targetRef}`);
    } else if (options?.baseRef) {
      numstatArgs.push(options.baseRef);
      patchArgs.push(options.baseRef);
    }

    const numstatResult = await this.executor.exec(numstatArgs, { cwd });
    const patchResult = await this.executor.exec(patchArgs, { cwd });

    return parseGitDiffNumstat(numstatResult.stdout, patchResult.stdout);
  }

  public async log(options?: LogOptions, cwd?: string): Promise<GitCommitInfo[]> {
    const args = ['log', `--format=${LOG_FORMAT}`];
    if (options?.maxCount) {
      args.push('-n', options.maxCount.toString());
    }
    if (options?.branchOrRef) {
      args.push(options.branchOrRef);
    }

    const result = await this.executor.exec(args, { cwd, throwOnError: false });
    // In empty repo with no commits, git log exits with error: fatal: your current branch 'main' does not have any commits yet
    if (result.exitCode !== 0) {
      if (result.stderr.includes('does not have any commits yet') || result.stderr.includes('fatal: bad default revision')) {
        return [];
      }
      throw new GitButlerError(result.stderr || result.stdout, 'COMMAND_FAILED', {
        command: `git ${args.join(' ')}`,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    }

    return parseGitLog(result.stdout);
  }

  public async branchList(cwd?: string): Promise<GitBranchInfo[]> {
    const args = [
      'for-each-ref',
      '--format=%(refname:short)|%(objectname)|%(upstream:short)|%(upstream:track)|%(HEAD)',
      'refs/heads',
    ];
    const result = await this.executor.exec(args, { cwd });
    return parseBranchForEachRef(result.stdout);
  }

  public async branchCurrent(cwd?: string): Promise<string> {
    const result = await this.executor.exec(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
    return result.stdout.trim();
  }

  public async branchExists(name: string, cwd?: string): Promise<boolean> {
    const branches = await this.branchList(cwd);
    return branches.some((b) => b.name === name);
  }

  public async branchCreate(name: string, startPoint?: string, cwd?: string): Promise<void> {
    const args = ['branch', name];
    if (startPoint) {
      args.push(startPoint);
    }
    await this.executor.exec(args, { cwd });
  }

  public async branchDelete(name: string, force: boolean = false, cwd?: string): Promise<void> {
    const flag = force ? '-D' : '-d';
    await this.executor.exec(['branch', flag, name], { cwd });
  }

  public async checkout(branchOrRef: string, options?: CheckoutOptions, cwd?: string): Promise<void> {
    const args = ['checkout'];
    if (options?.createBranch) {
      args.push('-b');
    }
    args.push(branchOrRef);
    await this.executor.exec(args, { cwd });
  }

  public async add(files: string[] | string, cwd?: string): Promise<void> {
    const fileList = Array.isArray(files) ? files : [files];
    await this.executor.exec(['add', ...fileList], { cwd });
  }

  public async commit(message: string, options?: CommitOptions, cwd?: string): Promise<string> {
    const args = ['commit', '-m', message];
    if (options?.allowEmpty) {
      args.push('--allow-empty');
    }
    if (options?.all) {
      args.push('-a');
    }
    await this.executor.exec(args, { cwd });
    return this.revParse('HEAD', cwd);
  }

  public async revParse(ref: string, cwd?: string): Promise<string> {
    const result = await this.executor.exec(['rev-parse', ref], { cwd });
    return result.stdout.trim();
  }

  public async fetch(remote: string = 'origin', cwd?: string): Promise<void> {
    await this.executor.exec(['fetch', remote], { cwd });
  }

  public async pull(remote: string = 'origin', branch?: string, cwd?: string): Promise<void> {
    const args = ['pull', remote];
    if (branch) {
      args.push(branch);
    }
    await this.executor.exec(args, { cwd });
  }

  public async push(remote: string = 'origin', branch?: string, options?: PushOptions, cwd?: string): Promise<void> {
    const args = ['push'];
    if (options?.setUpstream) {
      args.push('-u');
    }
    if (options?.force) {
      args.push('--force');
    }
    args.push(remote);
    if (branch) {
      args.push(branch);
    }
    await this.executor.exec(args, { cwd });
  }

  public async unlockIndex(cwd?: string): Promise<boolean> {
    try {
      const gitDirRes = await this.executor.exec(['rev-parse', '--git-dir'], { cwd });
      if (gitDirRes.exitCode === 0) {
        const gitDir = path.resolve(cwd ?? process.cwd(), gitDirRes.stdout.trim());
        const lockPath = path.join(gitDir, 'index.lock');
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath);
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  public async pruneWorktrees(cwd?: string): Promise<void> {
    await this.executor.exec(['worktree', 'prune'], { cwd });
  }
}

export const defaultGitService = new GitService();
