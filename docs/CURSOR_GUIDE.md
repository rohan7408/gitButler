# Git Butler — Cursor IDE Integration Guide

This guide explains how to configure Cursor to utilize Git Butler for automated worktrees, checkpoints, and quality gates.

---

## 1. Configure MCP Server in Cursor

Create or edit `.cursor/mcp.json` in your repository root:

```json
{
  "mcpServers": {
    "git-butler": {
      "command": "npx",
      "args": ["-y", "@git-butler/cli", "mcp"]
    }
  }
}
```

---

## 2. Cursor Rules (`.cursorrules`)

Add the following rules to your project's `.cursorrules` file so Cursor's Agent automatically uses Git Butler:

```markdown
# Git Butler Operating Rules

You have access to Git Butler MCP tools for safe Git workflows.

## Mandatory Rules:
1. Always start a task using `task_start` before creating or editing files.
2. Perform all edits in the worktree directory returned by `task_start`.
3. Call `checkpoint_create` before major refactors. If changes break, use `checkpoint_restore`.
4. Never claim a task is completed without running `task_verify` to run test suites.
5. Use `git_status` and `git_diff` instead of guessing Git state.
6. When done, call `task_close` to clean up the temporary worktree.
```

---

## 3. Example Prompts in Cursor Composer

### Start a New Feature
```text
@git-butler Start a task called "User Authentication" and implement JWT session handlers with unit tests in the allocated worktree.
```

### Snapshot Before Refactor
```text
@git-butler Create a checkpoint before we refactor the database schema.
```

### Verify Quality Gate
```text
@git-butler Verify the "User Authentication" task and open a GitHub PR if all tests pass.
```
