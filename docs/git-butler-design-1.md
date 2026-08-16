# Git Butler

> **You code. Git Butler handles Git.**

## 1. Vision

Git Butler is an **agent-agnostic Git workflow plugin/skill for AI coding agents**.

It is designed to work inside AI coding environments such as:

- Codex
- Claude Code
- OpenCode
- Hermes Agent
- Other compatible AI coding agents

The core model is:

> **AI Agent = Brain**
>
> **Git Butler = Hands**

The AI agent understands the user's request, reasons about tasks, decides what should happen, and calls Git Butler tools.

Git Butler executes the requested Git workflow, maintains project state, verifies real repository state, and prevents unsafe Git operations.

Git Butler does not replace the AI agent, Git, or GitHub/GitLab.

---

# 2. Core Idea

Traditional AI coding workflow:

```text
User
  ↓
AI Agent
  ↓
Git commands
  ↓
Repository
```

Git Butler adds a reliable Git management layer:

```text
User
  ↓
AI Agent
  🧠 Brain
  ↓
Git Butler
  🦾 Hands
  ↓
Git / GitHub / GitLab
```

The AI agent makes decisions.

Git Butler performs operations and reports actual results.

The fundamental principle is:

> **The AI decides. Git Butler executes and verifies.**

---

# 3. Problem

AI coding agents can write code quickly, but Git workflows become complicated when the agent is working on multiple tasks.

Typical problems include:

- Branch management
- Switching between tasks
- Protecting uncommitted work
- Managing multiple worktrees
- Remembering previous tasks
- Creating checkpoints
- Deciding when to commit
- Pushing changes
- Creating pull requests
- Handling merge conflicts
- Recovering from broken work
- Giving AI agents too much Git permission
- AI hallucinating Git state

The developer should not need to manually manage all of this.

---

# 4. Product Goal

Git Butler should make Git disappear from the developer's mental workload.

Instead of:

```text
git switch
git stash
git worktree
git commit
git push
git pull
git merge
```

the developer interacts naturally with the AI agent:

```text
"Create the order page."

"Let's work on the dashboard."

"Go back to the order page."

"Refine the order page UI."

"Commit this."

"Create a PR."

"Merge it."
```

The AI agent uses Git Butler to translate those intentions into safe Git operations.

---

# 5. Important Terminology

Git Butler should distinguish three concepts:

## Task

The human/project concept.

Example:

```text
Order Page
```

A task can survive for a long time and have multiple iterations.

## Branch

The Git history associated with the task.

Example:

```text
feature/order-page
```

## Worktree

The temporary physical workspace where an AI agent works.

Example:

```text
../myapp-order-page/
```

Therefore:

```text
Task
  ↓
Branch
  ↓
Worktree
  ↓
AI Agent
```

A worktree can be removed without deleting the task or its Git history.

---

# 6. Agent-Agnostic Architecture

Git Butler should not depend on a single AI coding agent.

Conceptually:

```text
                 AI CODING AGENTS

      ┌────────┬──────────┬──────────┬────────┐
      │ Codex  │ Claude   │ OpenCode │ Hermes │
      │        │ Code     │          │ Agent  │
      └────────┴──────────┴──────────┴────────┘
                       │
                       │ Git Butler
                       ▼
                ┌──────────────┐
                │  Git Butler  │
                │    Plugin    │
                └──────────────┘
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
            Git      GitHub    Project
         Worktrees    /GitLab    State
```

The exact integration mechanism depends on the capabilities of each AI agent.

Git Butler should expose a consistent tool interface while allowing agent-specific adapters where necessary.

---

# 7. High-Level Architecture

Git Butler consists conceptually of four layers.

```text
┌──────────────────────────────────────────────┐
│                 AI AGENT                     │
│        Codex / Claude / OpenCode / Hermes    │
│                                              │
│                 🧠 Brain                     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              GIT BUTLER SKILL                 │
│                                              │
│  Workflow rules                              │
│  Task reasoning                              │
│  Tool usage guidance                         │
│  Safety policies                             │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│             GIT BUTLER PLUGIN                │
│                                              │
│  Git operations                              │
│  Worktree operations                         │
│  Task state                                  │
│  Checkpoints                                 │
│  Permissions                                 │
│  Remote / PR operations                      │
└───────────────┬──────────────┬───────────────┘
                │              │
                ▼              ▼
             Git/Git       GitHub/GitLab
             Worktrees          PRs
```

---

# 8. Skill vs Plugin

## Skill

The skill explains **what should happen and when**.

Responsibilities:

- Understand Git Butler workflow
- Identify task boundaries
- Decide when an existing task should be continued
- Decide when a new task should be created
- Recommend branch naming
- Determine when checkpoints are appropriate
- Explain permission requirements
- Guide safe recovery
- Use Git Butler tools correctly

The skill provides workflow intelligence to the AI agent.

## Plugin

The plugin provides **actual execution capabilities**.

The plugin should not hallucinate repository state.

If it reports:

```text
Branch created
```

the branch must actually exist.

If it reports:

```text
Worktree created
```

the worktree must actually exist.

If it reports:

```text
PR created
```

the PR must actually exist.

---

# 9. Project State / Memory

Git Butler needs persistent state per project.

Conceptually:

```text
project/
└── .ai-git/
    ├── project.json
    ├── tasks.json
    ├── agents.json
    ├── permissions.json
    ├── config.json
    ├── checkpoints/
    └── activity.json
```

The exact storage implementation can change later.

The important concept is that Git Butler remembers **development state**, not the entire AI conversation.

---

# 10. Task State

A task should contain information such as:

```text
Task
├── id
├── name
├── description
├── status
├── branch
├── worktree
├── assigned agent
├── checkpoints
├── commits
├── pull request
├── iterations
├── last activity
└── useful context
```

Example:

```text
Task: Order Page

ID:
task_001

Status:
READY_FOR_REVIEW

Branch:
feature/order-page

Worktree:
../myapp-order-page/

Agent:
Agent A

Last checkpoint:
cp_17

Pull Request:
#41

Context:
Order listing, pagination and API integration.
```

---

# 11. Task Lifecycle

Recommended task states:

```text
PLANNED
   ↓
IN_PROGRESS
   ↓
READY_FOR_REVIEW
   ↓
APPROVED
   ↓
MERGED
   ↓
COMPLETED
```

Additional states can exist for exceptional situations:

```text
BLOCKED
FAILED
CONFLICT
WAITING
```

Important distinction:

**Agent completion is not automatically final product completion.**

The agent may report:

```text
TASK_COMPLETED
```

Git Butler should verify the repository state before marking it ready.

---

# 12. Example: Multiple Tasks

User says:

```text
Create order page.
Create dashboard.
Create sales report.
```

The AI agent decides that these are separate tasks.

Git Butler creates:

```text
Order Page
├── feature/order-page
└── worktree A

Dashboard
├── feature/dashboard
└── worktree B

Sales Report
├── feature/sales-report
└── worktree C
```

Each AI agent/task can work independently.

The worktrees are isolated using Git's native worktree functionality.

Git Butler does not reinvent Git worktrees.

It orchestrates them.

---

# 13. Worktree Lifecycle

A worktree is an execution environment, not the permanent identity of a task.

## Create

```text
Task created
    ↓
Branch created
    ↓
Worktree created
    ↓
AI works
```

Conceptually:

```bash
git worktree add ../myapp-order-page -b feature/order-page
```

## During work

Git Butler can inspect:

```text
git status
git diff
git log
git worktree list
```

## After completion

The worktree may be cleaned up.

The branch, commits, PR and task state remain.

## Reopening a task

User:

```text
"Refine the UI/UX of the order page."
```

AI identifies the existing Order Page task.

Git Butler can recreate the worktree from the existing branch:

```text
Existing Task
    ↓
Existing Branch
    ↓
Create/restore worktree
    ↓
AI continues
```

---

# 14. Task Continuation

This is one of Git Butler's most important features.

Example:

```text
Order Page
Status: COMPLETED
Branch: feature/order-page
PR: #41
```

Later:

```text
User:
"Refine the UI/UX of the order page."
```

The AI should identify that this refers to the existing task.

Instead of automatically creating:

```text
feature/refine-order-page-ui
```

it can reopen:

```text
feature/order-page
```

and create a new worktree if necessary.

The task can maintain multiple iterations:

```text
Order Page

Iteration 1
✓ Order listing
✓ Pagination
✓ API integration
✓ PR #41 merged

Iteration 2
→ UI/UX refinement
```

---

# 15. Completion Verification

AI agents can hallucinate.

Git Butler should be designed to minimize the consequences.

Example:

```text
AI Agent:
"Order Page is completed."
```

Git Butler should verify actual state.

Possible verification:

```text
✓ Branch exists
✓ Worktree exists
✓ Expected changes exist
✓ Git status checked
✓ Tests passed
✓ Build passed
✓ No obvious conflicts
```

Then:

```text
READY_FOR_REVIEW
```

If verification fails:

```text
AI claim:
COMPLETED

Verification:
❌ 3 tests failing

Result:
NOT_READY
```

The principle is:

> **Never trust an AI claim about Git state when Git can verify it.**

---

# 16. Ground Truth

Git Butler should have a strict rule:

> **Never fabricate state.**

Different information should come from its authoritative source.

```text
Git state
    → Git

Branch/worktree
    → Git

Commit
    → Git

Pull Request
    → GitHub/GitLab

CI
    → CI provider

Task state
    → Git Butler project state

Agent status
    → Agent integration when available
```

If Git Butler cannot determine something, it should report:

```text
UNKNOWN
```

rather than guessing.

---

# 17. Git Butler Tool Categories

The plugin API should be organized around capabilities.

## Task

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

## Worktree

```text
worktree_create()
worktree_list()
worktree_status()
worktree_restore()
worktree_remove()
```

## Branch

```text
branch_list()
branch_create()
branch_exists()
branch_delete()
branch_switch()
```

## Git State

```text
git_status()
git_diff()
git_log()
git_show()
```

## Checkpoints

```text
checkpoint_create()
checkpoint_list()
checkpoint_get()
checkpoint_restore()
```

## Commit

```text
commit_create()
commit_get()
```

## Remote

```text
push()
pull()
fetch()
```

## Pull Requests

```text
pr_create()
pr_get()
pr_update()
pr_status()
pr_merge()
```

## Verification

```text
run_tests()
run_build()
run_lint()
verify_task()
```

## Permissions

```text
permissions_get()
permissions_request()
permissions_check()
```

The final tool list should be refined during implementation.

---

# 18. Natural Language Workflow

Users should not need to learn Git commands.

Example:

```text
User:
"Let's work on the Dashboard."
```

AI:

```text
Find current task
→ checkpoint current work
→ create/reuse Dashboard task
→ create branch
→ create worktree
→ continue coding
```

User:

```text
"I'm done."
```

AI:

```text
Inspect changes
→ verify
→ checkpoint
→ commit if permitted
```

User:

```text
"Push it."
```

AI:

```text
Check permission
→ push
```

User:

```text
"Create a PR."
```

AI:

```text
Create PR
```

User:

```text
"Merge it."
```

Git Butler:

```text
Check permission
→ check branch
→ check CI
→ check review
→ merge if authorized
```

---

# 19. Permissions

Git Butler should provide granular permissions.

Suggested levels:

## Level 0 — Read

```text
git_status
git_diff
git_log
```

## Level 1 — Local

```text
create_branch
worktree_create
worktree_remove
checkpoint
commit
```

## Level 2 — Remote

```text
push
pull
```

## Level 3 — Collaboration

```text
create_pr
update_pr
request_review
```

## Level 4 — Dangerous

```text
merge
delete_branch
reset
force_push
```

Dangerous operations should require explicit authorization.

The AI must never silently escalate permissions.

---

# 20. Project-Scoped Permissions

Permissions should be scoped to the repository/project.

Example personal project:

```text
commit
push
PR
merge
```

Company repository:

```text
commit
push
PR
```

but:

```text
merge → human approval
```

Conceptually:

```text
.ai-git/
└── permissions.json
```

---

# 21. Checkpoints

AI coding can become chaotic.

Git Butler should provide recoverable checkpoints.

Example:

```text
Order Page
├── checkpoint 1
├── checkpoint 2
├── checkpoint 3
└── current
```

A checkpoint can associate:

```text
Git state
+
task state
+
AI context summary
+
timestamp
```

The underlying mechanism can use Git commits, stashes, or another safe mechanism.

---

# 22. Recovery

Worktrees should be considered disposable.

If one worktree breaks:

```text
Dashboard      → healthy
Authentication → broken
Checkout       → healthy
```

Only Authentication should be affected.

Git Butler can:

```text
detect failure
    ↓
preserve useful state
    ↓
remove broken worktree
    ↓
recreate from branch/checkpoint
    ↓
continue task
```

The goal is:

> **A broken worktree should not destroy the task.**

---

# 23. Pull Request Workflow

The PR belongs to the branch/commits, not the worktree.

```text
Task
 ↓
Branch
 ↓
Worktree
 ↓
AI coding
 ↓
Checkpoint
 ↓
Commit
 ↓
Push
 ↓
Pull Request
 ↓
CI
 ↓
Review
 ↓
Merge
```

Example:

```text
Order Page
    ↓
feature/order-page
    ↓
worktree-order-page
    ↓
AI finishes
    ↓
commit
    ↓
push
    ↓
PR #41
    ↓
CI ✓
    ↓
Review ✓
    ↓
Merge
```

After merge, Git Butler can clean up the worktree.

The task history remains available.

---

# 24. Merge Conflicts

Git Butler should never blindly resolve or overwrite conflicting work.

Example:

```text
Dashboard branch
                 → src/lib/user.ts
        /
Authentication branch
```

If both branches modify overlapping code:

```text
Conflict detected
```

Git Butler should preserve both sides and report:

```text
Conflict:
src/lib/user.ts

Dashboard modified lines 42–67.
Authentication modified overlapping lines.

No changes were discarded.
```

Possible actions:

```text
Resolve automatically
Ask AI to resolve
Show conflict
Leave unresolved
```

Any automatic resolution should be verified afterward.

---

# 25. Integration Verification

Before merging multiple changes, Git Butler can optionally use a temporary integration worktree.

Conceptually:

```text
main
 + Dashboard
 + Authentication
 + Checkout
        ↓
Temporary integration worktree
        ↓
Tests
Build
Lint
        ↓
PASS / FAIL
```

The purpose is to test combined changes without modifying `main`.

This should be an optional advanced feature rather than a requirement for the first MVP.

---

# 26. Activity History

Git Butler should maintain an understandable task timeline.

Example:

```text
Order Page

10:02  Task created
10:04  Branch created
10:05  Worktree created
10:31  Checkpoint #1
11:15  Commit created
11:20  Push completed
11:22  PR #41 created
11:35  CI passed
11:41  Review approved
11:42  Merged
11:43  Worktree removed
```

This provides an audit trail for AI-driven Git operations.

---

# 27. Active Tasks

Git Butler should allow the AI agent to retrieve an overview:

```text
Active Tasks

● Dashboard
  feature/dashboard
  Agent: Claude
  In Progress

● Order Page
  feature/order-page
  Ready for Review

● Sales Report
  feature/sales-report
  Blocked
```

This is useful when a project contains many AI-managed tasks.

---

# 28. Example End-to-End Scenario

## Step 1

User:

```text
Create order page.
```

AI:

```text
New task detected.
```

Git Butler:

```text
Task created:
Order Page

Branch:
feature/order-page

Worktree:
../myapp-order-page/
```

---

## Step 2

AI works in the worktree.

Git Butler can provide:

```text
status
diff
checkpoint
commit
```

---

## Step 3

AI:

```text
Order Page is completed.
```

Git Butler verifies.

```text
✓ Git state
✓ Tests
✓ Build

Status:
READY_FOR_REVIEW
```

---

## Step 4

User:

```text
Create dashboard.
```

AI creates another task.

```text
Dashboard
Branch: feature/dashboard
Worktree: ../myapp-dashboard/
```

Order Page remains stored as a project task.

---

## Step 5

Later:

```text
Refine the UI/UX of the order page.
```

AI searches existing project tasks.

```text
Found:
Order Page
feature/order-page
```

Git Butler:

```text
Reopening Order Page.
Creating worktree.
```

The AI continues working.

No unnecessary new task is created.

---

# 29. MVP

The first version should stay focused.

## MVP capabilities

1. Detect Git repository
2. Create/list/find tasks
3. Store project state
4. Detect/reuse task branches
5. Create/manage Git worktrees
6. Read Git status/diff/log
7. Create checkpoints
8. Restore checkpoints
9. Commit
10. Push
11. Create PR
12. Read PR status
13. Permission system
14. Basic task verification
15. Task history

The original concept also identifies these as the practical v0.1 foundation. fileciteturn0file0L800-L817

---

# 30. Later Versions

After the MVP:

```text
GitHub
GitLab
Bitbucket

Multiple repositories

Advanced agent adapters

CI awareness

Review awareness

Automatic conflict recovery

Integration worktrees

Branch cleanup

Release management

Team policies

Advanced rollback

Agent activity/status integration
```

These should not block the first implementation.

---

# 31. Core Design Principles

## Principle 1

> **AI Agent = Brain**

The AI reasons about the user's work.

## Principle 2

> **Git Butler = Hands**

Git Butler executes and verifies Git operations.

## Principle 3

> **Never fabricate Git state**

Actual Git/GitHub state is authoritative.

## Principle 4

> **Tasks are persistent**

A worktree can disappear. A task should not.

## Principle 5

> **Worktrees are disposable**

They are execution environments, not permanent project identity.

## Principle 6

> **Protect user work**

Never silently destroy, reset, force-push, overwrite, or merge without appropriate permission.

## Principle 7

> **Agent agnostic**

Git Butler should work across multiple AI coding agents.

## Principle 8

> **Natural language first**

The user should not need to know Git commands.

---

# 32. Product Positioning

### Long description

Git Butler is an agent-agnostic Git workflow plugin that gives AI coding agents safe, persistent, task-aware control over branches, worktrees, checkpoints, commits, pull requests, and merges.

### Short description

> **You code. Git Butler handles Git.**

### Core promise

> **You manage the work. AI manages Git.**

### Internal mental model

> **AI Agent = Brain. Git Butler = Hands.**

---

# 33. Final Architecture

```text
                         USER
                           │
                           ▼
                ┌───────────────────┐
                │    AI AGENT 🧠    │
                │                   │
                │ Codex             │
                │ Claude Code      │
                │ OpenCode          │
                │ Hermes            │
                └─────────┬─────────┘
                          │
                          │ Tool calls
                          ▼
                ┌───────────────────┐
                │   GIT BUTLER 🦾   │
                │                   │
                │ Tasks             │
                │ Worktrees         │
                │ Branches          │
                │ Checkpoints       │
                │ Git               │
                │ Permissions       │
                │ Verification      │
                │ PRs               │
                └──────┬───────┬────┘
                       │       │
              ┌────────┘       └────────┐
              ▼                         ▼
       ┌──────────────┐          ┌──────────────┐
       │     Git      │          │ GitHub/GitLab │
       │              │          │              │
       │ Branches     │          │ PRs          │
       │ Worktrees    │          │ CI           │
       │ Commits      │          │ Reviews      │
       └──────────────┘          └──────────────┘
                       │
                       ▼
                Project State
                   .ai-git/
```

---

# 34. The One-Sentence Definition

> **Git Butler is an agent-agnostic plugin that gives AI coding agents reliable hands to manage Git, while persistent project state lets those agents understand and continue tasks across branches, worktrees, checkpoints, commits, pull requests, and iterations.**

---

# 35. The Ultimate Workflow

```text
User thinks:

"I want to build the Dashboard."

AI thinks:

"This is a new task."

Git Butler does:

Create task
Create branch
Create worktree

AI codes.

Git Butler provides:

Status
Diff
Checkpoint
Commit
Push
PR
Verification

AI thinks:

"Dashboard is ready."

Git Butler verifies.

PR gets reviewed and merged.

Worktree is cleaned up.

Task remains remembered.

Later the user says:

"Improve the Dashboard UI."

AI finds the existing Dashboard task.

Git Butler restores the task environment.

AI continues.

The user never needs to think about:

branches
worktrees
stashes
commits
rebases
PR commands
Git cleanup

The user manages the work.

**Git Butler manages the Git.**
