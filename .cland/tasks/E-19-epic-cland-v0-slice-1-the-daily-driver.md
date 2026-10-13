---
id: E-19
kind: epic
title: "cland v0 slice 1, the daily driver"
state: closed
labels:
  - ready-for-agent
  - epic
  - slice-1
assignee: null
parent: null
blocked_by: []
topic: topic-121
branch: null
created: 2026-10-08T11:40:32Z
updated: 2026-10-11T06:40:28.557Z
github:
  repo: Kealman/cland-v0
  number: 19
  url: https://github.com/Kealman/cland-v0/issues/19
closed: 2026-10-11T06:40:28.781Z
---

Spec: `docs/spec/v0.md` on `main` (sections 6 and 7 hold the slices). Wayfinder map: https://github.com/Kealman/cland-v0/issues/1 (closed; its Decisions so far index every decision). ADRs: `docs/adr/0001-roles-are-hub-held-state.md`, `0002-tracker-files-are-the-source-of-truth.md`, `0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`, `0004-agents-work-on-a-local-git-territory.md`, `0005-neovim-is-the-host.md`. Glossary: `GLOSSARY.md`. Research (branches `research/<name>`, file `docs/research/<name>.md`): bcas-hub, harness-surfaces, neovim-engine, git-engines, qa-astra. Prototypes (branches, never merged): `prototype/nvim-host` (engine), `prototype/chat-screen` (superseded layouts), `prototype/workbench` (the accepted main screen). Design canvas: https://claude.ai/artifact/PMVXaxAkQJQ6mSNEo3k7eB. Design files in the repo: `docs/design/main-screen/` on `main` (mockups, previews, README with the precedence rule).

## Problem Statement

The human coordinates several AI coding-agent harnesses (Claude Code, Codex, OpenCode) on every project with one scheme, but the tools are scattered: the Coordinator runs in one terminal, tasks live in GitHub Issues, review and QA run through Codex by hand, and the only place to talk to agents with threads was a Discord bot bound to one project. The links between these pieces live in the human's head. Questions from agents, approvals and verdicts arrive in different places or not at all, and nothing shows which session does what right now.

## Solution

Slice 1 of cland: a terminal IDE hosted in Neovim, one instance per project, that the human uses daily instead of today's set of tools. A per-project hub daemon holds the shared state; sessions of all three harnesses connect to it through a spoke and are launched, observed and attached through adapters; the human talks to the Coordinator in topics with asks, sees every session's state, and works the items of the project's own tracker from one screen with toggleable panels. Review and QA run through the Reviewer and QA roles. The slice is done when the human runs a real task of the cland project itself inside cland.

## User Stories

1. As the human, I want to start cland from the repo root with one command, so that the hub daemon, the Neovim shell and the project's state come up together.
2. As the human, I want the hub to outlive the Neovim UI, so that closing or restarting the UI never kills my sessions.
3. As the human, I want to see the Coordinator's state (idle, busy, waiting for human, waiting for approval, unknown) in the top bar at all times, so that I know whether it is working or waiting on me.
4. As the human, I want to write to the Coordinator in the General topic and see the delivery stage of my message (queued, delivered, injected), so that "waiting for agent" is distinct from "the agent has seen it".
5. As the human, I want the Coordinator's reply to appear in the same topic within the same screen, so that the conversation has one place.
6. As the human, I want to launch a session of Claude Code, Codex or OpenCode with a role, a model and a working directory from the UI, so that I can assemble the crew for a task without leaving cland.
7. As the human, I want to attach to any live session in a terminal inside Neovim and type into it, so that I can see and steer what an agent does.
8. As the human, I want a Neovim restart to re-attach my sessions rather than kill them, so that the IDE is safe to restart.
9. As the human, I want the sessions panel to show each session's name, role, harness, model, state and current item, so that I see the whole crew at a glance.
10. As the human, I want Shift+Enter to insert a newline in the composer and in a harness TUI running inside Neovim, so that multi-line input works everywhere.
11. As the human, I want pasted text with tabs to arrive intact in a harness session, so that prompts and code paste correctly.
12. As the human, I want topics listed with their status (open, waiting for human, waiting for agent, closed), unread counts and the topics that wait for me pinned on top, so that I know where I am needed.
13. As the human, I want to open the topic of an item and the item of a topic with one motion, so that I never hunt for the related thread.
14. As the human, I want an agent-created topic to appear with a title and a binding to its item, so that questions about a task land in that task's topic.
15. As the human, I want an Ask to show as a card with numbered options and a free-answer field, so that I can answer with one key or a sentence.
16. As the human, I want an open ask to keep its topic waiting for me and to show in the inbox, so that no question is lost.
17. As the human, I want the inbox to list asks, approvals, topics waiting for me and dismissable notifications in that order, so that what only I can unblock comes first.
18. As the human, I want Enter on an approval to attach the session whose TUI holds the approval prompt, so that I answer approvals where the harness asks them.
19. As the human, I want the Agents topic to show agent-to-agent messages and session and role lifecycle events, read-only, so that I can watch the crew without noise in my own topics.
20. As the human, I want to assign a role to a session and to revoke it, so that roles follow my decisions, not the harness.
21. As the human, I want the Coordinator role to be exclusive, with a visible warning when it is vacant, so that there is never two coordinators or none without my knowing.
22. As the human, I want a role to move from one session to another with a handover note, so that I can switch the Coordinator to another harness or model mid-project without losing the thread.
23. As the Coordinator, I want to receive my role clause as a hub event on assignment and on every reconnect, so that my instructions do not depend on the harness's instruction files.
24. As the Coordinator, I want to pull the topics waiting for an agent, the open asks and the role's claims from the hub after a handover, so that I can continue the previous holder's work.
25. As the Coordinator, I want to be the only role that can ask the human, so that the human's attention is routed through one point.
26. As an Implementer, I want to ask the Coordinator in a plain message and have it appear in the Agents topic, so that my questions reach the right party without interrupting the human.
27. As a Reviewer or QA session, I want to receive a review or QA request through the hub and write my verdict on the item, so that the merge gate of slice 2 and the human can see it.
28. As the human, I want to see items as a tree of epics and tasks with status glyphs, the claiming session and an ask badge, so that the task list is the centre of my work.
29. As the human, I want to filter items by all, in work, needs you, done and map, so that the list fits the stage of the project.
30. As the human, I want the map filter to group items as decided, frontier, in work by sub-agents and blocked, so that a wayfinder map reads like a map.
31. As the human, I want to open an item and see its body, fields, verdicts and comments, so that I understand a task without opening its file.
32. As the human, I want the board view with backlog, planned, in progress, review, qa and done columns, so that I see the sprint at a glance.
33. As the human, I want one floating picker over items, topics, sessions and artifacts with fuzzy filtering, so that I reach anything by name without a panel open.
34. As the human, I want the motions gi, gt and gs to work from every panel and view, so that items, topics and sessions are always one keystroke apart.
35. As the human, I want to toggle each panel with one key and to have three example presets (charting, watch, steady), so that the screen fits the stage without hard-coded modes.
36. As the human, I want every tracker item to be one Markdown file with frontmatter in the repo, so that the tracker is readable, versioned and travels with the code.
37. As the human, I want to edit an item file by hand and have the hub re-index it, so that the files stay the source of truth.
38. As an agent, I want a `cland task` CLI to create, view, list, comment, edit, close, link and claim items, so that the process skills work through their "other" tracker mode.
39. As the Coordinator, I want claims to be live state held by the hub, distinct from the item's assignee, so that the UI shows who works on what right now.
40. As the human, I want sequential item ids like T-123 used in files, topics and commits, so that references are stable and short.
41. As the human, I want `cland init` to provision the cland folder, the managed files, the General and Agents topics and the roles config with defaults, so that a project is ready in one command.
42. As the human, I want `cland init` and `cland update` to touch only files marked as managed by cland, so that my own files are never overwritten.
43. As the human, I want `AGENTS.md` to carry the generic cland instructions and no `CLAUDE.md` to be created, so that all three harnesses read the same file.
44. As the human, I want the skills installed under one canonical folder with a symlink for Claude Code, so that every harness sees the same skills.
45. As the human, I want `cland doctor` to check the versions and authentication of the three harnesses, gh, Neovim and the hub, so that setup problems are found before work starts.
46. As the human, I want committed project files never to contain machine paths or hub secrets, so that the repo stays shareable.
47. As the human, I want a per-project secret and a discovery file in the cland folder, so that spokes, the CLI and the UI find and authenticate to the right hub.
48. As the human, I want hygiene limits (message size, rate, loop breaker) with thresholds in project config and state that survives a hub restart, so that two agents cannot loop forever.
49. As the human, I want a JSON-lines journal of hub events, so that I can reconstruct what happened.
50. As the human, I want the UI to show "unknown" when an adapter cannot tell a session's state, so that the screen never lies about state.
51. As the human, I want to start a real task of the cland project inside cland with the Coordinator in Claude Code, an Implementer in OpenCode and Reviewer and QA in Codex, so that cland is built with cland from this slice on.

## Implementation Decisions

- Neovim is the host (ADR 0005): cland is Lua inside a standalone build of Neovim 0.12.x, started under its own `NVIM_APPNAME` with `--clean -u`; mitigations for the terminal's known failures are part of the configuration: Shift+Enter mapping to the kitty CSI-u sequence, `termpastefilter` without `HT`, a scrollback cap of 10,000, no hit-enter prompts, UI updates through `vim.schedule`, sessions owned outside Neovim.
- The hub is a per-project daemon extracted from the BCAS driver hub core (ADR 0003): Node 24, TypeScript without a build step, `node:sqlite`, `ws`, with the spoke (an MCP stdio server inside each session holding one WebSocket to the hub), the versioned hello / welcome / deliver / result protocol, store-and-forward, hygiene and the test harness that drives a real spoke and a real hub. The Neovim UI talks to the hub over a Unix socket carrying the same frames as JSON lines; the same frames run over the stdio of a child process for sandboxed QA runs.
- The hub owns the session registry, routing with three delivery stages (queued, delivered, injected), the store of topics, messages and asks, role state and permission enforcement on every tool call, the tracker index and live claims, and the journal. It does not own decisions, the UI, git operations or artifact storage.
- Adapters are modules inside the hub; harness processes (Codex app-server, Claude Code `--bg`) live in the hub's process table. The mandatory contract: spawn, attach command, inject with injected confirmation, a normalised state stream, stop, resume; optional capabilities declared with per-signal reliability. The v0 mapping: Codex through the app-server on a Unix socket with `resume --remote` for attach and `thread/status/changed` for state; OpenCode through its local server with the TUI client for attach and SSE events for state (waiting for human is heuristic); Claude Code through `--bg` and `attach`, a cland mod for inject, hooks for state, `claude agents --json` as a polled fallback. No `-c` overrides on the Codex TUI process.
- Roles are hub-held state delivered as events (ADR 0001): Coordinator (exclusive), Implementer, Reviewer, QA; sessions without a role do not connect to the hub. A role carries a clause, a skill list, hub permissions and launch defaults (Coordinator Claude Code and Fable, Implementer OpenCode with a free model, Reviewer Codex and gpt-6.1-sol, QA Codex and gpt-6-astra, all editable). Permissions: the Coordinator sends to anyone, asks the human, creates topics, claims and assigns items, requests session launches, hands over its role and resolves; the Implementer sends, creates topics bound to its own item and claims its own item; Reviewer and QA send, read history and who, and write verdict comments on items; the Coordinator and the human create items, the Coordinator edits and closes them. The handover note has four sections: goals now, work in flight, open decisions, waiting on.
- Topics: one flat list per project with two standing topics, General and Agents; a topic has a title, a status set by message direction plus explicit ask and resolve, and at most one binding to a unit of work (at most one topic per unit of work); messages address the Coordinator by default and @role or @session pull others in; Ask is a message kind (options plus free answer), agent-to-human only; agents have no current topic, every delivery carries the topic id, history is pulled on demand.
- The tracker (ADR 0002): one Markdown file per item with YAML frontmatter in `.cland/tasks`, written through the hub, hand edits re-indexed, last writer wins; comments and structured verdicts in the file; `cland task` CLI plus the same hub tools; sequential ids; no auto-commits.
- The main screen is the workbench (spec section 5): a tabline top bar, a centre view (thread, board, item, session, Agents log, inbox full width), a left items panel with filters, one right panel (inbox, sessions or topics), one floating picker, the three motions, stage presets as examples.
- The cland folder is `.cland/` with `tasks/`, `roles.toml` and `config.toml` committed and `artifacts/`, `worktrees/`, `territory.git/`, `hub.db`, `hub.json`, `secret`, `journal.jsonl` ignored; TOML for config, YAML frontmatter in items, JSON lines for the journal.
- The process layer: skills in `.agents/skills` with `.claude/skills` symlinked; `docs/agents/*` for the tracker, domain docs and triage labels; `AGENTS.md` only, with an `@AGENTS.md` import if a `CLAUDE.md` exists; Claude Code hooks calling `cland hook`; everything managed by cland is marked and refreshed by `cland init` and `cland update`. In slice 1 the territory is not set up: `origin` stays GitHub and pushes to GitHub happen only on the Coordinator's explicit decision.
- Review and QA run through the roles: the Coordinator sends the request through the hub to a Codex session holding the Reviewer or QA role, which writes its verdict on the item; `/codex:rescue` is the fallback. QA in slice 1 checks what it can without the QA lane: shell-level checks, the `cland task` CLI, and a headless Neovim driven by `nvim_input` with `screenstring()`.
- Repository layout: `hub/` (TypeScript: hub, adapters, the `cland` CLI), `nvim/` (Lua: the standalone build and the UI), `skills/`, `docs/`; prototypes stay on their branches. The `cland` CLI on Node starts the daemon and Neovim.
- Tracer-bullet order: (1) hub daemon, spoke, Claude Code adapter and General in the UI; (2) Codex and OpenCode adapters; (3) roles, clauses, handover; (4) the full topic model and asks, the inbox; (5) the tracker and the skills, with a one-script migration of open GitHub Issues into `.cland/tasks`; (6) `cland init` and provisioning. Each bullet ends in something the human can use.
- Tracker bootstrap: until `.cland/tasks` exists, the tasks for building cland live in this repo's GitHub Issues and `/to-tickets` writes there.

## Testing Decisions

- A good test drives the system through its external seam and asserts on observable behaviour (frames received, state reported, files written, screen text), never on internals.
- The primary seam is the hub's frame protocol: tests start a real hub process and speak to it as a real spoke over MCP and WebSocket (the BCAS test harness, kept and extended) and as a real UI over the JSON-lines socket and over stdio. The `cland task` CLI is tested as a client of the same seam against a temporary project folder.
- The Neovim UI is tested from the same seam's other side: a headless Neovim driven by `nvim_input`, its grid read with `screenstring()`, talking to the hub or a stub of it over stdio (the default QA lane of the qa-astra research).
- The one unavoidable second seam is the harness process boundary: adapters are tested against fake harnesses that speak the real protocols (a fake Codex app-server over JSON-RPC on a Unix socket, a fake OpenCode server over HTTP and SSE, fake Claude Code hooks and commands). Real harnesses are exercised by manual smoke runs and by the QA role, not by the automated suite.
- No new seams inside the hub: no mocked store, router or adapter internals.
- Prior art: the BCAS driver hub's tests (`test/harness.ts` in its repo) that drive the real spoke and hub; the prototypes' tmux-driven checks and headless smoke runs on branches `prototype/nvim-host` and `prototype/workbench`.

## Out of Scope

The git territory (bare `origin`, worktrees per item, `cland merge`, `cland release`), artifacts, the QA lane infrastructure (Lua QA API, briefs, the `qa` skill), Agents-topic filters and the topic's artifact list: all slice 2. Everything in the map's fog: a sessions board as a separate screen, cost per item, crew presets, a journal viewer for retrospectives, the build's distribution format, the keymap scheme, inline images, GitHub sync of the tracker, the per-item change tour, remote access, multi-user mode.

## Further Notes

- Risks the implementation must honour (spec section 9): Codex's embedded-mode trap for any `-c` override on the TUI; Claude Code channels still a research preview; approvals auto-declined inside `/codex:rescue` runs; Unix sockets blocked in the Codex sandbox while network is off; sub-agents sharing their parent's spoke identity (clause rule plus audit log); GitHub personal-account limits during the bootstrap on Issues.
- All artifacts in the repo and tracker are in English.
- The human's working rules for building cland: the Coordinator thinks and decides, sub-agents do the work; review with gpt-6.1-sol and QA with gpt-6-astra through the roles or `/codex:rescue`; never do their work for them.

## Comments

### coord · 2026-10-09T20:56:30.636Z

Run note 20:58Z. The hub restarted on dev d7b821b (pid 61541), by the human's decision in General. T-74, T-75, T-66, T-76, T-77 and T-104 are now live. Doctor afterwards: 1 fail, because the territory hook installed by T-53 predated T-74's new refusal message. Behaviour was unchanged. The Coordinator installed exactly the expected hook, not via `cland init`, which rewrites other managed files. A direct hook probe confirms: dev and main refused without the marker, allowed with it; task branches allowed. Doctor is now 20 ok, 3 warn, 0 fail. Warnings: Codex 0.162.1 outside the tested range; a reused pid preserved correctly; a fresh test-fixture hub from a running suite, left alone until no suite runs, because doctor --fix acts machine-wide (T-102). Lesson: a change to a managed territory file needs its migration in the item, the class F drift from A-96. `cland update` should refresh the hook.

### coord · 2026-10-09T21:09:05.164Z

Run note 21:09Z. First live refusal of T-74's gate: `cland merge T-105` refused with merge-unpublished, because the root's dev held 5c192d5, an unpushed v0.1 spec commit from the human's other session. No ref moved. `cland push` published it, and the merge was retried. The gate works as designed. That session still commits without pushing, so every merge now needs a push first.

### qa-16 · 2026-10-11T06:39:09.116Z

verdict: qa
result: clear
by: qa-16 [qa]
run: qa-2026-10-11-16-t19-closure
commit: 8ffd8cacb221ec5e941f428b153ff94f3081f1cb

| Check | Surface | Result | Evidence |
| --- | --- | --- | --- |
| Release commit and tag | read-only Git | PASS | `git log --oneline -1 8ffd8ca`: “Tracker: T-76 filed; T-20 run note”; full commit 8ffd8cacb221ec5e941f428b153ff94f3081f1cb. Annotated v0.0.1 tag object e1aefa85c5d5f762f46773c8916e2e7fb717732b peels to this commit; local main is exactly this commit. |
| Release acceptance | task.view T-64 / T-20 | PASS | Both closed. T-64's 2026-10-09 16:42:21Z record names T-62's launch, review/QA, merge db7b7d7 and release v0.0.1. Its 16:44:13Z comment records the human's instruction “ok comment instead of me, and close it” and confirmation that the release left from inside cland. T-20's 16:39:45Z release and 16:44:26Z closure records agree. |
| Slice-1 history | task.view T-42 | PASS | Closed at the human's request on 2026-10-09 14:52:19Z. The record distinguishes the earlier rehearsal from the real run and explicitly waives the separate human-confirmation criterion. This is historical acceptance/waiver evidence, not a fresh demo. |
| Closure authority | task.view T-130 | PASS | D20, recorded 2026-10-11 06:36:26Z, directs T-19 closure and moves its open tech debt to T-216. |
| Remaining work and criteria | task.view T-19; task list --under T-19 --state open --json | PASS | Open-child query returns {"items":[]}. T-19 exposes criteria: []; there are no stable criterion ids to verify. |

Findings: high none; medium none; low none for this closure audit.

QA clear T-19 under D20. Run: qa-2026-10-11-16-t19-closure. Covered commit: 8ffd8cacb221ec5e941f428b153ff94f3081f1cb (v0.0.1). Verified: release ref identity, recorded release/human acceptance, historical slice-1 closure evidence, and absence of open children. No criterion marks requested: T-19 has no parsed criteria, so `verified: all` would add no meaningful verification.

Not run: new product demo, test suite, fresh real-model/terminal exercise, and live GitHub ref query; this request is explicitly an audit of existing release evidence. The historical GitHub publication is supported by T-64/T-20's recorded release readback, with local tag/main verified now. T-64 and T-42's legacy checkboxes were not newly verified or modified.

### qa-16 · 2026-10-11T06:40:12.605Z

verdict: qa
result: clear
by: qa-16 [qa]
run: qa-2026-10-11-16-t19-dev-closure
commit: 6675043d1a35ace9dd7de12979f0fd81c38d6b01

| Check | Surface | Result | Evidence |
| --- | --- | --- | --- |
| Requested dev build | read-only Git | PASS | git rev-parse dev = 6675043d1a35ace9dd7de12979f0fd81c38d6b01 |
| Released build retained | read-only Git | PASS | git merge-base --is-ancestor 8ffd8ca dev exits 0; v0.0.1 peels to 8ffd8cacb221ec5e941f428b153ff94f3081f1cb |
| Release demo items | task.view | PASS | T-64 and T-20 remain closed |
| Open children | task list --under T-19 --state open --json | PASS | {"items":[]} |
| Criterion inventory | task.view T-19 | PASS | criteria: []; no criterion ids to mark |

Findings: high none; medium none; low none within this closure audit.

QA clear T-19 under D20 at dev 6675043d1a35ace9dd7de12979f0fd81c38d6b01. Run: qa-2026-10-11-16-t19-dev-closure.

Release acceptance evidence is retained in A-1099 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1099-t-19-closure-qa-v0-0-1-release-evidence.md) and the earlier QA verdict qa-2026-10-11-16-t19-closure, pinned to v0.0.1's 8ffd8cacb221ec5e941f428b153ff94f3081f1cb. That report records the tag/main identity, T-64's human acceptance confirmation, T-20 closure and T-42's historical acceptance/waiver.

This second verdict verifies those closure conditions on current dev, as requested after the epic gate reported qa-stale for the historical release SHA. It is not a fresh behavioral regression verdict on all changes since v0.0.1. No new demo, suite, real-model/terminal exercise or live GitHub query ran; the Coordinator requested release-evidence closure only. No verified marks were added because T-19 has no criteria.

### coord · 2026-10-11T06:40:28.557Z

Closed by the human's decision D20 (T-130, 2026-10-11) on QA verdict qa-2026-10-11-16-t19-dev-closure (dev 6675043, A-1100), with release evidence qa-2026-10-11-16-t19-closure (v0.0.1, 8ffd8ca, A-1099). T-19 is no longer the catch-all parent; open tech debt moved to T-216 (Tech debt).
