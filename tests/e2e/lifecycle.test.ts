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
import { AgentToolAdapter } from '@git-butler/adapters';

describe('E2E: Complete AI Agent Feature Lifecycle', () => {
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
  let adapter: AgentToolAdapter;

  beforeEach(async () => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-e2e-lifecycle-'));
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
    adapter = new AgentToolAdapter(mcpServer);

    // Initialize root repository
    await git.init({ initialBranch: 'main' }, tempRepoDir);
    await executor.exec(['config', 'user.name', 'E2E Agent'], { cwd: tempRepoDir });
    await executor.exec(['config', 'user.email', 'agent@gitbutler.ai'], { cwd: tempRepoDir });

    // Initial commit
    fs.writeFileSync(path.join(tempRepoDir, 'package.json'), JSON.stringify({ name: 'my-app', version: '1.0.0' }, null, 2));
    fs.writeFileSync(path.join(tempRepoDir, 'README.md'), '# My App\n');
    await git.add('.', tempRepoDir);
    await git.commit('chore: initial commit', {}, tempRepoDir);
  });

  afterEach(() => {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  });

  it('runs complete multi-phase agent workflow from task start to PR merge and cleanup', async () => {
    // 1. Agent calls task_start through Anthropic tool adapter
    const startCall = await adapter.executeAnthropicTool('task_start', {
      name: 'Customer Portal',
      description: 'Build customer dashboard and profile page',
      path: tempRepoDir,
    });
    expect(startCall.is_error).toBeFalsy();
    const startData = JSON.parse(startCall.content[0].text);
    const taskId = startData.task.id;
    const worktreePath = startData.worktreePath;
    expect(startData.branch).toBe('feature/customer-portal');
    expect(fs.existsSync(worktreePath)).toBe(true);

    // 2. Verify root repo remains clean and untouched
    const rootStatus = await git.status(tempRepoDir);
    expect(rootStatus.isClean).toBe(true);

    // 3. Agent writes code inside the isolated worktree
    fs.writeFileSync(path.join(worktreePath, 'portal.js'), 'export function renderPortal() { return "Customer Portal v1"; }\n');
    fs.writeFileSync(path.join(worktreePath, 'portal.test.js'), 'const { renderPortal } = require("./portal.js"); if (renderPortal() !== "Customer Portal v1") process.exit(1);\n');

    // 4. Agent creates a checkpoint snapshot before refactoring
    const cpCall = await adapter.executeOpenAITool('checkpoint_create', {
      name: 'Before Profile Refactor',
      taskId,
      path: worktreePath,
    });
    const cpData = JSON.parse(cpCall.content);
    expect(cpData.id).toMatch(/^cp_/);
    expect(cpData.name).toBe('Before Profile Refactor');

    // 5. Agent introduces broken code
    fs.writeFileSync(path.join(worktreePath, 'portal.js'), 'SYNTAX ERROR BROKEN CODE');

    // 6. Agent restores checkpoint
    const restoreCall = await adapter.executeAnthropicTool('checkpoint_restore', {
      id: cpData.id,
      force: true,
      path: worktreePath,
    });
    expect(restoreCall.is_error).toBeFalsy();
    const restoredContent = fs.readFileSync(path.join(worktreePath, 'portal.js'), 'utf-8');
    expect(restoredContent).toContain('Customer Portal v1');

    // 7. Agent adds final features and commits code inside worktree
    fs.writeFileSync(path.join(worktreePath, 'portal.js'), 'exports.renderPortal = () => "Customer Portal v2";\n');
    fs.writeFileSync(path.join(worktreePath, 'portal.test.js'), 'const { renderPortal } = require("./portal.js"); if (renderPortal() !== "Customer Portal v2") process.exit(1);\n');

    const commitCall = await adapter.executeOpenAITool('git_commit', {
      message: 'feat: implement customer portal v2',
      path: worktreePath,
    });
    expect(commitCall.content).toContain('commitHash');

    // 8. Agent runs task verification with node test runner
    const verifyCall = await adapter.executeAnthropicTool('task_verify', {
      taskIdOrQuery: taskId,
      testCommand: 'node portal.test.js',
      path: tempRepoDir,
    });
    expect(verifyCall.is_error).toBeFalsy();
    const verifyData = JSON.parse(verifyCall.content[0].text);
    expect(verifyData.status).toBe('READY_FOR_REVIEW');

    // 9. Agent creates GitHub Pull Request
    const prCall = await adapter.executeOpenAITool('pr_create', {
      title: 'feat: customer portal',
      body: 'Complete implementation with unit tests',
      headBranch: startData.branch,
      taskId,
      path: tempRepoDir,
    });
    const prData = JSON.parse(prCall.content);
    expect(prData.number).toBe(1);
    expect(prData.state).toBe('OPEN');

    // 10. Verify task record updated with PR
    const taskGetCall = await adapter.executeAnthropicTool('task_get', {
      id: taskId,
      path: tempRepoDir,
    });
    const taskData = JSON.parse(taskGetCall.content[0].text);
    expect(taskData.pullRequest).toBe(prData.url);

    // 11. Agent merges PR
    const mergeCall = await adapter.executeOpenAITool('pr_merge', {
      prNumber: prData.number,
      taskId,
      path: tempRepoDir,
    });
    const mergedPr = JSON.parse(mergeCall.content);
    expect(mergedPr.state).toBe('MERGED');

    // 12. Agent closes task and tears down worktree
    const closeCall = await adapter.executeAnthropicTool('task_close', {
      queryOrId: taskId,
      removeWorktree: true,
      path: tempRepoDir,
    });
    expect(closeCall.is_error).toBeFalsy();
    expect(fs.existsSync(worktreePath)).toBe(false);

    // 13. Verify final task state is preserved
    const finalTask = taskManager.get(taskId, tempRepoDir);
    expect(finalTask?.status).toBe('COMPLETED');
    expect(finalTask?.pullRequest).toBe(prData.url);
  });
});
