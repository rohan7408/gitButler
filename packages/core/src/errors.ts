export type ErrorCode =
  | 'GIT_NOT_FOUND'
  | 'GIT_VERSION_INCOMPATIBLE'
  | 'NOT_A_GIT_REPO'
  | 'COMMAND_FAILED'
  | 'COMMAND_TIMEOUT'
  | 'WORKTREE_DIRTY'
  | 'WORKTREE_NOT_FOUND'
  | 'WORKTREE_EXISTS'
  | 'TASK_NOT_FOUND'
  | 'TASK_ALREADY_EXISTS'
  | 'CHECKPOINT_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'VERIFICATION_FAILED'
  | 'PR_NOT_FOUND'
  | 'COMMAND_NOT_FOUND'
  | 'INVALID_CONFIG'
  | 'STATE_CORRUPT'
  | 'INTERNAL_ERROR';

export interface GitButlerErrorDetails {
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  cause?: unknown;
  [key: string]: unknown;
}

export class GitButlerError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: GitButlerErrorDetails;

  constructor(message: string, code: ErrorCode = 'INTERNAL_ERROR', details?: GitButlerErrorDetails) {
    super(message);
    this.name = 'GitButlerError';
    this.code = code;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GitButlerError);
    }
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
