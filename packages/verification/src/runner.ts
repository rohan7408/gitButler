import spawn from 'cross-spawn';
import { type CheckResult } from '@git-butler/core';

export interface RunCommandOptions {
  cwd: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export class CommandRunner {
  public async run(name: string, commandString: string, options: RunCommandOptions): Promise<CheckResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 60000;

    return new Promise<CheckResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      // Handle command and arguments
      // On Windows or Unix, run through shell if it contains spaces or operators
      const child = spawn(commandString, [], {
        cwd: options.cwd,
        shell: true,
        env: {
          ...process.env,
          CI: 'true',
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
        const durationMs = Date.now() - startTime;
        resolve({
          name,
          passed: false,
          durationMs,
          error: err.message,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        const code = exitCode ?? (isTimedOut ? -1 : 0);

        if (isTimedOut) {
          resolve({
            name,
            passed: false,
            durationMs,
            exitCode: code,
            stdout: stdout.trim(),
            stderr: (stderr + `\nCommand timed out after ${timeoutMs}ms`).trim(),
            error: `Command timed out after ${timeoutMs}ms`,
          });
          return;
        }

        resolve({
          name,
          passed: code === 0,
          durationMs,
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          error: code !== 0 ? (stderr.trim() || `Exited with code ${code}`) : undefined,
        });
      });
    });
  }
}

export const defaultCommandRunner = new CommandRunner();
