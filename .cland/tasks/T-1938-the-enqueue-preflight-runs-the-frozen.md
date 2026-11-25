---
id: T-1938
kind: task
title: The enqueue preflight runs the frozen CLI usage compatibility test on the head merged with dev
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1793
branch: t/T-1938-the-enqueue-preflight-runs-the-frozen
created: 2026-11-17T08:28:33.210Z
updated: 2026-11-25T14:22:37.083Z
---

## Summary

The human approved (General, 2026-11-17 08:27Z, rule batch A-20783) adding `hub/test/cli-usage-compatibility.test.ts` to the check an item passes before enqueue. On 2026-11-17 three items (T-1630, T-1931, T-1869) failed late on the frozen help fixture `hub/test/fixtures/cli-usage/commands.json`, even after the instruction was added to briefs. Until then the Coordinator runs it in its own rule 36 preflight. This item moves it into the hub's enqueue preflight (H-13), beside the whole-source lints.

## Acceptance criteria

- [x] C1. `cland merge` refuses to enqueue a head whose merge with current dev fails cli-usage-compatibility.test.ts, naming the test and the first differing export (test).
  - done: impl-1938 · 2026-11-25T14:15:56.103Z
- [x] C2. A head that passes is enqueued as today, and the check's duration shows in the enqueue receipt (test).
  - done: impl-1938 · 2026-11-25T14:22:02.023Z

## Comments

### impl-1938 · 2026-11-25T14:10:13.399Z

Consumer inventory: native enqueue adapter -> checkedEnqueue -> TaskMerges -> CLI merge (existing optional preflight string, old replies supported). Resolution shared with Suites/batch paths; enqueue option leaves those paths unchanged. Tests searched across hub/nvim including T3/T4: merge-batches, merge-queue, merge-batch-dependencies, merge-recovery, verification-commands, suite-check, suite-task-selection, web-phase, session-native-lifecycle and harness/merge-component-support/plan-stage-fixture; only enqueue/configured-check expectations change. Frozen commands.json and cli-help/cli-usage compatibility migrate matching help bytes. Docs: running.md, tests.md, hub README, merge skill and file guidance. No persisted row or schema change; no role clause additions per launch brief.

### rev-41 · 2026-11-25T14:18:37.066Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261125-1938-source1
commit: 2fcfd47a0c22ff55e0dcbbb672aca9e614c8a56c
scope: full
findings: [{"severity":"medium","text":"M1: same-line subshell wrapping breaks valid configured checks ending in a shell comment. For check=\"npm run check # fast gate\", the comment consumes the closing ')' and appended compatibility command, so /bin/sh sees an unterminated subshell and a passing head cannot enqueue. Preserve shell grammar with line boundaries/equivalent composition and a regression.","file":"hub/src/verification-commands.ts","line":36}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at 2fcfd47a0c22ff55e0dcbbb672aca9e614c8a56c. Medium M1 at hub/src/verification-commands.ts:36: wrapping the configured shell command and its closing ')' on one line fails supported final-comment input, violating C2's passes/enqueues-as-today requirement. Example is source-derived; no native probe/output claimed. C2 failed; C1 remains unverified pending runtime evidence. Standards: no separate findings; Spec: one medium. Full record A-23468 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23468-t-1938-source-review-not-clear-at-2fcfd47a0.md. Existing native ownership, redaction, bounded fake test setup/behaviour, optional reply shape, help/frozen bytes and matching docs inspected. A-23461 selected local macOS Node24.21 checks are partial implementation evidence, not configured closure; reviewer ran no tests. Spending pause/Coordinator window after00:00UTC remains in force; a fix needs fresh source review.

Criteria: C2 failed (A previously valid passing configured check ending in a shell comment is rendered as an unterminated subshell and refused instead of enqueued.).

### impl-1938 · 2026-11-25T14:20:23.864Z

Source review M1: trailing shell comment consumed the same-line subshell delimiter. Reproduced red in existing guarded whole-case owner: actual (configured-check # fast gate) versus expected separate delimiter lines. Fixed command composition with explicit newlines; focused regression and full merge-batches 162/162 now pass on local macOS Node 24.21.0. Final typecheck/full lint queued before fresh review; no merge from dev and no verify submission.

### rev-41 · 2026-11-25T14:22:37.083Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-1938-source2
commit: de198c8a16386b6ca3d75d651b14d56640da5163
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at de198c8a16386b6ca3d75d651b14d56640da5163. M1 resolved by newline-delimited subshell composition with retained final-comment real-resolver regression; existing rejection/admission/cleanup/duration and capability controls remain guarded and bounded. Standards 0, Spec 0 findings. Record A-23473 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23473-t-1938-source-review-clear-at-de198c8a1.md. C1/C2 done but runtime-dependent/unverified pending configured same-head evidence. A-23472 records local macOS Node24.21 corrected T1 177/177, full typecheck/lint0 per request; A-23461's 345 tests remain prior-head evidence. No native shell/comment execution, configured closure, browser/T3/T4 or Reviewer run claimed. Spending pause/Coordinator window after00:00UTC remains; deployment/restart needed before relying on new hub capability.
