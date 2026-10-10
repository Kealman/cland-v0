---
id: T-142
kind: task
title: "Default subscriptions of leads: the Coordinator holds the tree less claimed items, an item's lead its item; death and long idle reach the node's lead or the next one up"
state: open
status: ready
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-140
  - T-141
topic: topic-70
branch: t/T-142-default-subscriptions-of-leads-the
created: 2026-10-10T01:52:19.101Z
updated: 2026-10-10T10:12:35.428Z
---

## Parent

T-108 (A quiet Coordinator), slice 5 of 6. Spec §3.9 (Defaults from the hierarchy), §3.7 (Regardless of hierarchy).

## What to build

Leads hold default subscriptions. The Coordinator holds the item tree less the claimed items; an item's lead holds its item. Each covers the states of the sessions working on its items (died, waiting for approval, idle longer than `idle_minutes`) and the task events of its items (verdict, status change, closed). A death or a long idle reaches the node's lead, or the next lead up when the lead itself is gone. Explicit subscriptions widen the defaults.

## Acceptance criteria

- [ ] A Reviewer stopped mid-review is reported to the item's lead at its next turn.
- [ ] A killed Implementer is reported to the Coordinator, the next lead up.
- [ ] Defaults follow claim changes: a newly claimed item leaves the Coordinator's default set and joins the claimant's.
- [ ] The inbox stays free of these events; `cland hub subscriptions` shows the defaults.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.

## Comments

### impl-142 · 2026-10-10T08:41:16.815Z

Implementing default lead subscriptions at the existing hub protocol seam. Scope stays in subscription/hygiene code; sessions.ts and adapters remain untouched. Baseline bd9ee7c includes event hygiene and item lead routing.

### impl-142 · 2026-10-10T08:53:29.697Z

Implemented and committed 0355a59: dynamic default subscriptions follow claims (including before first hello), pooled verifier holds, and offline Coordinator recovery; terminal events retain the existing atomic fan-out/checkpoint. Targeted ownership/lifecycle/long-idle/restart tests and typecheck pass. Full npm test and two-axis local review are running; no role/clause changes.

### impl-142 · 2026-10-10T09:01:34.938Z

Local Spec review found and reproduced two gaps: removed items lost final default events, and terminal recovery could send an older pooled Reviewer death to its already-dead lead. Both are fixed with regression coverage. Coordinator authorized an isolated Sessions.releaseInterruptedLaunches() startup seed plus HubCore.seedProcess(), and the existing subscription-hygiene crash-fixture arrangement (durable status setup, frame-history-only assertions). Existing item-lead tests now accept report digests; all ten pass.

### rev-67 · 2026-10-10T09:20:10.141Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-142-1
commit: 2ad3b1eb9d32f6a2ec92640c75e9bba50c32e530

Medium — hub/src/adapters/sessions.ts:673: pending-stop rows are excluded before seeding even after verified stop; an older Reviewer death is queued to the stopped Implementer instead of Coordinator while row removal remains pending.
Medium — hub/src/hub/core.ts:404: defaults consider only direct claims; an unclaimed child of a claimed container goes to Coordinator instead of its nearest ancestor lead, contrary to spec §3.9 subtree defaults.
Medium — hub/src/hub/core.ts:409: an anonymous claimant's name identity becomes shared UNKNOWN_SESSION; with Reviewer then Implementer anonymous hellos, the default and item status delivery belong to Reviewer instead of the claimant.

Standards: clear, 0 findings. Spec: not clear, 3 medium findings. Independently reproduced all three with Node24 pinned-source memory probes; ordinary defaults/recovery probes also passed. No file changes or suite repeat. Full evidence: A-523, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-523-t-142-completed-review-at-2ad3b1e-three-routing-gaps.md (supersedes preliminary A-522).

### impl-142 · 2026-10-10T09:22:36.836Z

Hub review A-523 found three medium ownership gaps: inherited claims on ancestors, verified-stopped leads with pending receipts during recovery, and anonymous hellos sharing an unknown recipient identity. Adding the three regressions at the established daemon/frame-history seam and fixing ownership as nearest live stable lead. The Coordinator requested withdrawal of the superseded queued suite; its runner has been terminated, and a fresh suite will be queued on the fix head.

### rev-67 · 2026-10-10T09:30:06.986Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-142-2
commit: 3bf53ca046a2c41ea66b379cfef38fd908f1d7d5

No high, medium or low findings remain. Standards: clear; Spec: clear. All three A-523 findings are fixed: ancestor/default ownership, published verified-stop receipt seeding, and distinct anonymous claimant identity. Root independently reran the original probes and ordinary full-item recovery/ownership probes against pinned 3bf53ca; all passed. Extended probes cover child subtree overrides, pooled grandchild holds, own idle/death to parent, terminal fallback and inherited final close; independent Spec pass checks unverified quarantine control. Prior full-item review carries forward with the complete revision diff checked. No edits or full suite repeat; full suite remains queued separately.

Evidence: A-531, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-531-t-142-full-item-review-at-3bf53ca-clear.md.

### impl-142 · 2026-10-10T09:44:29.374Z

Rebased cleanly onto root dev 10e25ba after fetching origin (both matched), as requested to include T-164's launch-notice fix. Pushed new head 5362c806491c445152dbaa6033d825f00a129d6f; range-diff shows the five patches preserved, with only upstream import context changed. Typecheck passes at the rebased head. Official Reviewer rev-67's full-item verdict was clear at prior 3bf53ca (A-531); the rebased head's npm test is queued once through the package runner behind the prioritized suites.

### rev-67 · 2026-10-10T09:49:45.684Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-142-3
commit: 5362c806491c445152dbaa6033d825f00a129d6f

No high, medium or low findings. Standards and Spec clear. Range-diff preserves all five cleared T-142 patches; only upstream agentsRecord import context differs. T-164's core/Session launch lifecycle notices and launchNotice:false clause logging do not alter claims, process seeding, default ownership, membership, workflow filtering or terminal recovery. Prior full-item A-531 clearance carries forward. Pinned hierarchy smoke probe at 5362c80 passes child overrides, pooled grandchild holds, own idle/death to parent, terminal fallback and final close. No edits or suite repeat; full suite separately queued.
Evidence: A-544, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-544-t-142-rebase-review-at-5362c80-clear.md.

### rev-67 · 2026-10-10T10:12:35.307Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-142-4
commit: b5d479ca017f04725763266e8250d14bf9fefc07

No high, medium or low findings. Standards: clear, 0 findings. Spec: clear, 0 findings. A-544 full-item clearance carries forward.

Pinned 5362c80...b5d479c changes only hub/test/agents-filters.test.ts (+9 −5), with no production changes. The added default task-status event belongs in Agents history under spec §3.9’s status-change subscriptions and ordinary deliveries plus v0’s Agents lifecycle record. Exact event text/alpha recipient are asserted. Latest-window, limit, item/session intersection, exact nonrecipient exclusions and MCP/history ID checks remain intact; indexes follow the added row. Whitespace check passes.
A-553 reports 2/2 affected tests and typecheck passing. No suite repeat or edits; fresh full-suite result separately pending.
Evidence: A-554, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-554-t-142-test-only-review-at-b5d479c-clear.md.
