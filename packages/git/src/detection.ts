import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { type DoctorCheckItem, type DoctorReport } from '@git-butler/core';
import { GitExecutor, defaultGitExecutor } from './executor.js';

export const RECOMMENDED_GIT_VERSION = '2.30.0';

export interface GitVersionInfo {
  installed: boolean;
  versionString?: string;
  parsedVersion?: string;
  isCompatible: boolean;
}

export async function detectGitVersion(executor: GitExecutor = defaultGitExecutor): Promise<GitVersionInfo> {
  try {
    const result = await executor.exec(['--version'], { throwOnError: false });
    if (result.exitCode !== 0) {
      return { installed: false, isCompatible: false };
    }

    // Git version strings look like "git version 2.43.0.windows.1" or "git version 2.39.2"
    const match = result.stdout.match(/git\s+version\s+([0-9]+\.[0-9]+\.[0-9]+)/i);
    const parsed = match ? match[1] : undefined;
    const isCompatible = parsed ? semver.gte(parsed, RECOMMENDED_GIT_VERSION) : false;

    return {
      installed: true,
      versionString: result.stdout,
      parsedVersion: parsed,
      isCompatible,
    };
  } catch {
    return { installed: false, isCompatible: false };
  }
}

export async function isInsideGitRepo(
  cwd?: string,
  executor: GitExecutor = defaultGitExecutor
): Promise<boolean> {
  try {
    const result = await executor.exec(['rev-parse', '--is-inside-work-tree'], {
      cwd,
      throwOnError: false,
    });
    return result.exitCode === 0 && result.stdout === 'true';
  } catch {
    return false;
  }
}

export async function getRepoRoot(
  cwd?: string,
  executor: GitExecutor = defaultGitExecutor
): Promise<string | null> {
  try {
    const result = await executor.exec(['rev-parse', '--show-toplevel'], {
      cwd,
      throwOnError: false,
    });
    if (result.exitCode === 0 && result.stdout) {
      return path.resolve(result.stdout);
    }
    return null;
  } catch {
    return null;
  }
}

export function isGitButlerConfigured(cwd: string = process.cwd()): boolean {
  const configDir = path.join(cwd, '.ai-git');
  return fs.existsSync(configDir);
}

export async function runDoctorChecks(
  cwd: string = process.cwd(),
  executor: GitExecutor = defaultGitExecutor
): Promise<DoctorReport> {
  const checks: DoctorCheckItem[] = [];

  // Check 1: Node.js runtime
  const nodeVer = process.version;
  const nodeSemver = semver.clean(nodeVer) || nodeVer;
  const isNodeOk = semver.gte(nodeSemver, '18.0.0');
  checks.push({
    name: 'Node.js Runtime',
    status: isNodeOk ? 'pass' : 'fail',
    message: isNodeOk ? `Node ${nodeVer} detected` : `Node ${nodeVer} is below required v18+`,
  });

  // Check 2: Git availability
  const gitInfo = await detectGitVersion(executor);
  if (!gitInfo.installed) {
    checks.push({
      name: 'Git Binary',
      status: 'fail',
      message: 'Git is not installed or not available in PATH',
    });
    checks.push({
      name: 'Git Version',
      status: 'fail',
      message: 'Cannot determine Git version',
    });
  } else {
    checks.push({
      name: 'Git Binary',
      status: 'pass',
      message: 'Git executable is detected in PATH',
    });

    if (gitInfo.isCompatible) {
      checks.push({
        name: 'Git Version',
        status: 'pass',
        message: `${gitInfo.versionString} (>= ${RECOMMENDED_GIT_VERSION})`,
      });
    } else {
      checks.push({
        name: 'Git Version',
        status: 'warn',
        message: `${gitInfo.versionString ?? 'unknown'} is older than recommended ${RECOMMENDED_GIT_VERSION}`,
        detail: 'Worktree features work best with Git 2.30.0 or higher.',
      });
    }
  }

  // Check 3: Git repository
  const inRepo = await isInsideGitRepo(cwd, executor);
  if (inRepo) {
    const root = await getRepoRoot(cwd, executor);
    checks.push({
      name: 'Git Repository',
      status: 'pass',
      message: `Inside Git repository (${root ?? cwd})`,
    });
  } else {
    checks.push({
      name: 'Git Repository',
      status: 'warn',
      message: `Current working directory is not a Git repository`,
      detail: 'Run `git init` or switch into a Git repository to use Git Butler task operations.',
    });
  }

  // Check 4: Git Butler config (.ai-git)
  const repoRoot = inRepo ? (await getRepoRoot(cwd, executor)) ?? cwd : cwd;
  const configured = isGitButlerConfigured(repoRoot);
  checks.push({
    name: 'Git Butler Config',
    status: 'pass',
    message: configured ? 'Initialized (.ai-git present)' : 'Not initialized yet (.ai-git not found)',
  });

  const allPassed = checks.every((c) => c.status !== 'fail');

  return {
    allPassed,
    checks,
  };
}

export async function runDoctorFix(
  cwd: string = process.cwd(),
  executor: GitExecutor = defaultGitExecutor
): Promise<{ fixed: string[] }> {
  const fixed: string[] = [];
  const inRepo = await isInsideGitRepo(cwd, executor);
  if (!inRepo) {
    return { fixed };
  }

  const root = (await getRepoRoot(cwd, executor)) ?? cwd;

  // 1. Remove stale index.lock
  const gitDirRes = await executor.exec(['rev-parse', '--git-dir'], { cwd: root, throwOnError: false });
  if (gitDirRes.exitCode === 0) {
    const gitDir = path.resolve(root, gitDirRes.stdout.trim());
    const lockPath = path.join(gitDir, 'index.lock');
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
      fixed.push('Removed stale .git/index.lock file');
    }

    // 2. Ensure .ai-git is in .git/info/exclude
    const excludePath = path.join(gitDir, 'info', 'exclude');
    if (fs.existsSync(excludePath)) {
      const content = fs.readFileSync(excludePath, 'utf-8');
      if (!content.includes('.ai-git')) {
        fs.appendFileSync(excludePath, '\n.ai-git\n.ai-git/\n');
        fixed.push('Added .ai-git to .git/info/exclude');
      }
    }
  }

  // 3. Prune disconnected worktrees
  const pruneRes = await executor.exec(['worktree', 'prune'], { cwd: root, throwOnError: false });
  if (pruneRes.exitCode === 0) {
    fixed.push('Pruned disconnected or stale Git worktrees');
  }

  return { fixed };
}
