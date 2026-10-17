---
title: Concepts
description: The hub, sessions and roles, the crew, items, topics, asks, plans, verdicts, worktrees and where cland keeps its state.
sidebar:
  order: 4
---

cland uses a small, fixed vocabulary. This page defines each word once.

## Hub

The **hub** is a local service, one per project, started from the project's root. Every session talks to other sessions and to you through it. It holds the shared state, routes messages, keeps the tracker index, and checks every tool call against the caller's role.

```sh
cland hub start     # usually automatic: cland and cland setup start it
cland hub status    # pid, uptime, version, connected sessions
cland hub stop
cland hub reload    # re-read config.toml and roles.toml without a restart
```

The hub outlives the workbench: closing Neovim or the browser leaves the crew working.

## Harness, session and account

A **harness** is an agent CLI that cland runs: Claude Code, Codex or OpenCode.

A **session** is one running instance of a harness, with its own history and working state. It has a name such as `impl-42` or `rev-1`, and at most one role. The hub launches sessions, delivers messages into them and knows their state from the harness itself: `busy`, `idle`, `waiting for human`, `waiting for approval`. It never relies on the model's own report.

Each session runs under an **account**: one of your harness logins. See [Accounts and limits](/docs/accounts/).

## Role

A **role** is what a session does in the project. Roles are hub state: the hub delivers the role's instructions (its **clause**) to the session that holds it, and enforces the role's permissions on every call.

| Role | Holders | Owns |
| --- | --- | --- |
| Coordinator | One, or none | The root of the project: plans, launches sessions, merges, releases. The only role that asks you. |
| Lead | One per epic or release | One container of the item tree: plans its epic, launches its sessions, merges its tasks. |
| Implementer | Many | One claimed task, until it is ready to merge. |
| Reviewer | Many | Review verdicts. Reads, never edits. |
| QA | Many | QA verdicts from running the product. |
| Aide | Many | Works for you alone and speaks for you, decisions included. Addressed by name only. |

A role can move to another session mid-project. The holder writes a **handover note** (goals now, work in flight, open decisions, what is waited on) and the next holder receives the clause with that note. The transcript never moves.

The **Aide** is your own session. It can create and change items, write to any session, and launch, stop or resume sessions when you tell it to. It never merges, releases or asks you questions: it is you.

## Crew

The **crew** is the project's staffing policy, in `.cland/crew.toml`: which roles run one session per item, as a pool or as a singleton, whether a session keeps its context between items, when it stops, and which levels of the item tree get their own Lead. `.cland/roles.toml` holds what a role is and how it launches: harness, model, effort, account and permissions. See [Crew configuration](/docs/crew/).

## Items

An **item** is an entry in the project's tracker: one Markdown file in `.cland/tasks/`, committed with the work. Every item has an id, a title, a state (open or closed), labels, an assignee, a parent and blocking edges.

| Kind | Prefix | What it is |
| --- | --- | --- |
| Release | `R-` | A versioned set of epics shipped together. Has a `version`. |
| Epic | `E-` | A larger feature, broken into tasks, with a plan. |
| Task | `T-` | One unit of work for one Implementer. |
| Question | `Q-` | A decision or research question. |
| Map | `M-` | A set of open questions charted before a plan exists. |
| Spec | `S-` | A specification. |
| Category | `C-` | A container for loose work: Bugs, Tech debt, Follow-ups, Ideas. |

The number is the identity; the prefix follows the kind. `T-17`, `E-17` and `17` all find the same item.

A **task** also has:

- a **status**: `backlog`, `planned`, `in progress`, `review`, `qa`, `ready` or `done`. The hub moves it on claims, verdicts and merges;
- a **size**: `XS`, `S`, `M` or `L`, set by whoever files it;
- a **rank** among its siblings. The lowest rank is next. Moving an item to the top is how you make it a priority;
- **acceptance criteria**, each with a stable id (`C1`, `C2`) and marks: done by the Implementer, verified by a Reviewer or QA, or failed with a note.

The tracker is the crew's only source of work. Use it from the shell with `cland task`:

```sh
cland task list --under R-1
cland task view T-42
cland task create "Parse the config file" --size S --parent E-3
```

You rarely need to: tell the Coordinator what you want and it files the items. In the workbench the explorer is read-only on purpose: its one action is a message to the Coordinator about the selected items.

## Topics and threads

A **topic** is a thread in your chat with the crew. It has a title, a status (`open`, `waiting for human`, `waiting for agent`, `closed`) and at most one bound task or epic.

- **General** is the standing topic for free conversation with the Coordinator.
- **Agents** is the read-only record of agent-to-agent messages and session lifecycle events.
- Each task or epic can have its own topic. Closing the item closes its topic.

Your messages go to the Coordinator unless you mention someone: `@reviewer`, `@qa` or a session name such as `@impl-42`. A mentioned session may answer you in that topic.

Runs of agent-to-agent messages fold into one line ("impl-42 → rev-1 · 4 messages"), so a thread shows what matters to you first.

## Asks, requests and the inbox

An **ask** is a decision question with numbered options and room for a free answer. Asks travel up the chain of leads: an Implementer's question goes to its epic's Lead or the Coordinator, each lead answers or forwards it one level, and only the Coordinator asks you. An open ask keeps its topic waiting.

A **request** asks you for an act: a review, a QA run or taking over a role.

The **inbox** holds only what needs you now, in four sections:

1. Asks and approvals: questions, and command approvals a harness waits on.
2. Plan approvals: epic plans waiting for you, when you approve plans.
3. Requests to you.
4. Messages to you.

The "needs you" count in the top bar is the inbox count. Everything else (verdicts, launches, merges) goes to the **events view**, newest first.

## Plans and approval

Every epic gets a **plan** before work starts: an ordered list of **stages**. Each stage holds parallel **lanes**, ordered lists of tasks, and a QA policy:

```yaml
stages:
  - name: parser and CLI
    qa: { scope: affected, when: after-stage }
    lanes:
      - [T-21, T-22]
      - [T-23]
  - name: panels
    qa: { scope: full, when: per-item }
    lanes:
      - [T-24, T-25]
```

- `scope` is `none`, `affected` or `full`.
- `when` is `per-item` (each task needs a QA verdict before merging) or `after-stage` (tasks merge on review, then one QA run closes the stage).
- Review is always required.

The Coordinator or the epic's Lead writes the plan into the epic's file. By default the plan needs no approval and you are notified. With `[plan] approval = "human"`, no Implementer starts on the epic until you approve the plan in the plan view (`gp`, then `a`). See [Crew configuration](/docs/crew/#plan-approval).

## Verdicts and the merge gate

A **verdict** is a structured comment on an item: a review or QA result, `clear` or `not clear`, written by a session holding the Reviewer or QA role, with the run it came from and the commit it checked. Clear verdicts can verify acceptance criteria by id; not-clear verdicts can fail them with a note.

The **merge gate** lands a task on `dev` only when:

- the latest review verdict is clear and current for the branch head;
- the latest QA verdict is clear and current, when the plan requires per-item QA;
- every acceptance criterion is marked done and verified;
- the verdicts come from sessions other than the one that claims the task.

When all of this holds, the hub sets the task to `ready` and tells the lead. The merge itself is one squash commit on `dev`. See [Verification and release](/docs/verification-and-release/).

## Territory, branches and worktrees

The **territory** is a local bare Git repository at `.cland/territory.git`, set as the project's `origin`. Agents branch, push and merge there, out of sight of GitHub. Your GitHub remote is renamed `github`; only `cland release` pushes to it.

- `main` mirrors GitHub. `dev` integrates the crew's work. Your root checkout lives on `dev`.
- Each task gets a **task branch** `t/T-42-<slug>` from `dev`, in its own **worktree** at `.cland/worktrees/T-42/`, made when the task is claimed. The Implementer works there; parallel tasks never share a checkout.
- After the merge the hub removes the worktree and the branch.

```sh
cland worktree list     # each worktree with its item, branch and sessions inside
cland worktree prune    # remove worktrees of closed items, after a y
```

## Artifacts

An **artifact** is a file, or a folder with an entry file, that a session or you show to others: a report, a diagram, a prompt draft. It has an id `A-12`, a kind (`prompt`, `note`, `page`, `diagram`, `file`) and an author, and appears as a chip in its topic. Your artifacts and an Aide's live until you delete them. An agent's artifact lives with its topic unless kept or promoted into the repository.

## Rulebook

The **rulebook**, `.cland/RULES.md`, holds the project's own rules for how work is done: "rule 3: one test suite at a time". Each rule has a scope (all roles or named roles), a date, a reason and a status. The hub puts a role's rules into its clause at launch and delivers new rules to running sessions. When you state a rule in a thread, the Coordinator records it.

```sh
cland rule add "Never push to GitHub outside a release" --scope all --reason "GitHub is public"
cland rule list
```

## Heartbeat

A **heartbeat** is a timed digest the hub sends a session, by default the Coordinator every hour: what is in flight and what looks stale (reviews nobody requested, ready tasks not merged, idle sessions, unanswered asks). It wakes the Coordinator when no event does. It never reaches your inbox.

## Where state lives

In the project, committed with your code:

| Path | What it is |
| --- | --- |
| `.cland/tasks/` | The tracker: one Markdown file per item. |
| `.cland/roles.toml` | The roles: clauses, skills, launch settings, permissions. |
| `.cland/crew.toml` | The staffing policy. |
| `.cland/config.toml` | Project settings: verification, plan approval, tracker levels, keys. |
| `.cland/RULES.md` | The rulebook. |
| `.agents/skills/` | The curated skill set (`.claude/skills` links to it). |
| `AGENTS.md`, `docs/agents/` | Instructions every harness reads; cland manages one block. |

In the project, ignored by Git:

| Path | What it is |
| --- | --- |
| `.cland/hub.db` | The hub's store: sessions, topics, messages, the tracker index, claims. |
| `.cland/journal.jsonl` | The append-only journal of every event. `cland hub journal` reads it. |
| `.cland/territory.git/` | The local territory. |
| `.cland/worktrees/` | Task worktrees. |
| `.cland/artifacts/` | Artifact files. |
| `.cland/ui.json` | Your workbench layout and preferences on this machine. |
| `.cland/secret`, `.cland/hub.json` | The hub's local secret and discovery file. |

For your user, shared by all projects:

| Path | What it is |
| --- | --- |
| `~/.config/cland/accounts.toml` | Your account registry: names, harnesses, paths. Never a secret. |
| `~/.local/state/cland/` | The spend ledger of cloud verification runs. |
| `~/.local/share/cland/opencode/` | cland's own OpenCode database. |
