import path from 'node:path';
import fs from 'node:fs';
import {
  type Task,
  type TaskStatus,
  type OrchestratedTask,
  type StartTaskOptions,
  type CloseTaskOptions,
  type WorktreeInfo,
  type WorktreeCreateOptions,
  type WorktreeRemoveOptions,
  type GitStatusResult,
  type ActivityEvent,
} from './types.js';
import { GitButlerError } from './errors.js';

export interface ITaskManager {
  create(params: { name: string; description?: string; branch?: string; agent?: string; worktreePath?: string; status?: TaskStatus; context?: Record<string, unknown> }, cwd?: string): Task;
  get(id: string, cwd?: string): Task | null;
  find(query: string, cwd?: string): Task[];
  findOne(query: string, cwd?: string): Task | null;
  list(filter?: { status?: TaskStatus; agent?: string }, cwd?: string): Task[];
  update(id: string, updates: Partial<Task>, cwd?: string): Task;
  reopen(id: string, cwd?: string): Task;
  complete(id: string, cwd?: string): Task;
  history(id?: string, cwd?: string): ActivityEvent[];
}

export interface IWorktreeManager {
  create(options: WorktreeCreateOptions, cwd?: string): Promise<WorktreeInfo>;
  list(cwd?: string): Promise<WorktreeInfo[]>;
  get(worktreePath: string, cwd?: string): Promise<WorktreeInfo | null>;
  status(worktreePath: string): Promise<GitStatusResult>;
  remove(worktreePath: string, options?: WorktreeRemoveOptions, cwd?: string): Promise<void>;
  restore(branch: string, worktreePath: string, cwd?: string): Promise<WorktreeInfo>;
}

export interface IGitService {
  branchExists(name: string, cwd?: string): Promise<boolean>;
  branchCurrent(cwd?: string): Promise<string>;
  branchCreate(name: string, startPoint?: string, cwd?: string): Promise<void>;
  revParse(ref: string, cwd?: string): Promise<string>;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function computeDefaultWorktreePath(repoRoot: string, taskName: string): string {
  const repoBaseName = path.basename(path.resolve(repoRoot));
  const taskSlug = slugify(taskName);
  const parentDir = path.dirname(path.resolve(repoRoot));
  return path.resolve(parentDir, `${repoBaseName}-${taskSlug}`);
}

export class GitButlerOrchestrator {
  constructor(
    private readonly taskManager: ITaskManager,
    private readonly worktreeManager: IWorktreeManager,
    private readonly gitService: IGitService
  ) {}

  public async startTask(options: StartTaskOptions, repoRoot: string = process.cwd()): Promise<OrchestratedTask> {
    const root = path.resolve(repoRoot);

    // 1. Check for existing task if reuse is allowed (default true)
    if (options.reuseExisting !== false) {
      const existingTask = this.taskManager.findOne(options.name, root);
      if (existingTask) {
        return this.continueTask(existingTask.id, { worktreePath: options.worktreePath }, root);
      }
    }

    // 2. Compute branch name & worktree path
    const branchName = options.branch?.trim() || `feature/${slugify(options.name)}`;
    const wtPath = options.worktreePath
      ? path.resolve(options.worktreePath)
      : computeDefaultWorktreePath(root, options.name);

    // 3. Create task record
    const task = this.taskManager.create(
      {
        name: options.name,
        description: options.description,
        branch: branchName,
        agent: options.agent,
        status: 'IN_PROGRESS',
        worktreePath: wtPath,
        context: options.context,
      },
      root
    );

    // 4. Create Git branch & worktree
    const branchAlreadyExists = await this.gitService.branchExists(branchName, root);
    let worktree: WorktreeInfo;

    if (branchAlreadyExists) {
      worktree = await this.worktreeManager.create({ path: wtPath, branch: branchName }, root);
    } else {
      worktree = await this.worktreeManager.create({ path: wtPath, newBranch: branchName }, root);
    }

    return {
      task,
      branch: branchName,
      worktreePath: worktree.path,
      isExisting: false,
    };
  }

  public async continueTask(
    queryOrId: string,
    options?: { worktreePath?: string },
    repoRoot: string = process.cwd()
  ): Promise<OrchestratedTask> {
    const root = path.resolve(repoRoot);

    // Find task
    let task = this.taskManager.get(queryOrId, root);
    if (!task) {
      task = this.taskManager.findOne(queryOrId, root);
    }

    if (!task) {
      throw new GitButlerError(`Task not found: "${queryOrId}"`, 'TASK_NOT_FOUND', { queryOrId });
    }

    // Reopen task if completed/closed
    if (task.status === 'COMPLETED' || task.status === 'APPROVED' || task.status === 'MERGED') {
      task = this.taskManager.reopen(task.id, root);
    } else if (task.status !== 'IN_PROGRESS') {
      task = this.taskManager.update(task.id, { status: 'IN_PROGRESS' }, root);
    }

    // Verify / restore worktree
    const expectedPath = options?.worktreePath
      ? path.resolve(options.worktreePath)
      : task.worktreePath
      ? path.resolve(task.worktreePath)
      : computeDefaultWorktreePath(root, task.name);

    let activeWorktree = await this.worktreeManager.get(expectedPath, root);

    if (!activeWorktree || !fs.existsSync(expectedPath)) {
      // Recreate worktree from existing task branch
      activeWorktree = await this.worktreeManager.restore(task.branch, expectedPath, root);
    }

    // Ensure task record has updated worktree path
    if (task.worktreePath !== activeWorktree.path) {
      task = this.taskManager.update(task.id, { worktreePath: activeWorktree.path }, root);
    }

    return {
      task,
      branch: task.branch,
      worktreePath: activeWorktree.path,
      isExisting: true,
    };
  }

  public async closeTask(
    queryOrId: string,
    options?: CloseTaskOptions,
    repoRoot: string = process.cwd()
  ): Promise<Task> {
    const root = path.resolve(repoRoot);

    let task = this.taskManager.get(queryOrId, root);
    if (!task) {
      task = this.taskManager.findOne(queryOrId, root);
    }

    if (!task) {
      throw new GitButlerError(`Task not found: "${queryOrId}"`, 'TASK_NOT_FOUND', { queryOrId });
    }

    const removeWorktree = options?.removeWorktree !== false;
    const force = options?.force === true;

    if (removeWorktree && task.worktreePath) {
      const wt = await this.worktreeManager.get(task.worktreePath, root);
      if (wt) {
        await this.worktreeManager.remove(task.worktreePath, { force }, root);
      }
    }

    const completed = this.taskManager.complete(task.id, root);
    return completed;
  }

  public async getActiveTasks(repoRoot: string = process.cwd()): Promise<OrchestratedTask[]> {
    const root = path.resolve(repoRoot);
    const tasks = this.taskManager.list(undefined, root);
    const activeTasks = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'READY_FOR_REVIEW');

    const result: OrchestratedTask[] = [];
    for (const t of activeTasks) {
      const wtPath = t.worktreePath || computeDefaultWorktreePath(root, t.name);
      result.push({
        task: t,
        branch: t.branch,
        worktreePath: wtPath,
        isExisting: true,
      });
    }

    return result;
  }
}
