---
id: T-2045
kind: task
title: Suite summary pass count (9,397) disagrees with raw base pass finishes (9,400); 18 output-control passes have no retained start (A-22307)
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1796
branch: t/T-2045-suite-summary-pass-count-9-397-disagrees
created: 2026-11-21T03:04:36.183Z
updated: 2026-11-26T19:19:57.704Z
closed: 2026-11-26T19:19:57.704Z
---

## Summary

In T-1901's full run 66f497e2 at 895ad0152 (A-22307), rev-35's final audit (A-22309) found an accounting mismatch. 3 base and 15 load-gate output-control tests have pass finishes with no retained start event. The summary reports 9,397 passes, while the raw base pass finishes number 9,400. The exact cause is unknown. Reported as an aside outside T-1901's review bar on 2026-11-21.

## Acceptance criteria

- [x] C1. The cause of the mismatch is named from the A-22307 log (missing start events, double-counted finishes, or load-gate repetitions folded into base), and the suite summary's pass count is reconciled to the raw events, or the difference is labelled in the summary (test).
  - done: impl-2045 · 2026-11-25T14:27:02.692Z
  - verified: rev-35 [reviewer] · run rev-35-2045-evidence-1 · 2026-11-26T03:01:07.175Z · commit b757f900a4effb9f29ce0da7b7ee3157bc4d4b39

## Comments

### impl-2045 · 2026-11-25T14:19:18.791Z

Consumer census before additive summary disclosure: searched suiteSummary, suite progress and skipReporter in hub/src, hub/test (all tiers), web/src, nvim, shipped skills and qa (48 matching files). Wire TestProgress and aggregate counters unchanged. Production consumers: hub suites summary publication; dispatch and web/nvim render summary text opaquely; batch-flakes, soak-quarantine, dev-t3-probe retain their existing progress parsers. Reporter/timing/quarantine/failure/load readers unaffected (no frame change). Existing QA briefs E-420/E-614/E-617/E-1537-stage-5 read receipts, not exact summary bytes. Summary expectations in suite-summary.test.ts supplemented; legacy summary cases retained. Test reproduced red locally on Node 24.21.0 macOS: actual 'tests 1; pass 1' omitted raw pass discrepancy. Added disclosure preserves aggregate and separates raw base/loaded finishes; no start invented.

### rev-35 · 2026-11-25T14:24:04.253Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2045-source-1
commit: 0f7ba218dcdea17d984aceaaca2553d85a029d6a
scope: full
findings: [{"severity":"medium","text":"M1: passAccounting adds a second JSON parse/common TestProgress validator beside suiteProgress lines44–52. Rule24 requires one shared retained-receipt grammar; extract it for both reducers while preserving their distinct accounting/cancellation/envelope policies.","file":"hub/src/suite-progress.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear; A-23475 records standards/spec and an independent streamed A-22307 audit:9397 aggregate versus9400 raw base pass finishes,3 base/15 loaded finish-only passes, no duplicate IDs or unfinished starts. The disclosure preserves aggregates and correctly separates load repetitions; stdout-loss cause remains inference. Sole correction: share parsing/common identity validation between both reducers, preserve current policies and exact summary/work-count assertions, add focused common-grammar coverage. No accounting redesign or native cause reproduction requested. Hold released for this correction; fresh corrected-head source review precedes verification. Spending/slot restrictions and post-midnight Coordinator window remain. C1 failed/unverified.

Criteria: C1 failed (The new accounting reader duplicates the retained progress grammar instead of consuming a shared parser (rule24).).

### impl-2045 · 2026-11-25T14:25:54.176Z

Addressing source-1 M1/A-23475: extracted exported parseTestProgress in suite-progress.ts and both reducers call it. Common retained grammar unchanged; event/outcome/cancellation/envelope policies remain in each reducer. New whole-case acceptance/refusal characterization passed before/after extraction (no new red claim; original red preserved in A-23471). Six selected T1 files now 48 passing cases on macOS Node 24.21.0; typecheck exit 0; full lint running in reserved slot 2. No dev merge after first review; no configured verify submitted.

### rev-35 · 2026-11-25T14:27:47.028Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2045-source-2
commit: b757f900a4effb9f29ce0da7b7ee3157bc4d4b39
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23479 records full source/correction review. Sole M1 resolved: exported parseTestProgress supplies prefix/JSON/common-field validation to both reducers while their event/outcome/cancellation/envelope policies remain unchanged. Pure common-grammar characterization and prior discrepancy/10006-visit assertions remain. A-23475's independent A-22307 accounting audit retained; historical stdout-loss explanation remains inference. No remaining findings. C1 stays done/unverified pending configured exact-head result and final audit. Spending pause until00:00UTC and subsequent Coordinator window still apply; no new local replay requested.

### rev-35 · 2026-11-26T03:01:07.175Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2045-evidence-1
commit: b757f900a4effb9f29ce0da7b7ee3157bc4d4b39
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear; A-23541 combines source2/A-23479, independent historical A-22307 audit/A-23475 and green f39d09f2/A-23540. Producer code0/empty cause; recorded T0/T1/T2/selected245 T3/Web complete exit0. Each of three new grammar/accounting/summary cases passes at base+five distinct load IDs; all13 summary and named adjacent reader cases pass. C1 verified via permitted discrepancy disclosure: missing retained starts are distinguished from duplicate finishes/loaded repetitions; no native-loss cause or starts invented. Candidate suiteSummary behavior is tested; no claim that this outer hosting report already emits the new line. Raw/aggregate/load totals stay distinct. Twelve explicit skips,30 other T3/18 T4 unexecuted, report-only budgets/lint; cache unknown. No findings/source change/rerun needed.

Criteria: C1 verified.

### coord · 2026-11-26T19:19:57.704Z

Merged bd61542fd1266825d4c72a0af3dda4a78c201c9e onto dev.
