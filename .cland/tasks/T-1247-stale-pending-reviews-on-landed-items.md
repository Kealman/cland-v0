---
id: T-1247
kind: task
title: Stale pending reviews on landed items keep every reviewer unassignable
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-989
branch: t/T-1247-stale-pending-reviews-on-landed-items
created: 2026-10-24T13:31:23.655Z
updated: 2026-10-24T14:14:59.917Z
closed: 2026-10-24T14:14:59.917Z
---

## Summary

P1 for crew throughput. At about 13:32Z on 2026-10-24, all four reviewers in the pool (rev-23, rev-26, rev-31, rev-32) showed `idle` with no holds, each still carrying a `pending` review for an item that had already landed: T-1030, T-1238, T-1211 and T-1232. At least six review requests waited unassigned: T-1214, T-1220, T-779, T-976, T-1149, T-1204 and T-1207, some for 30 or more minutes. Earlier the same day rev-26 sat idle with a stale pending for T-1227 after it landed. A reviewer that took a request outside assignment then could not record its verdict, because the request had not been delivered to it. A stale pending on a closed or merged item appears to count as "busy" for verifier assignment, so the queue stalls with every reviewer free. Coord worked around it by having leads resend requests by name.

## Acceptance criteria

- [x] C1. When an item closes or lands, every pending review or QA request for it is cleared from its verifier, and the verifier becomes assignable at once (test).
  - done: impl-1247 · 2026-10-24T13:38:11.099Z
  - verified: rev-23 [reviewer] · run rev-20261024-1247-final · 2026-10-24T14:05:52.571Z · commit 8e9ab922f09fbca394ba7000659b4a8aeba0dc12
- [x] C2. A free verifier with no hold takes the oldest queued request even when it carries a stale pending; a stale pending never blocks assignment (test).
  - done: impl-1247 · 2026-10-24T13:38:11.216Z
  - verified: rev-23 [reviewer] · run rev-20261024-1247-final · 2026-10-24T14:05:52.571Z · commit 8e9ab922f09fbca394ba7000659b4a8aeba0dc12
- [x] C3. `who` and the queue show a pending only while its item is open (test).
  - done: impl-1247 · 2026-10-24T13:38:11.551Z
  - verified: rev-23 [reviewer] · run rev-20261024-1247-final · 2026-10-24T14:05:52.571Z · commit 8e9ab922f09fbca394ba7000659b4a8aeba0dc12

## Comments

### impl-1247 · 2026-10-24T13:34:04.433Z

RED: node --test hub/test/verifier-routing.test.ts on the current uncommitted test tree, local macOS targeted T2 (no suite gate): 11 pass, 2 fail. Both new review/QA closure regressions leave oldest queued request addressed to its role; expected ['verify-a'], actual ['reviewer'] / ['qa']. Pending metadata has no item lifecycle cleanup and sessionPending does not validate current item state.

### impl-1247 · 2026-10-24T13:38:24.905Z

Implemented and pushed 8e9ab922f09fbca394ba7000659b4a8aeba0dc12 on t/T-1247-stale-pending-reviews-on-landed-items. C1–C3 done; source review requested from reviewer in topic-989 at 13:38Z and queued awaiting a free verifier. Local macOS targeted T2 verifier-routing: 16/16; T1 documentation: 3/3; hub typecheck passed. Test lint exit 0 in report mode (133 repository findings, 0 refusals; not an enforcement pass). Full mode-free verification awaits source verdict. Evidence artifact A-11094.

### rev-23 · 2026-10-24T13:46:35.072Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1247-source
commit: 8e9ab922f09fbca394ba7000659b4a8aeba0dc12
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1247 full source review — clear

Head8e9ab922f09fbca394ba7000659b4a8aeba0dc12/treea48c08e8e5740662cf763b32df0b397af4bc2b30; branch ref independently matches. Fixed base/sole parent847b7c2839a504c58c17ec46410363b6faabe8da; git diff847b7c28...8e9ab922, one commit8e9ab922, seven files138additions5deletions. Named fallback from live claimant accepted after queued role request; free hold rev23. Scope full, run rev-20261024-1247-source. Both axes in-session per reviewer.subagents=false. Reviewer read-only source/Git/tracker/docs/artifact inspection only; no tests/probes/edits/Git mutation/browser/delegation.

## Standards
No findings. Lifecycle publication enumerates only pending-verification metadata and removes every same-item key before post-commit verifier-queue draining, including disconnected sessions. Store helper keeps SQL/key discovery in Store. Closing/removal schedules work-view refresh; existing transaction afterCommit keeps queue delivery after durable publication. sessionPending defensively clears closed/missing legacy entries using tracker.itemLead's current indexed state; all role-routing/pool/session-view readers already call this shared boundary. Late delivered/accepted closed-item messages cannot reintroduce pending metadata. Existing open-item uncertain reservations, holds, queued progress and affinity logic are unchanged; no permission/role/protocol/dependency change.

New regressions use existing T2 projectHub/FakeClock/in-process sockets and semantic merge-component Tracker.finishMerge seam, no native Git/harness or timing assertions. Two verifiers each receive old pending work, two role requests queue, closure immediately assigns oldest then later in deterministic verifier order for Reviewer and QA. Exact message delivery barriers precede pending-view assertions. Landing-finalization control disconnects the verifier before finishMerge, reopens and reconnects same identity, proving durable deletion rather than merely suppressing a closed-item view. Legacy restart cases stop original hub writers/peer before opening a raw SQLite connection, close it in finally, restart and check absent stale who/session.list state and oldest queued delivery. Existing fixture lifecycle ownership is retained. No existing test assertion/bound relaxed.

Exact path-derived guide '# hub/test/verifier-routing.test.ts' and index row describe these seams, stopped-writer seeding, late-delivery and open-uncertain controls. Tracker and hub docs describe actual open/closed/missing lifecycle rather than implying history reconstruction. Whitespace clean; no material baseline-smell finding.

## Spec
C1 source established: item close/removal publishes cleanup for every matching durable reservation; Tracker.finishMerge emits the same closed-item path. Closed-to-reopen cannot restore deleted disconnected reservations. Queued requests are retried through existing afterCommit drain, not a polling delay. C2 source established: stale legacy pending read returns absent, so requestVerifier and Sessions free-pool checks can select idle/unknown unheld verifiers and retain ordered queued processing. Known open pending/uncertain input remains reserved. C3 source established: shared sessionPending reader feeds who/presence/process/session rows and pool/staffing; closed/missing is omitted and deleted. The new tests assert who, session rows, assigned queue destinations and closed late acceptance. No functional finding or scope expansion.

All C1–C3 are test-based and remain runtime-unverified until fresh configured evidence at this exact head. Current done marks present. A-11094 supplies summary-level local macOS pre-source-review working-tree diagnosis/red-green: closure destination oldrole vs expectedverify-a, legacy oldT1pending vs absent/newT2pending, and lifecycle-removal-negative reopen resurrection; targeted routing16/16, docs3/3 and hub-onlytypecheckexit0. It does not preserve complete original tool outputs/exits/native per-case timings, and is not a configured gate. Preserve available originals with exact source/platform limits and explicit gaps, no reruns for transcription or inferred fullcheckwall.

Clear source permits ordinary configured mode-free verify at unchanged8e9ab922, reporting original run/log/head/executor/platform/actual selected phases and timing. No forced full suite/new load probe, item QA(none), stage/landing/alltier claim. Coordinator owns enqueue/merge. Standards0 findings; Spec0 findings.

Durable A-11115.

### rev-23 · 2026-10-24T14:05:52.571Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1247-final
commit: 8e9ab922f09fbca394ba7000659b4a8aeba0dc12
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1247 final same-head evidence — clear

Head 8e9ab922f09fbca394ba7000659b4a8aeba0dc12; tree a48c08e8e5740662cf763b32df0b397af4bc2b30. Branch ref independently matches. Carry full source rev-20261024-1247-source/A-11115. Scope evidence, run rev-20261024-1247-final; findings []; C1–C3 verified. Reviewer read-only source/Git/tracker/artifact/log inspection, no tests/probes/edits/Git mutation/browser/delegation.

Original configured mode-free a087171e-b19e-46bf-842a-abcbfa3de76c/A-11153 finishes exit0; task.view independently agrees passed exact head. Native finishes 2995 ordinary test/425 file passes, zero failure/cancellation/skip, plus25 separate load-gate test/file passes (five new T2 identities each5/5). Actual hostT0, allT1(137 files876 top-level identities), fallback all hub/NeovimT2(243/1783), mapped T4 inbox-verifier-load one identity once/no repetitions, fullWeb44 files225 top-level identities. NoT3 command, remainingT3 deferred; mapped guard is not fullT4/nightly/stage/QA cover.

C1: landing finalization/disconnected-verifier/reopen persistence control ordinary0.334578171s,5/5 max0.323319214s; close-all Reviewer ordinary0.363770904s,5/5 max0.570510579s; close-all QA ordinary0.306967077s,5/5 max0.516155764s. The latter two each reserve two peers, queue two requests, close old item and assert immediate oldest/later assignment plus exact accepted delivery and new pending identities. Late closed-item delivery does not recreate pending. Source clears disconnected durable keys before postcommit queue drain, matching tested lifecycle.

C2/C3: legacy restart absent-from-who/session rows ordinary0.275541903s,5/5 max0.413954388s; stale legacy cannot block oldest queued review ordinary0.264927943s,5/5 max0.496214500s. Stopped-writer SQLite seed reproduces pre-fix persisted state; restart and message acceptance precede final assertions. Source also treats missing items as absent and all staffing/work-view readers share the guard; no missing-item runtime case falsely claimed. All new observations under2sT2, no allowance needed. Existing uncertain-open-item pending/pool reservation and held-progress/restart controls pass, so closed-item repair does not erase live verification ownership. Full routing file16/16 passes.

Mapped T4 '100-frame verifier delivery bursts never scan retained message history' passes1.333875346s, one base execution. Selected-phase addedwall2.380s excludes machine wait; file2.206615933s and phase suite2.43s are distinct. NoT4 repetitions or broader load enforcement claim.

Hostcheck25.641s exits0; marker fb9bb33350db7b321bad4a58b50493ac085ac13e independently Git tree, retained host gate not repeated remotely. T1/T2/T4/Web envelopes69/386/7/166s differ from suites64.01/381.47/2.43/160.58s and shards63.99/285.31hub+96.11Neovim/2.42guard/160.46Web. T2 reports8.47s load-gate extra wall, not assertion duration. Final Webprojection150.266s at2workers is not actual wall at4workers. Linuxx64 6.8.0-142-generic,c-8lon1 cland-v0-710ce6ee,Node24.21/Nvim0.12.5,workers2/Web4,lifetime735s/$0.0510;diskfsync9.14ms/SQLite12ms,tmpfs0.09/0.55ms,iowait0.01%/steal0%.

Retain report-only lint133/60,one missing baseline and Web/shell/items/inbox/connection/scale/render/smoke overages. Webwall160.58>40s,items50.282s,inbox42.773s. Ratchet2195.304s unchanged. Not an enforcing-budget/clean-lint clearance. A-11094 local macOS red/green/check summary remains limited targeted working-tree evidence, original tool output retained by claimant; no complete local artifact/native timing or inferred checkwall manufactured, no transcription reruns.

Fresh claimant conflict receipt69af88c8: fetched dev34475b5c4a9cce1c67eaadea006c9f2e40b333c0 with no-auto-maintenance, merge-tree exit0/prospective7a7809085362f947d36b799369007d23aed83ca9; clean unchanged head/no dev merge. Current done marks C1–C3 present. No item QA(none); final source/runtime settled only at this head. Coordinator owns enqueue/merge and any running-hub rollout; no landing/restart claim by reviewer. Standards0 findings; Spec0 findings.

Durable A-11160.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-24T14:14:59.917Z

Merged ed314b768e4bc388f31f1ca1b39b5ea7a3383cd1 onto dev.
