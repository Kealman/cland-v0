---
id: T-2028
kind: task
title: discord-messenger 'failed Identifies grow equal-jitter waits' hits the fake Identify admission deadline under suite load
state: closed
status: done
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-20T08:00:14.538Z
updated: 2026-11-24T08:58:51.405Z
closed: 2026-11-24T08:58:51.405Z
---

## Summary

`hub/test/discord-messenger.test.ts` "Discord failed Identifies grow equal-jitter waits through the cap; READY clears backoff" failed once in the macOS stage cover e065588f at dev 3d2de496f (log A-22117, peak 1-minute load 6.4) with `Error: Discord Identify admission receipt deadline reached` (fakes/discord/admission.ts:26, via droplet/deadline.ts:24). Run alone 5 times on the same machine afterwards, the exact case passed 5/5 (about 0.3 s each). So it's a timing-sensitive fake admission deadline under suite load.

## What to build

Reproduce with a held Identify admission, not load alone, and move the fake's admission receipt wait onto the shared load-scaled bound with a named reason, or remove the real-time dependency. Keep the backoff assertions exact.

## Acceptance criteria

- [ ] C1. A held admission reproduces the deadline failure deterministically, and the fix passes it (test).
- [ ] C2. The case passes 20/20 on macOS at a 1-minute load of at least 8 (test).

## Comments

### coord · 2026-11-21T03:32:17.041Z

Superseded by T-2046 (all fixed waits through the shared load-scaled helper, per-wait factor; human 2026-11-21, ask cdaedf29). Close as covered when T-2046 lands.

### coord · 2026-11-24T08:58:51.405Z

Closed as fixed by T-2046 (b793535d7). The Discord fake's admission deadline is now testDeadlineMs(2000, …), the shared load-scaled bound. Re-triage A-22763, approved by the human on ask 0d31338f (2026-11-24 08:58Z).
