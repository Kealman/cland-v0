---
id: T-1939
kind: task
title: transport-kind-types compiler case runs 11.8 s in a loaded full T2; move it to T3 beside typecheck.test.ts
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1881
blocked_by: []
regression_of: T-1660
topic: topic-1610
branch: t/T-1939-transport-kind-types-compiler-case-runs
created: 2026-11-17T08:45:27.406Z
updated: 2026-11-18T01:58:45.738Z
closed: 2026-11-18T01:58:45.738Z
---

## Summary

T-1660's case `hub/test/transport-kind-types.test.ts::a new transport kind compiles against the unchanged carrier contract` runs the TypeScript compiler API over the production import graph. In periodic dev T3 557d7a51 (A-20788, Linux c-8 nyc1, full T2 at load) it took 11.816 s against the enforced 5 s new-identity budget, which turned dev red. It took 2.515 s in T-1660's own verify and 1.714 s locally. The Coordinator added a dated allowance (17.8 s, owner C-216, expires 2026-11-24) so dev and task verifies stop failing. This item makes the fix permanent.

## Acceptance criteria

- [x] C1. The case runs in T3 beside hub/test/typecheck.test.ts, with its reason recorded in the tier manifest, and the T-1660 assertions are unchanged (test).
  - done: impl-1939 · 2026-11-17T23:26:56.321Z
  - verified: rev-36 [reviewer] · run rev-36-1939-final-1 · 2026-11-18T00:44:29.996Z · commit 0bde3ad44144580b926b30228ba5a34f91bf57d2
- [x] C2. The temporary allowance for the case is removed from hub/test/durations.json in the same change.
  - done: impl-1939 · 2026-11-17T23:26:56.869Z
  - verified: rev-36 [reviewer] · run rev-36-1939-source-1 · 2026-11-17T23:36:07.900Z · commit 0bde3ad44144580b926b30228ba5a34f91bf57d2
  - verified: rev-36 [reviewer] · run rev-36-1939-final-1 · 2026-11-18T00:44:29.996Z · commit 0bde3ad44144580b926b30228ba5a34f91bf57d2

## Comments

### impl-1939 · 2026-11-17T23:20:36.397Z

Consumer search: transport-kind-types path appears in tiers.json, durations.json (historical file/test baselines plus the removed allowance), per-test guide and generated guide index. Tier manifest is consumed by suite-shards/lint-tiers and suite selection/duration reporting; existing suite-tiers and durations*.test.ts cover these consumers. No wire/schema change or frozen help bytes change. C1/C2 direct manifest checks were red (T2 !== T3; allowance true !== false) before editing. Preserving historical timings; earlier T1/T2 proof is not reused for T3. Compiler assertions unchanged; only its tier header changes.

### rev-36 · 2026-11-17T23:36:07.900Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1939-source-1
commit: 0bde3ad44144580b926b30228ba5a34f91bf57d2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review: Standards clear / Spec clear, no findings. A-20949 records fixed baseline 98c597e0c1efc867c5e6e99ad789f6098223a4c3, tree ffd558b8f417cd1269421155a5be9148fcda1d6b, all four files and 170-path consumer dispositions. Only the compiler file's manifest classification changes to supported T3+scenario, beside typecheck.test.ts; executable body/assertions are byte-identical to parent. Exactly its dated allowance is removed; all other allowances, historical timing baselines and frozen help bytes remain unchanged. C2 verified statically. C1 remains pending a same-head configured runner-selected T3 receipt for the named compiler case; direct precommit node --test execution is supporting evidence, not configured T3-phase proof. A-20940/A-20947 retained 73 direct-file passes across explicitly separated precommit epochs; no exact precommit tree/raw native receipt is invented. Assignment-supplied 18.1 s upper value is labelled without an independently retained underlying run. QA none; no Reviewer runtime execution. Source hold released; lead may request Coordinator verification window. Earlier T1/T2 evidence is not reused as T3 proof.

Criteria: C2 verified.

### rev-36 · 2026-11-18T00:44:29.996Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1939-final-1
commit: 0bde3ad44144580b926b30228ba5a34f91bf57d2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20977 final same-head evidence: Standards clear / Spec clear, no findings. Source rev-36-1939-source-1/A-20949 unchanged/clean; Git treeffd558b8f417cd1269421155a5be9148fcda1d6b. Hub run0ec4d1ab-1920-46a6-9917-141431e02ab5/A-20975 finished passed, cached:null, verificationtreeeabc249d64e9a7f3f7b54cb47e3fde2b3ef2ad6b. Exact compiler identity has T3 base finish35706/timing35707 pass2.428558738s, file pass35709, T3 command end35734 exit0; one selected file/one case once, no repetitions. This supplies C1's configured T3 proof; C2 allowance-removal source verification carried forward. All710 selected base file envelopes and6686 ordinary test finishes pass (145nested included); allT0/T1/T2/changedT3/Web commands end0. A-20977's phrase 'zero command completions' means zero exit codes: all four runtime commands completed, as its table/end lines show. Separate42site load identities each5scoped pass finishes+5/5proof; no compiler repetitions. Provenance38335 Linuxx64 droplet Node24.21.0/nvim0.12.5; actual browser35740 HeadlessShell1248/ChromeTesting156.0.8078.4.269otherT3/17T4unexecuted, including typecheck.test.ts; that sibling's classification, not its execution, was source-established. T3 ratchet would-refuse growth/Web wall/lint130 advisories explicitly report-only, not owner failure or a restored-allowance request. Ticket-loss text not parsed into outcomes; no performance comparison, full diagnostic/whole-T3/native-macOS/provider/QA claim. All criteria verified; no Reviewer execution/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T01:58:45.738Z

Merged fd2f1d484aff3b13fccf892b3ed54e198717a43f onto dev.
