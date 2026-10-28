---
id: T-1418
kind: task
title: telegram-polling-restart's SIGKILL-mid-update case relies on the unhandled-edit hold that T-1378 removed
state: open
status: review
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
regression_of: T-1378
topic: topic-1138
branch: t/T-1418-telegram-polling-restart-s-sigkill-mid
created: 2026-10-28T06:48:13.082Z
updated: 2026-10-28T06:59:26.900Z
---

## Summary

The Linux stage cover 4525a184 at dev 10a58d78 (A-13086, shard-2) failed the T3 case `hub/test/telegram-polling-restart.test.ts::SIGKILL mid-update leaves the Telegram offset unconfirmed and restart handles it once`: `'2' !== null` at line 59. The case sends an `edited_message`, waits for the `telegram-update-unhandled` log line and expects the offset still unconfirmed before it SIGKILLs the hub. T-1378 deliberately changed that path: an update no handler accepts is now confirmed (silently for edits), so the offset moves to 2. T-1378's mode-free verify never selects T3 and its consumer inventory missed this case (rule 20). This is the first Linux cover containing T-1378 (b9b573ec).

## What to build

Keep the case's purpose — a SIGKILL between taking an update and confirming its offset replays it exactly once after restart — on a crash boundary that still exists: an update that does have a handler, killed while that handler is in flight (a fixture-held handler or a test seam), never the removed hold. Check every other T3/T4 consumer of `telegram-update-unhandled` and of the unhandled-hold behaviour and record them on the item.

## Acceptance criteria

- [ ] C1. The case kills the hub while an accepted update's handler is in flight, sees the offset unconfirmed at the kill, and sees the restart handle that update exactly once (test).
- [ ] C2. Every other test reading `telegram-update-unhandled` or the old hold is listed on the item and migrated or shown unaffected.

## Comments

### impl-1418 · 2026-10-28T06:57:25.978Z

Consumer inventory (rule 20): repository search of telegram-update-unhandled plus edited_message/unhandled/unconfirmed/no-handler/hold references across production, hub/web/nvim tests (including tiers T3/T4), qa briefs, docs and shipped skills. Production telegram-polling.ts emits the content-free log and confirms unmatched updates; telegram.ts terminal fallback uses that diagnostic. No production contract changes planned. Direct test consumers: telegram-polling-restart.test.ts (T3), stale unhandled-edit hold: migrate here; telegram-polling.test.ts (T2), unmatched edit explicitly confirms offset 2: unaffected; telegram-inbound.test.ts (T2), unsupported input confirms with notice, edit confirms silently, log content checks: unaffected. No other T3/T4 log/old-hold consumers found. Docs: docs/agents/tests/hub-test-telegram-polling-restart.test.ts.md describes stale hold and will be updated; hub/README.md and implement skill describe current confirmation behavior and remain accurate. Fixture plan: hold production accepted text handler at fake setMessageReaction request, assert durable message and absent offset while held, SIGKILL/join, then production restart with the same database to prove exactly one original human message and confirmed offset.

### impl-1418 · 2026-10-28T06:58:57.242Z

Additional inventory: qa/briefs/E-1309.md M2 invokes the unchanged generated SIGKILL test names and promises only durable handling/deduplication, so remains accurate. telegram-inbound.test.ts also holds setMessageReaction in its T2 graceful-stop feedback replay control; unaffected and provides the existing fake seam. Node v24.21.0 local macOS typecheck passed on the candidate working tree; no test files or suite have run locally due to Coordinator cover pause. Historical red is Linux A-13086 shard-2 on 10a58d78: '2' !== null, before replacement.
