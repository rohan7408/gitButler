import { Command } from 'commander';
import { runDoctorCommand } from './commands/doctor.js';
import { runVersionCommand, VERSION } from './commands/version.js';
import { createTaskCommand } from './commands/task.js';
import { createCheckpointCommand } from './commands/checkpoint.js';
import { createVerifyCommand } from './commands/verify.js';
import { createPrCommand } from './commands/pr.js';
import { createStatusCommand, createDiffCommand } from './commands/status.js';
import { GitButlerMcpServer } from '@git-butler/mcp';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('git-butler')
    .description('Agent-agnostic Git workflow plugin and MCP server for AI coding agents')
    .version(VERSION, '-v, --version', 'Output the current version of Git Butler');

  program
    .command('version')
    .description('Show the Git Butler version')
    .action(() => {
      runVersionCommand();
    });

  program
    .command('doctor')
    .description('Check the local environment for Git, Node, and repository prerequisites')
    .option('-C <path>', 'Run checks in the specified directory', process.cwd())
    .option('--fix', 'Automatically repair common issues (stale lock files, missing excludes, worktree pruning)', false)
    .action(async (options) => {
      await runDoctorCommand(options.C, Boolean(options.fix));
    });

  program.addCommand(createTaskCommand());
  program.addCommand(createCheckpointCommand());
  program.addCommand(createVerifyCommand());
  program.addCommand(createPrCommand());
  program.addCommand(createStatusCommand());
  program.addCommand(createDiffCommand());

  program
    .command('mcp')
    .description('Start the Model Context Protocol (MCP) server on stdio')
    .action(async () => {
      const server = new GitButlerMcpServer();
      await server.startStdio();
    });

  return program;
}

export * from './commands/doctor.js';
export * from './commands/version.js';
export * from './commands/task.js';
export * from './commands/checkpoint.js';
export * from './commands/verify.js';
export * from './commands/pr.js';
export * from './commands/status.js';
