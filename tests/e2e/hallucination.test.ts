import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { GitService, GitExecutor } from '@git-butler/git';
import { TaskManager } from '@git-butler/tasks';
import { WorktreeManager } from '@git-butler/worktrees';
import { VerificationEngine } from '@git-butler/verification';
import { GitButlerOrchestrator } from '@git-butler/core';
import { GitButlerMcpServer } from '@git-butler/mcp';
import { AgentToolAdapter } from '@git-butler/adapters';

describe('E2E: Hallucination Prevention & Verification Gate', () => {
  let tempRepoDir: string;
  let executor: GitExecutor;
  let git: GitService;
  let taskManager: TaskManager;
  let worktreeManager: WorktreeManager;
  let orchestrator: GitButlerOrchestrator;
  let verificationEngine: VerificationEngine;
  let mcpServer: GitButlerMcpServer;
  let adapter: AgentToolAdapter;

  beforeEach(async () => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-e2e-hallucination-'));
    executor = new GitExecutor(tempRepoDir);
    git = new GitService(executor);
    taskManager = new TaskManager();
    worktreeManager = new WorktreeManager(git, executor);
    orchestrator = new GitButlerOrchestrator(taskManager, worktreeManager, git);
    verificationEngine = new VerificationEngine(git, taskManager);

    mcpServer = new GitButlerMcpServer({
      gitService: git,
      taskManager,
      worktreeManager,
      orchestrator,
      verificationEngine,
      defaultCwd: tempRepoDir,
    });
    adapter = new AgentToolAdapter(mcpServer);

    // Initialize root repo
    await git.init({ initialBranch: 'main' }, tempRepoDir);
    await executor.exec(['config', 'user.name', 'Tester'], { cwd: tempRepoDir });
    await executor.exec(['config', 'user.email', 'tester@gitbutler.ai'], { cwd: tempRepoDir });

    fs.writeFileSync(path.join(tempRepoDir, 'main.js'), 'console.log("ready");');
    await git.add('.', tempRepoDir);
    await git.commit('chore: init', {}, tempRepoDir);
  });

  afterEach(() => {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  });

  it('rejects false agent claims when subprocess tests fail and admits task once truly fixed', async () => {
    // 1. Agent starts task
    const startCall = await adapter.executeAnthropicTool('task_start', {
      name: 'Tax Calculator Module',
      path: tempRepoDir,
    });
    const startData = JSON.parse(startCall.content[0].text);
    const worktreePath = startData.worktreePath;
    const taskId = startData.task.id;

    // 2. Agent writes buggy calculator and failing test
    fs.writeFileSync(
      path.join(worktreePath, 'calculator.js'),
      'exports.calculateTax = (amount) => amount * 0.50; // Buggy 50% tax\n'
    );
    fs.writeFileSync(
      path.join(worktreePath, 'test.js'),
      'const { calculateTax } = require("./calculator.js"); if (calculateTax(100) !== 10) { console.error("Expected 10% tax, got", calculateTax(100)); process.exit(1); }\n'
    );

    // Commit changes
    await adapter.executeAnthropicTool('git_commit', {
      message: 'feat: add tax calculator',
      path: worktreePath,
    });

    // 3. Agent attempts to verify — tests FAIL in real subprocess execution
    const verifyFailCall = await adapter.executeAnthropicTool('task_verify', {
      taskIdOrQuery: taskId,
      testCommand: 'node test.js',
      path: tempRepoDir,
    });
    const failData = JSON.parse(verifyFailCall.content[0].text);
    expect(failData.passed).toBe(false);
    expect(failData.status).toBe('NOT_READY');
    expect(failData.summary).toContain('Verification failed');

    // Verify task status in state store did NOT advance to READY_FOR_REVIEW
    const taskAfterFail = taskManager.get(taskId, tempRepoDir);
    expect(taskAfterFail?.status).not.toBe('READY_FOR_REVIEW');

    // 4. Agent fixes the bug
    fs.writeFileSync(
      path.join(worktreePath, 'calculator.js'),
      'exports.calculateTax = (amount) => amount * 0.10; // Fixed 10% tax\n'
    );
    await adapter.executeAnthropicTool('git_commit', {
      message: 'fix: correct tax calculation rate to 10%',
      path: worktreePath,
    });

    // 5. Agent re-verifies — tests PASS
    const verifyPassCall = await adapter.executeAnthropicTool('task_verify', {
      taskIdOrQuery: taskId,
      testCommand: 'node test.js',
      path: tempRepoDir,
    });
    const passData = JSON.parse(verifyPassCall.content[0].text);
    expect(passData.passed).toBe(true);
    expect(passData.status).toBe('READY_FOR_REVIEW');

    // Verify task status in state store updated to READY_FOR_REVIEW
    const taskAfterPass = taskManager.get(taskId, tempRepoDir);
    expect(taskAfterPass?.status).toBe('READY_FOR_REVIEW');
  });
});
