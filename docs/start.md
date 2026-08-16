# Git Butler — START.md

> **AI Agent = Brain. Git Butler = Hands.**
>
> This document is the implementation roadmap for building Git Butler from zero to a reliable MVP and then expanding it.

---

# 0. Product Definition

Git Butler is an **agent-agnostic Git workflow plugin/skill** used inside AI coding agents such as:

- Codex
- Claude Code
- OpenCode
- Hermes Agent
- Other compatible AI coding agents

The AI agent performs the reasoning.

Git Butler performs and verifies Git operations.

```text
User
  ↓
AI Agent 🧠
  ↓
Git Butler 🦾
  ↓
Git / GitHub / GitLab
```

Git Butler is NOT:

- another coding model
- a replacement for Git
- a replacement for GitHub/GitLab
- an autonomous AI agent
- a cloud service in the first version

---

# 1. Technology Stack

## Core

| Component | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js LTS |
| Package manager | pnpm |
| Protocol | MCP + CLI |
| Git operations | Native Git CLI |
| Validation | Zod |
| Local state | JSON |
| GitHub | REST/GraphQL API |
| CLI | Commander.js |
| Unit tests | Vitest |
| Integration tests | Docker + temporary Git repositories |
| Build | tsup |
| Logging | Pino |
| Distribution | npm |

## Why TypeScript?

Git Butler is primarily a developer tooling product.

TypeScript provides:

- strong typing
- excellent Node.js ecosystem
- easy CLI development
- good JSON/schema tooling
- straightforward MCP integration
- cross-platform support

## Why Native Git CLI?

Do not reimplement Git.

Git already handles:

- branches
- worktrees
- commits
- merges
- rebases
- hooks
- remotes
- conflict detection
- Git configuration

Git Butler should orchestrate Git rather than replace it.

---

# 2. Development Principles

These principles should guide every phase.

## Principle 1 — Brain vs Hands

```text
AI Agent = Brain
Git Butler = Hands
```

The AI decides what should happen.

Git Butler executes it.

## Principle 2 — Never fabricate state

If Git Butler says:

```text
Branch created
```

the branch must actually exist.

If it says:

```text
Worktree created
```

the worktree must actually exist.

If it says:

```text
PR created
```

the PR must actually exist.

## Principle 3 — Git is the source of truth for Git state

Never trust an AI claim when Git can verify it.

## Principle 4 — Tasks are persistent

A worktree can disappear.

A task should remain.

## Principle 5 — Worktrees are disposable

Worktrees are execution environments for agents, not permanent task identity.

## Principle 6 — Protect user work

Never silently:

- delete work
- reset changes
- force-push
- overwrite work
- merge
- delete branches

without the required permission.

## Principle 7 — Agent agnostic

Do not build the core around one AI agent.

## Principle 8 — Natural language first

The user should not need to understand Git internals.

---

# 3. Repository Architecture

Start with a pnpm monorepo.

```text
git-butler/
├── apps/
│   └── cli/
│
├── packages/
│   ├── core/
│   ├── git/
│   ├── tasks/
│   ├── worktrees/
│   ├── checkpoints/
│   ├── permissions/
│   ├── verification/
│   ├── github/
│   ├── mcp/
│   └── agents/
│       ├── claude/
│       ├── codex/
│       ├── opencode/
│       └── hermes/
│
├── schemas/
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

The exact folder structure can change during implementation, but the separation of responsibilities should remain.

---

# 4. Phase 0 — Project Bootstrap

## Goal

Create a clean TypeScript project that can be installed, built, tested, and executed.

## Tasks

1. Initialize Git repository.
2. Initialize pnpm workspace.
3. Configure TypeScript.
4. Configure tsup.
5. Configure Vitest.
6. Add Zod.
7. Add Pino.
8. Add Commander.js.
9. Create CLI entry point.
10. Create core package.
11. Create Git package.
12. Configure linting/formatting if desired.
13. Configure CI for basic build/test checks.

## First CLI

Implement:

```bash
git-butler --help
git-butler version
git-butler doctor
```

`doctor` should eventually check:

```text
✓ Node
✓ Git
✓ Git version
✓ Git repository
✓ Git Butler configuration
```

## End-of-phase tests

### Test 1 — Build

```bash
pnpm build
```

Expected:

```text
PASS
```

### Test 2 — Unit test runner

```bash
pnpm test
```

Expected:

```text
PASS
```

### Test 3 — CLI

```bash
pnpm git-butler --help
```

Expected:

```text
Git Butler CLI
...
```

### Test 4 — Git detection

Run inside a Git repository:

```bash
git-butler doctor
```

Expected:

```text
Git: ✓
Repository: ✓
```

Run outside a Git repository.

Expected:

```text
Repository: ✗
```

Do not crash.

## Phase 0 completion criteria

- Project builds.
- Tests run.
- CLI starts.
- Git is detected correctly.
- Errors are structured and understandable.

---

# 5. Phase 1 — Git Execution Layer

## Goal

Build a safe abstraction around the native Git CLI.

This becomes the foundation of everything else.

## Implement

```text
GitExecutor
```

Responsibilities:

- execute Git commands
- capture stdout
- capture stderr
- capture exit code
- handle timeouts
- expose structured errors
- never hide command failures

Example internal interface:

```typescript
interface GitResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
```

Higher-level methods:

```text
git.status()
git.diff()
git.log()
git.branchList()
git.branchCreate()
git.branchDelete()
git.checkout()
git.fetch()
git.pull()
git.push()
git.commit()
```

Do not expose arbitrary shell execution unless explicitly required.

## End-of-phase tests

Create temporary Git repositories automatically in tests.

Test:

1. Initialize repository.
2. Create file.
3. Commit file.
4. Create branch.
5. List branches.
6. Modify file.
7. Read status.
8. Read diff.
9. Commit.
10. Verify commit exists.
11. Trigger an intentional Git failure.
12. Verify Git Butler returns the actual error.

### Critical hallucination test

Force Git to fail.

Git Butler must return:

```text
FAILED
actual Git error
```

It must NEVER return:

```text
SUCCESS
```

## Phase completion criteria

Git Butler can reliably execute and report basic Git operations.

---

# 6. Phase 2 — Worktree Manager

## Goal

Make Git worktrees safe and easy for AI agents.

## Implement

```text
worktree_create()
worktree_list()
worktree_status()
worktree_remove()
worktree_restore()
```

Example:

```text
Task:
Order Page

Branch:
feature/order-page

Worktree:
../myapp-order-page
```

Internally use native Git:

```bash
git worktree add
git worktree list
git worktree remove
```

## Safety requirements

Before removing a worktree:

```text
Check:
- Is it clean?
- Are there uncommitted changes?
- Is the worktree locked?
- Does the task have a checkpoint?
```

Never silently destroy uncommitted work.

## End-of-phase tests

### Test 1 — Create

Create branch and worktree.

Verify:

```text
git worktree list
```

contains the expected worktree.

### Test 2 — Isolation

Create two worktrees:

```text
order-page
dashboard
```

Modify different files in each.

Verify they do not interfere.

### Test 3 — Remove

Remove a clean worktree.

Verify it disappears.

### Test 4 — Dirty worktree

Modify a file and attempt removal.

Expected:

```text
BLOCKED
Uncommitted changes detected.
```

### Test 5 — Recovery

Remove/recreate a worktree from the same branch.

Verify the branch state is preserved.

## Phase completion criteria

Multiple isolated AI workspaces work reliably.

---

# 7. Phase 3 — Project State

## Goal

Give Git Butler persistent memory of project tasks.

Initial storage:

```text
.ai-git/
├── project.json
├── tasks.json
├── agents.json
├── permissions.json
├── config.json
└── activity.json
```

Use:

```text
JSON + Zod
```

for the first implementation.

## Task schema

Conceptually:

```typescript
Task {
  id
  name
  description
  status
  branch
  worktree
  agent
  checkpoints
  commits
  pullRequest
  iterations
  lastActivity
  context
}
```

## Implement

```text
task_create()
task_get()
task_find()
task_list()
task_update()
task_reopen()
task_complete()
task_history()
```

## End-of-phase tests

### Test 1

Create:

```text
Order Page
```

Restart Git Butler.

Verify the task still exists.

### Test 2

Find task:

```text
find("order page")
```

Expected task returned.

### Test 3

Update task status.

Restart process.

Verify status persisted.

### Test 4

Delete/recreate worktree.

Verify task still exists.

### Test 5 — Existing task recognition

Create:

```text
Order Page
```

Then search:

```text
order page
```

The same task must be returned.

## Phase completion criteria

Project state survives process restarts and worktree cleanup.

---

# 8. Phase 4 — Task + Branch + Worktree Orchestration

## Goal

Connect the concepts.

Implement the core lifecycle:

```text
Task
 ↓
Branch
 ↓
Worktree
 ↓
AI workspace
```

Example operation:

```text
start_task("Order Page")
```

Expected:

```text
Task created
Branch created
Worktree created
```

## Reuse existing task

If:

```text
Order Page
```

already exists:

```text
start_task("Order Page")
```

should not blindly create a duplicate.

The system should return the existing task and let the AI decide whether to continue/reopen it.

## End-of-phase tests

Test:

```text
Create Order Page
Create Dashboard
Create Sales Report
```

Expected:

```text
3 tasks
3 branches
3 worktrees
```

Then modify each independently.

Verify:

```text
Order Page changes → Order Page worktree
Dashboard changes → Dashboard worktree
Sales Report changes → Sales Report worktree
```

### Continuation test

1. Complete Order Page.
2. Remove worktree.
3. Keep branch.
4. Ask to refine Order Page.
5. Recreate worktree.
6. Verify previous code exists.
7. Continue modifying it.

## Phase completion criteria

The complete task/worktree lifecycle works without manual Git commands.

---

# 9. Phase 5 — Checkpoints

## Goal

Protect AI-generated work and provide recovery.

Implement:

```text
checkpoint_create()
checkpoint_list()
checkpoint_get()
checkpoint_restore()
```

A checkpoint should record enough information to recover safely.

Possible data:

```text
checkpoint ID
task ID
commit
branch
timestamp
Git status
context summary
```

## End-of-phase tests

### Test 1

Create work.

Create checkpoint.

Make additional changes.

Restore checkpoint.

Verify expected state.

### Test 2 — Multiple checkpoints

```text
cp1
cp2
cp3
```

Restore each and verify the expected state.

### Test 3 — Recovery

Simulate broken work.

Restore last known-good checkpoint.

Verify repository becomes usable again.

## Phase completion criteria

An AI can safely experiment and recover.

---

# 10. Phase 6 — Verification Engine

## Goal

Prevent AI claims from becoming false Git state.

Implement:

```text
verify_task()
run_tests()
run_build()
run_lint()
```

The verification engine should be configurable.

Example:

```text
Task says completed
        ↓
Git state check
        ↓
Tests
        ↓
Build
        ↓
Lint
        ↓
Verification result
```

## Example

AI:

```text
"Order Page is completed."
```

Git Butler:

```text
✓ Branch exists
✓ Expected changes exist
✓ Tests pass
✓ Build passes

READY_FOR_REVIEW
```

If tests fail:

```text
❌ Tests failed

NOT_READY
```

## End-of-phase tests

### Test 1 — Passing project

Everything passes.

Expected:

```text
READY_FOR_REVIEW
```

### Test 2 — Failing tests

Introduce a deliberate test failure.

Expected:

```text
NOT_READY
```

### Test 3 — Build failure

Break build.

Expected:

```text
NOT_READY
```

### Test 4 — Missing branch

Delete expected branch.

Expected:

```text
VERIFICATION_FAILED
```

### Test 5 — Hallucination simulation

Pretend the AI reports:

```text
"PR created."
```

when no PR exists.

Git Butler must query the actual provider and return:

```text
PR NOT FOUND
```

## Phase completion criteria

Git Butler can independently verify important claims.

---

# 11. Phase 7 — Permissions and Safety

## Goal

Prevent dangerous AI actions.

Implement:

```text
permissions_get()
permissions_check()
permissions_request()
```

Suggested levels:

```text
READ
LOCAL_WRITE
REMOTE_WRITE
COLLABORATION
DANGEROUS
```

Examples:

### Read

```text
status
diff
log
```

### Local

```text
branch create
worktree create
checkpoint
commit
```

### Remote

```text
push
```

### Collaboration

```text
create PR
```

### Dangerous

```text
merge
reset
branch deletion
force push
```

## End-of-phase tests

Attempt every permission level.

Verify:

```text
Allowed → executes
Denied → blocked
```

Especially test:

```text
force-push
reset --hard
branch delete
merge
```

No dangerous operation should happen accidentally.

## Phase completion criteria

Git Butler has a reliable permission boundary.

---

# 12. Phase 8 — GitHub Integration

## Goal

Add remote collaboration.

Implement:

```text
pr_create()
pr_get()
pr_status()
pr_update()
pr_merge()
```

Start with GitHub.

GitLab can come later.

## Workflow

```text
Task
 ↓
Branch
 ↓
Commit
 ↓
Push
 ↓
PR
 ↓
CI
 ↓
Review
 ↓
Merge
```

## End-of-phase tests

Use a dedicated test repository.

Test:

1. Push branch.
2. Create PR.
3. Read PR.
4. Read CI status.
5. Update PR.
6. Test merge permissions.
7. Merge test PR.
8. Verify branch state.

Do not run destructive tests against a production repository.

## Phase completion criteria

Git Butler can safely manage a complete branch-to-PR workflow.

---

# 13. Phase 9 — MCP Interface

## Goal

Expose Git Butler capabilities to AI coding agents.

Architecture:

```text
Claude / Codex / OpenCode / Hermes
              │
              │ MCP
              ▼
      Git Butler MCP Server
              │
              ▼
        Git Butler Core
```

Expose tools such as:

```text
task_find
task_create
task_reopen

worktree_create
worktree_status
worktree_remove

git_status
git_diff

checkpoint_create
checkpoint_restore

commit_create
push

pr_create
pr_status

verify_task
```

Tool names and schemas should be finalized during implementation.

## Critical design rule

MCP tools should return **structured results**, not vague text.

Example:

```json
{
  "success": true,
  "worktree": {
    "path": "../myapp-order-page",
    "branch": "feature/order-page"
  }
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "WORKTREE_DIRTY",
    "message": "Worktree contains uncommitted changes."
  }
}
```

## End-of-phase tests

### Tool discovery

AI agent can discover Git Butler tools.

### Tool execution

AI agent can:

```text
create task
create worktree
inspect status
checkpoint
commit
```

### Error handling

Force failures.

Verify the agent receives structured errors.

### Truth test

Make Git state disagree with an AI assumption.

Verify Git Butler returns actual state.

## Phase completion criteria

At least one AI coding agent can use Git Butler end-to-end.

---

# 14. Phase 10 — Agent Compatibility

## Goal

Ensure Git Butler is not tied to one agent.

Create adapters where necessary.

Conceptual interface:

```typescript
interface AgentAdapter {
  name: string;

  getCapabilities(): AgentCapabilities;

  getStatus(): Promise<AgentStatus>;

  notify?(message: string): Promise<void>;

  startTask?(task: Task): Promise<void>;
}
```

Potential adapters:

```text
agents/
├── claude/
├── codex/
├── opencode/
└── hermes/
```

The core should not contain agent-specific business logic.

## End-of-phase tests

Run the same Git Butler workflow through each supported agent integration:

```text
Create task
→ Worktree
→ Work
→ Verify
→ Commit
→ PR
```

Compare results.

The underlying task/Git behavior should remain consistent.

## Phase completion criteria

Adding another agent should require an adapter/integration, not rewriting Git Butler Core.

---

# 15. Phase 11 — Full End-to-End MVP Test

This is the most important phase.

Create a real test repository.

Start with:

```text
main
```

User request:

```text
Create order page.
Create dashboard.
Create sales report.
```

The AI agent should create three tasks.

Expected:

```text
Order Page
Dashboard
Sales Report
```

Each should have:

```text
branch
worktree
task state
```

---

## Test A — Parallel isolation

Make changes in all three worktrees.

Verify:

```text
Order Page changes do not appear in Dashboard.
Dashboard changes do not appear in Sales Report.
Sales Report changes do not appear in Order Page.
```

---

## Test B — Completion

Finish Order Page.

Agent reports:

```text
completed
```

Git Butler verifies.

Expected:

```text
READY_FOR_REVIEW
```

---

## Test C — Failed completion

Make tests fail.

Agent reports:

```text
completed
```

Git Butler must reject completion.

Expected:

```text
NOT_READY
```

---

## Test D — Worktree cleanup

Remove Order Page worktree.

Verify:

```text
Task remains.
Branch remains.
History remains.
```

---

## Test E — Task refinement

User:

```text
Refine the UI/UX of the order page.
```

AI finds existing task.

Git Butler restores/recreates worktree.

Verify:

```text
Existing branch used.
Existing code exists.
New changes are isolated.
```

---

## Test F — Checkpoint recovery

Create bad changes.

Restore checkpoint.

Verify:

```text
Bad changes removed/recovered safely.
Previous working state restored.
```

---

## Test G — PR

Push Order Page.

Create PR.

Verify:

```text
PR exists.
Correct branch.
Correct commits.
```

---

## Test H — Merge

Merge only with appropriate permission.

Verify:

```text
main contains Order Page changes.
```

---

## Test I — Cleanup

After merge:

```text
Remove worktree.
Mark task completed.
Preserve task history.
```

---

# 16. Phase 12 — Failure Testing

Git Butler will be used around destructive operations, so failure testing is critical.

Simulate:

```text
Git command failure
Network failure
GitHub API failure
Broken worktree
Deleted branch
Missing remote
Merge conflict
Dirty worktree
Invalid task state
Corrupt JSON state
Interrupted process
Agent crash
Agent timeout
```

For every failure verify:

1. No user work is silently lost.
2. State remains recoverable.
3. Git Butler returns an explicit error.
4. The AI receives enough information to recover.
5. Git Butler never reports success when the operation failed.

---

# 17. Phase 13 — Cross-Platform Testing

Git Butler should eventually support:

```text
Windows
macOS
Linux
```

Test:

- Git path detection
- worktree paths
- process execution
- environment variables
- file locking
- permissions
- path separators
- shell behavior

Do not assume Unix shell behavior.

Native Git commands should be invoked in a cross-platform manner from Node.js.

---

# 18. Phase 14 — Packaging and Distribution

## Goal

Make installation simple.

Target:

```bash
npm install -g git-butler
```

or the appropriate agent-specific installation mechanism.

The user should be able to run:

```bash
git-butler doctor
```

and receive a clear diagnostic.

## Test

Install the built package into a clean environment.

Verify:

```text
install
→ initialize
→ detect Git
→ create task
→ create worktree
→ run verification
```

without the development repository.

---

# 19. Phase 15 — Documentation

Documentation should cover:

```text
Installation
Quick start
Architecture
MCP integration
CLI
Task system
Worktrees
Checkpoints
Permissions
GitHub
Troubleshooting
Recovery
Agent integrations
Security
Development
Testing
```

Create:

```text
README.md
ARCHITECTURE.md
CONTRIBUTING.md
SECURITY.md
docs/
```

---

# 20. Testing Strategy

Git Butler should have multiple testing layers.

## Unit tests

Test pure logic:

```text
task state transitions
branch naming
permissions
schema validation
task matching
configuration
```

Fast and isolated.

## Integration tests

Use temporary real Git repositories.

Test:

```text
branches
worktrees
commits
checkpoints
merges
conflicts
```

## API tests

Use GitHub test repositories or mocks where appropriate.

## MCP tests

Start the MCP server and call real tools.

## End-to-end tests

Run the entire workflow:

```text
task
→ worktree
→ code
→ checkpoint
→ verify
→ commit
→ push
→ PR
→ merge
→ cleanup
→ reopen
```

---

# 21. Testing Rule

Every phase must finish with tests.

Do not move to the next phase because the code "looks correct."

Use this rule:

```text
IMPLEMENT
   ↓
TEST
   ↓
BREAK IT INTENTIONALLY
   ↓
TEST RECOVERY
   ↓
FIX
   ↓
TEST AGAIN
   ↓
PHASE COMPLETE
```

Especially for Git operations, test both:

```text
SUCCESS
FAILURE
```

---

# 22. Definition of Done for MVP

Git Butler MVP is ready when all of these work:

```text
[ ] Git repository detection
[ ] Task creation
[ ] Task persistence
[ ] Task search
[ ] Task reopening
[ ] Branch creation
[ ] Worktree creation
[ ] Worktree isolation
[ ] Worktree cleanup
[ ] Git status
[ ] Git diff
[ ] Checkpoints
[ ] Checkpoint recovery
[ ] Commit
[ ] Push
[ ] Verification
[ ] Permission system
[ ] GitHub PR creation
[ ] PR status
[ ] MCP interface
[ ] At least one AI agent integration
[ ] Full end-to-end test
[ ] Failure/recovery tests
[ ] Cross-platform baseline
[ ] npm/package installation
[ ] Documentation
```

---

# 23. Recommended Implementation Order

Do not build everything at once.

Follow this order:

```text
PHASE 0
Bootstrap
   ↓
PHASE 1
Git Executor
   ↓
PHASE 2
Worktrees
   ↓
PHASE 3
Project State
   ↓
PHASE 4
Task + Branch + Worktree
   ↓
PHASE 5
Checkpoints
   ↓
PHASE 6
Verification
   ↓
PHASE 7
Permissions
   ↓
PHASE 8
GitHub
   ↓
PHASE 9
MCP
   ↓
PHASE 10
Agent Compatibility
   ↓
PHASE 11
Full E2E
   ↓
PHASE 12
Failure Testing
   ↓
PHASE 13
Cross Platform
   ↓
PHASE 14
Packaging
   ↓
PHASE 15
Documentation
```

---

# 24. What NOT to Build First

Avoid these until the core works:

```text
❌ Web dashboard
❌ Cloud backend
❌ PostgreSQL
❌ Redis
❌ Team accounts
❌ Billing
❌ AI model inside Git Butler
❌ Complex analytics
❌ Mobile application
❌ Custom Git implementation
```

The first product should prove one thing:

> **Can an AI agent reliably use Git Butler to manage multiple tasks and worktrees without the developer manually managing Git?**

If yes, the core idea is validated.

---

# 25. First Real Demo

The first impressive demo should be:

```text
User:

Create:
1. Order page
2. Dashboard
3. Sales report
```

AI agent:

```text
Creates three tasks.
```

Git Butler:

```text
Creates three branches.
Creates three worktrees.
```

AI agents work independently.

Then:

```text
Order Page → completed
Dashboard → in progress
Sales Report → in progress
```

User:

```text
Refine the Order Page UI.
```

AI finds the existing Order Page task.

Git Butler:

```text
Restores the correct branch/worktree.
```

AI continues.

Then:

```text
Checkpoint
→ Commit
→ Push
→ PR
→ Verification
→ Merge
→ Cleanup
```

Finally:

```text
Order Page
✓ Completed
✓ PR merged
✓ Worktree cleaned
✓ Task history preserved
```

That is the **core Git Butler experience**.

---

# 26. Final Architecture

```text
                         USER
                           │
                           ▼
                ┌───────────────────┐
                │    AI AGENT 🧠    │
                │                   │
                │ Codex             │
                │ Claude Code       │
                │ OpenCode          │
                │ Hermes            │
                └─────────┬─────────┘
                          │
                          │ MCP / Tools
                          ▼
                ┌───────────────────┐
                │   GIT BUTLER 🦾   │
                │                   │
                │ Core              │
                │ Task Manager      │
                │ Worktree Manager  │
                │ Git Executor      │
                │ Checkpoints       │
                │ Verification      │
                │ Permissions       │
                │ GitHub            │
                │ MCP Server        │
                └──────┬───────┬────┘
                       │       │
              ┌────────┘       └────────┐
              ▼                         ▼
       ┌──────────────┐          ┌──────────────┐
       │     Git      │          │ GitHub/GitLab │
       │              │          │              │
       │ Worktrees    │          │ PRs          │
       │ Branches     │          │ CI           │
       │ Commits      │          │ Reviews      │
       └──────────────┘          └──────────────┘
                       │
                       ▼
                  .ai-git/
               Project State
```

---

# 27. Final Product Philosophy

Git Butler should make the developer think in terms of:

```text
Tasks
Features
Work
Iterations
```

not:

```text
branches
worktrees
stashes
rebases
commits
PR commands
```

The AI agent handles the reasoning.

Git Butler handles the Git.

Git remains the source of truth.

The developer remains in control.

> **You manage the work. Git Butler manages the Git.**
