import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { parseWorktreeListPorcelain } from '@git-butler/worktrees';

describe('Worktree Parser', () => {
  it('parses multi-worktree porcelain output', () => {
    const output = [
      'worktree /repo/main',
      'HEAD e87b21a6f8b123456789',
      'branch refs/heads/main',
      '',
      'worktree /repo/order-page',
      'HEAD 99a12c8b7e1234567890',
      'branch refs/heads/feature/order-page',
      'locked Reason: agent is modifying files',
      '',
      'worktree /repo/bare-repo',
      'bare',
    ].join('\n');

    const worktrees = parseWorktreeListPorcelain(output);
    expect(worktrees).toHaveLength(3);

    expect(worktrees[0].path).toBe(path.resolve('/repo/main'));
    expect(worktrees[0].headCommit).toBe('e87b21a6f8b123456789');
    expect(worktrees[0].branch).toBe('main');
    expect(worktrees[0].bare).toBe(false);
    expect(worktrees[0].locked).toBe(false);

    expect(worktrees[1].path).toBe(path.resolve('/repo/order-page'));
    expect(worktrees[1].branch).toBe('feature/order-page');
    expect(worktrees[1].locked).toBe(true);
    expect(worktrees[1].lockReason).toBe('Reason: agent is modifying files');

    expect(worktrees[2].bare).toBe(true);
  });

  it('handles empty output gracefully', () => {
    const worktrees = parseWorktreeListPorcelain('');
    expect(worktrees).toEqual([]);
  });
});
