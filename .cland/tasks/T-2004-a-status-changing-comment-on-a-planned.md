---
id: T-2004
kind: task
title: A status-changing comment on a planned-stage item blocked the hub loop for about 19 s after a 1,627-item explorer refresh
state: closed
status: done
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
updated: 2026-11-19T18:27:21.262Z
closed: 2026-11-19T18:27:21.262Z
---

## Summary

Hub pid 72462 (db53a0cb9, restart #87) blocked its event loop for about 19 s at 10:52:33Z on 2026-11-19, ending in tracker-storage-stalled at 10:52:52.376Z and a 23,146 ms `task.comment`. The call was rev-39's small not-clear verdict on T-1728 (about 2.4 KB body), which also marked C1 failed and moved the status from review to in progress. In hub.log (read by v0-6a; hub.db untouched): a stage-ancestry visit for head 3ead64f1a at 10:52:32.204Z; the comment starts at 10:52:32.785Z; explorer-recomputed for 1,627 items at 10:52:33.034Z (durationMs 9.6); then no line at all until 10:52:52.363Z. The recompute itself is fast, so the 19 s went into synchronous work after it, possibly announce or stage-cover dependents for E-1883's plan stage. A second stage-ancestry visit at 10:52:55Z didn't block.

## What to build

Name the owner of the 19 s synchronous block with a CPU profile or per-step timings on a fixture that reproduces a status change on a planned-stage item at production scale. Then make that path bounded or yielding, as T-1952 did for the freshness announcements.

## Acceptance criteria

- [x] C1. The blocking owner is named with evidence: a profile or per-step timing on a fixture that changes a planned-stage item's status with a status-and-verdict comment at about 1,650 items (evidence).
  - done: impl-2004 · 2026-11-19T11:28:32.246Z
  - verified: rev-36 [reviewer] · run rev-36-2004-final-1 · 2026-11-19T16:55:14.681Z · commit d7975cb79e34a3fa798bad48d353e4922365ace4
  - verified: rev-36 [reviewer] · run rev-36-2004-final-2 · 2026-11-19T17:36:59.688Z · commit dccc14d8a9db40a36d109c17d1b4adb108d0f09e
- [x] C2. On that fixture, a `task.view` request issued during the status change answers within 2 s, red on the current code (test).
  - done: impl-2004 · 2026-11-19T15:05:42.923Z
  - verified: rev-36 [reviewer] · run rev-36-2004-final-1 · 2026-11-19T16:55:14.682Z · commit d7975cb79e34a3fa798bad48d353e4922365ace4
  - verified: rev-36 [reviewer] · run rev-36-2004-final-2 · 2026-11-19T17:36:59.688Z · commit dccc14d8a9db40a36d109c17d1b4adb108d0f09e

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

### impl-2004 · 2026-11-19T15:01:23.442Z

Additional raw-diagnostic consumer census after A-21820: startup-replies-scale.test.ts is T3 and directly counts explorer-recomputed, without importing or naming announceBatch, publishTaskBatch or freshness methods. Prior all-tier search omitted this raw diagnostic field and 'startup recomputed' assertion wording, so an actual consumer was missed (not a tier exemption). Expanded explorer-recomputed/raw assertion search finds tracker-summary (T1), item-summary and item-summary-scale (T2), startup-replies-scale (T3), production Tracker emitter and tracker docs; inbox-archive-workload's similarly worded startup inbox counter is a different producer/field and unaffected. The first three were already covered; new T3 consumer now counts actual touched rows. A-21825 posted unchanged-head/baseline row series before migration: 65 chunks/3074 rows vs3/3012. Coordinator39397d11/7e7a8f58 authorizes >=1004 && <=4016 ceiling, no weaker than old4×1004. Fixture/byte/latency/positive durable-state assertions remain unchanged. No configured retry yet.

### impl-2004 · 2026-11-19T15:03:57.666Z

Follow-through to Coordinatorebc5915e: startup-replies-scale now observes exactly one startup publication producer by the existing internal completion-promise identity, at most ceil(1004/16)=63 chunks for that producer, and at most63+2 recompute calls (initial source hydration and visibility passes). Thus per-row flushing fails even if touched-row total fits. No new asynchronous work is started or retained by this observer; existing hub owner joins production work. This adds startup-replies-scale as the second test-only AnnouncementBatchReceipt consumer alongside startup-ready-component; production server still ignores the additive argument and wire shape remains unchanged. Whole T3 file passed2/2 locally after final guard, including462955 reply bytes/99498 snapshot bytes and all preserved latency/plan-child assertions; no full configured pass inferred.

### rev-36 · 2026-11-19T15:10:00.218Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-2004-source-4
commit: d7975cb79e34a3fa798bad48d353e4922365ace4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source CLEAR at d7975cb79/tree65fa30c13b5eb911706790f4f7c5fe18cda87949; A-21827. Sole parent362da9e20, clean, two-file T3 test/guide correction, no production/helper/tier/config/allowance change or dev merge. A-21821 finding resolved for source by A-21825 same-fixture measurements and Coordinator39397d11/ebc5915e approval: unchanged current65 calls/3074 touched rows remains original-assertion fail/code1; three pre-change production modules on identical current fixture yield3 calls/3012 rows/pass/code0, both signalnull. Baseline module and common original test hashes independently match Git; this is a three-module controlled baseline, not a whole historical checkout pass.

ExplorerFieldsIndex producer items count actual recomputed aggregates; new1004–4016 row bound preserves old4×1004 ceiling. Separate exactly-one producer / <=ceil(1004/16)=63 chunks / <=63+2 calls catches per-row explosion. Synchronous wrapper forwards publish/completion unchanged; promise is identity only and adds no async acquisition/wait. Raw diagnostic reader census and miss reason now explicit, second test-only receipt consumer recorded. Matching guide updated. All other original checkpoint/history/read/latency/frame-total-byte/snapshot/durable-child assertions retained; prior1650 and producer/stop controls unchanged. Row counts do not establish CPU-cost equivalence or exclusive historical stall attribution.

A-21826 final precommit bytes match both committed source hashes: whole T3 file2/2pass,462955 startup reply bytes/99498 card snapshot, full typecheck/lint exit0,129 report-only findings/zero refusals. Local darwinarm64 Node24.21, fake Git/in-process fixtures, browsernone. Final native PID/signal/root-removal facts unavailable; no T1 rerun/new-head configured/Linux/full-tier claim. Parent pass and both failed configured rounds remain separate epochs with unexecuted phases. Findings[]; C1/C2 unverified by source. Hold released for Coordinator-owned new verify all at fixed head; changes need new review. Reviewer read-only inspection only, no edits/tests/probes/scans/native/browser/delegation.

### rev-36 · 2026-11-19T16:55:14.682Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-2004-final-1
commit: d7975cb79e34a3fa798bad48d353e4922365ace4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head CLEAR at d7975cb79/tree65fa30c13b5eb911706790f4f7c5fe18cda87949; A-21838 audits run38e5d328/A-21837 against source4. C1 retained source/profile diagnosis identifies fixture freshness fan-out and repeated visibility/item-layer projection; current publication/CPU receipt21076 is scoped to that fixture, not exclusive attribution of the historical live19s stall. C2 exact1650 case ordinary21070/timing21071 pass26.045232169s whole-case; five distinct load passes21016/21594/22641/23439/24461. Actual request diagnostic21077 is404.539ms during status/verdict write excluding setup; positive whole-case resource close21078. Durable status/verdict, newer interleaved title and tail assertions remain required.

Prior failures now ordinary pass: producer ordering27701/27702 and stop27705/27706; thousand-row startup42931/42932, pinned startup42935/42936. Actual startup3074 touched rows/65 recompute calls, preserved producer/chunk/call limits;460381 reply bytes/99498 snapshot bytes. Original planned1000-row control retains2058-row bound receipt21105. Shared synchronous projection/legacy frame9926/9927 passes+5. Whole-case, startup-status, CPU and publication intervals remain distinct; no speedup claim.

Full structured index:9117ordinary=9105pass+12skip,0fail/cancel; separate15load passes. All1000file envelopes pass, no duplicate/unfinished/missing T1T2T3Web identities:233T1/440T2/272T3/55Web.18T4 unexecuted. T0/T1/T2/T3/Web exit0;T0host66.688s. Provenance50261 exacthead/runtime595d997c01fdc369db12d0b4bcdd33a7261d727d,uncached Linuxx64 6.8.0-149/Node24.21/Nv0.12.5,c8sfo2,3355625ms/$0.2330295138888889;isolated HeadlessShell1248/ChromeTesting156.0.8078.4.12skips5sandbox/1caffeinate/2OpenCode/4zsh remain unavailable coverage,skipreasonreportmissing0. Lint129/62,duration/ratchet/Web notices report-only. Priorbf8162a2/A21779 and74401041/A21820 stay failed/partial; diagnostic/baseline/local/source epochs retain original scopes and limits. Findings[];C1/C2 verified at current head, hold released; hub ready routes settlement. No extra run requested. Reviewer read-only inspection only, no edits/tests/probes/scans/native/browser/delegation.

Criteria: C1 verified, C2 verified.

### rev-36 · 2026-11-19T17:04:05.621Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-2004-delta-1
commit: dccc14d8a9db40a36d109c17d1b4adb108d0f09e
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized duration-conflict delta SOURCE CLEAR at dccc14d8a/treeec649a5377532d45f0b354de81ff330e183747bd; A-21844. Coordinator90d60c22 authorizes parents final-reviewed d7975cb79+devd58a09d79. Sole manual conflict durations.json: exact dev manifest plus seven lines for existing40s C-216 entry; dev9.5s T-1669 allowance and deletion of retired19/8.5/16s entries retained, no rewrite/default/gate change. Original allowance projection wording remains historical rationale; actual later Linux measurements remain A-21837/A-21838.

Both-parent intersection is only manifest and auto-merged item-summary-scale/guide. Dev's T-1988 first churn fixture ownership/setup merges with unchanged own1650 comment case, two-second/durable-comment/interleaved-tail assertions and startup row controls. Tracker/core/visibility, stage-case, producer/stop and startup-replies controls are byte-identical to own parent. Eager upstream file-fixture/name-selection observation separately routed as Tech debt S for dedup; unchanged shared helper, outside this resolution.

Independent key search hub/test+nvim/test matches only manifest and whole fake-Claude(T3)/item-summary-scale(T2) files, no Neovim match. A-21841 precommit final merged candidate, no subsequent edits: those files12/12 and5/5; four pinned durationT1files34/34; full typecheck/lint0,131 report-only findings/zero refusals, production manifest lint0. Local darwinarm64 Node24.21, disposable/fake lifecycle, granted native slot, browsernone. Independent top-level signal/PID/root-removal facts unavailable; no postcommit configured/full-tier proof. Prior38e5d328/A21837 stays d797 pass with18T4unexecuted; both earlier failed rounds and diagnostic/local epochs stay separate. Findings[]; C1/C2 remain stale/unverified at newhead. Hold released for Coordinator's authorized mode-free verification; merge-batch T3 retains configured scope. Reviewer read-only inspection only, no edits/tests/probes/scans/native/browser/delegation.

### rev-36 · 2026-11-19T17:36:59.688Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-2004-final-2
commit: dccc14d8a9db40a36d109c17d1b4adb108d0f09e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head CLEAR at dccc14d8a9db40a36d109c17d1b4adb108d0f09e / Git tree ec649a5377532d45f0b354de81ff330e183747bd, clean readback. A-21847 independently audits configured aed68391/A-21846 against delta-clear A-21844. C1 retained fixture diagnosis/profile identifies freshness fan-out and repeated visibility/item-layer projection, without exclusive attribution of the historical live19s stall. Current21224 CPU user9689.372ms/system3558.322ms and publication12053.904ms remain distinct scopes. C2 exact1650 case ordinary21218/timing21219 pass25.595685591s whole-case plus five distinct load passes21285/22618/23568/24762/25633. Actual task.view diagnostic21225 is389.325ms during status/verdict write excluding setup; positive hub/resource closure21226. Durable comment/interleaved title/tail assertions retained.

Prior-failure controls ordinary pass: producer ordering27895/27896, stop27899/27900, thousand-row startup36295/36296 and pinned startup36299/36300. Startup65calls/3074touchedrows,1004files/1008reads/max2,1checkpoint/0fulljobs,460424replybytes/99498snapshot; preserved producer/chunk/call/row and byte/latency/durable-state assertions complete. Shared synchronous projection/legacy frame10014/10015 plus5passes. Whole-case/request/startup/publication/CPU intervals are not compared as speedups.

Complete index7126ordinarypasses,0fail/cancel/skip; separate10loadpasses;737fileenvelopes allpass/no duplicates/unfinished.233T1/440T2/8selectedT3/1mappedT4/55Web complete.264remainingT3 batch-deferred;17T4 unexecuted. MappedT4 verifier-load basepass36560/36561 supplies no repetition proof. T0/T1/T2/selectedT3/mappedT4/Web exit0;T0host100.908s step only. Exacthead provenance39172 runtimecandidate02034cfe6a26fc53f1b46b182c454b2c916a2c94,uncachedLinuxx64 6.8.0-149/Node24.21/Nv0.12.5,c8sfo2,1481901ms/$0.10290979166666667 accounting;isolated HeadlessShell1248/ChromeTesting156.0.8078.4,skips[],skipreasonreportmissing0. Lint/budget/ratchet advisories remain report-only; projections not timings. No verify-all/current complete-T3 claim.

Findings[];C1/C2 verified at this head. Prior bf8162a2/A21779 and74401041/A21820 remain failed/partial;38e5d328/A21837 remains prior d797 full-green epoch. Local/precommit/profile/native provenance limits and T2005/separate upstream fixture aside retain scopes. Hold released; no extra run requested. Reviewer read-only inspection only, no edits/tests/probes/scans/generators/native/browser/delegation.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T18:27:21.262Z

Merged e3c0e9320d9ada99dbd2510737e33985416a51fd onto dev.
