# Git Butler — Model Context Protocol (MCP) Setup Guide

This guide explains how to connect Git Butler's 19 typed MCP tools to your preferred AI coding assistant or IDE.

---

## 1. Claude Desktop

Add the following to your `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

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

Restart Claude Desktop. You will see a 🔨 icon indicating Git Butler tools are active.

---

## 2. Cursor IDE

In Cursor, open **Settings -> Features -> MCP Servers -> Add New MCP Server**:

- **Name:** `git-butler`
- **Type:** `command`
- **Command:** `npx -y @git-butler/cli mcp`

Or configure via `.cursor/mcp.json` in your project root:

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

## 3. Antigravity IDE

Configure in your workspace MCP configuration file or settings:

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

## 4. OpenCode / Hermes / Local LLMs

You can run the MCP server directly over STDIO:

```bash
npx @git-butler/cli mcp
```

Or consume the raw JSON Schema definitions via `@git-butler/adapters`:

```typescript
import { toRawTools, getAgentSystemPrompt } from '@git-butler/adapters';

const tools = toRawTools();
const systemPrompt = getAgentSystemPrompt({ agentType: 'hermes' });
```

---

## 📋 Available MCP Tools

| Tool | Category | Description |
| :--- | :--- | :--- |
| `doctor` | Diagnostics | System and repository health checks |
| `git_status` | Git | Structured porcelain working tree status |
| `git_diff` | Git | Diff statistics and patch details |
| `git_log` | Git | Commit history log |
| `git_commit` | Git | Stage files and create structured commit |
| `git_checkout` | Git | Switch branches or checkout refs |
| `git_branch_create` | Git | Create a new Git branch |
| `git_branch_list` | Git | List local branches |
| `task_start` | Tasks | Start new task, branch, and isolated worktree |
| `task_continue` | Tasks | Reopen task and restore worktree |
| `task_close` | Tasks | Close task and clean up worktree |
| `task_list` | Tasks | List all tracked tasks |
| `task_get` | Tasks | Get full task metadata |
| `task_verify` | Verification | Run real automated test & build quality gates |
| `checkpoint_create` | Checkpoints | Instant snapshot before complex edits |
| `checkpoint_restore` | Checkpoints | Roll back workspace to snapshot commit |
| `checkpoint_list` | Checkpoints | List saved checkpoints |
| `pr_create` | GitHub | Open a GitHub Pull Request |
| `pr_status` | GitHub | Query PR and CI status |
| `pr_merge` | GitHub | Merge Pull Request |
