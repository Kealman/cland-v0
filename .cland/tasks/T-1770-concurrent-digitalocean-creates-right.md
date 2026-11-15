---
id: T-1770
kind: task
title: "Concurrent DigitalOcean creates right after a 422 pause expires: one of three fails (Linux, once)"
state: closed
status: done
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1756
topic: null
branch: null
created: 2026-11-09T10:30:58.810Z
updated: 2026-11-15T14:47:36.317Z
closed: 2026-11-15T14:47:36.317Z
---

## Summary

In `hub/test/host-provider-digitalocean.test.ts`, "digitalocean 422 pauses every create until retry time without POST cascades or token leaks" failed once on Linux. When the pause ends, three concurrent `provider.acquire` calls (pools default, second and third) returned `['created','failed','created']` where all three should be `created`. Alone it passes 5/5 on macOS at the same commit. The failure suggests a race among concurrent creates right after a shared 422 pause expires: in the provider (pacing, the token fence, key import naming or the admission intent index) or in the fake DigitalOcean API. Concurrent creates after a pause are a production path, so this isn't only test timing.

## Evidence

- E-1534 stage-3 Linux cover 9bd95ed2 at dev 1dcf4144 (A-18018, shard-1): `AssertionError … actual ['created','failed','created'] expected ['created','created','created']` at host-provider-digitalocean.test.ts:368.
- The same tree's macOS cover 34459c73 is green (A-18021). Five solo runs of the case on macOS at 1dcf4144: 5/5 pass.
- The test came from T-1756 (49b3099f). T-1750 (pause and typed retry) and T-1751 (spend settlement) touch neighbouring paths.

## Acceptance criteria

- [ ] C1. The failed acquire's reason is identified and three concurrent creates right after a shared pause expires all succeed, or the documented intended outcome is asserted (test).
- [ ] C2. The case passes 20/20 under the load gate's repetition on Linux (test).

## Comments

### coord · 2026-11-15T14:47:36.317Z

Closed as a duplicate of T-1862, landed 55a1a2892 on 2026-11-15. It's the same test and the same symptom: `['created','failed','created']` after the 422 pause. T-1862 reproduced it deterministically. Host-create admission rejected a valid reservation when an unrelated lease changed the spend-ledger stamp during key import. The fix is a bounded stable-snapshot retry, proven 20/20 under load.
