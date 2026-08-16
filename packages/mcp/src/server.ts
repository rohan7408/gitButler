import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  GitButlerError,
  GitButlerOrchestrator,
  type PermissionPolicy,
} from '@git-butler/core';
import { GitService, runDoctorChecks, defaultGitService } from '@git-butler/git';
import { TaskManager, defaultTaskManager } from '@git-butler/tasks';
import { WorktreeManager, defaultWorktreeManager } from '@git-butler/worktrees';
import { CheckpointManager, defaultCheckpointManager } from '@git-butler/checkpoints';
import { VerificationEngine, defaultVerificationEngine } from '@git-butler/verification';
import { GitHubService, defaultGitHubService } from '@git-butler/github';
import { PermissionGuard, defaultPermissionGuard } from '@git-butler/permissions';
import { TOOLS } from './tools.js';

export interface McpServerOptions {
  gitService?: GitService;
  taskManager?: TaskManager;
  worktreeManager?: WorktreeManager;
  orchestrator?: GitButlerOrchestrator;
  checkpointManager?: CheckpointManager;
  verificationEngine?: VerificationEngine;
  githubService?: GitHubService;
  permissionGuard?: PermissionGuard;
  permissionPolicy?: PermissionPolicy;
  defaultCwd?: string;
}

export interface McpCallResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export class GitButlerMcpServer {
  private readonly gitService: GitService;
  private readonly taskManager: TaskManager;
  private readonly worktreeManager: WorktreeManager;
  private readonly orchestrator: GitButlerOrchestrator;
  private readonly checkpointManager: CheckpointManager;
  private readonly verificationEngine: VerificationEngine;
  private readonly githubService: GitHubService;
  private readonly permissionGuard: PermissionGuard;
  private readonly permissionPolicy: PermissionPolicy;
  private readonly defaultCwd: string;

  constructor(options: McpServerOptions = {}) {
    this.defaultCwd = options.defaultCwd ?? process.cwd();
    this.gitService = options.gitService ?? defaultGitService;
    this.taskManager = options.taskManager ?? defaultTaskManager;
    this.worktreeManager = options.worktreeManager ?? defaultWorktreeManager;
    this.orchestrator =
      options.orchestrator ??
      new GitButlerOrchestrator(this.taskManager, this.worktreeManager, this.gitService);
    this.checkpointManager = options.checkpointManager ?? defaultCheckpointManager;
    this.verificationEngine = options.verificationEngine ?? defaultVerificationEngine;
    this.githubService = options.githubService ?? defaultGitHubService;
    this.permissionGuard = options.permissionGuard ?? defaultPermissionGuard;
    this.permissionPolicy = options.permissionPolicy ?? {
      tier: 'DANGEROUS',
      protectedBranches: ['main', 'master', 'production', 'release'],
      allowDirectMainCommit: false,
      allowForcePush: false,
    };
  }

  public listTools() {
    return TOOLS;
  }

  public async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpCallResult> {
    try {
      const targetCwd = (args.path as string) ? path.resolve(args.path as string) : this.defaultCwd;

      let resultData: unknown;

      switch (name) {
        case 'doctor': {
          this.permissionGuard.assertAllowed('doctor:run', this.permissionPolicy);
          resultData = await runDoctorChecks(targetCwd);
          break;
        }

        case 'git_status': {
          this.permissionGuard.assertAllowed('git:status', this.permissionPolicy);
          resultData = await this.gitService.status(targetCwd);
          break;
        }

        case 'git_diff': {
          this.permissionGuard.assertAllowed('git:diff', this.permissionPolicy);
          resultData = await this.gitService.diff(
            {
              staged: args.staged as boolean | undefined,
              baseRef: args.baseRef as string | undefined,
              targetRef: args.targetRef as string | undefined,
            },
            targetCwd
          );
          break;
        }

        case 'git_log': {
          this.permissionGuard.assertAllowed('git:log', this.permissionPolicy);
          resultData = await this.gitService.log(
            {
              maxCount: args.maxCount as number | undefined,
              branchOrRef: args.branchOrRef as string | undefined,
            },
            targetCwd
          );
          break;
        }

        case 'git_commit': {
          const message = args.message as string;
          const currentBranch = await this.gitService.branchCurrent(targetCwd);
          this.permissionGuard.assertAllowed('git:commit', this.permissionPolicy, {
            targetBranch: currentBranch,
          });

          if (args.files && Array.isArray(args.files)) {
            await this.gitService.add(args.files as string[], targetCwd);
          } else {
            await this.gitService.add('.', targetCwd);
          }
          const commitHash = await this.gitService.commit(
            message,
            { allowEmpty: Boolean(args.allowEmpty) },
            targetCwd
          );
          resultData = { commitHash, message, branch: currentBranch };
          break;
        }

        case 'git_checkout': {
          const branchOrRef = args.branchOrRef as string;
          this.permissionGuard.assertAllowed('git:checkout', this.permissionPolicy);
          await this.gitService.checkout(
            branchOrRef,
            { createBranch: Boolean(args.createBranch) },
            targetCwd
          );
          resultData = { checkedOut: branchOrRef };
          break;
        }

        case 'git_branch_create': {
          const branchName = args.name as string;
          this.permissionGuard.assertAllowed('git:branch_create', this.permissionPolicy);
          await this.gitService.branchCreate(branchName, args.startPoint as string | undefined, targetCwd);
          resultData = { branchCreated: branchName };
          break;
        }

        case 'git_branch_list': {
          this.permissionGuard.assertAllowed('git:branch_list', this.permissionPolicy);
          resultData = await this.gitService.branchList(targetCwd);
          break;
        }

        case 'task_start': {
          this.permissionGuard.assertAllowed('orchestrator:start_task', this.permissionPolicy);
          resultData = await this.orchestrator.startTask(
            {
              name: args.name as string,
              description: args.description as string | undefined,
              branch: args.branch as string | undefined,
              worktreePath: args.worktreePath as string | undefined,
              agent: args.agent as string | undefined,
              reuseExisting: args.reuseExisting !== false,
            },
            targetCwd
          );
          break;
        }

        case 'task_continue': {
          this.permissionGuard.assertAllowed('orchestrator:continue_task', this.permissionPolicy);
          resultData = await this.orchestrator.continueTask(
            args.queryOrId as string,
            { worktreePath: args.worktreePath as string | undefined },
            targetCwd
          );
          break;
        }

        case 'task_close': {
          this.permissionGuard.assertAllowed('orchestrator:close_task', this.permissionPolicy);
          resultData = await this.orchestrator.closeTask(
            args.queryOrId as string,
            {
              removeWorktree: args.removeWorktree !== false,
              force: Boolean(args.force),
            },
            targetCwd
          );
          break;
        }

        case 'task_list': {
          this.permissionGuard.assertAllowed('task:list', this.permissionPolicy);
          resultData = this.taskManager.list(
            {
              status: args.status as any,
              agent: args.agent as string | undefined,
            },
            targetCwd
          );
          break;
        }

        case 'task_get': {
          this.permissionGuard.assertAllowed('task:get', this.permissionPolicy);
          const task =
            this.taskManager.get(args.id as string, targetCwd) ??
            this.taskManager.findOne(args.id as string, targetCwd);
          if (!task) {
            throw new GitButlerError(`Task not found: "${args.id}"`, 'TASK_NOT_FOUND', { id: args.id });
          }
          resultData = task;
          break;
        }

        case 'task_verify': {
          this.permissionGuard.assertAllowed('verify:check', this.permissionPolicy);
          resultData = await this.verificationEngine.verifyTask(
            args.taskIdOrQuery as string,
            {
              testCommand: args.testCommand as string | undefined,
              buildCommand: args.buildCommand as string | undefined,
              lintCommand: args.lintCommand as string | undefined,
              requireCleanWorktree: args.requireCleanWorktree as boolean | undefined,
            },
            targetCwd
          );
          break;
        }

        case 'checkpoint_create': {
          this.permissionGuard.assertAllowed('checkpoint:create', this.permissionPolicy);
          resultData = await this.checkpointManager.create(
            {
              name: args.name as string,
              taskId: args.taskId as string | undefined,
              contextSummary: args.contextSummary as string | undefined,
              allowDirty: args.allowDirty !== false,
            },
            targetCwd,
            targetCwd
          );
          break;
        }

        case 'checkpoint_restore': {
          this.permissionGuard.assertAllowed('checkpoint:restore', this.permissionPolicy);
          resultData = await this.checkpointManager.restore(
            args.id as string,
            { force: Boolean(args.force) },
            targetCwd,
            targetCwd
          );
          break;
        }

        case 'checkpoint_list': {
          this.permissionGuard.assertAllowed('checkpoint:list', this.permissionPolicy);
          resultData = this.checkpointManager.list(args.taskId as string | undefined, targetCwd);
          break;
        }

        case 'pr_create': {
          this.permissionGuard.assertAllowed('github:pr_create', this.permissionPolicy);
          resultData = await this.githubService.prCreate(
            {
              title: args.title as string,
              body: args.body as string,
              headBranch: args.headBranch as string | undefined,
              baseBranch: (args.baseBranch as string) ?? 'main',
              draft: Boolean(args.draft),
              taskId: args.taskId as string | undefined,
            },
            targetCwd,
            targetCwd
          );
          break;
        }

        case 'pr_status': {
          this.permissionGuard.assertAllowed('github:pr_status', this.permissionPolicy);
          const prNumberOrBranch = args.prNumberOrBranch as string;
          const prNumber = Number.parseInt(prNumberOrBranch, 10);
          const target = Number.isNaN(prNumber) ? prNumberOrBranch : prNumber;

          const pr = await this.githubService.prStatus(target, targetCwd);
          const ci = await this.githubService.ciStatus(target, targetCwd).catch(() => null);
          resultData = { pr, ci };
          break;
        }

        case 'pr_merge': {
          this.permissionGuard.assertAllowed('github:pr_merge', this.permissionPolicy);
          resultData = await this.githubService.prMerge(
            args.prNumber as number,
            {
              method: (args.method as any) ?? 'squash',
              deleteBranch: Boolean(args.deleteBranch),
            },
            targetCwd,
            targetCwd,
            args.taskId as string | undefined
          );
          break;
        }

        default:
          throw new GitButlerError(`Unknown tool: "${name}"`, 'COMMAND_FAILED', { name });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(resultData, null, 2),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing tool "${name}": ${message}`,
          },
        ],
      };
    }
  }

  public async startStdio(): Promise<void> {
    const server = new Server(
      {
        name: 'git-butler-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.listTools(),
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const result = await this.callTool(name, (args as Record<string, unknown>) ?? {});
      return {
        content: result.content,
        isError: result.isError,
      };
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}
