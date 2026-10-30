---
id: T-1457
kind: task
title: test:tiers refuses a duration allowance owned by a task-kind item
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1233
branch: t/T-1457-test-tiers-refuses-a-duration-allowance
created: 2026-10-30T05:44:57.517Z
updated: 2026-10-30T10:22:56.920Z
closed: 2026-10-30T10:22:56.920Z
---

## Summary

A duration allowance owned by a task closes with it and strands the allowance; `test:tiers` should refuse a task-kind owner and name the key. Not yet implemented (315af806 only re-owned entries). Sources: T-707, T-761. Rule batch 4 C5 (A-14151).

## Acceptance criteria

- [x] C1. An allowance whose owner is a task is refused by test:tiers with its identity and owner.
  - done: impl-1457 · 2026-10-30T10:21:16.087Z
  - verified: rev-31 [reviewer] · run rev-20261030-1457-final1 · 2026-10-30T10:22:47.519Z · commit b4cc221787ebddba283965cf559e01131e6b2af1

## Comments

### impl-1457 · 2026-10-30T10:20:22.899Z

T-1457 already delivered evidence

Head and freshly fetched origin/dev: b4cc221787ebddba283965cf559e01131e6b2af1. No source changes.

Original implementation: c14711256aa4a02f19575fa27baa6958939f418c, “test:tiers refuses a duration allowance owned by a task, so a merge can't make dev's manifest invalid (T-761)”; Item T-761; Reviewed-by rev-31 (rev-20261018-761-final).

Call chain: package.json test:tiers -> hub/test/lint-tiers.ts -> hubShards -> lintDurations -> lintDurationManifest with durationOwners. Production refusal includes task owner, allowance key, source line and suggested open ancestor container. Already enforced; this item enables no new gate.

Local execution: node --test <absolute hub/test/suite-tiers.test.ts>, Node v24.21.0, Darwin arm64, local executor. Child cwd, HOME, XDG and Git config were disposable and environment sealed with fixtureEnvironment. All 16 cases passed; no failures, cancellations, skips or todos. Exact criterion case: “test:tiers refuses an open task allowance with its line and open epic replacement” (passed). Whole-file receipt duration_ms 672.707625; no full suite, typecheck, lint suite, browser or remote verification ran.

Current manifest audit: 354 allowances. All resolve to E-880, kind epic, state open (parent C-327, open category). Task-owned allowances: 0. Existing production lintDurationManifest(source, owners) passed. Read only audit used durationOwners and lintDurationManifest; no new check or policy change.

### rev-31 · 2026-10-30T10:22:47.519Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261030-1457-final1
commit: b4cc221787ebddba283965cf559e01131e6b2af1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Already-delivered evidence clear,C1verified,A-14249. Existing c14711256/T-761 implementation persists at b4cc22178;no source delta or new gate. Inspected production test:tiers→hubShards→lintDurations→owner-aware lintDurationManifest and exact refusal owner/key/source-line behavior. A-14248 transcribes original retained tool outputs:exact case 'test:tiers refuses an open task allowance with its line and open epic replacement' pass8.742041ms;whole T1 file16/16,0nonpass,native exit0,Darwinarm64 Node24.21,localsealed scratch. No full suite/typecheck/browser/remote or new execution claimed. Manifest audit354allowances allopen epicE-880,0taskowners,productionlintpass. A-14244 summary separate. Request is closure without merge;QA none;Coordinator owns closure. No Reviewer workload or edits.

Criteria: C1 verified.

### coord · 2026-10-30T10:22:56.920Z

Already delivered by c14711256 (T-761): test:tiers refuses a task-owned duration allowance with its line and open-epic replacement. Evidence A-14244 (suite-tiers.test.ts 16/16 at b4cc22178; 354 allowances, none task-owned). Reviewer rev-31 clear at b4cc22178 (rev-20261030-1457-final1). No source change, nothing to merge.
