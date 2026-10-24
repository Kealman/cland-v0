---
id: T-976
kind: task
title: "The periodic dev T3 culprit search goes inconclusive on old trees: it applies the live hub's lints to pre-change manifests and can't place files new in the range"
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - bug
  - hub
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-984
branch: t/T-976-the-periodic-dev-t3-culprit-search-goes
created: 2026-10-20T15:39:04.758Z
updated: 2026-10-24T14:31:48.944Z
closed: 2026-10-24T14:31:48.944Z
---

## Summary

On 2026-10-20 two culprit searches lost files to the search mechanics rather than to the code under test:
- **Search for b5fc792c:** `fixture-orphans-lifecycle.test.ts` ended inconclusive ("unknown explicit hub shard file", because the file is new inside the range); `scenarios/droplet-verify.test.ts` ended inconclusive ("verify-tiers: duration key has no matching test identity: …demo stop confirms an earlier delete…", the stale key T-956 later removed).
- **Search for cfd6761e:** all four failing files ended inconclusive the same way. Every probe at an older head ran the live hub's T-956 identity lint against that head's manifest.
- **doctor-isolation:** pinned to T-955, which changes only role-clause test files. That points to a probe outcome that depends on a racy test without a repeat. T-965 later removed the race.

## What to build

- A probe at an older head validates manifests with the rules that applied at that head, or skips manifest lint for probe-only runs and says so.
- A failing file that doesn't exist at an older head counts as absent, so the search places it at its first-appearance commit.
- A culprit verdict needs a repeated red/green pair at the boundary before it files a bug.

## Acceptance criteria

- [x] C1. A T2 test with a fake history shows a stale duration key at an older head no longer makes a probe inconclusive.
  - done: impl-976 · 2026-10-24T12:56:38.504Z
  - verified: rev-31 [reviewer] · run rev-20261024-976-final · 2026-10-24T14:08:04.165Z · commit e37c4a01b4fe508cc17854d4b8630b7ca847a7a6
  - verified: rev-31 [reviewer] · run rev-20261024-976-merged-final · 2026-10-24T14:26:01.033Z · commit 5c1cb1ee1dadc2945d274ae5f5a7a13a58fda08f
- [x] C2. A file introduced inside the range is placed at its introducing commit.
  - done: impl-976 · 2026-10-24T12:56:38.701Z
  - verified: rev-31 [reviewer] · run rev-20261024-976-final · 2026-10-24T14:08:04.165Z · commit e37c4a01b4fe508cc17854d4b8630b7ca847a7a6
  - verified: rev-31 [reviewer] · run rev-20261024-976-merged-final · 2026-10-24T14:26:01.033Z · commit 5c1cb1ee1dadc2945d274ae5f5a7a13a58fda08f
- [x] C3. A boundary that flips on repetition is reported as inconclusive (flaky), not filed against a culprit.
  - done: impl-976 · 2026-10-24T12:56:39.013Z
  - verified: rev-31 [reviewer] · run rev-20261024-976-final · 2026-10-24T14:08:04.165Z · commit e37c4a01b4fe508cc17854d4b8630b7ca847a7a6
  - verified: rev-31 [reviewer] · run rev-20261024-976-merged-final · 2026-10-24T14:26:01.033Z · commit 5c1cb1ee1dadc2945d274ae5f5a7a13a58fda08f

## Comments

### coord · 2026-10-20T19:51:17.588Z

Another data point, 2026-10-20 19:51Z (search for periodic run 8777e86b): the last-green rerun 5cc2e460 at 9ae9a20b passed 20/20 but had 3 platform skips (needs macOS sandbox-exec on Linux), and the search classified it 'inconclusive (file has nonpassing execution receipts)'. A known platform skip that is identical at both ends should not make a passing receipt nonpassing; otherwise every nvim/test/qa.test.ts culprit search on Linux ends inconclusive. The actual culprits here were T-999 and T-1007, fixed by T-1027.

### impl-976 · 2026-10-24T12:50:02.360Z

Test-first progress: C1 T2 reproduced `duration key has no matching test identity: hub/test/example.test.ts::removed old test`, then passed after probe-only hosting lint/tier-projection bypass (candidate commands retained and logged). C2 T2 fake three-merge history now passes with explicit pinned-tree absence receipts and no executor acquisition on absent commits. C3 boundary-pair repetition next; no real droplets or native Git in these fixture histories. Read A-10828 and reruns A-10833/10840/10843/10846 read-only: merge-policy red at 2306692 and 8644953, green receipts at 89e5c30/69b3dc7; no claim about an unobserved culprit.

### rev-26 · 2026-10-24T13:35:29.415Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-976-source-1
commit: b5eb367f71a158cb90f265ed6baa4e75df2bbd15
scope: full
findings: [{"severity":"medium","text":"M1: task's Coordinator comment requires identical known platform exclusions at both ends to remain usable for historical search; probeResult still rejects every skip. Preserve explicit nonexecuted skip evidence and accept only positively matched known platform exclusions, with changed/missing/unknown exclusions inconclusive; add fake-history/probe controls.","file":"hub/src/hub/dev-t3-probe.ts","line":74}]
finding_counts: {"high":0,"medium":1,"low":0}

T-976 full source review — not clear

Headb5eb367f71a158cb90f265ed6baa4e75df2bbd15; tree02a946da7ea2c99c47df5f1def7f371595bcb071. Fixed base/merge-base699a44dd1741e272ecd883c73c1aeda0215d6dff, integrated before first source review; task commit8c48c7ec plus pre-review merge. Reviewed complete16-file153+/46− diff, task body/criteria/comments, probe/search/report/admission code, tests and matching docs/skill/A-11059. Standards and Spec assessed in-session without delegation or runtime execution.

## Standards
No findings. Historical bypass is restricted to internal devT3Probe admission; ordinary verification and batch diagnostics still use hosting lint/projections. Candidate commands remain pinned normally and historical logs explicitly disclose skipped hosting checks/projections. Existing immutable head/tree and fresh:true probe paths remain; absence does not allocate a checkout or executor.
Shared diagnostic root/traversal predicate preserves existing allowed roots and controls. Native presence read uses immutable commit object ls-tree and propagates Git errors; matching returned filename, not a failed read, supplies absence. Reporter distinguishes absent head/tree/not-executed from run/artifact evidence. Consumer inventory in runtime is probe/search/report/Dispatcher; no Web/Neovim receipt consumer missed by the union change.
New fake-history tests stay at existing T2 sealed repository/executor seam; pure search/probe/soak changes remain T1, no new real provider/Git/hub/worker invocation, sleep or cap relaxation. Existing fixture ownership remains, source/runtime authority unchanged. Matching README/shared/per-test/implement guidance describes skip disclosure, separate absence, confirmations and +2×F upper cost. No clause expansion.

## Spec — M1 medium
hub/src/hub/dev-t3-probe.ts:74 onward still rejects every skipped finish row and every completed non-pass outcome. The existing T1 test explicitly continues to classify all skipped records alike. The task's Coordinator comment dated2026-10-20T19:51:17.588Z asks that a known platform skip identical at both ends not make a passing receipt inconclusive, citing three "needs macOS sandbox-exec" exclusions in nvim/test/qa.test.ts on Linux. That documented historical search blocker remains: otherwise passing requested-file executions with those unchanged exclusions never reach usable baseline/boundary comparison.

Implement positively evidenced stable known platform exclusions across the compared ends; retain their identities/reasons/platform and preserve that skipped cases were not executed. Newly introduced, changed, missing or unexplained skips and files without actual passing execution must remain inconclusive. Add fake-history/probe controls proving the allowed identical platform exclusion set and negative controls for changed/unknown exclusions, with no Bug on ambiguous evidence. Do not globally turn skip into pass. Update matching proof/guidance and receipt consumers as needed. Claimant has acknowledged M1 and is working test-first while verification remains held.

## Other spec checks
C1's stale-duration-key seam is implemented: hosting manifest/test lint and planTierReport bypass only historical diagnostic jobs with explicit log note, while candidate commands remain. T2 writes a stale removed identity and exercises that admission.
C2 absence is explicit null run/artifact/path plus pinned head/file/tree; absent predecessor narrows the low side, red-head absence is inconclusive. A fake introduced-file range asserts no checkout/acquisition for absent commits and lands first red introduction.
C3 boundary confirmation phases use separate :boundary durable keys, fresh run ids and matching original outcomes, rejecting either flip or reused run id before assigning culprit. Both green- and red-side flips assert inconclusive/no Bug; stable Web/two-file grouping remains. Reopen between confirmation sides and pre-confirmation unreported culprit checkpoint upgrade are statically consistent. These observations are source checks, not verification marks or a complete runtime pass.

Cost remains at most two extra present-side probes per failing file reaching a boundary, one if predecessor is absent; a green-side flip stops before red confirmation. Probe-only evidence does not authorize ordinary cover/landing success. General absence and platform exclusions must remain separate concepts.

## Evidence / disposition
A-11059 summarizes exact-head local macOS npm check and targeted9/9T2,4/4T1search,9/9T1soak with fake histories/executors; report-only lint133/60,zero refusals. No complete raw original command/stdout/exit/timing bundle audited here. Preserve available original returns durably with actual source/platform and missing/truncated limits, without rerunning for transcription. No real-world culprit inferred from read-only historical inputs listed in the artifact.

Full source not clear for the additional explicit task-comment requirement M1. Literal C1–C3 source paths otherwise look implemented but remain runtime-unverified; no criterion is marked verified or independently failed by this source verdict, since M1 is the separately documented task requirement. This is the complete source finding set. Commit/push the correction, update claimant marks as appropriate and request fresh full source review before ordinary mode-free verification. No post-review dev merge absent Coordinator authorization. QA none/after-stage, no landing/full-suite claim. Standards0; Spec1medium finding.
Durable review A-11091.

### impl-976 · 2026-10-24T13:45:08.374Z

M1 corrected at e37c4a01b4fe508cc17854d4b8630b7ca847a7a6 (no post-review dev merge). Existing suite skip reason records retained; known Linux sandbox exclusions remain partial metadata with identities/reasons/full platform and only the executed subset compared beside exact matching sets/platforms. Changed/missing/unexplained sets, all-skipped files and architecture drift remain inconclusive/no Bug. Exact-head local Darwin arm64 npm check passed (test lint report-only 133 findings/60 files, 0 refusals), T2 component 14/14, T1 search 6/6, T1 soak policy 9/9; targeted files sequential, sealed fakes, no real droplets. Original tool returns retained in A-11109; correction and consumer/limits notes A-11110. Mode-free verify remains held for fresh full source review.

### rev-31 · 2026-10-24T13:52:57.122Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-976-source2
commit: e37c4a01b4fe508cc17854d4b8630b7ca847a7a6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-976 corrected full source review — clear

Head e37c4a01b4fe508cc17854d4b8630b7ca847a7a6; tree 0239cc31ea3f6dadbb47756aacbb68e3fa40ac69; fixed full-review base 699a44dd1741e272ecd883c73c1aeda0215d6dff. The pushed origin task ref matches. Reviewed the full 17-file change, correction against b5eb367f, task body/Coordinator comment, prior full audit A-11091, runtime consumers, tests, documentation and original retained receipts A-11109/A-11110. Standards and Spec assessed in-session, without delegation or runtime execution.

Standards: no findings. The internal historical-probe flag alone bypasses hosting admission lint/tier projection; candidate commands and ordinary verification/batch lint remain. Shared diagnostic-path validation preserves test roots and traversal refusal. Immutable Git head/tree checks, separate fresh probe keys and absence-before-checkout remain. New fixtures use sealed fake repositories/executors and existing T1/T2 seams; no real provider, new process loop, raised timeout or assertion relaxation. Matching shared/canonical test guidance, README and Implement skill/CHANGES describe the behavior and bounded extra runs.

Spec: M1 from A-11091 is resolved. Suite evidence retains the existing complete skip records. probeResult pairs skipped finishes with exact known Linux sandbox prerequisite names/reasons and retains a partial verdict with executed red/green subset, full executor platform and excluded identities. Missing/unknown/unpaired exclusions, wrong/missing platform, unfinished/todo/cancelled execution and all-skipped greens remain inconclusive. Search compares exact exclusion multisets plus OS/architecture at each present probe and both fresh confirmations. Changed or missing sets, architecture drift and partial-versus-absent endpoints stop without a Bug. A partial green red-head rerun does not label the original failure a flake. Report text and structured receipts disclose excluded tests as not executed; this grants no full passing cover or load proof. The T2 stable three-skip/long-identity history reaches a culprit, while changed/missing/unknown/confirmation-drift controls file none; T1 pairing/platform/architecture controls remain explicit.

C1 still skips only hosting historical checks, with stale candidate-manifest fake history and an explicit log note; candidate commands remain. C2 preserves immutable absence receipts (head/file/tree, null execution ids), avoids checkout/acquisition and identifies the introducing commit for a fully comparable introduced-file history. C3 repeats only the adjacent boundary with separate durable :boundary keys and fresh run ids, rejects both outcome flips/reused ids, and survives restart between sides. Web and two-file grouping controls remain. At most +2 present-side droplet probes per file reaching a boundary, or +1 with absent predecessor; green-side failure stops early. The conservative partial/absent combination is documented as inconclusive.

Evidence limits: A-11109 contains original post-change tool calls/chunks at this exact head on local Darwin arm64: npm check exit0 (test lint report-only 133 findings/60 files, zero refusals); component14/14, search6/6, soak9/9, zero skips. Fake Linux platform facts are fixture inputs, not native Linux execution. Earlier b5eb367f output remains a summary, not reconstructed raw proof. Per-call waits are not total command wall time. These local receipts do not establish the configured task run.

Full source clear, zero findings on either axis. C1–C3 remain runtime-unverified pending ordinary configured mode-free verification at this unchanged head and subsequent evidence review. No post-review dev merge without Coordinator authorization; no QA/landing claim.
Durable review A-11128.

### rev-31 · 2026-10-24T14:08:04.165Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-976-final
commit: e37c4a01b4fe508cc17854d4b8630b7ca847a7a6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-976 final same-head evidence review — clear

Head e37c4a01b4fe508cc17854d4b8630b7ca847a7a6 / Git tree0239cc31ea3f6dadbb47756aacbb68e3fa40ac69; pushed task ref still matches. Carries corrected full Standards/Spec source clear A-11128 / rev-20261024-976-source2, resolving prior M1 from A-11091. Independently inspected task.verify and original A-11162; read-only Reviewer inspection, no execution/delegation.

Ordinary configured mode-free 01f6b9de-88ee-4178-80cb-812fbf536291 exited0 at that exact head. All2995 ordinary finish identities pass, no fail/cancelled/skipped/todo; T0/allT1/full fallback hub+NeovimT2/Web completed. Eleven affected new identities each also have five distinct passing load receipts (55 additional bodies, excluded from2995). Largest affected load body1.622615844s; no affected new identity exceeds the enforced5s gate and no allowance needed. No native historical repository/provider work is executed by the fake-history tests; native Linux execution here refers to the test-suite executor.

C1 verified: T2 “searches old manifests without applying the hosting hub lint” passes ordinarily0.934436702s and5/5 under load (worst1.533081693s), retaining candidate commands/explicit hosting-lint disclosure.
C2 verified: T2 introduced-file case passes0.830593887s and5/5 (worst1.290627759s), preserving pinned absence/null execution ids/no checkout-acquisition and first-introduction attribution.
C3 verified: both fresh-boundary flip cases pass ordinarily1.019031959/1.357671578s and5/5 each (worst1.529041242/1.622615844s), publishing inconclusive/no Bug. T1 restart/bisection and two-file soak integration pass.
M1 correction also has positive stable partial-exclusion case1.081043203s plus5/5 and changed/missing/unknown/confirmation-drift negatives, all5/5; pairing/incomplete evidence/architecture controls pass in T1. The receipt proves those fixture contracts, not real historical culprit identities or native macOS sandbox behavior.

Executor Linux x64 6.8.0-142-generic / Node24.21 / Neovim0.12.5, c-8 lon1 droplet cland-v0-f67f7404, workers2, lifetime728s, cost$0.0505. T0 envelope25.338s uses host gate tree89f764c484326dec84e628c96e5fe23a8df5af88, explicitly not repeated remotely. T1 envelope69s, T2 387s, Web164s; observed Web shard159.54s/phase suite159.67s exceeds40s report-only wall budget. Lint133 findings/60files, ordinary duration notices and T3 ratchet report-only; zero lint refusals. One missing duration baseline remains disclosed. T3/T4 did not execute; remaining process cover is periodic/integrated and not supplied by configured T1-only batches. No QA/full-process-cover claim.

A-11109's original local Darwin arm64 check/targeted receipts stay separately attributed with original per-call timing limits. Historical summary A-11059 was not reconstructed as raw evidence. No additional tests, baseline inflation, cap relaxation or post-review source merge used for settlement.

C1–C3 all done and now verified. Final evidence clear, findings[]. Claimant will include fresh no-auto-maintenance dev conflict-check evidence and unchanged head/tree in the ready report before Coordinator enqueue; no fresh-dev conflict result has been inferred from this runtime log. Source/runtime verdict is at the stated head only. Coordinator owns enqueue and any required integration; no merge/QA/landing claim.
Durable review A-11165.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-976 · 2026-10-24T14:10:34.318Z

Coordinator-authorized rule11 dev34475b5c merge resolved and pushed as 5c1cb1ee1dadc2945d274ae5f5a7a13a58fda08f, treee224d3109b8de922c066dcca0af331ab97c3c9e2. Both conflicts combine T-1232 log/guard plumbing with fourth probe repetition argument; guarded skipped-notice paths, T-1098 Web admission and all T-976 behavior retained. Local Darwin arm64 npm check passed (lint report-only133/60,0refusals); sequential targeted component14/14, search7/7, scheduling7/7, soak9/9. Fresh delta source review next; prior green01f6b9de is historical and supplies no proof for this head.

### rev-31 · 2026-10-24T14:12:15.676Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-976-integration
commit: 5c1cb1ee1dadc2945d274ae5f5a7a13a58fda08f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-976 authorized integration delta source review — clear

Head5c1cb1ee1dadc2945d274ae5f5a7a13a58fda08f; treee224d3109b8de922c066dcca0af331ab97c3c9e2; parents reviewed e37c4a01b4fe508cc17854d4b8630b7ca847a7a6 and exact authorized dev34475b5c4a9cce1c67eaadea006c9f2e40b333c0. Origin task ref matches. Read Coordinator05335e3e-eeb4-4539-ac0a-8e88f1181ba7 directly in topic history: merge that dev under rule11, preserve T-1232 guards/T-1098 Web/T-976 historical+confirmation paths, delta review then fresh mode-free/evidence/ready. Carries full source A-11128; prior final A-11165 and green01f6b9de/A-11162 apply only to the parent and are historical. Reviewer read-only; no execution/delegation.

Standards/Spec: no delta findings. Inspected both-parent combined conflict diff and checkpoint-to-head changes. SearchBoundary retains incoming log?:LogFn and the task's fourth optional boundary repetition argument; Dispatcher now supplies both log:this.#log and passes repetition to DevT3Probes. All partial/exclusion/absence unions and phase/restart state transitions remain. The actual conflict resolution makes no other search/dispatcher logic change.

Incoming T-1232 guarded search catch persists original dev-t3-search-error, contains a throwing blocked notice in its second catch and guards even failed logging before finally resets #work. Nightly soak/periodic skip paths log original candidate error before notice delivery and retain guarded notice-failure catches/finally cleanup. Their new T1 fault controls remain: rejected report plus throwing blocked notice retries on the next timer tick; both skip-notice errors leave queue/status reads serving. The task's ordinary/fresh boundary keys and no-Bug controls remain unchanged.

Compared with reviewed parent, dev-t3-probe.ts, dev-t3-report.ts, suite-candidate.ts, suite-log.ts and entire component fake-history test blobs are unchanged. Historical-only hosting-lint bypass, candidate commands, immutable absence, exact paired platform exclusions and boundary confirmations therefore remain the inspected implementation. suites.ts differs here only by incoming two skip-notice guards; its T-1098 Web diagnostic selection remains and the stable Web component is retained. Shared contracts/docs inherited from dev are carried, not a new full audit of unrelated landed work. No new timeout/cap, test loop, fixture shrinkage, manifest baseline/allowance or role change.

A-11168 retains exact merged-head identity plus original local Darwin arm64 tool-return chunks and exit0 for npmcheck (133/60 report-only lint,zero refusals), sequential component14/14, search7/7, scheduling7/7, soak9/9, zero skips. Native Node runner times16.024805083/.384057542/.324353291/.842349708s respectively; per-call tool waits are not full command wall time. These tests use sealed fake histories/executors, not real droplets or native historical repository probes. They are local partial validation only.

Delta source clear, findings[]. C1–C3 remain done; previous runtime marks at e37c4a01 are stale for this merged head. Run one ordinary configured mode-free verification at unchanged5c1cb1ee with original receipt routed here, then request evidence review. Extra production probe cost remains at most+2×F for boundary confirmations (+1 absent predecessor), no extra repetition introduced by merge. No further source/head change absent authorization and new review; no QA/enqueue/landing/current-head runtime-pass claim.
Durable review A-11171.

### rev-31 · 2026-10-24T14:26:01.033Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-976-merged-final
commit: 5c1cb1ee1dadc2945d274ae5f5a7a13a58fda08f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-976 merged-head final evidence review — clear

Head5c1cb1ee1dadc2945d274ae5f5a7a13a58fda08f / treee224d3109b8de922c066dcca0af331ab97c3c9e2; origin task ref matches. Carries full source A-11128 and authorized integration delta A-11171 / rev-20261024-976-integration, preserving Coordinator05335e3e's exact dev34475b5c merge. Prior A-11165/A-11162 at e37c4a01 remain historical. Read-only inspection of task.verify and original A-11194; no execution/delegation.

Fresh ordinary configured mode-free85c6d651-cedf-4024-ab86-884f0fcf8dae exited0 at the merged head. Independently counted3002 ordinary finish identities, all pass/zero failures,cancellations,skips,todo. T0/allT1/full fallback hub+NeovimT2/Web completed. Eleven affected new identities have55 separate passing load bodies (each5/5); not added to the3002 ordinary total. Worst affected load1.551402300s, no new-identity allowance required. T3/T4 did not execute; configured batch tiers omit T3, remaining process cover deferred to periodic/integrated occasions.

C1 verified at new head: stale older-manifest T2 case0.937015939s,5/5 load worst1.285058403s.
C2 verified at new head: introduced-file/no-old-head-execution T2 case0.825915527s,5/5 worst1.211536921s.
C3 verified at new head: green/red boundary flips1.012250809/1.303448250s, each5/5 (worst1.505723732/1.551402300s), no Bug on ambiguous/flaky boundary.
Known identical platform-exclusion positive and changed/missing/unknown/confirmation-drift negatives all pass ordinarily and5/5; pairing/incomplete/architecture T1 controls pass. These native-Linux suite executions exercise sealed fake histories/executors, not real historical provider probes or native macOS sandbox semantics.
Merged T-1232 blocked-notice recovery passes0.042462229s; soak/dev-T3 throwing skip-notice controls0.034117290/0.019534608s. T-1098 stable Web diagnostic component passes1.223508051s. Incoming guarded error boundaries and task's fourth repetition argument therefore retain explicit coupled runtime proof.

Executor Linux x64 6.8.0-142-generic / Node24.21 / Neovim0.12.5; c-8lon1 droplet cland-v0-b25e4e96, workers2, lifetime664s,cost$0.0461. T0 envelope24.647s references host gate tree64623d15007454c65fe04c31989a3ab92b1df069, explicitly not repeated remotely. T1 envelope63s,T2 357s,Web151s; Web observed shard146.70s/phase suite146.80s exceeds40s report-only wall budget. Lint133/60, existing duration notices and T3 ratchet report-only; three missing baselines and incomplete base timing remain disclosed. No blanket duration-budget or all-process-cover success claim.

A-11168's original local exact-head Darwin arm64 check/37 targeted passes remain separately attributed with per-call timing limits; configured Linux evidence above supplies the current runtime settlement. No runtime test rerun by Reviewer, source change, new allowance or extra repetitions used.

C1–C3 all done and now verified at5c1cb1ee. Final evidence clear, zero findings. Preserve reviewed head and include fresh no-auto-maintenance dev conflict evidence in the ready report for Coordinator enqueue. This verdict supplies no fresh-dev conflict assertion, actual merge, QA or landing claim; any further authorized integration needs its own delta review and current-head verification.
Durable review A-11195.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-24T14:31:48.944Z

Merged 3795efe3e739b103b594cdc4a3db6f466460185f onto dev.
