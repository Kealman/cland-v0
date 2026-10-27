---
id: T-1397
kind: task
title: The gap line, the General mirror's filter, phone replies, the mute receipt and the card order become messenger-neutral
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by: []
topic: null
branch: null
created: 2026-10-27T23:38:45.130Z
updated: 2026-10-27T23:39:00.625Z
---

> Prefactor that edits Telegram files: it lands before E-1311's stage-2 Telegram lanes (T-1385, T-1387) start, and Telegram's existing tests must pass unchanged.

## Summary

A behaviour-preserving prefactor. The decisions Discord shares with Telegram move out of the Telegram files into neutral modules, and Telegram calls them: what General mirrors and under which author, the gap line, the phone reply model, the mute receipt and the oldest-first card order. Telegram's output and persisted keys stay unchanged.

## What to build

- **`mirrorOut(message, self)`** returns `null` for what is not mirrored: requests, answers, asks to the human, and the remote's own `via`. Otherwise it returns `{ header, text, silent }`. The authors are "you" from a workbench, "you (Telegram)" or "you (Discord)" from the other remote, and the agent's name otherwise. Progress notes and hub notices are silent.
- **`flushGap(store, clock, { matches, stateKey }, send)`** is `flushTelegramGap` with a job matcher and a state key. `flushTelegramGap` stays as a wrapper with `telegram.gap` and its current matcher.
- **The phone reply model.** The model holds a title, groups under bold labels and small lines last. `statusReply(project, status, releases, { connected, muted, outbox, label, extra })` takes `label` as "This chat" or "This channel" and `extra` as the gateway's own numbers. `helpReply(project, sections)` builds the help reply. `telegramStatus` and `telegramHelp` render the model to entities exactly as today.
- **`RemoteStore.applyMute(receipt, muted)`** generalises `applyTelegramMute`. Telegram keeps its `telegram.mute:<chat>:<message>` receipts, so a replayed `/mute` still applies once.
- **`inboxPublication(inbox, webOrigin)`** returns the open asks, the hub-answered approvals and the notices, oldest first with ties by id. `TelegramCards.publishInbox` uses it.

**Contract:** this changes no wire, frame or persisted shape. Internal consumers: `telegram.ts`, `telegram-cards.ts`, `telegram-commands.ts`, `telegram-gap.ts`, the Telegram tests through their existing imports, and `hub/README.md`'s remote section. It runs beside E-1311, whose Telegram tickets edit `telegram.ts`; see the plan.

## Acceptance criteria

- [ ] C1. Every existing `hub/test/telegram-*.test.ts` passes with its assertions unchanged (test).
- [ ] C2. `mirrorOut` gives "you" for a workbench message, "you (Telegram)" for a Telegram one seen from Discord and "you (Discord)" seen from Telegram, returns `null` for the remote's own `via`, a request, an answer and an ask to the human, and marks progress notes and hub notices silent (test).
- [ ] C3. `flushGap` with a Discord matcher and state key counts sources once and leaves Telegram's missed rows and `telegram.gap` untouched (test).
- [ ] C4. The neutral status reply labels the remote's group "This chat" or "This channel" as asked, and `inboxPublication` orders asks, hub approvals and notices oldest first with ties by id (test).
- [ ] C5. `applyMute` applies once per receipt key, and a replayed Telegram `/mute` with an existing receipt still changes nothing (test).

## Notes

Shared files: hub/src/remote/telegram.ts, telegram-gap.ts, telegram-commands.ts, telegram-cards.ts, state.ts; new hub/src/remote/mirror.ts, gap.ts, replies.ts
