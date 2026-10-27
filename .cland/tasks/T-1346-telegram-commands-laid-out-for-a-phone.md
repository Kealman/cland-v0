---
id: T-1346
kind: task
title: Telegram commands laid out for a phone and the menu registered only on change
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1342
topic: topic-1098
branch: t/T-1346-telegram-commands-laid-out-for-a-phone
created: 2026-10-26T19:09:07.381Z
updated: 2026-10-27T01:10:25.000Z
---

## Summary

The Telegram commands `/status`, `/inbox`, `/mute`, `/unmute`, `/decision`, `/question`, `/cancel`, `/help` and `/start` answer in a layout made for a phone screen. The command menu is registered for private chats only when it differs from what Telegram holds.

## What to build

Replies open with a title line, then groups under bold labels (Hub, Coordinator, Sessions, Queues, Release, This chat), one fact per line, with sessions as bullets and the gateway's numbers last as small text. `/help` has short headed sections with the commands as a bullet list and the trust lines last. Replies are text with entities. The reads go through the gateway's allowed reads (T-1321). Spec §3.10.

## Acceptance criteria

- [ ] C1. `/status`, `/inbox` and `/help` render in the specified layout as text with entities, and `/cancel` and `/start` answer as spec §3.10 says (test).
- [ ] C2. The first hub start registers the menu for private chats, and a second start with the same menu registers nothing (test).

## Comments

### impl-1346 · 2026-10-27T00:19:42.097Z

Pre-change consumer audit (rule 20): no hub wire shape/authority/schema changes planned. New Bot API methods getMyCommands/setMyCommands and additive sendMessage entities affect TelegramApi, TelegramRemote, loopback fake, telegram-api/pairing/polling/messenger tests (T2) and polling-restart (T3). Production factory messenger.ts supplies existing persistence/project name; gateway's existing allowed hub.status/task.list/inbox.list reads suffice. Sibling T-1343 adds format/entities; T-1344 adds RemoteSend ingress and optional Remote.start fourth receipt callback; retain both at merge. Searches cover hub/src, hub/test all tiers, nvim/test, web/test, qa/briefs, .agents/skills and docs. No menu callers or persisted menu readers exist; reconcile against platform rather than a new DB cache. Existing injected/legacy remotes remain unchanged; existing gateway previous-wire tests cover optional startup arguments. /decision,/question remain T-1344; /mute,/unmute T-1345. Cards pending-answer state is absent until the cards epic, so /cancel must never clear frame correlation or answer an ask.

### impl-1346 · 2026-10-27T00:25:32.550Z

Checkpoint 281d3dfc8 and artifact A-12534 record five red→green command/menu cases. Local macOS targeted T2 telegram-commands.test.ts completed (5/5), telegram-pairing.test.ts completed (3/3); npm run typecheck completed. No T0–T4 suite, remote executor or browser evidence claimed. Coordinator decision 58808755-e6ca-4134-a495-9b05ac62cc2f keeps command replies direct, no outbox/jobs; durable native chat/message fence precedes replies, and replay after effect-before-receipt interruption emits no duplicate. Integration and source review await the required sibling landings; full verify is Coordinator-owned.

### impl-1346 · 2026-10-27T01:10:25.000Z

Integrated the landed T-1343 via origin/dev (ce423359), preserving rendering format and both receive paths; merged head 4a1fd1017. All six command cases pass, including the newly green long literal card split case. On this macOS local tree: npm run typecheck completed; targeted telegram-api (15/15), telegram-rendering (6/6), telegram-pairing (3/3) and cli-help (5/5) passed, run one file at a time. The updated help fixture is committed separately. No full-suite/Linux/browser evidence claimed. T-1344 and T-1349 must land and merge before source review.
