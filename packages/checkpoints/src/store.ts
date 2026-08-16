import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { type Checkpoint, CheckpointSchema, GitButlerError } from '@git-butler/core';

export const AI_GIT_DIR = '.ai-git';

export function ensureGitExclude(repoRoot: string): void {
  const root = path.resolve(repoRoot);
  const gitDir = path.join(root, '.git');
  let infoDir: string | undefined;

  if (fs.existsSync(gitDir)) {
    try {
      const stat = fs.statSync(gitDir);
      if (stat.isDirectory()) {
        infoDir = path.join(gitDir, 'info');
      }
    } catch {
      // Non-critical
    }
  }

  if (infoDir) {
    try {
      if (!fs.existsSync(infoDir)) {
        fs.mkdirSync(infoDir, { recursive: true });
      }
      const excludeFile = path.join(infoDir, 'exclude');
      const existing = fs.existsSync(excludeFile) ? fs.readFileSync(excludeFile, 'utf-8') : '';
      if (!existing.includes('.ai-git')) {
        fs.appendFileSync(excludeFile, '\n.ai-git\n.ai-git/*\n.ai-git/**\n');
      }
    } catch {
      // Non-critical
    }
  }
}

export class CheckpointStore {
  private readonly root: string;
  private readonly filePath: string;

  constructor(repoRoot: string = process.cwd()) {
    this.root = path.resolve(repoRoot);
    const baseDir = path.join(this.root, AI_GIT_DIR);
    this.filePath = path.join(baseDir, 'checkpoints.json');
    ensureGitExclude(this.root);
  }

  public loadCheckpoints(): Checkpoint[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return z.array(CheckpointSchema).parse(JSON.parse(raw));
    } catch (err) {
      throw new GitButlerError('Failed to parse checkpoints.json state file.', 'STATE_CORRUPT', { cause: err });
    }
  }

  public saveCheckpoints(checkpoints: Checkpoint[]): void {
    ensureGitExclude(this.root);
    z.array(CheckpointSchema).parse(checkpoints);
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
    fs.writeFileSync(tempPath, JSON.stringify(checkpoints, null, 2), 'utf-8');
    try {
      fs.renameSync(tempPath, this.filePath);
    } catch {
      try {
        fs.copyFileSync(tempPath, this.filePath);
        fs.unlinkSync(tempPath);
      } catch (err) {
        throw new GitButlerError(`Failed to write checkpoints atomically: ${this.filePath}`, 'STATE_CORRUPT', { cause: err });
      }
    }
  }

  public appendCheckpoint(checkpoint: Checkpoint): void {
    CheckpointSchema.parse(checkpoint);
    const list = this.loadCheckpoints();
    list.push(checkpoint);
    this.saveCheckpoints(list);
  }
}
