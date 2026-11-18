---
id: T-1807
kind: task
title: "LoginBinder's selectForLaunch still walks rejected reader-intent history: reuse the maintained capacity eligibility"
state: open
status: in progress
size: M
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: topic-1631
branch: t/T-1807-loginbinder-s-selectforlaunch-still
created: 2026-11-10T23:04:20.883Z
updated: 2026-11-18T17:45:45.314Z
---

## Summary

`selectForLaunch`'s candidate query, used by `LoginBinder`, still visits matching rejected reader-intent rows. A-18500's raw run recorded about 2000 visits on a synthetic corpus before T-1784 extracted `heldForLaunch`. T-1784 made the scheduler's verdict path bounded, but deliberately left the selection body unchanged (Coordinator decision 7bbdaa44), so the launch-time bind can still walk that history.

## Context

Found by impl-1784 during T-1784, 2026-11-10. No timing or slowness claim beyond the measured work count. T-1784 adds the maintained `pending_bindings` counter and a partial capacity index that a fix can reuse.

## Acceptance criteria

- [ ] C1. `selectForLaunch` decodes at most a bounded number of rows on a synthetic corpus of 10,000 retained logins and reader intents, shown by decode-count and query-work controls (test).
- [ ] C2. The selection order (account, then name) and the T-1778/T-1786 selection contract are unchanged: their selection tests pass unchanged (test).

## Comments

### impl-1807 · 2026-11-18T17:45:45.314Z

Consumer inventory (rule 20): repository-wide search for selectForLaunch, heldForLaunch, login_ready_launch and login_reader_launch. Production selectForLaunch caller/result reader: LoginBinder.#prepare in hub/src/host/login-binding.ts reads held login/binding phase and ready Login; no wire/result shape changes. Direct test callers: hub/test/login-selection.test.ts (ready/key/held selection and migration), new login-capacity regression. Index consumer outside selection: LoginRecords.signedOut (login_ready_launch state prefix), covered by login-records.test.ts and login-signed-out tests/docs. Existing binder contracts: login-binding.test.ts, login-exclusive.test.ts, login-exclusive-native.test.ts; unchanged. Documentation/fixtures: docs/hub/logins.md, per-file login-selection/login-capacity/login-signed-out guides, qa/briefs/E-1535-stage-2.md (historical source assertion), E-1535-stage-3.md follow-up. No shipped skill, startup probe, raw socket/client reader or frozen help fixture consumes this private method/result. No reply/schema contract change; public Login and selection result shapes unchanged. Reusing maintained eligibility in existing indexes per Coordinator decision 4493ce37.
