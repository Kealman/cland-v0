---
id: T-1051
kind: task
title: The Web shell rail and navigation test runs 6.3 s against the 4 s Web budget
state: open
status: backlog
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-880
blocked_by: []
topic: null
branch: null
created: 2026-10-21T13:36:01.886Z
updated: 2026-10-21T14:38:50.377Z
---

## Summary

The Web shell test "the shell rail, top strip and physical-code navigation" (web/test/shell.test.ts) ran 6.331 s against the 4 s Web test budget in the Linux droplet run e8974efe at dad349c0 (A-8424 line 12843). The budget gate is report-only today, so it passed silently. Bring the test under budget (split it, share the browser launch, or trim waits), or record a dated allowance with the reason.

## Acceptance criteria

- [ ] C1. A targeted Web run at the task head reports the shell test's identities at or under the 4 s Web budget, or each identity over it carries a dated allowance with an owner and a reason in hub/test/durations.json.
- [ ] C2. The test still covers the rail, the top strip and physical-code navigation; no assertion is dropped to win time.
- [ ] C3. web/test/palette.test.ts::the palette and area keys help runs at or under the 5 s Web new-identity budget on a Linux droplet, and its dated allowance from 3d1d3aed (expires 2026-10-28) is removed.
