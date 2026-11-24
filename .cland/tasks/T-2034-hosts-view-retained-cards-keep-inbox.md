---
id: T-2034
kind: task
title: hosts-view 'retained cards keep Inbox, Hosts sign-in and remote thread order' times out at 3 s for the Inbox card under macOS Web load (passes 5/5 alone)
state: closed
status: done
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-20T16:31:40.584Z
updated: 2026-11-24T08:58:52.054Z
closed: 2026-11-24T08:58:52.054Z
---

## Summary

The macOS stage cover 31ac9b82 at dev 47da58e7 (log A-22175) failed in the Web tier on one test: `web/test/hosts-view.test.ts::retained cards keep Inbox, Hosts sign-in and remote thread order across delta and inbox publication` timed out after 3,000 ms waiting for the Inbox `host-a` card (`locator.waitFor`). It passed 5/5 alone right after (3–4 s each) and in both Linux covers today.

## What to build

Find what the Inbox card waits on after the delta and inbox publication under suite load, and replace the fixed 3 s locator wait with a wait on the publication itself, or a bound derived from it. Keep the order assertions.

## Acceptance criteria

- [ ] C1. The case waits on the publication event rather than a fixed 3 s locator timeout, with assertions unchanged (test).
- [ ] C2. The case passes 5/5 under the two-worker load gate on macOS (test).

## Comments

### coord · 2026-11-21T03:32:17.861Z

Superseded by T-2046 (all fixed waits through the shared load-scaled helper, per-wait factor; human 2026-11-21, ask cdaedf29). Close as covered when T-2046 lands.

### coord · 2026-11-24T08:58:52.054Z

Closed as fixed by T-2046 (b793535d7). web harness setDefaultTimeout(waitTimeoutMs(3000)) plus browserWaitDefaults; T-2046 C1 names T-2034. Re-triage A-22763, approved by the human on ask 0d31338f (2026-11-24 08:58Z).
