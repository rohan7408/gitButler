import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  type Task,
  TaskSchema,
  type ProjectConfig,
  ProjectConfigSchema,
  type ActivityEvent,
  ActivityEventSchema,
  GitButlerError,
} from '@git-butler/core';

export const AI_GIT_DIR = '.ai-git';

export class StateStore {
  private readonly baseDir: string;
  private readonly configPath: string;
  private readonly tasksPath: string;
  private readonly activityPath: string;

  constructor(repoRoot: string = process.cwd()) {
    this.baseDir = path.join(path.resolve(repoRoot), AI_GIT_DIR);
    this.configPath = path.join(this.baseDir, 'config.json');
    this.tasksPath = path.join(this.baseDir, 'tasks.json');
    this.activityPath = path.join(this.baseDir, 'activity.json');
  }

  public getStorePath(): string {
    return this.baseDir;
  }

  public isInitialized(): boolean {
    return fs.existsSync(this.baseDir) && fs.existsSync(this.configPath);
  }

  public ensureInitialized(config?: Partial<ProjectConfig>): ProjectConfig {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    let currentConfig: ProjectConfig;
    if (!fs.existsSync(this.configPath)) {
      const now = new Date().toISOString();
      const parentDirName = path.basename(path.dirname(this.baseDir)) || 'git-butler-project';
      currentConfig = {
        projectName: config?.projectName ?? parentDirName,
        defaultBranch: config?.defaultBranch ?? 'main',
        worktreeDirectory: config?.worktreeDirectory ?? '..',
        createdAt: now,
        updatedAt: now,
      };
      this.saveConfig(currentConfig);
    } else {
      currentConfig = this.loadConfig();
    }

    if (!fs.existsSync(this.tasksPath)) {
      this.saveTasks([]);
    }

    if (!fs.existsSync(this.activityPath)) {
      this.saveActivity([]);
    }

    // Ensure .ai-git is ignored locally by Git in .git/info/exclude
    const gitInfoExclude = path.join(path.dirname(this.baseDir), '.git', 'info', 'exclude');
    if (fs.existsSync(path.dirname(gitInfoExclude))) {
      try {
        const existingExclude = fs.existsSync(gitInfoExclude) ? fs.readFileSync(gitInfoExclude, 'utf-8') : '';
        if (!existingExclude.includes('.ai-git')) {
          fs.appendFileSync(gitInfoExclude, '\n.ai-git\n.ai-git/*\n');
        }
      } catch {
        // Non-critical
      }
    }

    return currentConfig;
  }

  public loadConfig(): ProjectConfig {
    if (!fs.existsSync(this.configPath)) {
      const bakPath = `${this.configPath}.bak`;
      if (fs.existsSync(bakPath)) {
        try {
          const raw = fs.readFileSync(bakPath, 'utf-8');
          const recovered = ProjectConfigSchema.parse(JSON.parse(raw));
          this.saveConfig(recovered);
          return recovered;
        } catch {
          // ignore
        }
      }
      throw new GitButlerError('Git Butler is not initialized in this repository.', 'INVALID_CONFIG');
    }

    try {
      const raw = this.readFileSafe(this.configPath);
      return ProjectConfigSchema.parse(JSON.parse(raw));
    } catch {
      // Recovery from .bak
      const bakPath = `${this.configPath}.bak`;
      if (fs.existsSync(bakPath)) {
        try {
          const rawBak = fs.readFileSync(bakPath, 'utf-8');
          const recovered = ProjectConfigSchema.parse(JSON.parse(rawBak));
          this.saveConfig(recovered);
          return recovered;
        } catch {
          // Both corrupted
        }
      }
      throw new GitButlerError('Failed to parse config.json state file.', 'STATE_CORRUPT');
    }
  }

  public saveConfig(config: ProjectConfig): void {
    ProjectConfigSchema.parse(config);
    this.writeFileAtomic(this.configPath, JSON.stringify(config, null, 2));
  }

  public loadTasks(): Task[] {
    if (!fs.existsSync(this.tasksPath)) {
      const bakPath = `${this.tasksPath}.bak`;
      if (fs.existsSync(bakPath)) {
        try {
          const rawBak = fs.readFileSync(bakPath, 'utf-8');
          const recovered = z.array(TaskSchema).parse(JSON.parse(rawBak));
          this.saveTasks(recovered);
          return recovered;
        } catch {
          return [];
        }
      }
      return [];
    }

    try {
      const raw = this.readFileSafe(this.tasksPath);
      return z.array(TaskSchema).parse(JSON.parse(raw));
    } catch {
      // Self-healing recovery from .bak snapshot
      const bakPath = `${this.tasksPath}.bak`;
      if (fs.existsSync(bakPath)) {
        try {
          const rawBak = fs.readFileSync(bakPath, 'utf-8');
          const recovered = z.array(TaskSchema).parse(JSON.parse(rawBak));
          this.saveTasks(recovered);
          return recovered;
        } catch {
          // Corrupt backup
        }
      }
      return [];
    }
  }

  public saveTasks(tasks: Task[]): void {
    z.array(TaskSchema).parse(tasks);
    this.writeFileAtomic(this.tasksPath, JSON.stringify(tasks, null, 2));
  }

  public loadActivity(): ActivityEvent[] {
    if (!fs.existsSync(this.activityPath)) {
      return [];
    }
    try {
      const raw = this.readFileSafe(this.activityPath);
      return z.array(ActivityEventSchema).parse(JSON.parse(raw));
    } catch {
      const bakPath = `${this.activityPath}.bak`;
      if (fs.existsSync(bakPath)) {
        try {
          const rawBak = fs.readFileSync(bakPath, 'utf-8');
          return z.array(ActivityEventSchema).parse(JSON.parse(rawBak));
        } catch {
          return [];
        }
      }
      return [];
    }
  }

  public saveActivity(events: ActivityEvent[]): void {
    z.array(ActivityEventSchema).parse(events);
    this.writeFileAtomic(this.activityPath, JSON.stringify(events, null, 2));
  }

  public appendActivity(event: ActivityEvent): void {
    ActivityEventSchema.parse(event);
    const events = this.loadActivity();
    events.push(event);
    this.saveActivity(events);
  }

  private readFileSafe(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      throw new GitButlerError(`Failed to read state file: ${filePath}`, 'STATE_CORRUPT', { cause: err });
    }
  }

  private writeFileAtomic(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
    fs.writeFileSync(tempPath, content, 'utf-8');
    try {
      fs.renameSync(tempPath, filePath);
    } catch {
      // Fallback for Windows file lock delays
      try {
        fs.copyFileSync(tempPath, filePath);
        fs.unlinkSync(tempPath);
      } catch (err) {
        throw new GitButlerError(`Failed to write state file atomically: ${filePath}`, 'STATE_CORRUPT', { cause: err });
      }
    }

    // Update backup snapshot with newly confirmed valid content
    try {
      fs.copyFileSync(filePath, `${filePath}.bak`);
    } catch {
      // Non-critical
    }
  }
}
