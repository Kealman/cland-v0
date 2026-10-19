---
id: T-877
kind: task
title: T-856's real-Git push proof trips the T2 process boundary; move it to an allowed tier or seam
state: open
status: backlog
size: S
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-19T13:52:09.532Z
updated: 2026-10-19T14:49:53.664Z
---

## Summary

T-856's C4 proof that the Aide's `cland push` moves the territory's dev runs real Git at T2: prepared-project Git execFileSync, territory spawnSync, a lock-probe spawn, and production push territoryGitAsync execFile. The tier rules permit only the CLI child at T2. That is report-only today (A-6073/A-6074) and accepted for T-856 by the Coordinator, but the case must move to an allowed tier or seam before T2 boundaries enforce.

## Acceptance criteria

- [ ] C1. The real territory-push proof runs at a tier whose rules allow those processes (a T3 case with the `// T3:` header), or behind an injected Git seam at T2, keeping the actual territory-dev advancement assertion. The T2 tier-mismatch report for it is gone.
