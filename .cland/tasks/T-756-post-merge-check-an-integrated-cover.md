---
id: T-756
kind: task
title: "Post-merge check: an integrated cover after T-755 runs within 15% of a same-tree task full run"
state: open
status: backlog
size: XS
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by:
  - T-755
topic: null
branch: null
created: 2026-10-17T20:14:33.860Z
updated: 2026-10-17T21:51:17.068Z
---

## Summary

T-755 adds a storage health receipt and moves droplet test temp roots onto tmpfs, after two integrated covers ran about 55% slower than task runs because of disk-backed SQLite and filesystem latency (A-4721). This check confirms the effect on dev once T-755 has merged.

## What to build

No code. The Coordinator runs the first integrated cover after T-755 merges, then compares its suite duration and the disk-bound files (store migration, inbox-workload) with a same-tree task full run, citing both storage receipts.

## Acceptance criteria

- [ ] C1. The first integrated cover after T-755 runs within 15% of a same-tree task full run, or its storage receipt explains the gap, recorded here with both run ids.

## Comments

### coord · 2026-10-17T20:15:11.373Z

T-755's executor change is loaded by the running hub, not by the candidate tree. So the live storage receipt and tmpfs root first appear on droplet runs after T-755 merges and the hub restarts. This check also confirms that the receipt appears in a real result header.

### coord · 2026-10-17T21:51:17.068Z

Follow-up from T-755 (impl-755, 21:43Z): T-755 adds two temporary T3 allowances in hub/test/durations.json for hub/test/executor-health.test.ts, owned by E-677 and expiring 2026-10-24. They cover the tmpfs temp root (6.18 s) and the disk fallback (5.22 s) on droplet run 86d9a076 (A-4743). Remove them once the post-merge integrated duration baseline includes these cases, and before E-677 closes or the expiry date.
