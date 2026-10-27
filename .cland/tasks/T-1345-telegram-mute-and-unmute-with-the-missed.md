---
id: T-1345
kind: task
title: Telegram mute and unmute with the missed count and the mute_default key
state: open
status: in progress
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1343
topic: topic-1100
branch: t/T-1345-telegram-mute-and-unmute-with-the-missed
created: 2026-10-26T19:09:07.071Z
updated: 2026-10-27T01:15:13.904Z
---

## Summary

`/mute` silences the General stream while cards and notices still arrive. `/unmute` posts one line, "N messages arrived while muted", and `[remote] mute_default` sets the state a new pairing starts in.

## What to build

Mute state per pairing in the remote tables, read by the mirror out. Spec §3.4.

## Acceptance criteria

- [x] C1. Three General messages during mute are not sent, a hub notice still is, `/unmute` posts "3 messages arrived while muted", and a new pairing starts muted when `mute_default` is true (test).
  - done: impl-1345 · 2026-10-27T01:15:13.904Z

## Comments

### impl-1345 · 2026-10-27T01:09:14.508Z

Rule 20 consumer inventory before edits: searched production, hub/test (all tiers), web/nvim, shipped .agents skills, qa briefs, docs/agents and hub/README for muteDefault/mute_default, remote_pairings, mute state, TelegramRemote and TelegramPollingOptions. Production consumers: dispatch pairing.approve initializes existing remote_state `mute`; daemon remote.status and CLI remote status read it; config/init/configuration manage the existing default; messenger creates TelegramRemote; pollTelegram owns trusted paired admission/offset receipts; state.ts owns remote_state and pairing persistence. Changed consumers: TelegramRemote adds suppression and exact paired commands; RemoteStore adds additive effect/count methods using existing remote_state; pairing.approve resets missed count. Unaffected wire clients: protocol RemoteStatusResult/CLI/web/nvim keep the existing mute boolean and prior reply/list shapes; no schema or permission change. Regression consumers retained: remote-cli.test.ts (default and rotation), config-set/init-config, pairing-approval/codes/service, telegram-rendering/messenger/pairing/polling incl T3 polling-restart, remote-state/outbox/gateway, startup cli-imports/project-hub-lifecycle. QA E-1309 uses /mute and /unmute on fake; E-1307 outbox gap counts are separate and unchanged. Docs consumers to update: hub README, agents pairing, implement skill + CHANGES, CLI config/remote help and golden fixture, new per-test guide. New tests use sealed projectHub frame + fake Bot API with FakeClock; no real platforms or processes.

### impl-1345 · 2026-10-27T01:13:40.918Z

TDD/component evidence on macOS local working tree based on ce423359: new telegram-mute.test.ts initially failed with `Error: executor operation deadline reached` at the missing /unmute durable poll receipt (1 failed, 0 passed). After implementing paired commands, source suppression/counting and atomic effect receipts, the same file passes 3/3: `Telegram mute suppresses three General messages but keeps a hub notice and unmute reports the count`; `Telegram unmute interruption after commit preserves the count reset without replaying its reply`; `Telegram mute counts each eligible source once and a replacement pairing starts with a fresh count`. Last local top-level durations 118/73/64 ms. Full npm run typecheck passed before the final additional guard test; closed-item wording lint passed. These are T2 fixture receipts and static checks only, no Linux/droplet, browser, source review, whole-suite or enforced duration gate evidence. Pacing integration remains until T-1347 lands; final head will be rechecked. No per-item QA brief required (qaPolicy scope none).
