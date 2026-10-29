---
id: T-1429
kind: task
title: T-1402's Discord held-receipt disposal test fails 1 of 5 load-gate repeats on a loaded macOS cover
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1205
branch: t/T-1429-t-1402-s-discord-held-receipt-disposal
created: 2026-10-28T14:23:53.218Z
updated: 2026-10-29T18:19:03.178Z
---

## Summary

The load gate in the E-1311 stage-2 macOS cover ab376574 at cfcd0c61 (A-13338) ran T-1402's new test `hub/test/discord-messenger.test.ts` "Discord hub fixture aborted held receipt joins writers before Store close" 4/5: repetition 3 failed with "Discord exchange disposal incomplete" (AggregateError at hub/test/fakes/discord/exchange.ts). Peak load was 20.95. It passed 5/5 alone on the same Mac right after (coord, 2026-10-28 14:25Z). Load flake: filed under the flaky-rerun rule.

## Acceptance criteria

- [x] C1. The disposal bound in the Discord exchange fake is attributed from receipts under load, and the test passes 10/10 under two workers plus CPU load on macOS, or the bound is sized from measured receipts.
  - done: impl-1429 · 2026-10-29T18:18:59.590Z

## Notes

Regression candidate of T-1402 (the test's origin). The identity will leave the load gate's new-test set once stage-close durations are refreshed.

## Comments

### impl-1429 · 2026-10-29T18:14:00.432Z

Consumer search before additive fixture receipt work: discordExchangeOwner is used by discord-api, discord-messages, discord-commands, discord-cards(-fixture), discord-artifacts, discord-render, discord-inbound-media, discord-workbench-fixture, remotes-fixture, setup-remote-component, telegram-polling-restart, and fakes/discord/hub.ts. Existing receipts() shape, operation bounds, drainClock 2000ms negative control and Store/root retention must remain compatible. No production frame/schema/authority change. File guides and implement skill document the fixture barrier; broad rg includes T3/T4 and shipped docs.

### impl-1429 · 2026-10-29T18:16:28.301Z

Instrumentation head 2ee5d6dfa pushed to origin. Red: existing aborted-held-receipt test failed new receipt-existence assertion before implementation. Green: full touched hub/test/discord-messenger.test.ts 38/38 (local darwin/arm64, no browser, 4.149s file wall) and npm run typecheck. Phase joins measured complete in <=7.6ms unloaded; 2000ms bounds unchanged. Initial cold targeted run failed separate tempProject operation bound at ~3.036s; subsequent exact run passed 112ms. Coordinator queued stress slot third; A-13919 contains sealed bounded ten-repeat/two-lane/two-CPU-worker probe. C1 not yet claimed complete.

### impl-1429 · 2026-10-29T18:18:59.270Z

C1 disposal evidence at 2ee5d6dfa: A-13928, 10/10 exact aborted-held-receipt identities under two concurrent fresh Node test workers plus two progressing CPU workers; local darwin/arm64, no browser. Native phase 0.698–1.757ms, fake 1.470–3.182ms, hub stop 4.977–8.215ms, every receipt complete and validated independently of exit status. Probe wall 2.733s includes CPU startup/shutdown and fresh workers; peak sampled 1m load 4.265625. Not reproduced at load 4.3, cover peak was 20.95. Keep 2000ms bound; Coordinator accepted instrumentation/no increase. Initial tempProject operation deadline failure is a separate acquisition path reported with exact stack to Coordinator for filing.
