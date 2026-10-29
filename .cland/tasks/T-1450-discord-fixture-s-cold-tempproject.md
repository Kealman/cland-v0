---
id: T-1450
kind: task
title: Discord fixture's cold tempProject acquisition exceeds the 2 s exchange operation budget once on macOS
state: open
status: in progress
size: XS
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: t/T-1450-discord-fixture-s-cold-tempproject
created: 2026-10-29T18:19:08.852Z
updated: 2026-10-29T18:21:08.001Z
---

## Summary

The Discord hub fixture's first `tempProject` acquisition took over 2 s on an unloaded Mac, so the exchange run deadline fired before the test began. Find the slow cold-start phase and bound it from measured receipts, or move cold project setup outside the operation budget.

## Evidence

Observed by impl-1429 during T-1429, first targeted run of `hub/test/discord-messenger.test.ts` at dev 78d77a329 (macOS arm64, no extra load):

```
Error: Discord exchange operation incomplete
    at Object.run (hub/test/fakes/discord/exchange.ts:50:21)
    at Object.start (hub/test/fakes/discord/hub.ts:34:33)
    at TestContext.<anonymous> (hub/test/discord-messenger.test.ts:432:19)
```

Test "Discord hub fixture aborted held receipt joins writers before Store close": 3036 ms (process 3428 ms). `hub.ts:34` is `const root = await native.run(() => tempProject(t));`, which runs before hub acquisition or held-receipt setup. This is the run-operation deadline, not the disposal path T-1429 instrumented. The next identical run passed in 112 ms. No phase receipts existed at the time.

## Acceptance criteria

- [ ] C1. The fixture records a timing receipt for the tempProject acquisition phase, and a failure names that phase and its elapsed time.
- [ ] C2. The acquisition bound is sized from measured cold-start receipts on macOS (at least 10 fresh processes), or cold setup runs outside the 2 s exchange budget; the test passes 10/10 fresh-process repetitions under two workers plus CPU load on macOS.
