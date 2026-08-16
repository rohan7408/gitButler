import { type PermissionTier } from '@git-butler/core';

export type OperationName =
  // Git Read
  | 'git:status'
  | 'git:diff'
  | 'git:log'
  | 'git:branch_list'
  | 'git:branch_current'
  | 'git:rev_parse'
  // Git Local Mutation
  | 'git:add'
  | 'git:commit'
  | 'git:checkout'
  | 'git:branch_create'
  | 'git:branch_delete_safe'
  // Git Remote Interaction
  | 'git:fetch'
  | 'git:pull'
  | 'git:push'
  // Git Dangerous
  | 'git:push_force'
  | 'git:reset_hard'
  | 'git:clean_fd'
  | 'git:branch_delete_force'
  // Tasks
  | 'task:list'
  | 'task:get'
  | 'task:find'
  | 'task:history'
  | 'task:create'
  | 'task:update'
  | 'task:reopen'
  | 'task:complete'
  // Worktrees
  | 'worktree:list'
  | 'worktree:get'
  | 'worktree:status'
  | 'worktree:create'
  | 'worktree:remove_safe'
  | 'worktree:remove_force'
  | 'worktree:restore'
  | 'worktree:lock'
  | 'worktree:unlock'
  | 'worktree:prune'
  // Checkpoints
  | 'checkpoint:list'
  | 'checkpoint:get'
  | 'checkpoint:create'
  | 'checkpoint:restore'
  // Orchestration & Verification
  | 'orchestrator:start_task'
  | 'orchestrator:continue_task'
  | 'orchestrator:close_task'
  | 'verify:check'
  | 'doctor:run'
  // GitHub
  | 'github:pr_create'
  | 'github:pr_status'
  | 'github:ci_status'
  | 'github:pr_merge'
  | 'github:pr_merge_admin';

export const TIER_LEVELS: Record<PermissionTier, number> = {
  READ_ONLY: 1,
  LOCAL_MUTATION: 2,
  REMOTE_INTERACTION: 3,
  DANGEROUS: 4,
};

export const OPERATION_TIERS: Record<OperationName, PermissionTier> = {
  // Git Read (Tier 1)
  'git:status': 'READ_ONLY',
  'git:diff': 'READ_ONLY',
  'git:log': 'READ_ONLY',
  'git:branch_list': 'READ_ONLY',
  'git:branch_current': 'READ_ONLY',
  'git:rev_parse': 'READ_ONLY',

  // Git Local Mutation (Tier 2)
  'git:add': 'LOCAL_MUTATION',
  'git:commit': 'LOCAL_MUTATION',
  'git:checkout': 'LOCAL_MUTATION',
  'git:branch_create': 'LOCAL_MUTATION',
  'git:branch_delete_safe': 'LOCAL_MUTATION',

  // Git Remote (Tier 3)
  'git:fetch': 'REMOTE_INTERACTION',
  'git:pull': 'REMOTE_INTERACTION',
  'git:push': 'REMOTE_INTERACTION',

  // Git Dangerous (Tier 4)
  'git:push_force': 'DANGEROUS',
  'git:reset_hard': 'DANGEROUS',
  'git:clean_fd': 'DANGEROUS',
  'git:branch_delete_force': 'DANGEROUS',

  // Tasks
  'task:list': 'READ_ONLY',
  'task:get': 'READ_ONLY',
  'task:find': 'READ_ONLY',
  'task:history': 'READ_ONLY',
  'task:create': 'LOCAL_MUTATION',
  'task:update': 'LOCAL_MUTATION',
  'task:reopen': 'LOCAL_MUTATION',
  'task:complete': 'LOCAL_MUTATION',

  // Worktrees
  'worktree:list': 'READ_ONLY',
  'worktree:get': 'READ_ONLY',
  'worktree:status': 'READ_ONLY',
  'worktree:create': 'LOCAL_MUTATION',
  'worktree:remove_safe': 'LOCAL_MUTATION',
  'worktree:remove_force': 'DANGEROUS',
  'worktree:restore': 'LOCAL_MUTATION',
  'worktree:lock': 'LOCAL_MUTATION',
  'worktree:unlock': 'LOCAL_MUTATION',
  'worktree:prune': 'LOCAL_MUTATION',

  // Checkpoints
  'checkpoint:list': 'READ_ONLY',
  'checkpoint:get': 'READ_ONLY',
  'checkpoint:create': 'LOCAL_MUTATION',
  'checkpoint:restore': 'LOCAL_MUTATION',

  // Orchestrator, Verify, Doctor
  'orchestrator:start_task': 'LOCAL_MUTATION',
  'orchestrator:continue_task': 'LOCAL_MUTATION',
  'orchestrator:close_task': 'LOCAL_MUTATION',
  'verify:check': 'READ_ONLY',
  'doctor:run': 'READ_ONLY',

  // GitHub
  'github:pr_create': 'REMOTE_INTERACTION',
  'github:pr_status': 'REMOTE_INTERACTION',
  'github:ci_status': 'REMOTE_INTERACTION',
  'github:pr_merge': 'REMOTE_INTERACTION',
  'github:pr_merge_admin': 'DANGEROUS',
};
