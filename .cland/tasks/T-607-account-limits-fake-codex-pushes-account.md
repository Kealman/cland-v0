---
id: T-607
kind: task
title: account-limits "fake Codex pushes account windows and sparse per-model updates while reads are held" counts 6 where 4 are expected on a loaded Mac
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - needs-triage
  - hub
  - flaky
assignee: null
parent: E-952
blocked_by: []
topic: topic-718
branch: t/T-607-account-limits-fake-codex-pushes-account
created: 2026-10-16T12:29:35.335Z
updated: 2026-10-20T09:59:38.737Z
---

## Summary

The v0.1.3 macOS release run dbf1b763 at 0e2a0aee (A-3904, darwin arm64, peak load 13.3) failed hub/test/account-limits.test.ts, "fake Codex pushes account windows and sparse per-model updates while reads are held", with `6 !== 4` after 2.17 s. The droplet release run c01507ab at the same head passed it. It looks like a count that depends on timing under load: extra pushes are observed while the reads are held.

## Acceptance criteria

- [ ] C1. Every write of the Codex rate-limits fixture is atomic (same-directory temp file plus rename), and account-limits.test.ts passes 20/20 sequential whole-file runs plus a green mode-free verify at the reviewed head.

## Comments

### impl-607 · 2026-10-20T09:43:40.307Z

A-7125 triage confirmed the fixture truncate/write window can trigger fake Codex's 6% fallback. Changed only hub/test/account-limits.test.ts: same-directory temp write then rename for all Codex rate-limits snapshots. Existing native-contract T3 waits and assertions retained; no new processes or time waits. Baseline file passed; root npm run typecheck passed. Running 20 complete-file repetitions sequentially, no stress load; source review precedes mode-free verification.
