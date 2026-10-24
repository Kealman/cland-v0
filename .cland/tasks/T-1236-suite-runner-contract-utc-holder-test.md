---
id: T-1236
kind: task
title: suite-runner-contract UTC holder test times out on a fixed 5 s frame wait under load
state: closed
status: done
size: XS
labels:
  - bug
  - flaky
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-24T11:42:19.082Z
updated: 2026-10-24T12:54:12.597Z
closed: 2026-10-24T12:54:12.597Z
---

## Summary

The periodic dev T3 1de62ca6 at 23066929 (A-10828, Linux droplet, peak 1m load 6.69) failed `hub/test/suite-runner-contract.test.ts` "verify queue preserves a live UTC package holder across observer timezones" after 8.5 s with `Error: no frame matched within 5000ms; saw [{"type":"welcome","name":"cli","presence":[]}]` (harness.ts:645). The same test passed in the Linux stage cover 001d0718 at 95662413 (A-10848) and in the earlier cover 4d0ec3dd. Its fixed 5 s frame wait races the queue frame under load.

## Acceptance criteria

- [ ] C1. The test waits on a receipt (the queue frame or holder record) bounded by the test timeout, not a fixed 5 s wall-clock wait, and its timezone assertions are unchanged (test).
- [ ] C2. The test passes 10/10 at workers 2 under the T3 load of a full run (Linux droplet receipt).

## Comments

### coord · 2026-10-24T12:27:29.413Z

Correction (coord, 12:28Z): this is probably not a load flake. The periodic culprit-search rerun 438612ab (A-10973, Linux droplet, peak 1m load 0.6–0.9) ran this file alone at 23066929. Both holder tests failed, "UTC package holder" and "legacy package holder", 8.5 s each. At 95662413 both passed in the Linux 001d0718 and macOS 328a44b8 stage covers. So a commit at or before 23066929 broke them, and a commit up to 95662413 fixed them. The hub's culprit search is naming the introducing commit. Once it reports, re-check this file on current dev: if it passes there, close this item as fixed by the commit that made it pass, rather than as flaky.

### coord · 2026-10-24T12:54:12.597Z

Closed as fixed, not flaky (coord, 12:55Z). The periodic culprit search for 23066929 pinned the regression to T-444 (ea76a629): T-539 at 57bddc59 passes (A-11051) and T-444 at ea76a629 fails (A-11017). Both holder tests ('UTC package holder', 'legacy package holder') failed deterministically on quiet droplets at 23066929 (A-10973). The fix landed between 23066929 and 95662413; T-1228 (e50a5842) is the likeliest candidate, since it reworked verify submission. Evidence that it holds: Linux 001d0718 and macOS 328a44b8 stage covers at 95662413 passed both, and local macOS on dev 699a44dd passed 6/6 (3 runs x 2 tests).
