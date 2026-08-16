import { type AgentType } from '@git-butler/core';
import { type PromptOptions } from '../types.js';

export function getAgentSystemPrompt(options: PromptOptions = {}): string {
  const agentType: AgentType = options.agentType ?? 'generic';
  const projectName = options.projectName ?? 'Repository';
  const permissionTier = options.permissionTier ?? 'LOCAL_MUTATION';

  const baseInstructions = `
# Git Butler — AI Coding Assistant Guidelines

You have access to Git Butler tools to manage Git workflows, tasks, worktrees, checkpoints, and quality gates for "${projectName}".

## Core Operating Principles:
1. **You are the Brain; Git Butler is the Hands:**
   You plan and write code. Git Butler executes Git operations, maintains physical isolation, and creates safe recovery points.
2. **Never Fabricate Git State:**
   Never assume or guess Git status, commits, or branch status. Always call \`git_status\`, \`git_log\`, or \`git_diff\` to obtain ground truth.
3. **Use Isolated Worktrees for Every Feature:**
   Always start work with \`task_start(name)\`. This creates a dedicated feature branch and allocates an isolated physical worktree. Perform all code modifications inside that worktree.
4. **Create Checkpoints Before Complex Changes:**
   Before performing large refactors or risky multi-file edits, call \`checkpoint_create(name)\`. If anything breaks, you can instantly restore with \`checkpoint_restore(id)\`.
5. **Enforce Independent Verification:**
   Never claim a task is done without calling \`task_verify(taskId)\`. Git Butler will run real automated tests, builds, and linting checks to verify your code before marking the task ready.
6. **Active Permission Policy:**
   Your current permission tier is **${permissionTier}**. Direct commits, deletions, or force pushes to protected branches (main, master, production) are strictly blocked by safety policies.
`.trim();

  switch (agentType) {
    case 'claude':
      return `${baseInstructions}

## Claude Tool Use Notes:
- Invoke tools using standard tool calling XML / JSON payloads.
- Always check the returned JSON object for \`isError: true\` or error details.
`;

    case 'openai':
      return `${baseInstructions}

## OpenAI / Codex Function Calling Notes:
- Call tools via the structured function calling interface.
- Check return values for execution results and handle structured error codes.
`;

    case 'opencode':
    case 'hermes':
      return `${baseInstructions}

## Agent Runtime Notes:
- Provide clear task names when starting work with \`task_start\`.
- Keep commit messages concise and following Conventional Commits (e.g., feat:, fix:, chore:).
`;

    default:
      return baseInstructions;
  }
}
