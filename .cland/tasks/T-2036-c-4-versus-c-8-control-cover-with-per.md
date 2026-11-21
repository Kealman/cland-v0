---
id: T-2036
kind: task
title: c-4 versus c-8 control cover with per-second load metrics (split from T-1897 C2; after T-1897 lands and the hub restarts)
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by:
  - T-1897
  - T-2048
topic: topic-1690
branch: t/T-2036-c-4-versus-c-8-control-cover-with-per
created: 2026-11-20T17:40:44.218Z
updated: 2026-11-21T16:39:34.085Z
closed: 2026-11-21T16:39:34.085Z
---

## Summary

The paired c-8 and c-4 control measurement that sizes the droplet (the human's 2026-10-17 decision), split from T-1897 C2 on 2026-11-20. It needs T-1897's per-second sampler to be in the running hub first: the hub uploads run.ts, run.sh and health.ts from its own tree, not the candidate's (rule 19). So it runs after T-1897 lands and the hub restarts.

Kind: measurement. Part of E-1888 (approved in triage A-19813, ask 8e3dd5ab); carries T-1897's original C2.

## Acceptance criteria

- [x] C1. One c-4 workers-2 cover at a tree with a green c-8 cover is compared with it for wall time, reds and cost in an artifact (evidence).
  - done: impl-2036 · 2026-11-21T16:38:10.636Z
  - verified: rev-35 [reviewer] · run rev-35-2036-evidence-2 · 2026-11-21T16:39:14.770Z · commit 0693b298f628e4677eee3a5b772fc8194d393c31

## Comments

### impl-2036 · 2026-11-21T01:04:55.041Z

Read T-2036 and split-source T-1897 including its comments. Opened topic-1690. Preparing paired, unsharded c-8/c-4 workers-2 fresh controls at one clean head; requested Coordinator spend authorization ($0.30–$0.50 estimate, ~$0.56 at both caps), selection confirmation and first verify window before submission. No code/test changes expected; evidence-only review after measurement.

### impl-2036 · 2026-11-21T01:50:05.282Z

Coordinator approved pair spend up to ~$0.56 and owns submissions. c-8 reference run 66f497e2-27e2-4002-8bc1-bf82a907c48a admitted 2026-11-21 01:49Z from T-1901 head 895ad015203dd1656d03442f1d9c1512dfecfd6c, full verify all, workers 2, unsharded. Coordinator will submit c-4 at the same head after delivery. Offline bounded streaming extractor prepared and exercised against A-22289 and synthetic gap/null/malformed/duplicate/red controls. Measurement and C1 remain pending completed pair receipts.

### impl-2036 · 2026-11-21T03:48:23.359Z

c-4 control attempt bed4ce72-815f-463c-8001-3ef17cdf9c64 at pinned head895ad015203dd1656d03442f1d9c1512dfecfd6c failed before droplet execution: `all exit 1; dirty or changed worktree cannot be bundled for droplet` (A-22314). Host T0 exit0/60.359s only; machine tiers/Web unexecuted, platform and machine health unavailable. Not a performance sample, no cost inferred. Reported to Coordinator for attribution/retry decision, no resubmission. Green c-8 A-22307 and original failed c-4 receipt retained separately; C1 pending actual paired measurement.

### impl-2036 · 2026-11-21T03:50:49.170Z

Clean exact-head c-4 retry079f98c4-39f4-462b-a356-dd4b3d5af463 failed pre-execution: `all exit 1; prepared snapshot disk does not fit size c-4` (A-22315). Host T0 exit0/80.176s only; T1/T2/T3/Web unexecuted; machine/platform unavailable. Requested Coordinator-owned compatible image preparation before any further enqueue (rule19). No performance or cost inferred, no workaround/resubmission. Prior bed4ce72/A-22314 remains separately retained: Coordinator attributed it to concurrent dev merge during bundling. C1 remains incomplete.

### impl-2036 · 2026-11-21T16:30:17.879Z

Published C1 comparison A-22515 (scan-and-publish clean after filesystem-locator redaction): durable folder /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22515-t-2036-c-4-vs-c-8-paired-sizing-evidence, entry comparison.md. Same measured head895ad015203dd1656d03442f1d9c1512dfecfd6c/tree9c888efcc1a42935c5dbdbdc54c7e9fb549ba0f9, noncached unsharded workers2: c-8 66f497e2/A-22307 green T0–T3+Web; c-4 f98eed3f/A-22514 exit124 at75m, completed T0–T2, partial T3, Web unexecuted, zero observed assertion failures. Pair confirmed machine cost$0.4430880903; c-4 interrupted telemetry unavailable. Includes per-tier observed sums/walls, machine health/lifetimes, original c-8 3992-sample CSV, explicit gaps, prior pre-execution failures and sizing implication to retain c-8 under current deadline. Coordinator cd9d15a1 accepted timeout as valid measurement, no retry. No product source changes; evidence review follows.

### rev-35 · 2026-11-21T16:37:08.438Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2036-evidence-1
commit: 0693b298f628e4677eee3a5b772fc8194d393c31
scope: evidence
findings: [{"severity":"medium","text":"The comparison omits unequal executed repetition work: c-8 ran 55 T1 + 100 T2 load-gate cases before its completed tier receipts; c-4 ran none. Matching base plans do not establish matching command workloads. Disclose this difference and qualify wall/sum ratios and telemetry windows; the conditional timeout sizing conclusion can remain.","file":".cland/artifacts/A-22515-t-2036-c-4-vs-c-8-paired-sizing-evidence/comparison.md","line":38}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence-only review of unchanged task branch 0693b298f628e4677eee3a5b772fc8194d393c31; measured head895ad015203dd1656d03442f1d9c1512dfecfd6c/tree9c888efcc1a42935c5dbdbdc54c7e9fb549ba0f9. One medium M1 remains; lead accepted omission in 802f31f6. Full audit A-22516 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22516-t-2036-evidence1-unequal-repetition-work-needs-disclosure.md. Original log hashes, producer timing arithmetic, cost/health and 3992 original c-8 telemetry rows match; c-4 timeout/partial T3/unexecuted Web, lost series and earlier attempts remain distinct. Coordinator cd9d15a1 accepts interrupted sizing result; no retry requested. No Reviewer execution or source change. After this verdict releases the hold, publish only the wording correction preserving originals and request a narrow evidence re-review.

Criteria: C1 failed (A-22515 omits unequal c-8/c-4 repetition workloads when comparing completed-phase timing and telemetry; correct evidence wording without a rerun.).

### rev-35 · 2026-11-21T16:39:14.770Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2036-evidence-2
commit: 0693b298f628e4677eee3a5b772fc8194d393c31
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22517 resolves the sole M1 evidence finding in A-22516: explicit55 T1+100 T2 c-8 load-gate finishes versuszero c-4; equal base plans distinguished from unequal executed work; wall/sum ratios and telemetry windows qualified. Read-only comparison confirms onlycomparison.md changed; all extraction/raw-sample/control files are byte-identical to A-22515. Taskhead0693b298f628e4677eee3a5b772fc8194d393c31 unchanged; measuredhead895ad015203dd1656d03442f1d9c1512dfecfd6c/canonicaltree9c888efcc1a42935c5dbdbdc54c7e9fb549ba0f9. C1 verified for the accepted measurement, not a c-4 full-suite pass: c-8 A-22307 completedT0–T3+Web green; c-4 A-22514 exit124 at75m afterT0–T2, T3partial/Webunexecuted, zero observed assertion failures. T4 unexecutedboth. Coordinatorcd9d15a1 accepts timeout, no retry. Linux x64 dropletsams3 Node24.21.0/Nvim0.12.5; c-8 HeadlessShell1248/Chrome156.0.8078.4, c-4browserunexecuted. Machineworkers2/T1serial/c-8Web4; advisorybudgetsreport-only. Lifecyclecost$0.4430880903 excludes preparation/earlier-attempt unknowns;3992 originalc-8samples, c-4seriesunavailable. Conditional retain-c-8 conclusion only, no equal-work/size-only inference. Audit A-22518 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22518-t-2036-evidence2-repetition-scope-corrected-c1-clear.md. No Reviewer execution or source change.

Criteria: C1 verified.

### coord · 2026-11-21T16:39:34.085Z

Closed without a merge: the task branch carries no code change, so this is an evidence-only measurement. C1 is verified (rev-35, A-22517). The comparison is in A-22515 (comparison.md, wording-corrected in A-22517). At the same head 895ad0152, unsharded with 2 workers, c-8 run 66f497e2 (A-22307) completed T0–T3 and Web green. The c-4 run f98eed3f (A-22514) ended exit 124 on the 75-minute run limit after T0–T2, with T3 partial and Web unexecuted, and 0 observed failures. The completed tiers were slower on c-4: T1 197 s against 177 s, and T2 1,217 s against 963 s. Implication: keep c-8 at the current run deadline. A full unsharded suite does not fit c-4 within 75 minutes. Confirmed machine cost for the pair was $0.443.
