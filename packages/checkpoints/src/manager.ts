import path from 'node:path';
import { nanoid } from 'nanoid';
import {
  type Checkpoint,
  type CreateCheckpointOptions,
  type RestoreCheckpointOptions,
  GitButlerError,
} from '@git-butler/core';
import { GitService, GitExecutor, defaultGitService, defaultGitExecutor } from '@git-butler/git';
import { TaskManager, defaultTaskManager } from '@git-butler/tasks';
import { CheckpointStore } from './store.js';

export class CheckpointManager {
  constructor(
    private readonly gitService: GitService = defaultGitService,
    private readonly executor: GitExecutor = defaultGitExecutor,
    private readonly taskManager: TaskManager = defaultTaskManager
  ) {}

  public async create(
    options: CreateCheckpointOptions,
    targetDir: string = process.cwd(),
    repoRoot: string = targetDir
  ): Promise<Checkpoint> {
    const dir = path.resolve(targetDir);
    const root = path.resolve(repoRoot);

    const status = await this.gitService.status(dir);
    const isClean = status.isClean;

    // Instantiate store and ensure .ai-git is excluded from git
    const store = new CheckpointStore(root);

    // If dirty, stage and commit snapshot (respecting .git/info/exclude)
    if (!isClean && options.allowDirty !== false) {
      await this.executor.exec(['add', '-A'], { cwd: dir });
      await this.gitService.commit(`[checkpoint] ${options.name}`, {}, dir);
    }

    const commitHash = await this.gitService.revParse('HEAD', dir);
    const currentBranch = await this.gitService.branchCurrent(dir);
    const checkpointId = `cp_${nanoid(8)}`;
    const now = new Date().toISOString();

    const checkpoint: Checkpoint = {
      id: checkpointId,
      taskId: options.taskId,
      name: options.name,
      commitHash,
      branch: currentBranch,
      timestamp: now,
      isCleanAtCreation: isClean,
      contextSummary: options.contextSummary,
      metadata: options.metadata,
    };

    store.appendCheckpoint(checkpoint);

    // If associated with a task, update task's checkpoint list
    if (options.taskId) {
      try {
        const task = this.taskManager.get(options.taskId, root);
        if (task) {
          const updatedCheckpoints = [...task.checkpoints, checkpointId];
          this.taskManager.update(options.taskId, { checkpoints: updatedCheckpoints }, root);
        }
      } catch {
        // Continue even if task manager update encounters non-critical warning
      }
    }

    return checkpoint;
  }

  public list(taskId?: string, repoRoot: string = process.cwd()): Checkpoint[] {
    const store = new CheckpointStore(path.resolve(repoRoot));
    const checkpoints = store.loadCheckpoints();
    if (taskId) {
      return checkpoints.filter((c) => c.taskId === taskId);
    }
    return checkpoints;
  }

  public get(id: string, repoRoot: string = process.cwd()): Checkpoint | null {
    const store = new CheckpointStore(path.resolve(repoRoot));
    const checkpoints = store.loadCheckpoints();
    return checkpoints.find((c) => c.id === id) ?? null;
  }

  public async restore(
    id: string,
    options?: RestoreCheckpointOptions,
    targetDir: string = process.cwd(),
    repoRoot: string = targetDir
  ): Promise<Checkpoint> {
    const dir = path.resolve(targetDir);
    const root = path.resolve(repoRoot);

    const checkpoint = this.get(id, root);
    if (!checkpoint) {
      throw new GitButlerError(`Checkpoint not found: "${id}"`, 'CHECKPOINT_NOT_FOUND', { id });
    }

    // Safety check: uncommitted changes made after checkpoint
    const status = await this.gitService.status(dir);
    if (!status.isClean && !options?.force) {
      throw new GitButlerError(
        `Working directory contains uncommitted changes (${status.files.length} modified files). Restoration blocked to prevent data loss. Use force to overwrite.`,
        'WORKTREE_DIRTY',
        { checkpointId: id, files: status.files }
      );
    }

    // Restore Git state to the exact commit SHA
    await this.executor.exec(['reset', '--hard', checkpoint.commitHash], { cwd: dir });
    await this.executor.exec(['clean', '-fd', '-e', '.ai-git', '-e', '.ai-git/*'], { cwd: dir });

    return checkpoint;
  }
}

export const defaultCheckpointManager = new CheckpointManager();
