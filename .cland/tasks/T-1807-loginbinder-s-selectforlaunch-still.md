---
id: T-1807
kind: task
title: "LoginBinder's selectForLaunch still walks rejected reader-intent history: reuse the maintained capacity eligibility"
state: open
status: planned
size: M
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: null
branch: null
created: 2026-11-10T23:04:20.883Z
updated: 2026-11-17T23:14:16.824Z
---

## Summary

`selectForLaunch`'s candidate query, used by `LoginBinder`, still visits matching rejected reader-intent rows. A-18500's raw run recorded about 2000 visits on a synthetic corpus before T-1784 extracted `heldForLaunch`. T-1784 made the scheduler's verdict path bounded, but deliberately left the selection body unchanged (Coordinator decision 7bbdaa44), so the launch-time bind can still walk that history.

## Context

Found by impl-1784 during T-1784, 2026-11-10. No timing or slowness claim beyond the measured work count. T-1784 adds the maintained `pending_bindings` counter and a partial capacity index that a fix can reuse.

## Acceptance criteria

- [ ] C1. `selectForLaunch` decodes at most a bounded number of rows on a synthetic corpus of 10,000 retained logins and reader intents, shown by decode-count and query-work controls (test).
- [ ] C2. The selection order (account, then name) and the T-1778/T-1786 selection contract are unchanged: their selection tests pass unchanged (test).
