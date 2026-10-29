---
id: T-1445
kind: task
title: Fake-droplet tests leak a polling 'npm test' and node pair whenever a run ends without writing the finish file
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-29T16:09:32.114Z
updated: 2026-10-29T16:09:32.114Z
---

## Summary

On 2026-10-29 the Mac had 97 orphaned `npm test` processes (ppid 1, 10–15 days old), each with a `node -e` child that checks every 50 ms for `$HOME/finish`. Their cwd was `…/T/cland-fake-do-*/droplet-*/home/runner/cland`. That's about 194 processes, adding load while swap was nearly full (396 MB free). Coord stopped them with SIGTERM; free swap rose to 1.5 GB. Tests that start that finish-polling child: `executor-safety`, `executor-run`, `suite-candidate`, `suite-close-recovery` and `suite-remote-process`. A run that ends, is cancelled or times out without writing `finish` leaves the pair running forever.

## What to build

Every fake-droplet run's remote command exits or is killed when its test or fixture ends: write `finish`, or kill the process group in the fixture's cleanup, including timeout and abort paths. The poller itself also gives up after a bounded time. Add a census assertion so a leaked pair fails the test.

## Acceptance criteria

- [ ] C1. Each listed test file leaves no `npm test` or finish-polling `node` process behind after it passes, fails or is aborted, shown by a process census in the test.
- [ ] C2. The finish poller exits by itself after a bounded time even if nobody writes `finish`.
