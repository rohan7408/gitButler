import spawn from 'cross-spawn';
import { GitButlerError, type GitResult } from '@git-butler/core';

export interface ExecuteGitOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  throwOnError?: boolean;
}

export class GitExecutor {
  constructor(private readonly defaultCwd?: string) {}

  public async exec(args: string[], options: ExecuteGitOptions = {}): Promise<GitResult> {
    const cwd = options.cwd ?? this.defaultCwd ?? process.cwd();
    const timeoutMs = options.timeoutMs ?? 30000;
    const throwOnError = options.throwOnError ?? true;

    return new Promise<GitResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      const child = spawn('git', args, {
        cwd,
        env: {
          ...process.env,
          LC_ALL: 'C',
          GIT_TERMINAL_PROMPT: '0',
          ...options.env,
        },
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(
            new GitButlerError('Git executable was not found in PATH.', 'GIT_NOT_FOUND', {
              cause: err,
              command: `git ${args.join(' ')}`,
            })
          );
        } else {
          reject(
            new GitButlerError(`Failed to spawn git process: ${err.message}`, 'INTERNAL_ERROR', {
              cause: err,
              command: `git ${args.join(' ')}`,
            })
          );
        }
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        const code = exitCode ?? (isTimedOut ? -1 : 0);

        if (isTimedOut) {
          const timeoutErr = new GitButlerError(
            `Git command timed out after ${timeoutMs}ms: git ${args.join(' ')}`,
            'COMMAND_TIMEOUT',
            { command: `git ${args.join(' ')}`, exitCode: code, stdout, stderr }
          );
          if (throwOnError) {
            return reject(timeoutErr);
          }
        }

        const result: GitResult = {
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };

        if (code !== 0 && throwOnError) {
          const message = result.stderr || result.stdout || `Git command failed with exit code ${code}`;
          return reject(
            new GitButlerError(message, 'COMMAND_FAILED', {
              command: `git ${args.join(' ')}`,
              exitCode: code,
              stdout: result.stdout,
              stderr: result.stderr,
            })
          );
        }

        resolve(result);
      });
    });
  }
}

export const defaultGitExecutor = new GitExecutor();
