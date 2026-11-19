---
id: T-2004
kind: task
title: A status-changing comment on a planned-stage item blocked the hub loop for about 19 s after a 1,627-item explorer refresh
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1656
branch: t/T-2004-a-status-changing-comment-on-a-planned
created: 2026-11-19T10:54:30.279Z
updated: 2026-11-19T14:58:14.662Z
---

## Summary

Hub pid 72462 (db53a0cb9, restart #87) blocked its event loop for about 19 s at 10:52:33Z on 2026-11-19, ending in tracker-storage-stalled at 10:52:52.376Z and a 23,146 ms `task.comment`. The call was rev-39's small not-clear verdict on T-1728 (about 2.4 KB body), which also marked C1 failed and moved the status from review to in progress. In hub.log (read by v0-6a; hub.db untouched): a stage-ancestry visit for head 3ead64f1a at 10:52:32.204Z; the comment starts at 10:52:32.785Z; explorer-recomputed for 1,627 items at 10:52:33.034Z (durationMs 9.6); then no line at all until 10:52:52.363Z. The recompute itself is fast, so the 19 s went into synchronous work after it, possibly announce or stage-cover dependents for E-1883's plan stage. A second stage-ancestry visit at 10:52:55Z didn't block.

## What to build

Name the owner of the 19 s synchronous block with a CPU profile or per-step timings on a fixture that reproduces a status change on a planned-stage item at production scale. Then make that path bounded or yielding, as T-1952 did for the freshness announcements.

## Acceptance criteria

- [x] C1. The blocking owner is named with evidence: a profile or per-step timing on a fixture that changes a planned-stage item's status with a status-and-verdict comment at about 1,650 items (evidence).
  - done: impl-2004 · 2026-11-19T11:28:32.246Z
- [ ] C2. On that fixture, a `task.view` request issued during the status change answers within 2 s, red on the current code (test).
  - failed: rev-36 [reviewer] · 2026-11-19T14:58:14.662Z · note Required configured round failed on an attributed startup explorer work-bound compatibility control; same-fixture row measurements and correction or justified migration remain required, although the own two-second latency assertion passed.

## Comments

### impl-2004 · 2026-11-19T11:17:00.554Z

Consumer inventory before finalizing publication path: Tracker.#announceBatch callers are Freshness settled and #tipsMoved. Tracker.onChange consumers: hub/server (publishTask with publishTaskBatch wrapper), hub/dispatch (presence/work), hub/merge-queue (reconcile), adapters/sessions (verifier/claim ownership), and tracker/component tests. Frame consumers searched by task, layers, frame/event type and publication function names across hub/src, web/src, nvim/lua, shared/wire, hub/mod, all hub/test and nvim/test tiers, docs, qa and shipped skills: web connection.ts and browser-notifications.ts; Neovim init.lua/items.lua; CLI socket-client/events follow plumbing; spoke hub-client; mod bridge hooks consume delivery/message frames rather than raw task summaries. ModelRing/replay and full/slim numbered clients retain their existing task frame format; no field/schema/text changes. Existing item-summary, model-output/ring, visibility, events, mod-bridge, web connection and Neovim task fixtures cover these clients. QA/skills have no announcement-batch API caller. The new regression retains a full legacy task subscriber while additional clients acknowledge subscription then drain native bytes. C1 baseline diagnosis: A-21737. No source review requested yet.

### coord · 2026-11-19T11:22:32.868Z

Follow-up after landing (impl-2004, 2026-11-19 11:21Z): the new 1,650-row scale fixture spends about 11 s in setup and cleanup. Adapt it to T-1988's cheap synthetic tracker fixture helper once T-1988 lands, and drop the 40 s C-216 allowance with it. Track it under T-2005 or as a Tech debt item when T-2004 closes.

### rev-35 · 2026-11-19T11:38:27.720Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2004-source-1
commit: 691e280be970d133aa4750aca5e302e7ca73346a
scope: full
findings: [{"severity":"medium","text":"Standards M1: the new 1650-row regression uses raw TestContext for guard installation, seed/Store/hub/client acquisition and its enclosing body. Resource hooks do not fence/join the original setup and observed/secondChange/tail/comment continuations; scheduleTips.poke also discards read() ownership. Guard restoration is not gated on positive hub/resource closure after rejected cleanup. Enroll a whole-case owner before acquisition, separately bound setup, retain/join all original work and late acquisitions, and retain roots/seams/native guard until positive closure. Keep the exact latency, durable comment and mid-publication ordering assertions.","file":"hub/test/item-summary-scale.test.ts","line":74}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source NOT CLEAR at clean691e280be970d133aa4750aca5e302e7ca73346a/tree362c74ed, base1ae83dc7. A-21754 records1medium Standards finding, nohigh/low or additionalSpec issue. New1650-row raw-t case lacks enclosing admission/setup/body/original async joins; projectHub/tempProject resource owners are narrower, poke drops read() ownership and guard restoration lacks positive hub-close fencing. Leadc5eac69d confirms no other owner or disposition. Correct only the new case/necessary seams, preserve exact response, durable comment and second-write tail assertions. Production16-row hydration/publication chunks, synchronous Visibility scope cleared before yielding and unchanged legacy/full/slim wire shapes reviewed positively. T-1952 assertion migration explicitly checked: default1000-row fixture preserved, old4batches allowed<=4000row visits, replacement1000–2100 is tighter; retained original3/2052 vsfixed6/2058 and unchangedE2/R1source-once assertion preserved.40sC216 allowance matchesaf8e16c2/Nov26/projection, behavior2sunchanged; T2005 owns remainingfull-mapCPU/setupfollow-up. C1fixtureowner/profile evidence qualified, not exclusive historical attribution. A21737/A21747 andc5eac69d retain distinct16sparserred, finalidentical-fixture5349.336→219.715ms/CPU9158.659→7049.441ms scopes, intermediatefailed/incomplete rounds and unknownrootretention. All are precommit evolving epochs/no independent invocation/source/native hashes; no exact-head suite claim.112selectedT1/1192,46/47thenchangedscale5/5,finallint/typecheck0 are scopedlocalmacOSarm64/Node24.21 observations, not one combined green full batch. C1doneunverified,C2failed,nothingverified. Hold released; fresh pinned source review before configured window. Static Reviewer inspection only.

Criteria: C2 failed (The new scale regression lacks a pre-acquisition whole-callback owner joining setup, original observations and scheduled freshness work, with positive resource-close fencing of root/seam/native-guard restoration.).

### impl-2004 · 2026-11-19T11:47:02.683Z

M1 correction scope: only the new scale callback plus optional timeout on stageCase.wait. Whole-case owner precedes acquisitions; original detached view/tail/second-edit/poke work stays enrolled; raw sinks register a close event receipt; projectHub/inProcessSpoke partial resources register through owner.resources; explicit owner.close confirms positive closure before root/native-guard restoration. Shared helper consumer search: dev-t3-coverage-component, item-summary-scale existing serving case, stage-closure-component, startup-listener-scale (T3), startup-ready-component, suite-persistence. Their existing 5000 ms wait and cleanup bounds remain unchanged; only the new callback selects setup 15000 ms and detached observation 60000 ms. Existing actual refused Suites.close/native-guard retention control passed. A-21754 remains the authority for prior diagnostic epochs/provenance limits; no prior evidence is upgraded or reconstructed.

### rev-36 · 2026-11-19T11:56:02.504Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-2004-source-2
commit: 70c2d3a939b3da111d28260940990010f47e588e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec SOURCE CLEAR at70c2d3a939b3da111d28260940990010f47e588e/treed4bdcb814dced68f8ec71449cb6689111548da4a, parent691e280be, no dev merge; A-21763. Priorrev35M1/A-21754 resolved: stageCase whole-caller/positive guard before acquisition, producer-side root adoption, named setup bounds, original detached view/tail/edit/comment/poke ownership and final failure propagation; partial hub/MCP resources registered through required context, sockets capture native-close receipt before connect, hello send admitted, explicitclose/required positive resources fence root/seam/guard restoration. Optional wait timeout preserves all other5000ms defaults and cleanup bound, consumer list retained. Independent production diff agrees16-row refresh/publication chunks, synchronous shared Visibility projector cleared before yield, current-row ordering and previous full/slim/wire shape;2000ms reply/durablecomment/newtitle/tail assertions unchanged. T-1952 tighter1000–2100 work budget/ancestor-source-once and approved40sC216setupallowance/Nov26/T2005followup retained. A-21761 exactcleanhead before/after1namedT2pass,reply276.917ms and positive resource-close diagnostic;15033.389833ms case/16105.196ms runner differ from publication5557.682834ms/CPU5313.158+805.983ms scopes. Native signal/PID/independentroot-removal unavailable, scanner notmeasurementattestation. Broaderprecommit30/30/static0 and earlier112file1192/CPU/startup/failures remainqualified A-21754epochs, no exclusivehistorical19sattribution/configured/Linux/browser/fulltiers proof. Findings[]; C1/C2unverified bysourcepass, finalsamehead evidence required. Holdreleased for Coordinatorwindow/configuredverify atfixedhead. Reviewer read-only source/log/metadata, no edits/runtime/scanners/generators/providers/browser/delegation.

### rev-36 · 2026-11-19T13:20:10.088Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-2004-evidence-1
commit: 70c2d3a939b3da111d28260940990010f47e588e
scope: evidence
findings: [{"severity":"medium","text":"S1: existing whole-producer completion control fails with literal 6 !== 2 in A-21779. Wrapper-count granularity alone does not prove or exclude interleaving; the changed path's producer-order/work/final-state compatibility remains unresolved. Coordinator e5cfefe2 requires an ordered unchanged-head trace before serialization repair versus producer-aware oracle migration; no simple count widening.","file":"hub/test/startup-ready-component.test.ts","line":92},{"severity":"medium","text":"S2: existing stop-fence control fails with 'stop fences the in-flight and queued publications', 1 !== 0. The count lacks publication-versus-stop timestamps; pre-stop first-chunk versus post-stop defect remains unresolved pending Coordinator-required trace. Preserve strict no refresh/publication after stop and positive joined closure.","file":"hub/test/startup-ready-component.test.ts","line":86}]
finding_counts: {"high":0,"medium":2,"low":0}

Evidence NOT CLEAR at unchanged70c2d3a93; A-21783 consolidates A-21779/bf8162a2 failed/partial and Coordinator e5cfefe2 (supersedes db463975). Ordinary6224=6222pass+2fail; separate10load-gate passes. T0exit0/124.552s hostonly,233T1filespassed,T2 395pass/1fail;44NeovimT2/272T3/18T4/55Web unexecuted. Own1650 latencycase ordinary31.186754739s wholecase+5/5loadgate passed; no acceptance pass from this round. Literal errors A21779:33510–33541; structured failreceipts27755/27759. No assertion-output proof of interleaving or post-stop publication. Runtime tree6e56663ec06bdd5952827cf290d768ac53b6dd6c,uncached Linuxx64/Node24.21/Nv0.12.5,c8sfo2,1242133ms/$0.08625923611111111;browsernull,skipreportmissing0,report-onlylint/durations notfailurecause. C2failed,C1unverified,nothingverified. Release evidence hold for authorized unchanged-source ordered trace of producer start/end,chunks,hold,stopcall/resolution; posttrace before fix/migration, preserve wholeproducerordering/noafterstop/workbudget/finalstate; fresh pinned source review then Coordinator newall window. Priorlocal/precommit/source epochs remain separate. Reviewer read-only static/log inspection; no edits/tests/probes/scans/delegation.

Criteria: C2 failed (Required configured round failed on two attributed freshness producer-order/stop controls; ordered trace and repair or justified oracle migration remain required, although the named two-second latency assertion passed.).

### impl-2004 · 2026-11-19T13:35:24.901Z

Rule 20 re-search after bf8162a2 failure: direct freshness/announcement/stop-order tests across all tiers are T1 merge-batches, merge-queue-unit, tracker-summary; T2 custom-roles-component, freshness, item-summary-scale, item-summary, stage-closure-component, startup-ready-component; T3 follows-native, merge-recovery, planned-stage, startup-listener-scale, tracker-native-boundary, task-worktrees; T2 merge-policy listener control. Shared plan-stage-fixture also calls refreshFreshness. Raw function/frame/field searches covered #announceBatch/#announcementQueue, publishTaskBatch, refreshFreshness/resumeFreshness, task-freshness-settled, onChange, stop/drain ordering; docs, shipped skills, QA briefs, nvim/test and web/test searched, including T3/T4 assignments. No direct Neovim/Web/T4 lifecycle-wrapper consumer found; existing item-summary-lua / soak and Web connection/task frame consumers are unaffected because no wire, snapshot or persisted shape changes. Production onChange consumers remain server, dispatch, merge-queue and sessions adapter. Only server consumes its synchronous publication wrapper and ignores the new additive completion argument; only startup-ready-component consumes AnnouncementBatchReceipt. All other listener-only callbacks and old one-argument wrappers stay valid. A-21790 proves current source ordering/stop behavior; Coordinator f46cdb20 approves the oracle migration. The new receipt is the actual queued producer promise, true on full completion, false on stop fence and rejected on error; first publish callback and all wire shapes stay unchanged. Exact completed counts 2/0, strict zero after-stop refresh/chunk/notification, per-producer <=65 uniqueness/work budget, ancestor notification and final T-65 currency are retained or strengthened. Whole startup-ready-component file passes 11/11 locally after migration; failed full round remains failed and no configured retry has been submitted.

### impl-2004 · 2026-11-19T13:36:32.647Z

Correction to the immediately preceding consumer comment: manifest tiers were read back after writing that text and its tier labels were inaccurate. Exact current tiers: T1 merge-batches, merge-queue-unit, tracker-summary; T2 custom-roles-component, item-summary-scale, item-summary, merge-recovery, planned-stage, stage-closure-component, startup-ready-component, task-worktrees; T3 follows-native, freshness, startup-listener-scale, tracker-native-boundary, merge-policy. The consumer file set/reasons are unchanged. No T3/T4 or Neovim/Web proof is claimed from local T2 checks or the failed full run.

### rev-36 · 2026-11-19T13:50:29.629Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-2004-source-3
commit: 362da9e20965a507f20f3fde3d70060d4926d033
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source CLEAR at 362da9e20965a507f20f3fde3d70060d4926d033 / tree ca9bc5fefa191e9010446cb77ff380f8a5e86d3a; sole parent 70c2d3a93, clean, five-file correction, no dev merge. A-21805 records Standards/Spec review with no findings.

A-21790's 200 retained events confirm A's five chunks/end precede B's start; the stop-case chunk ends at 190, hold at 191, stop call at 193, no later refresh/publication/notification, positive stop resolution at 198. External instrumentation adds a completion microtask: ordering evidence only; both original assertions remain failed. Coordinator f46cdb20 explicitly approves the migration. New additive internal completion promise is the actual queued producer work, shared across chunks, true on full completion, false at stop fence, rejecting on error; queue containment and caller error propagation remain. Existing server one-argument synchronous wrapper and listener-only consumers remain compatible; no wire/persisted/snapshot changes.

Controls keep exact two whole producers / zero completed on stop, prohibit producer return/interleave, retain first-65 refresh boundary, 2–65 row budget, source uniqueness, ancestor notification and final T-65 currency; independently require zero after-stop refresh/chunk/item events and positive joined close. Original producer observations are owned, immediately rejection-observed and joined; existing whole-case/guard/setup/root/stop ownership remains. Original 1650 latency/durable-comment/second-write/tail and accepted 1000–2100 startup-budget/source-once assertions are unchanged. Three matching docs updated. A-21804 tier labels checked against pinned manifest supersede inaccurate earlier comment labels; no T1 proof borrowed for T3 consumers.

A-21804 local macOS arm64 Node24.21 summaries: 112 T1 files/1192 passes, two T2 files 16/16, full typecheck/lint exit0, zero refusals/129 report-only findings. Precommit correction-worktree association and unavailable independent invocation/tree/native facts remain qualified, not exact-head configured proof. Reported reply132.474ms excludes setup and differs from case/publication/CPU scopes; no exclusive historical19s attribution. C1/C2 remain unverified by source. A-21779/bf8162a2 stays failed/partial; earlier A-21783/A-21754/A-21761 epochs retained. Hold released for Coordinator-owned new verify all at this fixed head; any further head change needs review. Reviewer read-only source/trace/docs/manifest inspection only, no edits/tests/probes/scans/native/browser/delegation.

### rev-36 · 2026-11-19T14:58:14.662Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-2004-evidence-2
commit: 362da9e20965a507f20f3fde3d70060d4926d033
scope: evidence
findings: [{"severity":"medium","text":"S1: required T3 startup control fails with literal 'startup recomputed explorer 65 times; bound 4 batches' (A-21820:46822–46835). This missed raw explorer-recomputed consumer leaves startup work-bound compatibility unresolved. The count proves neither 65 full passes nor an acceptable row budget. Coordinator 39397d11 requires unchanged-head and pre-change same-fixture row-count series before production coalescing or an at-least-as-strict row-bound migration; retain byte, latency and durable-state assertions.","file":"hub/test/startup-replies-scale.test.ts","line":142}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence NOT CLEAR at unchanged 362da9e20; A-21821 consolidates failed/partial run74401041/A-21820. Literal startup-replies-scale failure at line142; ordinary finish42937/timing42938 fail10.661004831s. Per-recompute rows absent; do not infer full-pass regression or simply widen four to65. Later byte/remaining-seven-reply/snapshot assertions are unexecuted after this assertion. Producer diagnostics43129/43131 separately report first hub.status8221.9ms wall/9479.8ms CPU and65 batches/1004files/1008reads/max2; these scopes are not suite wall time.

Audit: 8621 ordinary=8611pass+1fail+9skip, separate15load passes;918 file envelopes finished917pass/1fail, no duplicates/unfinished. All233T1/440T2 completed;245T3 completed,27T3/18T4/55Web unexecuted. T0/T1/T2exit0, T3exit1;T0host74.136s. Own1650 ordinary21039/21040 pass31.055643574s whole-case+5load passes; corrected producer/stop controls27702/27703 and27706/27707 pass once. No criteria pass from failed round. Provenance46932 exacthead/runtimee6d75ea1130a4fd68b57906bde61e607b962863d,uncached Linuxx64 6.8.0-149/Node24.21/Nv0.12.5,c8sfo2,3743607ms/$0.25997270833333336;browsernull,nine known platform skips,skipreasonreportmissing0. Lint/duration/ratchet advisories are report-only, not failure causes.

Coordinator39397d11 attributes missed consumer to T-2004: post unchanged362 row series and same-fixture pre-change baseline first; full passes require coalescing and retained<=4, partial rows allow at-least-as-strict row budget only with before/after numbers. Preserve all byte/latency/final-state assertions and update raw-field/all-tier census with miss reason. Coordinator7e7a8f58 controls native slot. C2failed,C1unverified,nothingverified. Hold released for authorized measurement and bounded correction; fresh source review before Coordinator's new verify all. Priorbf8162a2/A21779 remains separately failed; local/trace/source epochs retain scopes. Reviewer read-only inspection only, no edits/tests/probes/scans/native/browser/delegation.

Criteria: C2 failed (Required configured round failed on an attributed startup explorer work-bound compatibility control; same-fixture row measurements and correction or justified migration remain required, although the own two-second latency assertion passed.).
