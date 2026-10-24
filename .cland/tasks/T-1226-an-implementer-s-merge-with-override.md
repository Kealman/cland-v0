---
id: T-1226
kind: task
title: An Implementer's merge with override answers 'unknown field override' instead of the human-only refusal
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
regression_of: T-998
topic: topic-962
branch: t/T-1226-an-implementer-s-merge-with-override
created: 2026-10-24T10:40:12.804Z
updated: 2026-10-24T10:46:30.611Z
---

## Summary

The Linux stage cover 4d0ec3dd at dev 44f220a5 (A-10755) fails hub/test/merge-policy.test.ts "the permission table refuses Implementer, Reviewer and QA on spoke and CLI; only the human shell overrides verdicts" (line 139): expected /only the human may override/, actual 'unknown field override; accepted fields: item, cancel'. Since T-998 (3830f7fc) validates arguments before argument-dependent permission checks, and the merge schema a non-human caller sees has no `override` field, the human-only refusal never fires. T3 test, so T-998's own verify and its T1 batch did not run it.

## Acceptance criteria

- [x] C1. `override` is a known `merge` field for every caller; a non-human caller sending it gets the human-only refusal (`forbidden`, "only the human may override"), and merge-policy.test.ts passes (test).
  - done: impl-1226 · 2026-10-24T10:44:19.067Z
- [x] C2. A truly unknown merge field still answers `invalid_argument` naming it (test).
  - done: impl-1226 · 2026-10-24T10:44:19.164Z

## Comments

### impl-1226 · 2026-10-24T10:41:45.352Z

Red reproduced on initial task head, local macOS targeted native Git test: node --test --test-name-pattern='the permission table refuses' hub/test/merge-policy.test.ts. Failure: expected /only the human may override/, actual 'unknown field override; accepted fields: item, cancel'. Using the supplied merge-policy seam plus existing T1 dispatcher/T2 spoke argument seams for regression controls. Diagnosis follows supplied T-998 cause; no speculative instrumentation needed.

### rev-31 · 2026-10-24T10:46:30.611Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1226-source
commit: 80fd78b9b4a7bfec913a0d66d0351b31f757305c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at 80fd78b9/tree f60d5c50; no findings. A-10767 audits shared-schema override string + MCP forwarding to unchanged human-only merge refusal. Availability-first and scoped/human override authority remain; truly unknown overide stays invalid_argument. T1 transport-free FakeClock refusal/notice controls and T2 exact outgoing frame/typed refusal/no extra request controls use bounded receipts and retained cleanup. Matching docs/local skill updated; wire MergeRequest already declares override. A-10763 is local development-tree 39/39/check summary, not complete native receipts. Preserve original command/output/exit/timing/source attribution, especially unchanged T3 merge-policy execution. C1/C2 final settlement pending configured mode-free same-head run plus native contract evidence; no Reviewer execution/enqueue.
