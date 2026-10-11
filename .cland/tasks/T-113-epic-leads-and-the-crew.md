---
id: T-113
kind: epic
title: "Epic: Leads and the crew"
state: open
criterion_seq: 9
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: T-130
blocked_by:
  - T-112
topic: topic-123
branch: null
created: 2026-10-09T21:51:34.152Z
updated: 2026-10-11T08:28:14.576Z
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

- [ ] C1. The `lead` role exists; a Lead holds one node's lead claim; only the Coordinator launches Leads; the Coordinator's exclusivity covers the root only.
  - verified: qa-17 [qa] · run qa-2026-10-11-17 · 2026-10-11T08:28:14.575Z
- [ ] C2. Events, reports and verdicts about an item climb the lead chain through Leads; Lead sessions hold default subscriptions to their subtree, less the subtrees with their own leads.
  - verified: qa-17 [qa] · run qa-2026-10-11-17 · 2026-10-11T08:28:14.575Z
- [ ] C3. Asks go up one level at a time with a one-call forward; only the root's lead asks the human.
  - verified: qa-17 [qa] · run qa-2026-10-11-17 · 2026-10-11T08:28:14.575Z
- [ ] C4. A Lead's permissions stop at its subtree; the Coordinator keeps releases, sync, push, unscheduled merges and the launch of Leads.
  - verified: qa-17 [qa] · run qa-2026-10-11-17 · 2026-10-11T08:28:14.575Z
- [ ] C5. A handover moves a node's lead with its note.
  - verified: qa-17 [qa] · run qa-2026-10-11-17 · 2026-10-11T08:28:14.575Z
- [ ] C6. `crew.toml` is validated and reloaded on change; a broken file keeps the last good version in force, with a notice; `cland crew show` and `cland crew set` work.
  - verified: qa-17 [qa] · run qa-2026-10-11-17 · 2026-10-11T08:28:14.575Z
- [ ] C7. `session.launch` enforces `size` and singletons, reuses idle pool members with `keep_context`, and `per-item` sessions stop as `stop_after` says.
  - verified: qa-17 [qa] · run qa-2026-10-11-17 · 2026-10-11T08:28:14.576Z
- [ ] C8. `cland init` writes the default crew, and the sessions panel header shows its summary.
  - verified: qa-17 [qa] · run qa-2026-10-11-17 · 2026-10-11T08:28:14.576Z
- [ ] C9. `hub/README.md`, the role clauses and the `handover` and `merge` skills describe leads and the crew.
  - verified: qa-17 [qa] · run qa-2026-10-11-17 · 2026-10-11T08:28:14.576Z

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

## Comments

### coord · 2026-10-11T08:25:23.909Z

Blocker T-108 removed (Coordinator, 2026-10-11 08:25Z). T-113 depended on T-108 through T-143 (the item loop), which merged on 2026-10-10. T-108's remaining open items, T-189 (the loop-demo rerun) and T-199 (single-verifier routing), are not prerequisites for Leads and the crew.

### qa-17 · 2026-10-11T08:28:14.576Z

verdict: qa
result: clear
by: qa-17 [qa]
run: qa-2026-10-11-17
commit: 8667214c05ad888cc8cb502c04a3739d0d02fb51

| Case | Surface | Result | Observation and evidence |
| --- | --- | --- | --- |
| M0 | hub-api | PASS | Original seven children and T-112 closed; T-130 release. Stale T-108 prerequisite corrected by Coordinator. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M0.txt) |
| M1 | hub-api | PASS | Lead claim at project root; no task worktree. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M1.txt) |
| M2 | hub-api | PASS | Duplicate node, task node and unknown node refused; second epic Lead allowed. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M2.txt) |
| M3 | hub-api | PASS | Lead cannot launch Leads; second Coordinator refused. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M3.txt) |
| M4 | hub-api | PASS | lead-launch: 5/5 tests. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M4.txt) |
| M5 | hub-api | PASS | lead-routing 3/3 and item-lead 10/10; blocked reports, ready and lifecycle routing. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M5.txt) |
| M6 | hub-api | PASS | Reparent removes T-5 from lead-1 subscriptions and adds it to lead-2; verdict targets lead-1. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M6.txt) |
| M7 | hub-api | PASS | In-subtree Implementer launch succeeds; foreign launch/stop/merges refused with level and node. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M7.txt) |
| M8 | hub-api | PASS | Push/release/sync root-only; in-subtree merge reaches ordinary review-role gate. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M8.txt) |
| M9 | hub-api | PASS | lead-permissions: 5/5, including successful gated merge. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M9.txt) |
| M10 | hub-api | PASS | Claim/note move to lead-next; after impl-4 stop, next verdict targets successor. T-217 separate finding. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M10.txt) |
| M11 | hub-api | PASS | lead-handover: 4/4, including note/subscriptions, rename, restart and crash recovery. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M11.txt) |
| M12 | hub-api | PASS | ask-chain: 10/10; assertions read for unchanged forward, waitingFor, inbox and identity refusals. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M12.txt) |
| M13 | hub-api | PASS | Scratch inbox: needs you 0. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M13.txt) |
| M14 | hub-api | PASS | Valid crew edits persist; invalid size/key/stop_after leave bytes unchanged; per-group accepted. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M14.txt) |
| M15 | hub-api | PASS | Broken crew retains last good; crew.set refuses; restore reloads; refusal notice captured in hub.log. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M15.txt) |
| M16 | hub-api | PASS | crew: 3/3 tests. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M16.txt) |
| M17 | hub-api | PASS | Fresh init writes flat defaults and Lead role; crew nonignored; second init unchanged. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M17.txt) |
| M18 | headless-grid | PASS | Real scratch hub + headless Neovim: header pool 2→1, broken edit retains 1, restore 2. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M18.txt) |
| M19 | hub-api | PASS | Reviewer cap 2, QA singleton; stopping a member frees its slot. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M19.txt) |
| M20 | hub-api | PASS | Idle rev-1 reused with same PID/sessionId for T-5; keep_context=false cannot bypass full cap. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M20.txt) |
| M21 | hub-api | PASS | crew-launch 4/4 and launch-admission 16/16; merge-stop, concurrent reservations and clauses. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M21.txt) |
| M22 | hub-api | PASS | README, default/generated clauses, handover and merge skills describe hierarchy and staffing. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M22.txt) |
| M23 | hub-api | PASS | Counted journal routing: four T-4 task deliveries to leads/claimant, zero to Coordinator; Lead stop reaches Coordinator. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M23.txt) |
| M18-test | headless-grid | PASS | Committed real-hub Neovim crew test: 1/1. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M18-test.txt) |
| M0-correction / M0-resolved | hub-api | Resolved | Initial M0 note incorrectly said T-108 closed. Captured JSON showed open; correction preserved, then Coordinator removed obsolete prerequisite. [correction](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M0-correction.txt), [resolution](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M0-resolved.txt) |
| D1 | deferred | BLOCKED | Deferred to v0.1.1 under D19. [scope](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/D1.txt) |
| D2 | deferred | BLOCKED | Deferred to v0.1.1 under D19. [scope](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/D2.txt) |
| D3 | deferred | BLOCKED | Deferred to v0.1.1 under D19. [scope](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/D3.txt) |
| D4 | deferred | BLOCKED | Deferred to v0.1.1 under D19. [scope](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/D4.txt) |
| D5 | deferred | BLOCKED | Deferred to v0.1.1 under D19. [scope](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/D5.txt) |

Findings, ranked by severity:

- **Medium — T-217, M10:** after `role set lead-next lead --item T-2 --note-file note.md`, `session launch lead-next --role lead --item T-2 --harness claude-code` refuses because T-2 is already claimed by lead-next. An unseen successor cannot be launched on the node it received. Coordinator filed T-217 and explicitly scoped C5 to claim, note and routing transfer, which passed; the launch edge case remains a separate follow-up. No fix made.
- **Low — brief corrections:** M0's T-108 closure prerequisite was obsolete; Coordinator removed it and required the original seven children plus T-112. Missing criterion ids will be stamped positionally C1–C9 by the structured verdict, per Coordinator instruction. M10 must stop the active Implementer before testing parent-Lead delivery; its own item claim otherwise receives the verdict correctly. Stopping preserves the durable claim but ends active routing ownership. M6's actual journal event is `event-delivery`. M15's `crew-refused` with Agents notice id is in `.cland/log/hub.log`, not the journal event filter. M19 rev-1 already exists from setup; its duplicate launch is correctly refused.

Verdict: **clear for the corrected scope**, with no failed criteria. All 24 manual cases passed under the Coordinator's corrections. Ten named test files ran one at a time: **61 passed, 0 failed, 0 skipped**. M18 used one pinned headless Neovim against the actual scratch hub, driven via `nvim_input` and read with `screenstring()`; the committed crew UI test independently passed. SHELL-001 was conditional on using --qa; direct headless driving was used, so it was not applicable. No full suite was requested or run.

Build: root dev **8667214c05ad888cc8cb502c04a3739d0d02fb51**, unchanged from first check to final validation; tracked edits remained confined to live .cland tracker state. Run: **qa-2026-10-11-17**. Scratch project and fake harness had independent hub/identity environment. All scratch sessions and hub stopped; scratch directories removed after durable captures. [Cleanup](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/cleanup.txt).

Criterion marks: **C1,C2,C3,C4,C5,C6,C7,C8,C9 verified**; failed: none. Mapping: C1 M1–M4; C2 M5/M6/M23; C3 M12/M13; C4 M7–M9; C5 M10/M11; C6 M14–M16; C7 M19–M21; C8 M17/M18; C9 M22. Original children were closed at start; T-217 was newly filed during this run and remains Coordinator follow-up.

Journal event-delivery counts before cleanup: lead-1 / task T-4 = 1; impl-4 / task T-4 = 2; lead-next / task T-4 = 1; lead-next / impl-4 stop = 1; Coordinator / Lead-2 stop = 1; Coordinator / T-4 task = 0. M5 independently proves ready and escalation paths. [Counted journal](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-113/qa-2026-10-11-17/M23.txt).

**Deferred to v0.1.1:** D1 real-model autonomous Lead workflow; D2 natural-language question/human-answer chain; D3 real-session stop and useful retained review context; D4 quality of a model-drafted handover note; D5 real-terminal readability. Recorded BLOCKED, exempt from the verdict under D19. None is the sole proof of a criterion.

Executed using the [qa skill](/Users/evgeniyivanov/Projects/cland/v0/.agents/skills/qa/SKILL.md). Every case has a qa-record.sh line in .cland/qa/runs.jsonl; original records and corrections remain intact.

Report artifact: A-1132, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1132-t-113-qa-clear-leads-and-crew-epic-demo-61-tests.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.
