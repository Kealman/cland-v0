---
id: T-491
kind: task
title: Droplet verify falls back to local on 'lock acquisition deadline reached' under load
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: E-425
blocked_by: []
topic: topic-360
branch: t/T-491-droplet-verify-falls-back-to-local-on
created: 2026-10-15T12:05:32.122Z
updated: 2026-10-16T05:56:53.078Z
---

## Summary

Under load, a verify that should go to a droplet falls back to the local slot with "lock acquisition deadline reached". This happened to 7453981f for T-453 at 12:04Z on 2026-10-15, with 1-min load around 34–44 and a droplet slot and budget free. The fallback lands in the serial Mac queue, the one place that's already overloaded, so load feeds more load.

## Acceptance criteria

- [ ] C1. A spend-ledger or executor lock that misses its deadline retries with backoff, within a bounded wait, before falling back to local. The fallback notice names the lock and how long it waited.
- [ ] C2. A test holds the lock past the old deadline while a remote slot and budget are free, and shows the run still goes remote once the lock frees within the bounded wait.

## Comments

### coord · 2026-10-16T01:58:13.828Z

Occurrence with real impact, 2026-10-16 01:27–01:58Z. Four verify runs got "executor-release-unconfirmed … lock acquisition deadline reached" with lease id null (no droplet created), or, for T-550's 609534539, a lease released at 01:30Z. All four stayed listed in `cland verify queue` as running remote holders: T-548 efff3e59, T-469 cd760b4c, T-527 2d023454, T-550 97a70087. `executor status` showed only two active droplets. Those phantoms held 4 of the 6 remote slots for up to 30 minutes, while five real waiters (T-505, T-517, T-523, T-556, T-559) sat "waiting for remote". The workaround is that owners cancel by full id and resubmit. A failed or never-created lease must release its queue slot and give the run a result.

### impl-491 · 2026-10-16T05:56:53.078Z

C2 regressions written first at real remote-admission seam for spend and executor locks (16s hold past old 15s deadline; require remote receipt after release). No production changes yet. Local red pending T-466 census-done per Mac load restriction; design/evidence artifact posted in topic-360.
