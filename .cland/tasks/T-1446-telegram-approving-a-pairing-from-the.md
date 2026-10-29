---
id: T-1446
kind: task
title: "Telegram: approving a pairing from the CLI sends no confirmation to the phone"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1196
branch: t/T-1446-telegram-approving-a-pairing-from-the
created: 2026-10-29T16:50:28.430Z
updated: 2026-10-29T17:02:15.385Z
---

## Summary

Found in the v0.3.0 live run (E-1314, QA qa-677, step L2, topic-1195, A-13818), on the real @cland_app_bot against the sandbox hub at dev 189d5100. The human pressed Start and got the code. `./sbx remote approve telegram <code>` succeeded, and the stored numeric identity matches the phone. But no confirmation reached the phone. The human's words: «Ничего не пришло в бот». At 16:46:59Z the remote's `lastOutbound` still predated the approval, and the outbox was 0, so no confirmation was ever queued.

## What to build

Find why approval queues no "Paired with <project>" line on Telegram. The spec and the prototype send it, and Discord edits its pairing reply to "Approved". Make the approval send exactly one confirmation through the durable outbox, and then send any open cards as the spec says. Cover it with a production-frame test on the fake Bot API that is red before the fix.

## Acceptance criteria

- [x] C1. After `cland remote approve telegram <code>`, the paired chat receives exactly one confirmation through the outbox, shown by a T2 production-frame test on the fake Bot API, red before the fix.
  - done: impl-1446 · 2026-10-29T16:59:07.822Z
- [x] C2. Open cards are sent after the confirmation, in order.
  - done: impl-1446 · 2026-10-29T16:59:07.943Z

## Comments

### impl-1446 · 2026-10-29T16:55:34.784Z

Consumer search before change: pairing.approve production callers are hub/src/cli/remote.ts, hub/src/setup/hub.ts and nvim/lua/cland/pairing_card.lua. Shared callback traverses dispatch.ts → daemon.ts/configuration.ts → gateway.ts; Discord implements pairingApproved, Telegram does not. Existing fake messenger/legacy adapter tests exercise optional callback compatibility. Production-frame tests include pairing-approval, telegram-pairing, setup-remote-component, remote-workbench, telegram-mute, doctor-remotes and web-authority; UI pairing tests and qa/briefs/E-1313.md consume unchanged approval frames. No frame/schema/admission change planned: add existing optional adapter hook to Telegram only. Legacy adapters, persisted outbox readers and other tiers retain their shapes. Seam agreed by assignment: production frames/CLI and fake Bot API.
