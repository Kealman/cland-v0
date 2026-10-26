---
id: T-1318
kind: task
title: "A reasonless platform skip fails the load gate on the other platform: macOS stage cover red with zero failures"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1284
blocked_by: []
regression_of: T-543
topic: topic-1070
branch: t/T-1318-a-reasonless-platform-skip-fails-the
created: 2026-10-26T00:27:25.158Z
updated: 2026-10-26T00:57:58.235Z
closed: 2026-10-26T00:57:58.235Z
---

## Summary

The macOS stage cover eb2ca0d8 at dev 998612a6 (A-12206) exited 1 with zero failing tests. T-543's new test "Linux background Claude publishes a verifiable native birth and stops through the recorded PID" uses `{ skip: process.platform !== 'linux' }`, a skip without a reason. The load gate repeats new tests five times and accepts a skip only when it carries a reason string (`hub/test/load-gate-reporter.ts` records `skipReason` only for a non-empty string), so all five macOS repetitions failed with "expected one passing receipt". The Linux cover 20f137a5 was green because the test runs there.

## What to build

Give every platform-conditional skip in the test tree a reason string, so the load gate classifies it as a skip on the other platform. Known sites: hub/test/claude-code-sessions-lifecycle.test.ts (the Linux-only native birth test) and hub/test/executor-droplet.test.ts (the macOS-only idle-sleep test). Search the hub, nvim and web test trees for any other boolean platform skip. Optionally add a test-lint finding for a reasonless boolean `skip`, report-only or enforced, matching how comparable lint rules ship.

## Acceptance criteria

- [x] C1. Every platform-conditional `skip` in hub/test, nvim/test and web/test passes a non-empty reason string on the skipping platform, and a load-gate unit or component test shows a reasoned platform skip counts as 5/5 skipped, not as a failure (test).
  - done: impl-1318 · 2026-10-26T00:34:10.910Z
  - verified: rev-26 [reviewer] · run rev-20261026-1318-evidence-1 · 2026-10-26T00:51:31.892Z · commit f85b8790db1869bbd86ffa3ce56984a635401669

## Comments

### impl-1318 · 2026-10-26T00:29:28.294Z

Initial inspection: clean inherited tree. Platform-skip audit across hub/test, nvim/test and web/test found three boolean platform conditions: claude-code-sessions-lifecycle.test.ts:136, executor-droplet.test.ts:387 and visibility.test.ts:55. codex-workspace-git.test.ts already gives a reason; nvim platform prerequisites use reasoned sandboxSkip/nvimOrSkip. Planned seams: T1 lintTestSource regression for reasonless direct platform skip declarations (optional report-only finding), and existing T3 durations-runner prerequisite receipt fixture extended with a reasoned platform condition to prove 5/5 skipped. No wire, admission or verifier selection change. The lint finding is additive/report-only: consumers audited are test-lint-policy.ts (explicit enforced rules), lint-tests.ts report CLI, test-lint.test.ts, test-lint-policy.test.ts, suite-selection tests and CLI lint-report consumers; all retain their existing formats and enforcement.

### impl-1318 · 2026-10-26T00:32:00.684Z

TDD and audit receipts (local macOS, working tree): new T1 case `test skips report reasonless boolean conditions and accept platform reason strings` first failed with actual [] vs expected skip-reason for process.platform !== 'linux'; after implementation the lint file passed 35/35. Positive inventory before fixes listed exactly claude-code-sessions-lifecycle:136, executor-droplet:387, visibility:55; the same inventory is now empty. Existing T3 `one load-gate fixture distinguishes all seven prerequisite receipt shapes` extended with an actual platform conditional passed in 5.693 s, asserting exit-zero positive-only run and exact reasoned 5/5-skipped summary, plus retained negative controls. No new T3 identity; existing 13.6 s allowance retained. Report-only finding consumers also audited: hub/src/hub/suites.ts census summary, suite-check/dry-run/protocol/admission/admission-cost/merge-gate tests, qa/briefs/E-676.md lint expectations; explicit enforced category lists exclude skip-reason, old report shape/reader behavior unchanged. New-client/older-hub shape unaffected because no protocol change.

### rev-26 · 2026-10-26T00:35:34.297Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1318-source-1
commit: f85b8790db1869bbd86ffa3ce56984a635401669
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source CLEAR; A-12208 at tree 0d3827b278a1eb9836e633bed5bc3a1db2ef6542. Standards/Spec 0 findings. Three platform predicates retain their run behavior with nonblank excluded-platform reasons; other sandbox/client prerequisites already reasoned. New direct skip-reason lint is explicitly report-only with lexical binding/false-positive controls, not an admission change. T1 reporter and retained T3 positive-only/mixed fixture prove 5/5 skipped without 5/5 passed, keeping invalid receipt negatives. Native bodies/selection/allowances unchanged. A-12207 local macOS 94 passes/1 reasoned Linux-only skip is supplementary, not Linux/configured proof; preserve original outputs/exits/capture limits. C1 runtime remains pending ordinary mode-free same-head verification after any active Coordinator quiet window is released; then final evidence review. No reviewer execution or new full/forced run requested.

### rev-26 · 2026-10-26T00:51:31.892Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1318-evidence-1
commit: f85b8790db1869bbd86ffa3ce56984a635401669
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR; A-12214 carries source1/A-12208 and original 5c8b8b7e/A-12213 exit 0. Actual deduplicated ordinary3377pass/1reasoned skip,450filepasses; separate10loadpasses, both new T1 identities5/5. T0/all T1/fallback all T2/four changed T3 once/Web complete; remaining T3/T4 absent. C1 reporter and report-only lint controls pass; actual native prerequisite fixture11.947594073s passes its exact5/5-skipped/no5/5-passed and invalid-receipt assertions (inner captured output not separately printed). Linux Claude native birth runs/pass3.900891903s; macOS inhibitor actual skip reason at17072, not a pass; POSIX wait runs/pass. Native54pass/1skip; selected added52.104s excludes machine wait, no repetitions. Linux c-8lon1 Node24.21/Neovim0.12.5 HeadlessShell156.0.8078.4/v1248 workers2 lifetime833s/$0.0579; host prepared-tree gate not remotely repeated typecheck. Lint/budget/printed allowance advice remain report-only, source allowances unchanged. C1 verified, Standards/Spec no findings. Coordinator owns enqueue/landing/after-stage QA; reviewer reads only.

Criteria: C1 verified.

### coord · 2026-10-26T00:57:58.235Z

Merged 8ec6895070bc8866ae315ba7ba174014e4a6dc45 onto dev.
