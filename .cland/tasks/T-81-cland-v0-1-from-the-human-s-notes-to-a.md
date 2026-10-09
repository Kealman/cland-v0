---
id: T-81
kind: map
title: "cland v0.1: from the human's notes to a spec and epics"
state: open
labels:
  - wayfinder:map
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:08:14.191Z
updated: 2026-10-09T19:38:05.893Z
---

## Destination

`docs/spec/v0.1.md` complete, and the v0.1 epics published as tracker items (label `v0.1`) ready for `/to-tickets`. Every concept in the human's v0.1 notes is either decided and recorded in the spec, GLOSSARY and ADRs, or explicitly deferred past v0.1 by the map's last ticket.

## Notes

- Domain: cland, a terminal IDE that runs and coordinates AI coding-agent harnesses (Claude Code, Codex, OpenCode) from a per-project hub, with Neovim as the host. v0 (`docs/spec/v0.md`, released as v0.0.1 on 2026-10-09) is the daily driver: one Coordinator over flat sessions, four hard-coded roles, items with `parent` and `blocked_by` only, a workbench with items panel, board, inbox, sessions, topics and a picker. This map plans v0.1 from the human's notes: seventeen intents, five of them large (session hierarchy, crew configuration and session reuse, epic planning, item hierarchy, visibility levels).
- Skills every session consults: `grilling` and `domain-modeling` for grilling tickets; `research` for research tickets; `prototype` for prototype tickets. Read `GLOSSARY.md` and `docs/adr/` before any decision and update them as decisions land. Respect the existing ADRs unless a ticket overturns one explicitly.
- The spec grows with the map: each resolution adds or rewrites its section of `docs/spec/v0.1.md` (status draft until the cut ticket closes). The cut ticket turns it complete and publishes the epics with `/to-spec`.
- Tracker mechanics: `docs/agents/issue-tracker.md`, "Wayfinding operations". A hub must be running. Child tickets are kind `question` with a `wayfinder:<type>` label; the claim is the assignee.
- Research goes on `research/<name>` branches as `docs/research/<name>.md`, pushed to `origin` (the local territory) only, never to GitHub and never merged. Prototypes go on `prototype/<name>` branches, never merged. Look-and-feel questions go to the design canvas first (https://claude.ai/artifact/TuzGTeNLthjo2RLwMyhZfp, sources in `docs/design/main-screen/`); a Neovim prototype only where terminal feasibility is the question.
- Every artifact in English. Sub-agents do the work; the session driving the map decides.
- Facts to start from: `docs/spec/v0.md`, `.cland/roles.toml`, `.cland/config.toml`, `hub/src/protocol.ts`, `hub/src/spoke/spoke.ts`, `nvim/README.md`, the retrospective artifact A-96. The state survey of 2026-10-09 found: sessions are flat, with no launched-by link, and harness sub-agents are invisible to the hub; four hard-coded roles and no crew configuration; practice was per-item Implementers, shared Reviewer and QA sessions, one Coordinator relaying every handoff; items have five kinds, two states, `parent` and `blocked_by`, and no status, rank, release or milestone; sessions cannot subscribe to events, so idles and deaths reach only the Agents log and the human's inbox; Claude Code sessions take hub messages only between turns; the human has no session of their own; there is no command palette and no focus-cycle key, and a terminal is left only with `C-\ C-n`; panel sizes are formulas re-applied on every change; the board shows every item, 72 cards in done.

### Settled while charting (2026-10-09)

- Scope: the whole notes file. Which of the five large themes land in v0.1 is decided by the cut ticket; the small improvements are in by default. The open v0 tail (T-19's follow-ups, bugs) stays in its own items.
- UI state persists: `.cland/ui.json`, ignored by git, keeps the last preset, panel visibility and sizes, and the items panel filters. A manual resize is no longer overridden by the layout formulas.
- A brief at launch: `session.launch` and `cland session launch` take a brief (text or an artifact). The hub delivers it right after the role clause, before the session's first turn, as its first delivery.
- Sessions panel: one line per session (name, role, state glyph, item); harness, model and usage on the selected row only. Groups in the order waiting, busy, idle; stopped sessions folded into one "stopped (N)" line that a key unfolds.
- Board: shows items of open parents only (epics, later releases), with a parent filter in its header. Closed items of a closed epic leave the board.
- Focus: `C-h/j/k/l` move focus between windows in every mode, terminal included, so leaving a session is a move; Esc always goes to the harness; one "leave terminal" key that never reaches the harness. The exact bindings come from the free-keys research.
- Palette: `␣p` becomes one command palette. No prefix searches objects and actions together; prefixes `>` actions, `#` items, `@` sessions, `~` artifacts, `/` topics. Every cland action (`:Cland` subcommands, panel toggles, session launch, answering an ask) is registered with a title and its key. Built on Neovim's built-in fuzzy matching, no plugin.
- The "in work" filter bug is the tracker item T-80, not a map ticket; the status ticket decides the model it waits on.
- Dogfooding: the v0.1 epics carry the label `v0.1`; when the release kind exists they move under the release item. No stopgap epic.

## Decisions so far

- Item hierarchy: a release above epics, and whether levels are configurable (T-87, .cland/tasks/T-87-item-hierarchy-a-release-above-epics-and.md): container kinds come from config, default release above epic, leaves under any container; a release item carries a version that `cland release --item` ships and closes; containers with open children cannot close; a current release scopes the panel, board and graph; sprints are not a level.
- Item workflow status and order: explicit fields or derived (T-88, .cland/tasks/T-88-item-workflow-status-and-order-explicit.md): an explicit status field for tasks (backlog, planned, in progress, review, qa, ready, done) moved by hub events and editable by the Coordinator and the human; a sparse rank among siblings, lowest first, no priority flag; "in work" is everything from planned to ready; the merge gate is unchanged.
- The human's own session (T-92, .cland/tasks/T-92-the-human-s-own-session.md): a non-exclusive Aide role that works for the human alone, addressed by name only, speaking for the human with decisions included; the tracker, artifacts, send and history but no launch, merge, handover or ask; a "yours" group in the sessions panel.

## Not yet specified

- Sprints and milestones: T-87 ruled them groupings across the tree, not levels. What a sprint would be in cland, and whether v0.1 needs one, waits on the status ticket and the cut.
- Cost per item and per session: where usage is summed and shown; waits on the session hierarchy (cost rolls up the tree) and on visibility levels.
- A journal and retrospective viewer: the A-96 retrospective was hand-made from the journal; what the workbench shows of the journal waits on visibility levels and subscriptions.
- History search: searching messages and comments across topics and items; waits on the palette and visibility levels.
- Notifications beyond the inbox: whether anything reaches the human outside the workbench (system notifications, sounds); waits on visibility levels.

## Out of scope

- A per-item change tour (the parked v0 intent: the current state with changed places marked, and a session in the item's context to explain it): not in the v0.1 notes; returns as its own effort.
- Multi-user and remote access; GitHub sync of items (the mirror is retired); inline images in the terminal; the distribution format of cland. All beyond the destination of v0.1.
