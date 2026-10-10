---
id: T-113
kind: epic
title: "Epic: Leads and the crew"
state: open
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: T-130
blocked_by:
  - T-108
  - T-112
topic: null
branch: null
created: 2026-10-09T21:51:34.152Z
updated: 2026-10-10T16:43:27.039Z
---

## Goal

The project can grow a level: a Lead session takes a whole epic, plans it, launches and stops its sessions, requests reviews and merges its items, while the Coordinator keeps the root and questions climb the chain one level at a time. A committed `crew.toml` says how each role is staffed, and the hub enforces it at launch and hands out idle pool members instead of new sessions. Today one Coordinator leads a flat crew, and staffing is decided ad hoc in its turns.

## Contents

- **§3.7 The hierarchy of sessions, the rest**: the `Lead` role leading an epic or a release, one lead per node with the Coordinator at the root; routing and default subscriptions through Leads; asks answered or forwarded one level up, with only the root's lead asking the human; permissions by level; the handover of a node with its note; and `leads` as the way a project grows a level.
- **§3.8 Crew configuration and session reuse**: a committed `.cland/crew.toml` holding the staffing policy (`leads`, and per role `policy`, `size`, `keep_context`, `stop_after`, `subagents`), enforced by `session.launch` with idle pool members handed out, reloaded on change with the last good version kept, shown by `cland crew show`, changed by `cland crew set`, summarised in the sessions panel header, and written by `cland init` with flat defaults.

Not in this epic: the plan a Lead writes and the `plan-epic` skill, and the lanes that `per-group` staffs: "The epic plan". This epic validates `per-group` in the file; the launch of one session per lane arrives with plans.

Choices where the spec is silent:

- A Lead takes its node's lead claim at launch (`session.launch` naming the epic or release) and runs from the project root, as the Coordinator does, since a container has no task branch.
- The `lead` role's launch defaults start as the Coordinator's; its skills cover its node (handover, merge, and `plan-epic` once it exists), not releases or sync.

## Tracer-bullet order

1. **A Lead on an epic.** The `lead` role in `roles.toml` and `cland init`; `session.launch` naming an epic gives the session that node's lead claim, one per node; only the Coordinator launches Leads; the panels show the Lead on its epic. Demo: the Coordinator launches `lead-1` on a v0.1 epic, and `@lead T-<epic>` reaches it.
2. **Routing through Leads.** Events and reports about an item climb the chain through Leads; Lead sessions get the default subscription to their subtree, less the subtrees with their own lead; idle and death notices reach them. Demo: an Implementer's "blocked" report under the epic reaches `lead-1`, not the Coordinator.
3. **Permissions by level.** A Lead launches and stops sessions for its epic's items, requests review and QA, and merges its items through the same gate; a request outside its subtree is refused, naming the level; the Coordinator keeps releases, sync, push, unscheduled merges and the launch of Leads. Demo: `lead-1` merges one of its items and is refused on an item of another epic.
4. **Asks up the chain.** A lead answers an ask from below or forwards it unchanged with one call; only the root's lead asks the human; the topic waits on the right party at each step. Demo: an Implementer's question goes to `lead-1`, which forwards it; the Coordinator turns it into an ask for the human.
5. **Handover of a node.** A node's lead claim moves with the handover note; claims and default subscriptions follow; the `handover` skill drafts a Lead's note. Demo: `lead-1` hands its epic to `lead-2` mid-way, and the next verdict's event reaches `lead-2`.
6. **The crew file.** `.cland/crew.toml` with its shape and validation; reload on change, a broken file refused with a notice and the last good version kept; `cland crew show` and `cland crew set`; `cland init` defaults; the sessions panel header's summary. Demo: `cland crew set reviewer.size 2` and the header reads "rev pool 2".
7. **Launches follow the crew.** Caps and singletons enforced by `session.launch`; an idle pool member returned for a `keep_context` pool; `per-item` sessions stopped after their merge; `subagents` in the role clauses; the Coordinator's clause launches Leads for the levels in `leads`. Demo: a review request while a Reviewer is idle reuses it; a third Reviewer launch with `size = 2` is refused.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo: the human accepts only the release (T-117), decision D16.

The human agrees with the Coordinator to set `leads = ["epic"]`. The Coordinator launches `lead-1` on a v0.1 epic. `lead-1` launches one Implementer per item, each stopping after its merge; it requests reviews from the Reviewer pool, which reuses an idle member; it merges its epic's items. An Implementer's question reaches `lead-1`, which answers it; another goes up to the Coordinator, which asks the human. A Reviewer launch beyond the pool's size is refused. The journal shows that the Coordinator received the epic's events, not its items'.

- [ ] The `lead` role exists; a Lead holds one node's lead claim; only the Coordinator launches Leads; the Coordinator's exclusivity covers the root only.
- [ ] Events, reports and verdicts about an item climb the lead chain through Leads; Lead sessions hold default subscriptions to their subtree, less the subtrees with their own leads.
- [ ] Asks go up one level at a time with a one-call forward; only the root's lead asks the human.
- [ ] A Lead's permissions stop at its subtree; the Coordinator keeps releases, sync, push, unscheduled merges and the launch of Leads.
- [ ] A handover moves a node's lead with its note.
- [ ] `crew.toml` is validated and reloaded on change; a broken file keeps the last good version in force, with a notice; `cland crew show` and `cland crew set` work.
- [ ] `session.launch` enforces `size` and singletons, reuses idle pool members with `keep_context`, and `per-item` sessions stop as `stop_after` says.
- [ ] `cland init` writes the default crew, and the sessions panel header shows its summary.
- [ ] `hub/README.md`, the role clauses and the `handover` and `merge` skills describe leads and the crew.

## Dogfooding

From this epic on, the build runs on its own `crew.toml`: per-item Implementers that stop after their merge, a Reviewer pool with kept context, and a QA singleton, the shape the v0 run practised by hand. Whether the remaining epics get epic Leads is the Coordinator's decision with the human, taken when the Coordinator saturates.

## Constraints

- **ADRs.** 0006 (The hierarchy is the item tree; leads are hub-held claims on nodes): the whole design, from routing to permissions per level. 0001 (Roles are hub-held state delivered as events): Lead is a role, and a handover moves with its note. 0007 (Events reach sessions as deliveries, digested at turn boundaries): Lead subscriptions. 0004 (Agents work on a local git territory): a Lead's merges pass the same gate.
- **Research.** `research/hierarchy-prior-art` (`docs/research/hierarchy-prior-art.md`, T-84): one supervising level is the norm, results come up summarised, caps belong in code. `research/coordinator-load` (`docs/research/coordinator-load.md`, T-82): the load that motivates Leads. `research/harness-teams` (`docs/research/harness-teams.md`, T-83): in-harness sub-agents stay inside a session and count to its cost, which `subagents` governs.
- **Risks** from the sizing: asks become agent-to-agent with forwarding, and subtree permissions need the item chain on every request path; pools and per-group lanes against per-item worktrees, since nothing yet moves a session between worktrees; `stop_after = "merge"` is process ownership.
- **References.** `PlanBefore.dc.html` and `PlanMidway.dc.html` in `docs/design/main-screen/` show a Lead in an epic's header. No mockup shows the crew summary, so the spec's words are the reference.
- **The v0 tail.** T-102 (process termination ownership outside the sweep) and T-79 (synchronous filesystem calls while spawning) touch this code. Neither is a prerequisite: the Coordinator takes one first only if it blocks this work; otherwise they carry `tech-debt`.
- **Order.** Fourth in the hub lane; it waits for "A quiet Coordinator" and "Criteria that live". "The epic plan" waits for it.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. Here the fake harnesses cover launches, pool reuse and stops.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.7 The hierarchy of sessions: leads on the item tree, §3.8 Crew configuration and session reuse; §3.9 (Defaults from the hierarchy).
- Map T-81: decisions T-89 and T-90; research T-82, T-83, T-84.
- GLOSSARY: Lead, Coordinator, Crew, Pool, Handover note, Role.
- ADRs: `docs/adr/0006-the-hierarchy-is-the-item-tree.md`, `docs/adr/0001-roles-are-hub-held-state.md`, `docs/adr/0007-events-reach-sessions-as-deliveries.md`, `docs/adr/0004-agents-work-on-a-local-git-territory.md`.
- Branches: `research/hierarchy-prior-art`, `research/coordinator-load`, `research/harness-teams`.
- Mockups: `docs/design/main-screen/PlanBefore.dc.html`, `PlanMidway.dc.html`.
