<div align="center">

# 🎩 Git Butler
### *The Autonomous Git Workflow Engine & MCP Server for AI Coding Agents*

[![npm version](https://img.shields.io/npm/v/@rohan7/git-butler.svg?style=flat-square)](https://www.npmjs.com/package/@rohan7/git-butler)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary%20%2F%20Non--Commercial-red.svg?style=flat-square)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-21%20Tools%20Supported-purple.svg?style=flat-square)](https://modelcontextprotocol.io)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict%20100%25-3178c6.svg?style=flat-square)](https://www.typescriptlang.org)
[![Tests Passing](https://img.shields.io/badge/Tests-81%2F81%20Passing-brightgreen.svg?style=flat-square)](https://vitest.dev)

<br />

**AI Agent = Brain. Git Butler = Hands.**  
*You manage the work. Git Butler manages the Git.*

<br />

[Features](#-key-features) •
[Quickstart](#-quickstart) •
[MCP Setup](#-model-context-protocol-mcp-setup) •
[CLI Reference](#-cli-command-reference) •
[Architecture](#-core-architecture) •
[Documentation](#-documentation)

---

</div>

## 💡 The Problem Git Butler Solves

When AI coding assistants (Cursor, Claude, Antigravity, OpenCode) execute raw terminal Git commands directly, severe failures frequently happen:

| Without Git Butler ❌ | With Git Butler 🎩 ✅ |
| :--- | :--- |
| **Index Contention:** Parallel subagents crash with `.git/index.lock` collisions. | **Physical Worktree Isolation:** Every task and subagent gets a dedicated, isolated worktree. Concurrent agents work simultaneously. |
| **Accidental Overwrites:** Uncommitted user files are destroyed by agent checkouts. | **Dirty Worktree Protection:** Operations block with `WORKTREE_DIRTY` unless explicit force is granted. |
| **Missing Dependencies:** Subagents in new worktrees break because `node_modules` and `.env` are missing. | **Auto-Dependency Linking:** Instant NTFS junction/symlink of `node_modules` and `.env` copying into every worktree. |
| **Hallucinated Status:** Agents falsely claim "all tests pass" without running them. | **Independent Quality Gate:** Process execution validates real test, build, and lint outputs before admitting completion. |
| **Broken Main Branch:** Agents commit half-baked code directly to `main`. | **Protected Branch Defense:** 4-tier security matrix defends `main`, `master`, and `production`. |
| **Risky Refactors:** Complex changes break everything with no easy rollback. | **Instant Checkpoints:** Lightweight snapshot commits allow 1-second instant rollback. |

---

## ⚡ Key Features

- 🌳 **Disposable Isolated Worktrees:** Automatic feature branches and physical worktree creation for every task.
- 📦 **Automatic Dependency & Environment Linking:** Worktrees automatically link root `node_modules` (via Windows NTFS junction or Unix symlink) and copy `.env*` files so test runners and dev servers execute immediately without reinstalling.
- 🔀 **End-to-End Task Completion & Safe Merge:** Finish tasks with a single command or MCP tool: safely merges into target branch (`main`/`master`), tears down the worktree directory, and marks the task `COMPLETED`.
- 🚀 **Batch Task Orchestration:** Start multiple tasks in parallel with dedicated isolated worktrees and branches in one command or MCP call (`task_batch_start`).
- 📸 **Instant Snapshot Checkpoints:** Create instant lightweight snapshot commits before risky refactors and roll back safely in milliseconds.
- 🧪 **Independent Process Verification Gate:** Independent test runner and compilation verification prevents agents from hallucinating task completion.
- 🔒 **4-Tier Permission Boundaries:** Fine-grained access control (`READ_ONLY`, `LOCAL_MUTATION`, `REMOTE_INTERACTION`, `DANGEROUS`).
- 🛡️ **Zero-Hallucination Ground Truth:** All Git status, diffs, and logs are parsed from native Git porcelain outputs (`git status --porcelain=v2`, `git for-each-ref`).
- 🐙 **Automated GitHub PR Lifecycle:** Integrated PR creation, CI check monitoring, and squash merge automation.
- 🔌 **Universal Agent Compatibility:** Official Model Context Protocol (MCP) server over STDIO (21 typed tools), with format translators for Anthropic Claude (`input_schema`), OpenAI Codex, and raw JSON schemas.

---

## 🚀 Quickstart

### 1. Interactive Setup Wizard (Recommended)
Configure your AI coding environment in seconds. Git Butler interactively prompts you to choose your AI assistant(s) or IDE(s), or sets up a Universal Global Config (`~/.mcp.json`):

```bash
npx -y @rohan7/git-butler setup
```

Or configure directly using flags:
```bash
# Universal Global Config (works across all projects & supported AI tools)
npx -y @rohan7/git-butler setup --global

# Or specific IDEs:
npx -y @rohan7/git-butler setup --cursor       # Current project (.cursor/mcp.json)
npx -y @rohan7/git-butler setup --antigravity  # Google Antigravity
npx -y @rohan7/git-butler setup --claude       # Anthropic Claude Desktop
npx -y @rohan7/git-butler setup --windsurf     # Windsurf Editor
npx -y @rohan7/git-butler setup --all          # Configure all supported environments
```

### 2. Verify Environment Health
```bash
npx -y @rohan7/git-butler doctor
# Automatically fix stale lock files and broken worktrees
npx -y @rohan7/git-butler doctor --fix
```

### 3. Global CLI Installation (Optional)
```bash
npm install -g @rohan7/git-butler
```

---

## 🔌 Model Context Protocol (MCP) Setup

Connect Git Butler's 21 typed MCP tools directly to your favorite IDE or AI desktop application.

<details open>
<summary><b>Universal Global Config (<code>~/.mcp.json</code>)</b></summary>

Works across all projects and MCP clients automatically:
```json
{
  "mcpServers": {
    "git-butler": {
      "command": "npx",
      "args": ["-y", "@rohan7/git-butler", "mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Cursor IDE (<code>.cursor/mcp.json</code>)</b></summary>

Add to your project's `.cursor/mcp.json` or Cursor Settings -> Features -> MCP:
```json
{
  "mcpServers": {
    "git-butler": {
      "command": "npx",
      "args": ["-y", "@rohan7/git-butler", "mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Claude Desktop (<code>claude_desktop_config.json</code>)</b></summary>

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "git-butler": {
      "command": "npx",
      "args": ["-y", "@rohan7/git-butler", "mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Google Antigravity (<code>.agents/mcp_config.json</code> or <code>~/.gemini/config/mcp_config.json</code>)</b></summary>

```json
{
  "mcpServers": {
    "git-butler": {
      "command": "npx",
      "args": ["-y", "@rohan7/git-butler", "mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Windsurf / OpenCode / Hermes / Local LLMs</b></summary>

Start the STDIO JSON-RPC server directly:
```bash
npx -y @rohan7/git-butler mcp
```
</details>

---

## 🛠️ CLI Command Reference

### 📋 Setup & Environment
```bash
# Interactive setup wizard
git-butler setup

# Install universal global config (~/.mcp.json)
git-butler setup --global

# Run diagnostics and auto-repair
git-butler doctor --fix
```

### 📋 Task Management
```bash
# Start a new task with an isolated branch and worktree
git-butler task start "Order Processing Webhook"

# Start multiple isolated tasks at once
git-butler task batch "Order Tracking Page" "Stripe Webhook Integration"

# List all tracked tasks, statuses, and PR links
git-butler task list

# Show detailed metadata for a task
git-butler task show <taskId>

# Complete and merge task into target branch, remove worktree, and update status
git-butler task finish <taskIdOrName>

# Finish with custom merge options:
git-butler task finish <taskIdOrName> --target main --method squash --delete-branch

# Continue an existing task (reopens worktree and increments iteration)
git-butler task continue <taskIdOrName>

# Close task and clean up temporary worktree directory (preserving feature branch)
git-butler task close <taskIdOrName>
```

### 📸 Instant Checkpoints & Fast Recovery
```bash
# Create an instant snapshot checkpoint before editing
git-butler checkpoint create "Before Database Migration"

# List saved checkpoints with commit SHAs and branches
git-butler checkpoint list

# Roll back workspace to a checkpoint commit
git-butler checkpoint restore <checkpointId> --force
```

### 🧪 Independent Quality Verification Gate
```bash
# Run real test and build gates on task before review
git-butler verify <taskId> --test "pnpm test" --build "pnpm build" --lint "pnpm lint"
```

### 🐙 GitHub Pull Requests
```bash
# Create a Pull Request linked to task
git-butler pr create --title "feat: order processing" --body "Implements webhook handling" --task <taskId>

# View PR status and CI check conclusions
git-butler pr status <prNumber>

# Merge PR and update task state
git-butler pr merge <prNumber> --method squash --task <taskId>
```

### 🔍 Status & Diff
```bash
# View structured Git status
git-butler status

# View diff statistics and patch preview
git-butler diff --staged
```

---

## 🏗️ Core Architecture

```text
┌───────────────────────────────────────────────────────────┐
│                     AI Coding Agent                       │
│        (Claude / Cursor / Antigravity / OpenCode)         │
└─────────────────────────────┬─────────────────────────────┘
                              │ JSON-RPC (STDIO)
                              ▼
┌───────────────────────────────────────────────────────────┐
│                 Git Butler MCP Server (19 Tools)          │
└───────────┬─────────────────┬─────────────────┬───────────┘
            │                 │                 │
            ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│ Orchestrator     │ │ Checkpoint Store │ │ Quality Gate    │
│ • Task Lifecycle │ │ • Snapshot Commits│ │ • Subprocess    │
│ • Worktree Alloc │ │ • Rollback Engine│ │   Test Runner   │
└───────────┬──────┘ └────────┬─────────┘ └────────┬────────┘
            │                 │                    │
            ▼                 ▼                    ▼
┌───────────────────────────────────────────────────────────┐
│                  Native Git & GitHub API                  │
│       (Porcelain Parsers • Ground Truth • Safe Exec)      │
└───────────────────────────────────────────────────────────┘
```

---

## 📦 Monorepo Packages

Git Butler is architected as modular TypeScript packages:

- **[`@git-butler/core`](packages/core)**: Zod schemas, structured errors, and `GitButlerOrchestrator`.
- **[`@git-butler/git`](packages/git)**: Safe non-shell `GitExecutor`, porcelain parsers, and diagnostic doctor.
- **[`@git-butler/worktrees`](packages/worktrees)**: Physical worktree allocation, isolation, and pruning.
- **[`@git-butler/tasks`](packages/tasks)**: Atomic `.ai-git/` persistent store with `.bak` self-healing recovery.
- **[`@git-butler/checkpoints`](packages/checkpoints)**: Snapshot commit manager and rollback engine.
- **[`@git-butler/verification`](packages/verification)**: Independent process runner and quality gate engine.
- **[`@git-butler/permissions`](packages/permissions)**: 4-tier security matrix and protected branch guard.
- **[`@git-butler/github`](packages/github)**: Pull request, CI checks, and merge automation.
- **[`@git-butler/mcp`](packages/mcp)**: Model Context Protocol STDIO server exposing 19 tools.
- **[`@git-butler/adapters`](packages/adapters)**: Tool format converters for Claude and OpenAI Codex.
- **[`@git-butler/cli`](apps/cli)**: Complete developer command-line interface binary (`git-butler`).

---

## 📚 Documentation

- 📖 [Architecture & Invariant Rules](docs/ARCHITECTURE.md)
- 🔌 [MCP Setup Guide](docs/MCP_SETUP.md)
- 🤖 [Claude Integration Guide](docs/CLAUDE_GUIDE.md)
- 💻 [Cursor Integration Guide](docs/CURSOR_GUIDE.md)

---

## 📄 License & Commercial Protection

Git Butler is protected by a **Proprietary & Non-Commercial License**.  
Free for individual, educational, and internal developer workflow use.  
**Strictly prohibited:** Selling, reselling, monetizing, or distributing modified commercial versions without explicit written authorization from the authors. See [LICENSE](LICENSE) for full legal terms.
