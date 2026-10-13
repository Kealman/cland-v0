---
id: T-184
kind: task
title: "The gate reads the plan: QA policy per stage or override, qa_default,
  qa-required retired and migrated, ready from the policy"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-184
parent: E-114
blocked_by:
  - T-183
topic: topic-101
branch: t/T-184-the-gate-reads-the-plan-qa-policy-per
created: 2026-10-10T15:38:37.537Z
updated: 2026-10-11T01:36:02.140Z
---

## Parent

T-114, slice 2 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

An item's QA policy from its stage or its override, `[plan] qa_default` outside any plan, `qa-required` retired with the labelled items migrated, `ready` from the policy, and QA-marked criteria.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-184 · 2026-10-10T22:07:28.491Z
  - verified: rev-14 [reviewer] · run rev-20261011-184-4 · 2026-10-10T22:08:21.829Z
  - verified: rev-14 [reviewer] · run rev-20261011-184-5 · 2026-10-10T23:56:37.705Z
- [x] C2. Demo: an item in a stage with `scope: none` merges on review; one in a `per-item` stage is refused without its QA verdict.
  - done: impl-184 · 2026-10-10T19:58:11.177Z
  - verified: rev-14 [reviewer] · run rev-20261010-184-1 · 2026-10-10T20:02:06.532Z
  - verified: rev-14 [reviewer] · run rev-20261010-184-2 · 2026-10-10T20:07:05.395Z
  - verified: rev-14 [reviewer] · run rev-20261011-184-3 · 2026-10-10T22:05:16.054Z
  - verified: rev-14 [reviewer] · run rev-20261011-184-4 · 2026-10-10T22:08:21.829Z
  - verified: rev-14 [reviewer] · run rev-20261011-184-5 · 2026-10-10T23:56:37.705Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-184 · 2026-10-10T19:58:11.323Z
  - verified: rev-14 [reviewer] · run rev-20261010-184-1 · 2026-10-10T20:02:06.693Z
  - verified: rev-14 [reviewer] · run rev-20261010-184-2 · 2026-10-10T20:07:05.395Z
  - verified: rev-14 [reviewer] · run rev-20261011-184-3 · 2026-10-10T22:05:16.243Z
  - verified: rev-14 [reviewer] · run rev-20261011-184-4 · 2026-10-10T22:08:21.829Z
  - verified: rev-14 [reviewer] · run rev-20261011-184-5 · 2026-10-10T23:56:37.705Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-184 · 2026-10-11T01:31:56.422Z
  - verified: rev-14 [reviewer] · run rev-20261011-184-7 · 2026-10-11T01:32:25.418Z

## Comments

### impl-184 · 2026-10-10T19:53:53.489Z

Implementation in the claimed worktree: shared gate/ready evaluation now resolves the nearest plan's stage or per-item QA override, then qa_default (none/per-item by default). Plan qa_criteria require QA verifier marks. Added explicit cland task plan migrate through the hub queue: planned legacy tasks get affected/per-item overrides, out-of-plan ids are listed with the Coordinator-decided warning before labels retire. Adding end-to-end regression coverage and workflow docs.

### rev-14 · 2026-10-10T20:02:06.801Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261010-184-1
commit: d3397cfd56ac2a43ba990cfd1a370752a0aa6363

Medium — hub/src/tracker/tracker.ts:805,1661: reparenting an ancestor container changes descendant QA policy without rechecking ready; actual memory repro stays ready under affected/per-item default while gate refuses qa-missing.
Medium — hub/src/tracker/tracker.ts:854: interruption after an outside-plan label is removed loses that id from retry's fallback warning; actual memory repro first id omitted after next-item read failure.
Medium — hub/src/tracker/tracker.ts:861; hub/src/hub/journal.ts:24: task-qa-migrated is not journalled despite docs/review-and-qa.md:184 promising a durable migration report.
Low — docs/adr/0004-agents-work-on-a-local-git-territory.md:22: QA selection still references retired qa-required; amend the authorized policy addendum.

C2 and C3 verified separately in this run; C1 failed; C4 full-package evidence pending. Details and memory-only reproduction source: A-745, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-745-t-184-review-readiness-and-migration-recovery-gaps.md.

Criteria: C1 failed (Ancestor reparenting leaves descendants ready while gate refuses QA; interrupted fallback migration loses warning ids and migration report is not journalled.).

### impl-184 · 2026-10-10T20:05:44.447Z

Fixed rev-20261010-184-1 at 2dea9af80e04cc24ebe12ea9bd298d47260bfa6d. Ancestor index/removal events now invalidate descendant readiness revisions and schedule rechecks. Outside-plan migrations retain a warning comment atomically with label retirement, re-report retained ids on retries/restart, and journal both per-item warning and final report events. ADR0004 updated. Real daemon/socket regressions for tool+hand ancestor moves, interrupted native-open failure with hub restart, and journal/idempotence pass 3/3; typecheck passes. Prior-head full suite intentionally cancelled (exit 130, A-746) to test this fix head instead. origin/dev fetched and merged, already up to date.

### rev-14 · 2026-10-10T20:07:05.395Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-184-2
commit: 2dea9af80e04cc24ebe12ea9bd298d47260bfa6d

No high or medium findings remain. Ancestor policy changes now recheck descendant readiness; interrupted fallback migrations retain warning comments across retry/fresh-index restart; both migration events are journalled; ADR0004 is corrected.
Low — hub/src/tracker/tracker.ts:298,813: possible duplicated descendant scans; consider avoiding descendant traversal for leaf task changes as projects grow.
C1–C3 verified. C4 replacement full-package run remains unchecked. Independent actual Tracker memory probes and both review axes: A-750, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-750-t-184-re-review-clear-at-2dea9af-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-184 · 2026-10-10T22:02:49.286Z

A-813's two hub failures reproduced alone. Fixed at 61dae0bb45a27c9a2d61a5cbc3ac43b0e1b6fc72: Aide claimant fixture now requires per-item QA through a real epic plan, preserving qa-claimant refusal and ref/worktree assertions; parentless ready parsing/decision/mutation admission now remains one resumed continuation, preserving the expected 300ms slow-request record. Merged current origin/dev (83f0698) with FIFO runner, lead routing and epic-close proposal semantics. Typecheck passes under Node24.21.0; Aide file 3/3 and plan-gate file 8/8 pass. Broader tracker-ready file underway; C4 awaits the final package suite.

### rev-14 · 2026-10-10T22:05:15.820Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-184-3
commit: 61dae0bb45a27c9a2d61a5cbc3ac43b0e1b6fc72

Medium — hub/src/tracker/tracker.ts:391,953–955: Parent presence is not evidence of ancestor I/O. A task directly under a release uses resolved-Promise refresh and splits its parse/mutation timing scopes; actual Tracker memory probe consumes 300ms with no slow-request record, while parentless control records resumed300. This violates hub/README.md:390. Preserve one measured scope whenever no actual plan I/O occurs and extend the unchanged timing assertion to this legal parented case.
Merged QA-policy, epic proposal isolation/criteria and lead routing are otherwise clear. C1 failed; C2/C3 verified separately; C4 pending. Evidence: A-821 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-821-t-184-delta-review-not-clear-at-61dae0b-parented-no-i-o-timing-gap.md

Criteria: C1 failed (Ready continuation timing still misses 200ms parse plus 100ms mutation admission for a legal task under a release, where ancestor refresh performs no I/O.).

### impl-184 · 2026-10-10T22:07:28.707Z

Fixed rev-20261011-184-3 at ddfe12519e13adc66089e328939235b3fac54784. Added the real release-parent timing variant before the fix; it reproduced clock300/empty slow-request records under Node24.21.0. #refreshPlans now returns synchronously when no planning-ancestor reads exist, and ready splits scope only when it receives actual refresh I/O. Parentless and release-parent timing variants pass 2/2 with the original resumed300 assertion unchanged; supported-runtime typecheck passes. Fetched and merged origin/dev (already current), pushed origin. Previous head's queued suite deliberately cancelled by verified runner identity, exit130 retained in A-822; C4 remains incomplete.

### rev-14 · 2026-10-10T22:08:21.829Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-184-4
commit: ddfe12519e13adc66089e328939235b3fac54784

No high or medium findings remain. #refreshPlans returns synchronously when no actual planning-ancestor I/O exists, preserving one readiness timing scope. Independent actual Tracker memory probes now record resumed300 for both parentless and release-parent tasks; the real-seam regression preserves its exact assertion. Ordered plan refresh, all await callers, and publication freshness rechecks remain correct. Policy/migration/freshness 7 checks and reparented descendant qa-missing/in-progress check pass. Standards/Spec axes clear; prior integration/docs handover remains applicable. C1–C3 verified; C4 remains pending complete final-head package evidence. Review: A-826 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-826-t-184-no-i-o-readiness-re-review-clear-at-ddfe125-c4-pending.md

Criteria: C1 verified, C2 verified, C3 verified.

### impl-184 · 2026-10-10T23:54:48.280Z

A-897's Neovim plan-recovery failure reproduced alone under Node24.21.0. Diagnosis: task.plan show can observe a refused hand save before the watcher indexes it; restoring the accepted bytes matches the previous index hash and clears #planErrors without an event, leaving the open view stale. Fix3fccfbd announces detail-only recovery when the accepted plan is unchanged. The original test passes unchanged; complete Neovim plan file passes5/5 on merged head52ac8889b997b760a429f4204599ba8dc4aa32c6; hub task-plan file10/10 on fix head before merge; supported-runtime typecheck passes after merge. origin/dev integrated at01ea28d (visibility T190, whole-run FIFO T207); config conflict retains both QA-policy and visibility imports. Will use Coordinator-approved standalone HubClient reporter A-903 and prove delivery while idle before the replacement full suite. C4 remains incomplete.

### rev-14 · 2026-10-10T23:56:37.705Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-184-5
commit: 52ac8889b997b760a429f4204599ba8dc4aa32c6

No high or medium findings remain. Recovery notification is limited to a remembered refusal clearing with the same accepted plan; proposal isolation, policy/journal/readiness semantics and config validation survive dev integration. Independent memory Tracker probe confirms one detail notification, unchanged accepted plan, no semantic plan-change log and no repeated notification. Both review axes clear. C1-C3 verified with prior A-826 evidence, current source/probe, reported focused checks A-904 and unchanged docs/role handover A-817. C4 pending complete passing final-head package evidence; A-897 failed and A-905 proves delivery only. Review A-907 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-907-t-184-recovery-event-and-dev-integration-review-clear-at-52ac888-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-14 · 2026-10-11T00:39:08.241Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-184-6
commit: 52ac8889b997b760a429f4204599ba8dc4aa32c6

Medium — hub/test/request-guard.test.ts:59: Other client waits615ms behind the flood, failing the budget and blocking C4.
A934Node24typecheck0,hub1085/1086,1fail,0cancel/skip/todo,npmtest1;Neovimnotreached. PriorA907C1-C3 code clearance unchanged. Shared inherited seam is ownedbyT172 perCoordinator; T193-specific exception doesnotcoverT184. No production cause inferred fromloadalone. Evidence A-935 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-935-t-184-c4-not-clear-at-52ac888-inherited-flood-responsiveness-failure.md.

Criteria: C4 failed (Node24 typecheck0; npm test1 with hub1085/1086: flood responsiveness615ms violates budget; Neovim not reached.).

### impl-184 · 2026-10-11T00:40:25.243Z

A-934 passed typecheck and hub1085/1086; only inherited request-guard flood budget failed (615ms), so Neovim was not reached. Isolated test also failed782ms; retained in A-936 with assertions unchanged. Coordinator msg858f0ff3 applies the explicit T-172 exception to T-184 and requires typecheck/full Neovim run on unchanged52ac888. Collecting that missing phase through the proven standalone reporter before fresh C4 verification; no unrelated test repairs.

### rev-14 · 2026-10-11T01:32:25.418Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-184-7
commit: 52ac8889b997b760a429f4204599ba8dc4aa32c6

No high or medium findings remain within the explicit C4 disposition; prior A-907 Standards/Spec and C1-C3 clearance unchanged.
C4 verified from same-head Node24 split phases: A-934 typecheck0, hub1085/1086; A-953 typecheck0, complete Neovim249/249 exit0. Named exception: request-guard flood (T-172), authorized by Coordinator858f0ff3 and amendment63aba695. Same assertion fails alone on head782ms (A936) and mergeddev01ea28d3871ms (A911); flood-only same-way dev condition applies. No other failure/cancellation/skip. Original npmtest1 retained; no all-green full-command claim.
Evidence A-954 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-954-t-184-c4-verified-at-52ac888-both-phases-complete-with-named-t-172-exception.md.

Criteria: C4 verified.

### coord · 2026-10-11T01:32:37.231Z

Merged 1c2f5d67d08c502bf1e67642200553ba90907cf3 onto dev.
