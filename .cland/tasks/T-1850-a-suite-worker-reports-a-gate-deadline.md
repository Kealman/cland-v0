---
id: T-1850
kind: task
title: A suite worker reports a gate-deadline expiry as 'hub stopped before worker admission completed'
state: open
status: review
size: XS
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1589
branch: t/T-1850-a-suite-worker-reports-a-gate-deadline
created: 2026-11-14T03:47:22.789Z
updated: 2026-11-17T06:08:32.195Z
---

## Summary

`hub/src/hub/suite-worker.ts:34–42` reports the same cause, "hub stopped before worker admission completed", for two different outcomes: a signal or owner shutdown, and the plain expiry of its 15 s wait for the admission gate while the hub is still alive. Found aside by T-1846: in batch a52745fe (A-19260) the gate was never written because the hub's own identity probes were intercepted by a test fixture's `ps` wrapper. The receipt still read as a hub stop, which first sent the diagnosis the wrong way.

## What to build

The worker's result names which of the two happened: a signal received (named), or the admission gate not written within the named 15 s bound. The run log and the native completion carry the distinct cause. Consumers that match on the old text are found and migrated (rule 20).

## Acceptance criteria

- [x] C1. A worker whose gate is never written, while no signal arrives, reports a gate-deadline cause naming the bound, distinct from a signal stop (test).
  - done: impl-1850 · 2026-11-17T06:05:33.738Z
- [x] C2. A worker that receives SIGTERM before admission reports the signal cause, and every consumer of the old cause text is listed on this item and still passes (test).
  - done: impl-1850 · 2026-11-17T06:05:34.274Z

## Comments

### impl-1850 · 2026-11-17T05:52:36.841Z

Rule 20 consumer inventory before changing the emitted cause: exact-text searches across production, all hub/nvim/web test tiers and fixtures, docs, QA briefs, .agents and tracker find only suite-worker.ts (producer) plus historical tracker prose (T-1850/T-1852/T-544), no exact-text parser. suite-worker emits cause in Finished and result.json; executor/local.ts reads result.json generically; hub/suites.ts reads/persists outcome.cause and builds suiteSummary; suite-cover.ts classifies known prefixes (old and new admission causes both retain existing fallback); dispatch.ts, journal.ts, merge-batches.ts and dev-t3-result.ts forward/report generic cause strings. suite-infrastructure.ts preserves ordinary code/cause and reserves only its explicit infrastructure prefix. T-204 tooling/retro searches find no retained script matching this text; suiteSummary and run-log/result readers accept arbitrary strings. QA briefs E-1531/E-579/E-426 and suite-timeouts fixtures reference worker/Finished/admission, not this text. No wire shape changes. Existing old-shaped {code,cause} receipt regression will be retained alongside new cause tests. Existing suite-summary/suite-worker-cause tests cover generic readers; no native file needed. Red observed on Node 24.21.0/macOS: expected 'worker admission gate wait expired after 15000 ms', actual 'hub stopped before worker admission completed'; 1 fail, 2 pass, pure fake clock/gate.

### rev-35 · 2026-11-17T06:01:03.625Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1850-source-1
commit: 5c76543443740b52b87fb74bf36aeb8b6d0a8597
scope: full
findings: [{"severity":"medium","text":"Denied admission still runs native setup; failures at lines 45–59 replace the selected gate-deadline cause in catch 103–105 before Finished/result.json. Preserve the terminal admission cause and cover the actual completion handoff under failing setup.","file":"hub/src/hub/suite-worker.ts","line":39},{"severity":"medium","text":"Separate now/pause injection and scalar-clock tests violate docs/agents/tests.md:469's complete Clock requirement; migrate the wait/tests to the shared Clock model.","file":"hub/src/suite-worker-admission.ts","line":5}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source review at exact unchanged head/tree 148e736e0a121c9d1b71ac974bd0f848dd3f081b. Two medium findings, Spec then Standards; details and evidence limits in A-20678. Lead confirms both gaps and no approved exception; Coordinator agrees C1 finding. C1 failed; C2 runtime/consumer-pass requirements unverified, no verified criteria in this pass. A-20667/A-20671 local dirty-candidate T1 11/11 and typecheck/lint receipts are qualified, not native worker-handoff or configured coverage. No Reviewer tests/probes/edits. Fresh source review after correction, before configured verification.

Criteria: C1 failed (Native metadata/setup failure after gate expiry replaces the required named deadline cause in the actual completion receipt.).

### impl-1850 · 2026-11-17T06:03:55.009Z

Review correction in progress (A-20678). New owner regression first failed: actual persisted cause 'cannot establish compatibility lease identity', expected 'worker admission gate wait expired after 15000 ms'; node --test hub/test/suite-worker-cause.test.ts exit 1, 5/6 pass, 1 fail. Fixed by actual executable delegation to runWorkerWithAdmission: rejected admission skips native setup and logs/persists terminal cause with complete shared Clock. After fix, suite-worker-cause + suite-summary 11/11 pass; hub typecheck exit 0; cli-usage-compatibility + cli-help 10/10 pass in sealed fixture (T1 + targeted T2; no frozen help bytes changed). Same local macOS Node 24.21.0. Full configured verification still not run. Existing wire/readers unchanged; platform intentionally absent when no native setup ran, rather than probing after failed admission.

### rev-35 · 2026-11-17T06:08:32.195Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1850-source-2
commit: 2101be35796b8907da0aee7ef5256b21f5e88276
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source review of reworked completion owner, source tree f7e0091552a17b9773204de97d022993ac7a34a9; A-20685. Both A-20678 findings are corrected: actual executable delegates admission/completion, denied admission skips native setup, exact log/persist tests use throwing setup control, and shared Clock governs timestamps/scheduling. No new findings; prior-shaped outcome/export compatibility retained, optional platform safely absent before setup. C1/C2 are source-correct but remain unverified pending same-head configured run; no verified marks in this source pass. A-20683 local working-source 11/11 T1 plus targeted T1/T2 help10/10/typecheck/lint are qualified, not configured exact-head evidence. Preserved pre-existing log-before-persist order was separately reported to lead as S Tech debt. No Reviewer runtime/probe/edit. Follow Coordinator verification window policy.
