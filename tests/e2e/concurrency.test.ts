import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { GitService, GitExecutor } from '@git-butler/git';
import { TaskManager } from '@git-butler/tasks';
import { WorktreeManager } from '@git-butler/worktrees';
import { GitButlerOrchestrator } from '@git-butler/core';
import { GitButlerMcpServer } from '@git-butler/mcp';
import { AgentToolAdapter } from '@git-butler/adapters';

describe('E2E: Multi-Agent Concurrent Worktree Isolation', () => {
  let tempRepoDir: string;
  let executor: GitExecutor;
  let git: GitService;
  let taskManager: TaskManager;
  let worktreeManager: WorktreeManager;
  let orchestrator: GitButlerOrchestrator;
  let mcpServer: GitButlerMcpServer;
  let adapter: AgentToolAdapter;

  beforeEach(async () => {
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-e2e-concurrency-'));
    executor = new GitExecutor(tempRepoDir);
    git = new GitService(executor);
    taskManager = new TaskManager();
    worktreeManager = new WorktreeManager(git, executor);
    orchestrator = new GitButlerOrchestrator(taskManager, worktreeManager, git);

    mcpServer = new GitButlerMcpServer({
      gitService: git,
      taskManager,
      worktreeManager,
      orchestrator,
      defaultCwd: tempRepoDir,
    });
    adapter = new AgentToolAdapter(mcpServer);

    // Initialize root repo
    await git.init({ initialBranch: 'main' }, tempRepoDir);
    await executor.exec(['config', 'user.name', 'MultiAgent Team'], { cwd: tempRepoDir });
    await executor.exec(['config', 'user.email', 'team@gitbutler.ai'], { cwd: tempRepoDir });

    fs.writeFileSync(path.join(tempRepoDir, 'app.json'), JSON.stringify({ version: '1.0.0' }));
    await git.add('.', tempRepoDir);
    await git.commit('chore: init app', {}, tempRepoDir);
  });

  afterEach(() => {
    fs.rmSync(tempRepoDir, { recursive: true, force: true });
  });

  it('allows multiple concurrent agents to work in parallel worktrees without interference', async () => {
    // 1. Agent Alpha starts Frontend Task
    const alphaStart = await adapter.executeAnthropicTool('task_start', {
      name: 'Cart UI Component',
      agent: 'agent-alpha',
      path: tempRepoDir,
    });
    const alphaData = JSON.parse(alphaStart.content[0].text);

    // 2. Agent Beta starts Backend Task
    const betaStart = await adapter.executeOpenAITool('task_start', {
      name: 'Payment Processing Service',
      agent: 'agent-beta',
      path: tempRepoDir,
    });
    const betaData = JSON.parse(betaStart.content);

    // Verify distinct worktrees and branches
    expect(alphaData.worktreePath).not.toBe(betaData.worktreePath);
    expect(alphaData.branch).not.toBe(betaData.branch);

    // 3. Alpha writes frontend files in worktree A
    fs.writeFileSync(path.join(alphaData.worktreePath, 'Cart.tsx'), 'export const Cart = () => <div/>;\n');
    await adapter.executeAnthropicTool('git_commit', {
      message: 'feat: add Cart component',
      path: alphaData.worktreePath,
    });

    // 4. Beta writes backend files in worktree B
    fs.writeFileSync(path.join(betaData.worktreePath, 'Payment.ts'), 'export class PaymentService {}\n');
    await adapter.executeOpenAITool('git_commit', {
      message: 'feat: add PaymentService',
      path: betaData.worktreePath,
    });

    // 5. Verify isolation: Cart.tsx does not exist in Beta worktree and vice versa
    expect(fs.existsSync(path.join(betaData.worktreePath, 'Cart.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(alphaData.worktreePath, 'Payment.ts'))).toBe(false);

    // 6. Verify main repository has neither until merged
    expect(fs.existsSync(path.join(tempRepoDir, 'Cart.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(tempRepoDir, 'Payment.ts'))).toBe(false);

    // 7. Close both tasks cleanly
    await adapter.executeAnthropicTool('task_close', {
      queryOrId: alphaData.task.id,
      path: tempRepoDir,
    });
    await adapter.executeOpenAITool('task_close', {
      queryOrId: betaData.task.id,
      path: tempRepoDir,
    });

    // 8. Verify both worktree directories were removed cleanly
    expect(fs.existsSync(alphaData.worktreePath)).toBe(false);
    expect(fs.existsSync(betaData.worktreePath)).toBe(false);

    // 9. Verify branches and commits still exist in Git history
    const branches = await git.branchList(tempRepoDir);
    const branchNames = branches.map((b) => b.name);
    expect(branchNames).toContain(alphaData.branch);
    expect(branchNames).toContain(betaData.branch);
  });
});
