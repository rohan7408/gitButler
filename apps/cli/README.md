<div align="center">

# 🎩 Git Butler
### *The Autonomous Git Workflow Engine & MCP Server for AI Coding Agents*

[![npm version](https://img.shields.io/badge/npm-v0.1.0-blue.svg?style=flat-square)](https://www.npmjs.com)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary%20%2F%20Non--Commercial-red.svg?style=flat-square)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-19%20Tools%20Supported-purple.svg?style=flat-square)](https://modelcontextprotocol.io)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict%20100%25-3178c6.svg?style=flat-square)](https://www.typescriptlang.org)
[![Tests Passing](https://img.shields.io/badge/Tests-77%2F77%20Passing-brightgreen.svg?style=flat-square)](https://vitest.dev)

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
| **Hallucinated Status:** Agents falsely claim "all tests pass" without running them. | **Independent Quality Gate:** Process execution validates real test, build, and lint outputs before admitting completion. |
| **Broken Main Branch:** Agents commit half-baked code directly to `main`. | **Protected Branch Defense:** 4-tier security matrix defends `main`, `master`, and `production`. |
| **Risky Refactors:** Complex changes break everything with no easy rollback. | **Instant Checkpoints:** Lightweight snapshot commits allow 1-second instant rollback. |

---

## ⚡ Key Features

- 🌳 **Disposable Isolated Worktrees:** Automatic feature branches and physical worktree creation for every task.
- 📸 **Instant Snapshot Checkpoints:** Create instant lightweight snapshot commits before risky refactors and roll back safely in milliseconds.
- 🧪 **Independent Process Verification Gate:** Independent test runner and compilation verification prevents agents from hallucinating task completion.
- 🔒 **4-Tier Permission Boundaries:** Fine-grained access control (`READ_ONLY`, `LOCAL_MUTATION`, `REMOTE_INTERACTION`, `DANGEROUS`).
- 🛡️ **Zero-Hallucination Ground Truth:** All Git status, diffs, and logs are parsed from native Git porcelain outputs (`git status --porcelain=v2`, `git for-each-ref`).
- 🐙 **Automated GitHub PR Lifecycle:** Integrated PR creation, CI check monitoring, and squash merge automation.
- 🔌 **Universal Agent Compatibility:** Official Model Context Protocol (MCP) server over STDIO, with format translators for Anthropic Claude (`input_schema`), OpenAI Codex, and raw JSON schemas.

---

## 🚀 Quickstart

### 1. Instant Run with `npx` (No Installation Required)
```bash
npx git-butler doctor
```

### 2. Global CLI Installation
```bash
npm install -g git-butler
```

### 3. Verify Environment Health
```bash
git-butler doctor
# Automatically fix stale lock files and broken worktrees
git-butler doctor --fix
```

---

## 🔌 Model Context Protocol (MCP) Setup

Connect Git Butler's 19 typed MCP tools directly to your favorite IDE or AI desktop application.

<details open>
<summary><b>Cursor IDE (<code>.cursor/mcp.json</code>)</b></summary>

Add to your project's `.cursor/mcp.json` or Cursor Settings -> Features -> MCP:
```json
{
  "mcpServers": {
    "git-butler": {
      "command": "npx",
      "args": ["-y", "git-butler", "mcp"]
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
      "args": ["-y", "git-butler", "mcp"]
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
      "args": ["-y", "git-butler", "mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Windsurf / OpenCode / Hermes / Local LLMs</b></summary>

Start the STDIO JSON-RPC server directly:
```bash
npx git-butler mcp
```
</details>

---

## 🛠️ CLI Command Reference

### 📋 Task Management
```bash
# Start a new task with an isolated branch and worktree
git-butler task start "Order Processing Webhook"

# List all tracked tasks, statuses, and PR links
git-butler task list

# Show detailed metadata for a task
git-butler task show <taskId>

# Continue an existing task (reopens worktree and increments iteration)
git-butler task continue <taskIdOrName>

# Close task and clean up temporary worktree directory
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
