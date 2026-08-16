import path from 'node:path';
import fs from 'node:fs';
import {
  type CheckResult,
  type VerificationResult,
  type VerificationOptions,
  type VerificationStatus,
  GitButlerError,
} from '@git-butler/core';
import { GitService, defaultGitService } from '@git-butler/git';
import { TaskManager, defaultTaskManager } from '@git-butler/tasks';
import { CommandRunner, defaultCommandRunner } from './runner.js';

export class VerificationEngine {
  constructor(
    private readonly gitService: GitService = defaultGitService,
    private readonly taskManager: TaskManager = defaultTaskManager,
    private readonly commandRunner: CommandRunner = defaultCommandRunner
  ) {}

  public async verifyTask(
    taskIdOrQuery: string,
    options?: VerificationOptions,
    repoRoot: string = process.cwd()
  ): Promise<VerificationResult> {
    const root = path.resolve(repoRoot);
    const checks: CheckResult[] = [];
    const startTime = Date.now();

    // 1. Locate Task
    let task = this.taskManager.get(taskIdOrQuery, root);
    if (!task) {
      task = this.taskManager.findOne(taskIdOrQuery, root);
    }

    if (!task) {
      throw new GitButlerError(`Task not found for verification: "${taskIdOrQuery}"`, 'TASK_NOT_FOUND', {
        taskIdOrQuery,
      });
    }

    const workspaceDir = task.worktreePath && fs.existsSync(task.worktreePath)
      ? path.resolve(task.worktreePath)
      : root;

    // Check 1: Git Branch Existence
    const branchStartTime = Date.now();
    const branchExists = await this.gitService.branchExists(task.branch, root);
    checks.push({
      name: 'Git Branch Existence',
      passed: branchExists,
      durationMs: Date.now() - branchStartTime,
      error: branchExists ? undefined : `Branch "${task.branch}" was not found in Git repository.`,
    });

    if (!branchExists) {
      return {
        passed: false,
        status: 'VERIFICATION_FAILED',
        taskId: task.id,
        timestamp: new Date().toISOString(),
        checks,
        summary: `Verification failed: expected branch "${task.branch}" does not exist.`,
      };
    }

    // Check 2: Worktree & Git Clean Status
    const statusStartTime = Date.now();
    try {
      const gitStatus = await this.gitService.status(workspaceDir);
      const isClean = gitStatus.isClean;
      const requireClean = options?.requireCleanWorktree !== false;

      checks.push({
        name: 'Worktree Git Status',
        passed: requireClean ? isClean : true,
        durationMs: Date.now() - statusStartTime,
        error: !isClean && requireClean
          ? `Worktree has ${gitStatus.files.length} uncommitted or untracked changes.`
          : undefined,
        stdout: isClean ? 'Worktree is clean' : `${gitStatus.files.length} modified files`,
      });
    } catch (err) {
      checks.push({
        name: 'Worktree Git Status',
        passed: false,
        durationMs: Date.now() - statusStartTime,
        error: (err as Error).message,
      });
    }

    const timeoutMs = options?.timeoutMs ?? 60000;

    // Check 3: Automated Tests
    if (options?.testCommand) {
      const testResult = await this.commandRunner.run('Automated Tests', options.testCommand, {
        cwd: workspaceDir,
        timeoutMs,
      });
      checks.push(testResult);
    }

    // Check 4: Build Check
    if (options?.buildCommand) {
      const buildResult = await this.commandRunner.run('Build Check', options.buildCommand, {
        cwd: workspaceDir,
        timeoutMs,
      });
      checks.push(buildResult);
    }

    // Check 5: Lint Check
    if (options?.lintCommand) {
      const lintResult = await this.commandRunner.run('Lint Check', options.lintCommand, {
        cwd: workspaceDir,
        timeoutMs,
      });
      checks.push(lintResult);
    }

    const allPassed = checks.every((c) => c.passed);
    const status: VerificationStatus = allPassed ? 'READY_FOR_REVIEW' : 'NOT_READY';

    // Update task status in TaskManager
    if (allPassed) {
      this.taskManager.update(task.id, { status: 'READY_FOR_REVIEW' }, root);
    }

    const summary = allPassed
      ? `All ${checks.length} verification checks passed. Task is READY_FOR_REVIEW.`
      : `Verification failed: ${checks.filter((c) => !c.passed).map((c) => c.name).join(', ')} failed.`;

    return {
      passed: allPassed,
      status,
      taskId: task.id,
      timestamp: new Date().toISOString(),
      checks,
      summary,
    };
  }

  public async runTests(cwd: string, command: string = 'npm test', timeoutMs?: number): Promise<CheckResult> {
    return this.commandRunner.run('Tests', command, { cwd, timeoutMs });
  }

  public async runBuild(cwd: string, command: string = 'npm run build', timeoutMs?: number): Promise<CheckResult> {
    return this.commandRunner.run('Build', command, { cwd, timeoutMs });
  }

  public async runLint(cwd: string, command: string = 'npm run lint', timeoutMs?: number): Promise<CheckResult> {
    return this.commandRunner.run('Lint', command, { cwd, timeoutMs });
  }
}

export const defaultVerificationEngine = new VerificationEngine();
