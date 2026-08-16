import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { GitService, GitExecutor } from '@git-butler/git';
import { TaskManager } from '@git-butler/tasks';
import { WorktreeManager } from '@git-butler/worktrees';
import { CheckpointManager } from '@git-butler/checkpoints';
import { VerificationEngine } from '@git-butler/verification';
import { GitHubService, MockGitHubProvider } from '@git-butler/github';
import { GitButlerOrchestrator } from '@git-butler/core';
import { GitButlerMcpServer } from '@git-butler/mcp';

describe('GitButlerMcpServer Integration Tests', () => {
  let tempRepoDir: string;
  let executor: GitExecutor;
  let git: GitService;
  let taskManager: TaskManager;
  let worktreeManager: WorktreeManager;
  let orchestrator: GitButlerOrchestrator;
  let checkpointManager: CheckpointManager;
  let verificationEngine: VerificationEngine;
  let mockGhProvider: MockGitHubProvider;
  let githubService: GitHubService;
  let mcpServer: GitButlerMcpServer;

  beforeEach(async () => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-mcp-test-'));
    executor = new GitExecutor(tempRepoDir);
    git = new GitService(executor);
    taskManager = new TaskManager();
    worktreeManager = new WorktreeManager(git, executor);
    orchestrator = new GitButlerOrchestrator(taskManager, worktreeManager, git);
    checkpointManager = new CheckpointManager(git, executor, taskManager);
    verificationEngine = new VerificationEngine(git, taskManager);
    mockGhProvider = new MockGitHubProvider();
    githubService = new GitHubService(mockGhProvider, taskManager);

    mcpServer = new GitButlerMcpServer({
      gitService: git,
      taskManager,
      worktreeManager,
      orchestrator,
      checkpointManager,
      verificationEngine,
      githubService,
      defaultCwd: tempRepoDir,
    });

    // Initialize git repository
    await git.init({ initialBranch: 'main' }, tempRepoDir);
    await executor.exec(['config', 'user.name', 'MCP Tester'], { cwd: tempRepoDir });
    await executor.exec(['config', 'user.email', 'tester@mcp.local'], { cwd: tempRepoDir });

    fs.writeFileSync(path.join(tempRepoDir, 'main.txt'), 'base\n');
    await git.add('main.txt', tempRepoDir);
    await git.commit('chore: init main', {}, tempRepoDir);
  });

  afterEach(() => {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  });

  it('Test 1 — verifies all MCP tools are registered with schemas and descriptions', () => {
    const tools = mcpServer.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(18);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('doctor');
    expect(toolNames).toContain('git_status');
    expect(toolNames).toContain('git_diff');
    expect(toolNames).toContain('git_log');
    expect(toolNames).toContain('git_commit');
    expect(toolNames).toContain('git_checkout');
    expect(toolNames).toContain('task_start');
    expect(toolNames).toContain('task_continue');
    expect(toolNames).toContain('task_close');
    expect(toolNames).toContain('task_list');
    expect(toolNames).toContain('task_verify');
    expect(toolNames).toContain('checkpoint_create');
    expect(toolNames).toContain('checkpoint_restore');
    expect(toolNames).toContain('pr_create');
    expect(toolNames).toContain('pr_status');
    expect(toolNames).toContain('pr_merge');

    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('Test 2 — executes doctor and git_status tools over MCP', async () => {
    // 1. Doctor tool
    const doctorResult = await mcpServer.callTool('doctor', { path: tempRepoDir });
    expect(doctorResult.isError).toBeFalsy();
    expect(doctorResult.content).toHaveLength(1);
    const doctorData = JSON.parse(doctorResult.content[0].text);
    expect(doctorData.allPassed).toBe(true);

    // 2. Git status tool
    const statusResult = await mcpServer.callTool('git_status', { path: tempRepoDir });
    expect(statusResult.isError).toBeFalsy();
    const statusData = JSON.parse(statusResult.content[0].text);
    expect(statusData.isClean).toBe(true);
    expect(statusData.currentBranch).toBe('main');
  });

  it('Test 3 — executes task_start, task_list, and task_close lifecycle over MCP', async () => {
    // 1. task_start
    const startResult = await mcpServer.callTool('task_start', {
      name: 'MCP Shopping Cart',
      description: 'Implement cart state',
      path: tempRepoDir,
    });
    expect(startResult.isError).toBeFalsy();
    const startData = JSON.parse(startResult.content[0].text);
    expect(startData.task.name).toBe('MCP Shopping Cart');
    expect(startData.branch).toBe('feature/mcp-shopping-cart');
    expect(startData.worktreePath).toBeTruthy();

    // 2. task_list
    const listResult = await mcpServer.callTool('task_list', { path: tempRepoDir });
    const listData = JSON.parse(listResult.content[0].text);
    expect(listData).toHaveLength(1);
    expect(listData[0].name).toBe('MCP Shopping Cart');

    // 3. task_close
    const closeResult = await mcpServer.callTool('task_close', {
      queryOrId: 'MCP Shopping Cart',
      path: tempRepoDir,
    });
    expect(closeResult.isError).toBeFalsy();
    const closeData = JSON.parse(closeResult.content[0].text);
    expect(closeData.status).toBe('COMPLETED');
  });

  it('Test 4 — executes checkpoint_create and checkpoint_restore over MCP', async () => {
    fs.writeFileSync(path.join(tempRepoDir, 'feature.ts'), 'export const a = 1;\n');

    // 1. checkpoint_create
    const cpResult = await mcpServer.callTool('checkpoint_create', {
      name: 'Feature A v1',
      path: tempRepoDir,
    });
    expect(cpResult.isError).toBeFalsy();
    const cpData = JSON.parse(cpResult.content[0].text);
    expect(cpData.id).toMatch(/^cp_/);
    expect(cpData.name).toBe('Feature A v1');

    // 2. Make bad edits
    fs.writeFileSync(path.join(tempRepoDir, 'feature.ts'), 'BROKEN CODE');

    // 3. checkpoint_restore
    const restoreResult = await mcpServer.callTool('checkpoint_restore', {
      id: cpData.id,
      force: true,
      path: tempRepoDir,
    });
    expect(restoreResult.isError).toBeFalsy();

    const restoredContent = fs.readFileSync(path.join(tempRepoDir, 'feature.ts'), 'utf-8').trim();
    expect(restoredContent).toBe('export const a = 1;');
  });

  it('Test 5 — executes task_verify and pr_create over MCP', async () => {
    await git.branchCreate('feature/checkout-flow', undefined, tempRepoDir);
    const task = taskManager.create({ name: 'Checkout Flow', branch: 'feature/checkout-flow' }, tempRepoDir);

    // 1. task_verify
    const verifyResult = await mcpServer.callTool('task_verify', {
      taskIdOrQuery: task.id,
      testCommand: 'node -e "process.exit(0)"',
      path: tempRepoDir,
    });
    expect(verifyResult.isError).toBeFalsy();
    const verifyData = JSON.parse(verifyResult.content[0].text);
    expect(verifyData.status).toBe('READY_FOR_REVIEW');

    // 2. pr_create
    const prResult = await mcpServer.callTool('pr_create', {
      title: 'feat: checkout flow',
      body: 'Implements Stripe checkout',
      headBranch: 'feature/checkout-flow',
      taskId: task.id,
      path: tempRepoDir,
    });
    expect(prResult.isError).toBeFalsy();
    const prData = JSON.parse(prResult.content[0].text);
    expect(prData.title).toBe('feat: checkout flow');
    expect(prData.number).toBe(1);
  });

  it('Test 6 — handles errors gracefully over MCP without crashing', async () => {
    // 1. Unknown tool
    const unknownRes = await mcpServer.callTool('non_existent_tool', {});
    expect(unknownRes.isError).toBe(true);
    expect(unknownRes.content[0].text).toContain('Unknown tool');

    // 2. Non-existent task
    const taskRes = await mcpServer.callTool('task_get', { id: 'task_nonexistent', path: tempRepoDir });
    expect(taskRes.isError).toBe(true);
    expect(taskRes.content[0].text).toContain('Task not found');
  });
});
