---
id: T-440
kind: task
title: account-limited.test.ts waits on real reset and backoff clocks (about 100 s per file)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-14T20:25:41.982Z
updated: 2026-10-15T04:29:29.913Z
---

## Summary

`hub/test/account-limited.test.ts` takes about 101.7 s per targeted run under load, all green (T-389, impl-389, 2026-10-14). The case 'mark survives restart; live re-find succeeds, reset lifts the mark…' sets reset = Date.now() + 30_000 and waits for the real expiry (32.2 s). The two after-hit minimum and backoff cases cost 13.8 s and 17.7 s. Move these waits onto short controlled schedules or test timing knobs, keeping the restart and the refusal staged before the reset.

## Acceptance criteria

- [ ] C1. The file runs in under 40 s on an idle machine, with every assertion unchanged in meaning.
- [ ] C2. The refusal before the reset and the lift after it are both still observed after a hub restart.

## Comments

### coord · 2026-10-15T04:29:29.913Z

Seen failing: account-limited.test.ts:236 ('after-hit read waits for a recent failed poll backoff and duplicate hits share it'). The deferred poll did not supply the reset within 15000 ms (line 261), in T-254's gate 938db829 (A-2679), 2026-10-15 04:28Z. Its real-clock backoff waits make it load-sensitive.
