---
id: T-2030
kind: task
title: fake-claude-cleanup 'final census detects dropped cleanup' exceeds its 5 s T3 budget under load (5.021 s), failing the stage cover
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: topic-1676
branch: t/T-2030-fake-claude-cleanup-final-census-detects
created: 2026-11-20T08:27:59.701Z
updated: 2026-11-20T09:38:29.424Z
closed: 2026-11-20T09:38:29.424Z
---

## Summary

The Linux stage cover f315d006 at dev 3d2de496f (log A-22121) exited 1 with no failing test, only an enforced per-test T3 duration budget: `hub/test/fake-claude-cleanup.test.ts::fake Claude final census detects dropped cleanup 5.021 s > 5 s (add to hub/test/durations.json with a reason)` on shard 2 under suite load. Earlier samples were 3.5 to 4.2 s. T-2026 (atomic marker publication) landed in that file just before.

## What to build

Either make the case fit its budget by removing avoidable waits, without changing its assertions, or add a duration allowance for that identity at about 1.5 times the worst observed sample, with owner C-216, the lint's span and a reason naming this cover. Record the samples used.

## Acceptance criteria

- [x] C1. The case's worst observed Linux sample is within its budget or its allowance, and the durations manifest lint passes (test).
  - done: impl-2030 · 2026-11-20T08:31:10.434Z
  - verified: rev-35 [reviewer] · run rev-35-2030-evidence-1 · 2026-11-20T08:59:52.663Z · commit b40e8a0e40d29bc650463f6e6f65a8b64f830697

## Comments

### impl-2030 · 2026-11-20T08:31:10.674Z

Added exact 7.6 s allowance with owner C-216 and seven-day span. Samples: A-22121 cover f315d006 Linux worst 5.021 s, earlier 3.5–4.2 s. Recorded-sample production checker replay red before, green after; manifest lint, 241 selected T1/T2 tests, full test:lint and typecheck passed on macOS arm64 Node 24.21.0. Evidence A-22125. No native run.

### rev-35 · 2026-11-20T08:34:15.171Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2030-source-1
commit: b40e8a0e40d29bc650463f6e6f65a8b64f830697
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at b40e8a0e40d29bc650463f6e6f65a8b64f830697/tree686c0910; no findings, A-22126. Seven-line exact-case allowance7.6s, open standing categoryC-216, addedNov20/expiresNov27at00:00UTC matches parser's seven-day rule and task scope. Original A-22121 structured case receipts independently confirm max5.021069748s (basepass plus five passing repetitions); retained enforcing budget line5.021>5 caused the cover red.7.6is~1.51x worst. Semantic comparison shows every baseline/default/budget/other allowance unchanged, with no assertion/production changes. A-22125's local replay/lint/241selectedT1T2/typecheck claims retain authored-synopsis and platform limits; replay is not a native T3 pass. No new C1 verification: await exact-head configured result after Coordinator window. Original cover stays failed; no Reviewer execution/edit/probe. Hold released.

### impl-2030 · 2026-11-20T08:58:08.895Z

Configured verify 80a6de37-5598-428b-931f-42072a9c3638 at unchanged reviewed b40e8a0e40d29bc650463f6e6f65a8b64f830697 exited 0: 7122 passed, 0 failures/cancelled/skipped. T0 host check and droplet Linux x64 Node 24.21.0 T1/T2/Web completed; task fallback ran all T2. T3/T4 not executed in this run; T3 remains in merge batch. Duration gates report-only; existing overages do not count as enforced-budget evidence. Log A-22129; droplet lifetime 1281 s, cost $0.0890. Reviewer received same-head result for final settlement.

### rev-35 · 2026-11-20T08:59:52.663Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2030-evidence-1
commit: b40e8a0e40d29bc650463f6e6f65a8b64f830697
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; no findings. A-22130 audits producing80a6de37/A-22129 and current source verdict A-22126. Exact head b40e8a0e40d29bc650463f6e6f65a8b64f830697, canonical verification tree119d3836 distinct from Git tree686c0910.7122/7122 base passes,6977 top-level/145 nested,733 file passes;7855 unique paired IDs, no missing/duplicate or fail/cancel/skip/todo. T0hostcheck plus all237T1/441T2/55Web completed;272T3 including census deferred,18T4 unexecuted, no load repetitions/current census sample claimed. C1: original audited Linux worst5.021069748s lies under exact7.6s allowance (1.51362x), while original cover red remains red. Current log9495 positively passes shipped-allowance standing-owner/production lintDurationManifest control; T0full lint0refusals. C-216/Nov20–Nov27 allowance and unchanged assertions/baselines/defaults match source review. Droplet Linuxx64 c8ams3 Node24.21/Nvim0.12.5, isolated Headless1248/Chrome156; cached:null. Host gate not repeated remotely, advisories report-only, machine lifetime/cost not wall. C1 verified; hold released. No Reviewer edits/runtime/checks/probes.

Criteria: C1 verified.

### coord · 2026-11-20T09:38:29.424Z

Merged 850d5b5172df1ba8b181855dff35631eb5928e00 onto dev.
