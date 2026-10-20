---
id: T-452
kind: task
title: "Tracker conflict captures pile up: 1,661 .conflict files in .cland/tasks with no pruning"
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1006
blocked_by:
  - T-1009
topic: topic-758
branch: t/T-452-tracker-conflict-captures-pile-up-1-661
created: 2026-10-15T05:56:39.354Z
updated: 2026-10-20T17:47:01.659Z
---

## Summary

`.cland/tasks/` holds 1,661 `<item>.md.<uuid>.conflict` captures (2026-10-15 06:00Z), written at hub/src/tracker/tracker.ts:1825 when a tracker write finds a concurrent change. They are gitignored, so nothing prunes them and nobody sees them. Several are from this build's own body and criterion edits, for example E-386 at 03:45Z and 04:01Z. Decide on a retention policy (age or count), surface captures that differ from the committed file in `cland doctor` or `hub status`, and prune the rest.

## Acceptance criteria

- [x] C1. Captures older than the retention bound are pruned automatically, and the bound is documented.
  - done: impl-452 · 2026-10-20T17:38:04.624Z
  - verified: rev-23 [reviewer] · run rev-20261020-452-final · 2026-10-20T17:47:00.192Z · commit 5a2232d97f56bbe7cc6f4338fd9524c995528d85
- [x] C2. `cland doctor` reports the number of live captures, and names those whose content differs from the item's current file.
  - done: impl-452 · 2026-10-20T17:38:05.239Z
  - verified: rev-23 [reviewer] · run rev-20261020-452-final · 2026-10-20T17:47:00.192Z · commit 5a2232d97f56bbe7cc6f4338fd9524c995528d85

## Comments

### impl-452 · 2026-10-20T17:37:27.700Z

Implemented seven-day retention using latest mtime/ctime/birthtime, asynchronous startup and hourly passes outside request queue, active-intent protection, exact finalized capture matching and no canonical item deletion. Doctor reports live regular capture count and differing filenames/missing items, read-only including --fix. Scratch tempProject fixtures isolate HOME/XDG/Git/provider state; local macOS targeted retention tests 3/3 and doctor tests 19/19 passed on implementation tree, typecheck passed after authorized T-1017 shared fix. No prune or probe ran against live tracker. Docs/help and provisioned tracker guide updated; per-item QA policy none. Exact-head raw evidence follows.

### rev-23 · 2026-10-20T17:39:50.450Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-452-source
commit: 5a2232d97f56bbe7cc6f4338fd9524c995528d85
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Exact finalized regular-capture matching, strict seven-day max(mtime/ctime/birthtime) boundary, active-intent/conservative-error protection and canonical/tmp/symlink preservation reviewed. Async startup/hourly maintenance is outside request queue, single-pass with error reschedule and shutdown abort/drain. Doctor read-only count/differing names and matching help/README/repo+provisioned docs align. Three T1 maintenance tests and T2 doctor case use owned scratch/fake time/completion receipts. A-7828/7829/7830 local Mac targeted stdout inspected; no Linux/full-suite claim, lint report-only. C1/C2 runtime marks await exact-head mode-free gate. Audit A-7833. Reviewer ran no tests or live pruning.

### rev-23 · 2026-10-20T17:47:00.192Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-452-final
commit: 5a2232d97f56bbe7cc6f4338fd9524c995528d85
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7847/run64919481 exact-head audit:2085 ordinary tests/329 files all pass, Linux T1/all-T2 including Neovim. Retention3/3 and doctor19/19; each of four new identities actual5/5 load passes. C1 automatic retention/docs and C2 doctor counts/differing names established with source A-7833. Host8000c189 not repeated remotely; lint/budgets/ratchet report-only, two missing baselines. Lifetime361s/estimated$0.0250. No T3/T4/integrated task or QA claim; no per-item QA required. Audit A-7849. Reviewer ran no tests/live pruning.

Criteria: C1 verified, C2 verified.
