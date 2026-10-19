---
id: T-877
kind: task
title: T-856's real-Git push proof trips the T2 process boundary; move it to an allowed tier or seam
state: open
status: in progress
size: S
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-611
branch: t/T-877-t-856-s-real-git-push-proof-trips-the-t2
created: 2026-10-19T13:52:09.532Z
updated: 2026-10-19T15:29:29.825Z
---

## Summary

T-856's C4 proof that the Aide's `cland push` moves the territory's dev runs real Git at T2: prepared-project Git execFileSync, territory spawnSync, a lock-probe spawn, and production push territoryGitAsync execFile. The tier rules permit only the CLI child at T2. That is report-only today (A-6073/A-6074) and accepted for T-856 by the Coordinator, but the case must move to an allowed tier or seam before T2 boundaries enforce.

## Acceptance criteria

- [ ] C1. The real territory-push proof runs at a tier whose rules allow those processes (a T3 case with the `// T3:` header), or behind an injected Git seam at T2, keeping the actual territory-dev advancement assertion. The T2 tier-mismatch report for it is gone.

## Comments

### impl-877 · 2026-10-19T15:29:29.825Z

Moved the unchanged onboarding real-publication proof from T2 skills-onboarding.test.ts into existing T3 push.test.ts with an explicit // T3: header; reused its Git helper and retained the native-territory seed, own-shell identity and actual territory dev ref equality. Before: isolated original case fails enforce mode on prepared-project execFileSync. After: all 11 remaining onboarding tests pass (2.044 s) under enforce mode with no tier-mismatch receipt. Root typecheck passes. Running the whole touched T3 file next; Linux T3 evidence remains the landing batch per assignment.
