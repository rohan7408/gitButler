import { nanoid } from 'nanoid';
import {
  type Task,
  type TaskStatus,
  type ProjectConfig,
  type ActivityEvent,
  GitButlerError,
} from '@git-butler/core';
import { StateStore } from './store.js';

export interface CreateTaskParams {
  name: string;
  description?: string;
  branch?: string;
  agent?: string;
  status?: TaskStatus;
  worktreePath?: string;
  context?: Record<string, unknown>;
}

export interface TaskFilter {
  status?: TaskStatus;
  agent?: string;
}

export function slugifyBranchName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `feature/${slug || 'task'}`;
}

export class TaskManager {
  private getStore(cwd: string = process.cwd()): StateStore {
    return new StateStore(cwd);
  }

  public initProject(config?: Partial<ProjectConfig>, cwd?: string): ProjectConfig {
    const store = this.getStore(cwd);
    const projConfig = store.ensureInitialized(config);

    store.appendActivity({
      id: `act_${nanoid(8)}`,
      type: 'PROJECT_INITIALIZED',
      message: `Project ${projConfig.projectName} initialized with default branch ${projConfig.defaultBranch}`,
      timestamp: new Date().toISOString(),
    });

    return projConfig;
  }

  public isInitialized(cwd?: string): boolean {
    return this.getStore(cwd).isInitialized();
  }

  public getConfig(cwd?: string): ProjectConfig {
    return this.getStore(cwd).loadConfig();
  }

  public create(params: CreateTaskParams, cwd?: string): Task {
    const store = this.getStore(cwd);
    store.ensureInitialized();

    const tasks = store.loadTasks();

    // Check if task with exact same name already exists
    const existing = tasks.find((t) => t.name.trim().toLowerCase() === params.name.trim().toLowerCase());
    if (existing) {
      throw new GitButlerError(
        `Task with name "${params.name}" already exists (ID: ${existing.id}).`,
        'TASK_ALREADY_EXISTS',
        { existingTaskId: existing.id }
      );
    }

    const now = new Date().toISOString();
    const taskId = `task_${nanoid(8)}`;
    const branchName = params.branch?.trim() || slugifyBranchName(params.name);

    const newTask: Task = {
      id: taskId,
      name: params.name.trim(),
      description: params.description?.trim(),
      status: params.status ?? 'PLANNED',
      branch: branchName,
      worktreePath: params.worktreePath,
      agent: params.agent,
      checkpoints: [],
      commits: [],
      iterations: 1,
      createdAt: now,
      updatedAt: now,
      context: params.context,
    };

    tasks.push(newTask);
    store.saveTasks(tasks);

    store.appendActivity({
      id: `act_${nanoid(8)}`,
      taskId,
      type: 'TASK_CREATED',
      message: `Created task "${newTask.name}" on branch "${newTask.branch}"`,
      timestamp: now,
      metadata: { task: newTask },
    });

    return newTask;
  }

  public get(id: string, cwd?: string): Task | null {
    const store = this.getStore(cwd);
    const tasks = store.loadTasks();
    return tasks.find((t) => t.id === id) ?? null;
  }

  public find(query: string, cwd?: string): Task[] {
    const store = this.getStore(cwd);
    const tasks = store.loadTasks();
    const q = query.trim().toLowerCase();

    if (!q) return tasks;

    return tasks.filter((t) => {
      const nameMatch = t.name.toLowerCase().includes(q);
      const idMatch = t.id.toLowerCase() === q;
      const branchMatch = t.branch.toLowerCase().includes(q);
      const descMatch = t.description?.toLowerCase().includes(q);
      return nameMatch || idMatch || branchMatch || descMatch;
    });
  }

  public findOne(query: string, cwd?: string): Task | null {
    const results = this.find(query, cwd);
    return results.length > 0 ? results[0] : null;
  }

  public list(filter?: TaskFilter, cwd?: string): Task[] {
    const store = this.getStore(cwd);
    let tasks = store.loadTasks();

    if (filter?.status) {
      tasks = tasks.filter((t) => t.status === filter.status);
    }
    if (filter?.agent) {
      tasks = tasks.filter((t) => t.agent === filter.agent);
    }

    return tasks;
  }

  public update(id: string, updates: Partial<Task>, cwd?: string): Task {
    const store = this.getStore(cwd);
    const tasks = store.loadTasks();
    const index = tasks.findIndex((t) => t.id === id);

    if (index === -1) {
      throw new GitButlerError(`Task not found with ID: ${id}`, 'TASK_NOT_FOUND', { id });
    }

    const previous = tasks[index];
    const now = new Date().toISOString();

    const updatedTask: Task = {
      ...previous,
      ...updates,
      id: previous.id, // ID is immutable
      createdAt: previous.createdAt,
      updatedAt: now,
    };

    tasks[index] = updatedTask;
    store.saveTasks(tasks);

    // Record activity
    if (updates.status && updates.status !== previous.status) {
      store.appendActivity({
        id: `act_${nanoid(8)}`,
        taskId: id,
        type: 'STATUS_CHANGED',
        message: `Task "${updatedTask.name}" status changed from ${previous.status} to ${updates.status}`,
        timestamp: now,
        metadata: { from: previous.status, to: updates.status },
      });
    } else {
      store.appendActivity({
        id: `act_${nanoid(8)}`,
        taskId: id,
        type: 'TASK_UPDATED',
        message: `Task "${updatedTask.name}" updated`,
        timestamp: now,
        metadata: { updates },
      });
    }

    return updatedTask;
  }

  public reopen(id: string, cwd?: string): Task {
    const task = this.get(id, cwd);
    if (!task) {
      throw new GitButlerError(`Task not found with ID: ${id}`, 'TASK_NOT_FOUND', { id });
    }

    const newIterations = task.iterations + 1;
    const updated = this.update(
      id,
      {
        status: 'IN_PROGRESS',
        iterations: newIterations,
      },
      cwd
    );

    const store = this.getStore(cwd);
    store.appendActivity({
      id: `act_${nanoid(8)}`,
      taskId: id,
      type: 'TASK_REOPENED',
      message: `Task "${updated.name}" reopened (Iteration #${newIterations})`,
      timestamp: new Date().toISOString(),
      metadata: { iteration: newIterations },
    });

    return updated;
  }

  public complete(id: string, cwd?: string): Task {
    const task = this.get(id, cwd);
    if (!task) {
      throw new GitButlerError(`Task not found with ID: ${id}`, 'TASK_NOT_FOUND', { id });
    }

    const updated = this.update(id, { status: 'COMPLETED' }, cwd);

    const store = this.getStore(cwd);
    store.appendActivity({
      id: `act_${nanoid(8)}`,
      taskId: id,
      type: 'TASK_COMPLETED',
      message: `Task "${updated.name}" marked as COMPLETED`,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  public history(id?: string, cwd?: string): ActivityEvent[] {
    const store = this.getStore(cwd);
    const events = store.loadActivity();
    if (id) {
      return events.filter((e) => e.taskId === id);
    }
    return events;
  }
}

export const defaultTaskManager = new TaskManager();
