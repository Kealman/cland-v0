---
id: T-1909
kind: task
title: A site-only dev commit rebuilds a green merge batch whose tiers never run the site tests
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1794
branch: t/T-1909-a-site-only-dev-commit-rebuilds-a-green
created: 2026-11-16T10:35:08.568Z
updated: 2026-11-25T14:18:57.338Z
---

## Summary

At landing, batch 2003cd37 (T-1878, T-1876, T-1731; green run f55eb067, A-19971) was rebuilt because `cland publish` had merged one `site/src/content/log/*.mdx` file into dev ("commit 35e9b71d0 changed batch test inputs"). The batch tiers are T1 and T3, which don't run the site's own tests, so a rerun of about 45 minutes bought no coverage.

## What to build

The batch's test-input check counts a changed path only when a test in the batch's configured tiers can read it. A `site/**`-only change does not rebuild a hub batch unless a selected tier covers site files. Tracker and docs paths stay exempt, as now.

## Acceptance criteria

- [x] C1. A dev commit that changes only `site/**` while a batch is running lands the green batch without a rebuild, when no selected tier reads site files (test, red before the fix).
  - done: impl-1909 · 2026-11-25T14:17:00.335Z
- [x] C2. A commit that changes a file a selected tier reads still rebuilds the batch, as today (test).
  - done: impl-1909 · 2026-11-25T14:17:00.543Z

## Comments

### impl-1909 · 2026-11-25T14:07:49.185Z

Consumer census before policy change: batchRebuildReason is called by dispatch.ts and merge-batches.test.ts/merge-queue.test.ts; BatchBoundary.rebuildReason is called by MergeBatches landing and faked by merge-batches.test.ts, suite-persistence.test.ts, test-lint-policy.test.ts. Current classification shares refusedOverridePaths with immediate human override, which must remain unchanged. Direct site readers include T1 install-claims (recursive site/src text and site/public shell scan), remote-docs (site/test imports), qa-demo-policy (capture-safety import); T2 skills-onboarding, users-docs-invite, hosts-docs-pool and screenshot-capture; T3 install-script. Other site mentions in publish fixtures, duration/selection fixtures, prerequisite/build guard tests are synthetic data. No production change yet: question sent to lead about current T1 scanning the exact reported log path.

### impl-1909 · 2026-11-25T14:15:49.113Z

Coordinator decisions in topic-1794 narrowed this S item: only site/src/content/log/** on recorded built-in T3-only plans can reuse. T1/T2/T4, borrowed T1 receipts, Web additions, custom/missing commands and all other non-exempt paths still rebuild. No install-claims coverage change or immediate override change. Added optional in-process proof argument from the durable evidence job through MergeBatches/dispatch to batchRebuildReason; existing fake boundaries ignore it, older calls without it remain conservative. No persisted or wire fields added. C1 observed red: landing assertion actual [] versus expected [T-1]; after fix 165/165 changed-file tests pass on macOS arm64 Node 24.21.0 with fake executor receipts. Typecheck and full test:lint pass (0 refusals). No configured verify submitted; spending hold remains until Coordinator window after 00:00 UTC.

### rev-40 · 2026-11-25T14:18:57.338Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1909-source1
commit: f9bb5870a6904a6ce9517808738dd6f50fee4bdc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23470 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23470-t-1909-source-clear-at-f9bb5870a.md), no findings. Coordinator-approved scope 700b4015/83c0f0c9 is implemented: only release-log paths on recorded built-in T3-only plans; missing/custom/other-tier/Web/borrowed-T1 proof remains conservative. Durable evidence.job supplies optional policy proof; immediate override and old absent-proof callers unchanged. Required named T3/T4 lexical source-reader guard and direct/recursive positive controls retained. Landing reuse/rebuild and diff/history work counts inspected. Local A-23467 changed165/165 plus direct123/123/static0 are scoped; graph706 is selection, not coverage. C1/C2 final marks pending exact-head configured proof with named guard and both landing identities. Human midnight UTC hold/Coordinator window retained. Reviewer made no edits or executions.
