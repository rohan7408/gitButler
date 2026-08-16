import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createProgram } from '../../apps/cli/src/index.js';
import { GitService, GitExecutor } from '@git-butler/git';

describe('CLI Commands & Parsing', () => {
  let tempRepoDir: string;
  let executor: GitExecutor;
  let git: GitService;

  beforeEach(async () => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-cli-test-'));
    executor = new GitExecutor(tempRepoDir);
    git = new GitService(executor);

    await git.init({ initialBranch: 'main' }, tempRepoDir);
    await executor.exec(['config', 'user.name', 'CLI Tester'], { cwd: tempRepoDir });
    await executor.exec(['config', 'user.email', 'cli@gitbutler.ai'], { cwd: tempRepoDir });

    fs.writeFileSync(path.join(tempRepoDir, 'main.txt'), 'content');
    await git.add('main.txt', tempRepoDir);
    await git.commit('chore: init', {}, tempRepoDir);
  });

  afterEach(() => {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('Test 1 — registers all top-level commands on the CLI program', () => {
    const program = createProgram();
    const commandNames = program.commands.map((c) => c.name());

    expect(commandNames).toContain('version');
    expect(commandNames).toContain('doctor');
    expect(commandNames).toContain('task');
    expect(commandNames).toContain('checkpoint');
    expect(commandNames).toContain('verify');
    expect(commandNames).toContain('pr');
    expect(commandNames).toContain('status');
    expect(commandNames).toContain('diff');
    expect(commandNames).toContain('mcp');
  });

  it('Test 2 — executes task start, list, and close commands via CLI', async () => {
    const program = createProgram();
    program.exitOverride();

    // 1. task start
    await program.parseAsync(['node', 'git-butler', 'task', 'start', 'CLI Feature Task', '-C', tempRepoDir]);

    // 2. task list
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'git-butler', 'task', 'list', '-C', tempRepoDir]);
    expect(logSpy).toHaveBeenCalled();

    // 3. task close
    await program.parseAsync(['node', 'git-butler', 'task', 'close', 'CLI Feature Task', '-C', tempRepoDir]);
  });

  it('Test 3 — executes checkpoint create and list commands via CLI', async () => {
    const program = createProgram();
    program.exitOverride();

    fs.writeFileSync(path.join(tempRepoDir, 'main.txt'), 'modified content');

    // 1. checkpoint create
    await program.parseAsync([
      'node',
      'git-butler',
      'checkpoint',
      'create',
      'CLI Snapshot 1',
      '-C',
      tempRepoDir,
    ]);

    // 2. checkpoint list
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'git-butler', 'checkpoint', 'list', '-C', tempRepoDir]);
    expect(logSpy).toHaveBeenCalled();
  });

  it('Test 4 — executes status and diff commands via CLI', async () => {
    const program = createProgram();
    program.exitOverride();

    fs.writeFileSync(path.join(tempRepoDir, 'newfile.txt'), 'hello world');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'git-butler', 'status', '-C', tempRepoDir]);
    expect(logSpy).toHaveBeenCalled();

    await program.parseAsync(['node', 'git-butler', 'diff', '-C', tempRepoDir]);
    expect(logSpy).toHaveBeenCalled();
  });
});
