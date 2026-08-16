import { z } from 'zod';

export const DoctorCheckItemSchema = z.object({
  name: z.string(),
  status: z.enum(['pass', 'warn', 'fail']),
  message: z.string(),
  detail: z.string().optional(),
});
export type DoctorCheckItem = z.infer<typeof DoctorCheckItemSchema>;

export const DoctorReportSchema = z.object({
  allPassed: z.boolean(),
  checks: z.array(DoctorCheckItemSchema),
});
export type DoctorReport = z.infer<typeof DoctorReportSchema>;

export const GitResultSchema = z.object({
  exitCode: z.number(),
  stdout: z.string(),
  stderr: z.string(),
});
export type GitResult = z.infer<typeof GitResultSchema>;

// Git Status Types
export const GitFileStatusSchema = z.object({
  path: z.string(),
  origPath: z.string().optional(),
  indexStatus: z.string(), // 'M', 'A', 'D', 'R', 'C', 'U', '?'
  workingTreeStatus: z.string(), // 'M', 'D', 'U', '?'
  staged: z.boolean(),
  unstaged: z.boolean(),
  untracked: z.boolean(),
});
export type GitFileStatus = z.infer<typeof GitFileStatusSchema>;

export const GitStatusResultSchema = z.object({
  isClean: z.boolean(),
  currentBranch: z.string().optional(),
  trackingBranch: z.string().optional(),
  ahead: z.number().default(0),
  behind: z.number().default(0),
  files: z.array(GitFileStatusSchema),
});
export type GitStatusResult = z.infer<typeof GitStatusResultSchema>;

// Git Branch Types
export const GitBranchInfoSchema = z.object({
  name: z.string(),
  current: z.boolean(),
  commitHash: z.string(),
  upstream: z.string().optional(),
  ahead: z.number().default(0),
  behind: z.number().default(0),
});
export type GitBranchInfo = z.infer<typeof GitBranchInfoSchema>;

// Git Commit Types
export const GitCommitInfoSchema = z.object({
  hash: z.string(),
  shortHash: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  date: z.string(),
  message: z.string(),
  parents: z.array(z.string()).default([]),
});
export type GitCommitInfo = z.infer<typeof GitCommitInfoSchema>;

// Git Diff Types
export const GitDiffFileSchema = z.object({
  path: z.string(),
  status: z.string(),
  insertions: z.number(),
  deletions: z.number(),
  binary: z.boolean().default(false),
});
export type GitDiffFile = z.infer<typeof GitDiffFileSchema>;

export const GitDiffResultSchema = z.object({
  files: z.array(GitDiffFileSchema),
  totalInsertions: z.number(),
  totalDeletions: z.number(),
  patch: z.string(),
});
export type GitDiffResult = z.infer<typeof GitDiffResultSchema>;

// Worktree Types
export const WorktreeInfoSchema = z.object({
  path: z.string(),
  headCommit: z.string(),
  branch: z.string().optional(),
  bare: z.boolean().default(false),
  locked: z.boolean().default(false),
  lockReason: z.string().optional(),
  prunable: z.boolean().default(false),
});
export type WorktreeInfo = z.infer<typeof WorktreeInfoSchema>;

export const WorktreeCreateOptionsSchema = z.object({
  path: z.string(),
  branch: z.string().optional(),
  newBranch: z.string().optional(),
  startPoint: z.string().optional(),
  detach: z.boolean().optional(),
});
export type WorktreeCreateOptions = z.infer<typeof WorktreeCreateOptionsSchema>;

export const WorktreeRemoveOptionsSchema = z.object({
  force: z.boolean().optional(),
  deleteBranch: z.boolean().optional(),
});
export type WorktreeRemoveOptions = z.infer<typeof WorktreeRemoveOptionsSchema>;

// Task Types
export const TaskStatusSchema = z.enum([
  'PLANNED',
  'IN_PROGRESS',
  'READY_FOR_REVIEW',
  'APPROVED',
  'MERGED',
  'COMPLETED',
  'BLOCKED',
  'FAILED',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: TaskStatusSchema,
  branch: z.string(),
  worktreePath: z.string().optional(),
  agent: z.string().optional(),
  checkpoints: z.array(z.string()).default([]),
  commits: z.array(z.string()).default([]),
  pullRequest: z.string().optional(),
  iterations: z.number().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  context: z.record(z.unknown()).optional(),
});
export type Task = z.infer<typeof TaskSchema>;

// Checkpoint Types
export const CheckpointSchema = z.object({
  id: z.string(),
  taskId: z.string().optional(),
  name: z.string(),
  commitHash: z.string(),
  branch: z.string(),
  timestamp: z.string(),
  isCleanAtCreation: z.boolean(),
  contextSummary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

export const CreateCheckpointOptionsSchema = z.object({
  name: z.string(),
  taskId: z.string().optional(),
  contextSummary: z.string().optional(),
  allowDirty: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateCheckpointOptions = z.infer<typeof CreateCheckpointOptionsSchema>;

export const RestoreCheckpointOptionsSchema = z.object({
  force: z.boolean().optional(),
});
export type RestoreCheckpointOptions = z.infer<typeof RestoreCheckpointOptionsSchema>;

// Activity Log & Project Configuration
export const ActivityEventSchema = z.object({
  id: z.string(),
  taskId: z.string().optional(),
  type: z.string(),
  message: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

export const ProjectConfigSchema = z.object({
  projectName: z.string(),
  defaultBranch: z.string().default('main'),
  worktreeDirectory: z.string().default('..'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// Orchestration Types
export const OrchestratedTaskSchema = z.object({
  task: TaskSchema,
  branch: z.string(),
  worktreePath: z.string(),
  isExisting: z.boolean(),
});
export type OrchestratedTask = z.infer<typeof OrchestratedTaskSchema>;

export const StartTaskOptionsSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  branch: z.string().optional(),
  worktreePath: z.string().optional(),
  agent: z.string().optional(),
  reuseExisting: z.boolean().optional(),
  context: z.record(z.unknown()).optional(),
});
export type StartTaskOptions = z.infer<typeof StartTaskOptionsSchema>;

export const CloseTaskOptionsSchema = z.object({
  removeWorktree: z.boolean().optional(),
  force: z.boolean().optional(),
});
export type CloseTaskOptions = z.infer<typeof CloseTaskOptionsSchema>;

// Verification Types
export const VerificationStatusSchema = z.enum([
  'READY_FOR_REVIEW',
  'NOT_READY',
  'VERIFICATION_FAILED',
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const CheckResultSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  durationMs: z.number(),
  exitCode: z.number().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  error: z.string().optional(),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const VerificationResultSchema = z.object({
  passed: z.boolean(),
  status: VerificationStatusSchema,
  taskId: z.string().optional(),
  timestamp: z.string(),
  checks: z.array(CheckResultSchema),
  summary: z.string(),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export const VerificationOptionsSchema = z.object({
  testCommand: z.string().optional(),
  buildCommand: z.string().optional(),
  lintCommand: z.string().optional(),
  requireCleanWorktree: z.boolean().optional(),
  timeoutMs: z.number().optional(),
});
export type VerificationOptions = z.infer<typeof VerificationOptionsSchema>;

// Permission & Safety Types
export const PermissionTierSchema = z.enum([
  'READ_ONLY',
  'LOCAL_MUTATION',
  'REMOTE_INTERACTION',
  'DANGEROUS',
]);
export type PermissionTier = z.infer<typeof PermissionTierSchema>;

export const PermissionPolicySchema = z.object({
  tier: PermissionTierSchema.default('LOCAL_MUTATION'),
  protectedBranches: z.array(z.string()).default(['main', 'master', 'production', 'release']),
  allowDirectMainCommit: z.boolean().default(false),
  allowForcePush: z.boolean().default(false),
});
export type PermissionPolicy = z.infer<typeof PermissionPolicySchema>;

export const CheckPermissionResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  requiredTier: PermissionTierSchema.optional(),
  activeTier: PermissionTierSchema.optional(),
});
export type CheckPermissionResult = z.infer<typeof CheckPermissionResultSchema>;

// GitHub & Remote PR Types
export const PullRequestStateSchema = z.enum(['OPEN', 'CLOSED', 'MERGED']);
export type PullRequestState = z.infer<typeof PullRequestStateSchema>;

export const PullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string(),
  state: PullRequestStateSchema,
  headBranch: z.string(),
  baseBranch: z.string(),
  url: z.string(),
  isDraft: z.boolean().default(false),
  mergeable: z.boolean().default(true),
  author: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PullRequest = z.infer<typeof PullRequestSchema>;

export const CICheckConclusionSchema = z.enum([
  'success',
  'failure',
  'neutral',
  'cancelled',
  'timed_out',
  'action_required',
  'pending',
]);
export type CICheckConclusion = z.infer<typeof CICheckConclusionSchema>;

export const CICheckSchema = z.object({
  name: z.string(),
  status: z.enum(['queued', 'in_progress', 'completed']),
  conclusion: CICheckConclusionSchema.optional(),
  url: z.string().optional(),
});
export type CICheck = z.infer<typeof CICheckSchema>;

export const CIStateSchema = z.enum(['PENDING', 'SUCCESS', 'FAILURE', 'ERROR']);
export type CIState = z.infer<typeof CIStateSchema>;

export const CIStatusResultSchema = z.object({
  state: CIStateSchema,
  totalChecks: z.number(),
  passedChecks: z.number(),
  failedChecks: z.number(),
  checks: z.array(CICheckSchema),
});
export type CIStatusResult = z.infer<typeof CIStatusResultSchema>;

export const CreatePROptionsSchema = z.object({
  title: z.string(),
  body: z.string(),
  headBranch: z.string().optional(),
  baseBranch: z.string().default('main'),
  draft: z.boolean().default(false),
  taskId: z.string().optional(),
});
export type CreatePROptions = z.infer<typeof CreatePROptionsSchema>;

export const MergePROptionsSchema = z.object({
  method: z.enum(['merge', 'squash', 'rebase']).default('squash'),
  deleteBranch: z.boolean().default(false),
});
export type MergePROptions = z.infer<typeof MergePROptionsSchema>;

// Agent Compatibility Types
export const AgentTypeSchema = z.enum(['claude', 'openai', 'opencode', 'hermes', 'generic']);
export type AgentType = z.infer<typeof AgentTypeSchema>;
