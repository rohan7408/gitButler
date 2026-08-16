import path from 'node:path';
import { type WorktreeInfo } from '@git-butler/core';

export function parseWorktreeListPorcelain(output: string): WorktreeInfo[] {
  if (!output.trim()) return [];

  // Worktree list porcelain blocks are separated by double newlines or end of string
  const blocks = output.trim().split(/\r?\n\r?\n/);
  const worktrees: WorktreeInfo[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    let worktreePath = '';
    let headCommit = '';
    let branch: string | undefined;
    let bare = false;
    let locked = false;
    let lockReason: string | undefined;
    let prunable = false;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        worktreePath = path.resolve(line.substring('worktree '.length).trim());
      } else if (line.startsWith('HEAD ')) {
        headCommit = line.substring('HEAD '.length).trim();
      } else if (line.startsWith('branch ')) {
        const fullRef = line.substring('branch '.length).trim();
        branch = fullRef.replace(/^refs\/heads\//, '');
      } else if (line === 'bare') {
        bare = true;
      } else if (line.startsWith('locked')) {
        locked = true;
        const reason = line.substring('locked'.length).trim();
        if (reason) {
          lockReason = reason;
        }
      } else if (line.startsWith('prunable')) {
        prunable = true;
      }
    }

    if (worktreePath) {
      worktrees.push({
        path: worktreePath,
        headCommit,
        branch,
        bare,
        locked,
        lockReason,
        prunable,
      });
    }
  }

  return worktrees;
}
