import { z } from 'zod';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOLS: McpToolDefinition[] = [
  {
    name: 'doctor',
    description: 'Run health diagnostics on Git Butler, Node, Git version, and repository configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Target repository path (defaults to current working directory)' },
      },
    },
  },
  {
    name: 'git_status',
    description: 'Get structured status of working tree, staged, unstaged, and untracked files.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Target working directory path' },
      },
    },
  },
  {
    name: 'git_diff',
    description: 'Get diff statistics and patch between working tree, staged index, or branches.',
    inputSchema: {
      type: 'object',
      properties: {
        staged: { type: 'boolean', description: 'Compare staged changes against HEAD' },
        baseRef: { type: 'string', description: 'Base branch or commit reference' },
        targetRef: { type: 'string', description: 'Target branch or commit reference' },
        path: { type: 'string', description: 'Target working directory path' },
      },
    },
  },
  {
    name: 'git_log',
    description: 'Get structured commit history with hashes, author, date, and messages.',
    inputSchema: {
      type: 'object',
      properties: {
        maxCount: { type: 'number', description: 'Maximum number of commits to retrieve' },
        branchOrRef: { type: 'string', description: 'Branch or commit reference to inspect' },
        path: { type: 'string', description: 'Target working directory path' },
      },
    },
  },
  {
    name: 'git_commit',
    description: 'Stage specified files (or all files) and create a Git commit with a structured message.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files to stage and commit (defaults to all modified files)',
        },
        allowEmpty: { type: 'boolean', description: 'Allow creating commit with no changes' },
        path: { type: 'string', description: 'Target working directory path' },
      },
      required: ['message'],
    },
  },
  {
    name: 'git_checkout',
    description: 'Switch working tree branch or checkout a specific commit/ref.',
    inputSchema: {
      type: 'object',
      properties: {
        branchOrRef: { type: 'string', description: 'Branch name or commit ref to checkout' },
        createBranch: { type: 'boolean', description: 'Create and switch to new branch if true' },
        path: { type: 'string', description: 'Target working directory path' },
      },
      required: ['branchOrRef'],
    },
  },
  {
    name: 'git_branch_create',
    description: 'Create a new Git branch.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the branch to create' },
        startPoint: { type: 'string', description: 'Starting commit or branch (optional)' },
        path: { type: 'string', description: 'Target working directory path' },
      },
      required: ['name'],
    },
  },
  {
    name: 'git_branch_list',
    description: 'List all local branches in the repository.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Target working directory path' },
      },
    },
  },
  {
    name: 'task_start',
    description: 'Start a new task, generating feature branch and allocating an isolated physical worktree.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Task name (e.g. "Order Tracking Page")' },
        description: { type: 'string', description: 'Detailed description of the task requirements' },
        branch: { type: 'string', description: 'Custom feature branch name (optional)' },
        worktreePath: { type: 'string', description: 'Custom worktree path (optional)' },
        agent: { type: 'string', description: 'Agent identifier (optional)' },
        reuseExisting: { type: 'boolean', description: 'Automatically reuse/continue existing task if name matches' },
        path: { type: 'string', description: 'Target repository root path' },
      },
      required: ['name'],
    },
  },
  {
    name: 'task_continue',
    description: 'Continue or reopen an existing task, restoring its worktree from branch history and tracking iterations.',
    inputSchema: {
      type: 'object',
      properties: {
        queryOrId: { type: 'string', description: 'Task ID or name search query' },
        worktreePath: { type: 'string', description: 'Target worktree directory path (optional)' },
        path: { type: 'string', description: 'Target repository root path' },
      },
      required: ['queryOrId'],
    },
  },
  {
    name: 'task_close',
    description: 'Close task and tear down its temporary worktree while preserving all Git commits on the feature branch.',
    inputSchema: {
      type: 'object',
      properties: {
        queryOrId: { type: 'string', description: 'Task ID or name search query' },
        removeWorktree: { type: 'boolean', description: 'Remove physical worktree directory (default: true)' },
        force: { type: 'boolean', description: 'Force removal even if uncommitted changes exist' },
        path: { type: 'string', description: 'Target repository root path' },
      },
      required: ['queryOrId'],
    },
  },
  {
    name: 'task_list',
    description: 'List tracked tasks with their status, branches, worktrees, and iteration count.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (e.g. IN_PROGRESS, READY_FOR_REVIEW, COMPLETED)' },
        agent: { type: 'string', description: 'Filter by agent ID' },
        path: { type: 'string', description: 'Target repository root path' },
      },
    },
  },
  {
    name: 'task_get',
    description: 'Get full metadata for a specific task.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID or query' },
        path: { type: 'string', description: 'Target repository root path' },
      },
      required: ['id'],
    },
  },
  {
    name: 'task_verify',
    description: 'Run independent verification (branch check, worktree clean check, automated tests, build, lint) to validate task state.',
    inputSchema: {
      type: 'object',
      properties: {
        taskIdOrQuery: { type: 'string', description: 'Task ID or name to verify' },
        testCommand: { type: 'string', description: 'Automated test command to execute' },
        buildCommand: { type: 'string', description: 'Build command to execute' },
        lintCommand: { type: 'string', description: 'Lint command to execute' },
        requireCleanWorktree: { type: 'boolean', description: 'Require no uncommitted changes' },
        path: { type: 'string', description: 'Target repository root path' },
      },
      required: ['taskIdOrQuery'],
    },
  },
  {
    name: 'checkpoint_create',
    description: 'Create an instant safe snapshot checkpoint of working files and commit state.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Checkpoint description (e.g. "Before database refactor")' },
        taskId: { type: 'string', description: 'Associated task ID (optional)' },
        contextSummary: { type: 'string', description: 'Context summary for the snapshot' },
        allowDirty: { type: 'boolean', description: 'Auto-commit uncommitted changes into snapshot (default: true)' },
        path: { type: 'string', description: 'Target working directory path' },
      },
      required: ['name'],
    },
  },
  {
    name: 'checkpoint_restore',
    description: 'Safely roll back the working tree and Git index to a prior checkpoint commit SHA.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Checkpoint ID (e.g. "cp_abc12345")' },
        force: { type: 'boolean', description: 'Force overwrite uncommitted changes' },
        path: { type: 'string', description: 'Target working directory path' },
      },
      required: ['id'],
    },
  },
  {
    name: 'checkpoint_list',
    description: 'List all saved checkpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Filter checkpoints by task ID' },
        path: { type: 'string', description: 'Target repository root path' },
      },
    },
  },
  {
    name: 'pr_create',
    description: 'Open a GitHub Pull Request and link it directly to the active task.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Pull Request title' },
        body: { type: 'string', description: 'Pull Request markdown body' },
        headBranch: { type: 'string', description: 'Source feature branch' },
        baseBranch: { type: 'string', description: 'Target base branch (default: "main")' },
        draft: { type: 'boolean', description: 'Create as draft pull request' },
        taskId: { type: 'string', description: 'Link PR to task ID' },
        path: { type: 'string', description: 'Target repository root path' },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'pr_status',
    description: 'Query Pull Request state and aggregated CI checks status.',
    inputSchema: {
      type: 'object',
      properties: {
        prNumberOrBranch: { type: 'string', description: 'PR number (e.g. "42") or feature branch name' },
        path: { type: 'string', description: 'Target repository root path' },
      },
      required: ['prNumberOrBranch'],
    },
  },
  {
    name: 'pr_merge',
    description: 'Merge a GitHub Pull Request and automatically update linked task state to MERGED.',
    inputSchema: {
      type: 'object',
      properties: {
        prNumber: { type: 'number', description: 'Pull Request number to merge' },
        method: { type: 'string', enum: ['merge', 'squash', 'rebase'], description: 'Merge method (default: squash)' },
        deleteBranch: { type: 'boolean', description: 'Delete feature branch after merge' },
        taskId: { type: 'string', description: 'Associated task ID' },
        path: { type: 'string', description: 'Target repository root path' },
      },
      required: ['prNumber'],
    },
  },
];
