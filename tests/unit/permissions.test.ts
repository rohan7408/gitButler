import { describe, it, expect } from 'vitest';
import { PermissionGuard } from '@git-butler/permissions';
import { GitButlerError, type PermissionPolicy } from '@git-butler/core';

describe('PermissionGuard Unit & Safety Tests', () => {
  const guard = new PermissionGuard();

  it('Test 1 — Tier 1 agent (READ_ONLY): reads succeed, local mutation blocked with PERMISSION_DENIED', () => {
    const policy: PermissionPolicy = {
      tier: 'READ_ONLY',
      protectedBranches: ['main', 'master'],
      allowDirectMainCommit: false,
      allowForcePush: false,
    };

    // Reads are allowed
    expect(guard.canExecute('git:status', policy).allowed).toBe(true);
    expect(guard.canExecute('git:diff', policy).allowed).toBe(true);
    expect(guard.canExecute('git:log', policy).allowed).toBe(true);
    expect(guard.canExecute('task:list', policy).allowed).toBe(true);
    expect(guard.canExecute('checkpoint:list', policy).allowed).toBe(true);

    // Local mutation is blocked
    const commitCheck = guard.canExecute('git:commit', policy);
    expect(commitCheck.allowed).toBe(false);
    expect(commitCheck.requiredTier).toBe('LOCAL_MUTATION');
    expect(commitCheck.activeTier).toBe('READ_ONLY');

    expect(() => guard.assertAllowed('git:commit', policy)).toThrowError(GitButlerError);
    try {
      guard.assertAllowed('git:commit', policy);
    } catch (err) {
      expect((err as GitButlerError).code).toBe('PERMISSION_DENIED');
    }
  });

  it('Test 2 — Tier 2 agent (LOCAL_MUTATION): local mutations succeed, remote push blocked with PERMISSION_DENIED', () => {
    const policy: PermissionPolicy = {
      tier: 'LOCAL_MUTATION',
      protectedBranches: ['main', 'master'],
      allowDirectMainCommit: false,
      allowForcePush: false,
    };

    // Local mutations are allowed
    expect(guard.canExecute('git:add', policy).allowed).toBe(true);
    expect(guard.canExecute('git:commit', policy, { targetBranch: 'feature/login' }).allowed).toBe(true);
    expect(guard.canExecute('task:create', policy).allowed).toBe(true);
    expect(guard.canExecute('checkpoint:create', policy).allowed).toBe(true);
    expect(guard.canExecute('worktree:create', policy).allowed).toBe(true);

    // Remote push is blocked
    const pushCheck = guard.canExecute('git:push', policy);
    expect(pushCheck.allowed).toBe(false);
    expect(pushCheck.requiredTier).toBe('REMOTE_INTERACTION');

    expect(() => guard.assertAllowed('git:push', policy)).toThrow(GitButlerError);
  });

  it('Test 3 — Tier 3 agent (REMOTE_INTERACTION): remote operations succeed, force push blocked with PERMISSION_DENIED', () => {
    const policy: PermissionPolicy = {
      tier: 'REMOTE_INTERACTION',
      protectedBranches: ['main', 'master'],
      allowDirectMainCommit: false,
      allowForcePush: false,
    };

    // Remote operations are allowed
    expect(guard.canExecute('git:fetch', policy).allowed).toBe(true);
    expect(guard.canExecute('git:pull', policy).allowed).toBe(true);
    expect(guard.canExecute('git:push', policy, { targetBranch: 'feature/login' }).allowed).toBe(true);
    expect(guard.canExecute('github:pr_create', policy).allowed).toBe(true);

    // Force push and dangerous operations are blocked
    const forcePushCheck = guard.canExecute('git:push_force', policy, { targetBranch: 'feature/login' });
    expect(forcePushCheck.allowed).toBe(false);
    expect(forcePushCheck.requiredTier).toBe('DANGEROUS');

    expect(() => guard.assertAllowed('git:push_force', policy)).toThrow(GitButlerError);
    expect(() => guard.assertAllowed('git:reset_hard', policy)).toThrow(GitButlerError);
    expect(() => guard.assertAllowed('worktree:remove_force', policy)).toThrow(GitButlerError);
  });

  it('Test 4 — Tier 4 agent (DANGEROUS): all operations allowed', () => {
    const policy: PermissionPolicy = {
      tier: 'DANGEROUS',
      protectedBranches: ['main', 'master'],
      allowDirectMainCommit: true,
      allowForcePush: true,
    };

    expect(guard.canExecute('git:push_force', policy, { targetBranch: 'feature/login' }).allowed).toBe(true);
    expect(guard.canExecute('git:reset_hard', policy).allowed).toBe(true);
    expect(guard.canExecute('git:clean_fd', policy).allowed).toBe(true);
    expect(guard.canExecute('worktree:remove_force', policy).allowed).toBe(true);
  });

  it('Test 5 — Protected branch protection: direct commit/push/delete to main blocked', () => {
    const policy: PermissionPolicy = {
      tier: 'REMOTE_INTERACTION',
      protectedBranches: ['main', 'master'],
      allowDirectMainCommit: false,
      allowForcePush: false,
    };

    // Direct commit to main blocked
    const mainCommit = guard.canExecute('git:commit', policy, { targetBranch: 'main' });
    expect(mainCommit.allowed).toBe(false);
    expect(mainCommit.reason).toContain('Direct commits to protected branch "main" are blocked');

    // Deletion of main blocked
    const mainDelete = guard.canExecute('git:branch_delete_safe', policy, { targetBranch: 'main' });
    expect(mainDelete.allowed).toBe(false);
    expect(mainDelete.reason).toContain('Deletion of protected branch "main" is blocked');

    // Force push to main blocked
    const mainForcePush = guard.canExecute('git:push_force', policy, { targetBranch: 'main' });
    expect(mainForcePush.allowed).toBe(false);
    expect(mainForcePush.reason).toContain('Force pushing to protected branch "main" is strictly blocked');
  });
});
