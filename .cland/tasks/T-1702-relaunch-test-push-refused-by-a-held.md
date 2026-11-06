---
id: T-1702
kind: task
title: A push to the territory is refused with "push retry required" while another territory operation holds the lock, failing relaunch tests under load
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1614
found_by: cover
topic: null
branch: t/T-1702-relaunch-test-push-refused-by-a-held
created: 2026-11-06T01:44:41.119Z
updated: 2026-11-06T03:46:48.727Z
---

## Summary

A git push to the territory from a host worktree is refused with `cland: host <h>: push retry required: another territory operation holds the lock (pid …)` while another territory operation holds the lock. Under load this fails E-1532 stage 6's relaunch tests. It's now a reproduced defect, no longer a flake, and blocks stage 6.

Occurrences:
- Merge batch 16d0ab14 (A-17000/A-17001, Linux x64 droplet, peak load 6.4): hub/test/host-relaunch.test.ts "C2/C3 admitted host relaunch running keeps durable native and checkout ownership". The f2 push was refused, and the cleanup also showed `watch …/f1/…: producer result missing; native cleanup retained`.
- Stage 6 macOS cover 2f714548 (A-17016, dev 72ba2260, darwin arm64, peak load 12.1), repetition 4 of the load gate, two cases:
  - the same host-relaunch.test.ts "running" case (pid 59575);
  - hub/test/host-relaunch-native.test.ts "C2 production Codex relaunch crosses owned carriers and consumes a fresh native first input" (pid 97177).
  Both failed with the same refusal; the stack goes through hub/src/territory.ts.
- The Linux cover 38e6c547 at the same tree was green. impl-1698's matrix (A-17002) had 30 runs with no failure at load 1.5 to 4.2.

The lock holder isn't attributed yet. The project hub and both git daemons share the test-process pid, and the fixture discards the daemons' `log` events.

## What to build

1. Name the holder. Trace territory-lock acquire and release, with the operation name, in the relaunch fixtures, and reproduce under load (macOS with a load of 12 or more, burners allowed under the preservation lock). Candidates:
   - the hub's lease transfer or relaunch preparation;
   - the old host's agent ref-watch producer (push on ref move, T-1609, and T-1693's observe order);
   - the new host's publisher;
   - a T-1698 retry or transfer path.
2. Product decision (coord, 2026-11-06): a push to the territory waits, with a bound, for a held territory lock instead of refusing at once. Waiting at most 30 s through the existing lock-wait mechanics matches the setup budgets. It still refuses with the same named message once the bound expires. A push refused by a lease (`not leased to this host`) still refuses at once. If the holder turns out to be a relaunch operation that is still running after relaunch reported running, fix that ordering as well: running means the lease transfer and preparation are complete.
3. Tests: a deterministic reproduction (red before the fix) where a push arrives while a held territory operation releases within the bound and is admitted, and another where the lock is held past the bound and the push is refused with the named message. The two relaunch tests stay unedited and pass under load.

## Acceptance criteria

- [ ] C1. The territory-lock holder at the refused push in the relaunch tests is named from a trace or a deterministic reproduction (evidence).
- [ ] C2. A territory push arriving while the lock is held is admitted once the holder releases within the bound, and refused with the named message after the bound (tests, red before the fix).
- [ ] C3. host-relaunch.test.ts and host-relaunch-native.test.ts pass unedited, 10 of 10 on macOS at a one-minute load of 12 or more, and 5 of 5 in a Linux `docker run --init` run (evidence).
