---
id: T-1810
kind: task
title: host-restart reads the gone host's provision state before the release owner settles it (destroying vs destroyed)
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
regression_of: T-1779
topic: null
branch: null
created: 2026-11-11T04:44:47.089Z
updated: 2026-11-11T04:48:14.555Z
---

## Summary

`hub/test/host-restart.test.ts::restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership` failed once on the periodic dev T3 run 3fb22cf7 at 26dc219eb (Linux droplet, log A-18588): line 73 `assert.equal(store.hosts.provisions.get(gone.id)?.state,'destroyed')` read `'destroying'`. The same case passed at the same head in soak 077a9f37 (A-18583) and in A-18540, A-18550, A-18559 and A-18585 (9.8–12.4 s). Since T-1779 (acd4e3aaf), the test waits until the gone host's login reads `ready` from the detached-disk receipt, then asserts the provision state directly; the release owner can still be settling the provision at that point, so the direct read races.

## What to build

Make the assertion wait on the settled outcome through the provision's own close receipt (or `eventually` on `destroyed` with the named setup bound), without weakening what the case proves: the gone host ends `destroyed`, its lease is gone and its spend is settled. Confirm the race first by reproducing it (Linux, `docker run --init --network none`, or a stress loop alone) before the fix and showing the fixed case passes the load gate's five lone repetitions.

## Acceptance criteria

- [ ] C1. The race is reproduced at the pre-fix head or shown by the event order in a diagnostic, recorded in an item comment.
- [ ] C2. The case waits for the gone host's provision to read `destroyed` through a receipt or a named bounded wait, and still asserts the lease removal and settled spend (test).
- [ ] C3. The case passes five lone repetitions on macOS and on Linux at the fix head, recorded in an item comment.

## Comments

### coord · 2026-11-11T04:48:14.555Z

The periodic culprit search for 3fb22cf7 labelled host-restart "already-fixed on dev at 9eaec5315" because its failing-file rerun f345c8de passed there (A-18589, 9.7 s). Nothing between 26dc219eb and 9eaec5315 touches host-restart or its release path (T-1787 adds only storage writes), so the rerun pass is the flake's normal outcome, not a fix; this item stays open.
