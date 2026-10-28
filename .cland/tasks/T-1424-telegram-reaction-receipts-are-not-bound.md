---
id: T-1424
kind: task
title: Telegram reaction receipts are not bound to the captured pairing, so a later 👀 can reach a replaced chat
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1152
branch: t/T-1424-telegram-reaction-receipts-are-not-bound
created: 2026-10-28T11:43:34.103Z
updated: 2026-10-28T11:49:51.789Z
---

## Summary

TelegramInbound's flush stores reaction receipts without binding them to the pairing captured when the update arrived, and doesn't recheck the pairing after the native reaction I/O. If the human's chat is unpaired or replaced while 👌 is held, a later 👀 can be scheduled against the old receipt and reach the old chat. This predates albums; the T-1386 reviewer found it aside and excluded it from T-1386's findings (topic-1150).

## Acceptance criteria

- [x] C1. A stored reaction receipt carries the pairing identity captured on arrival; after any native reaction I/O, flush rechecks it, and a receipt whose pairing was unpaired or replaced sends no later reaction (test: hold 👌, unpair or replace, then show no 👀 to the old chat on the fake).
  - done: impl-1424 · 2026-10-28T11:47:20.812Z

## Notes

Reviewer aside on T-1386, 2026-10-28. Related: T-1385 (media queue), T-1378 (unsupported input).

## Comments

### coord · 2026-10-28T11:44:18.423Z

Moved into 0.3 (R-1278) on the human's answer to ask 843ac812 (2026-10-28 11:44Z), under the standing yes of 05:04Z.

### impl-1424 · 2026-10-28T11:45:33.760Z

Rule 20 consumer inventory before optional receipt pairing identity: telegram-inbound.ts is sole writer/reader of telegram.inbound:*; telegram.ts creates it and routes text/answers/media; media FIFO uses upload but keeps its own captured authority. Tests directly read receipts: telegram-inbound.test.ts (recovery), telegram-cards.test.ts (answer delivery), telegram-notices.test.ts and telegram-polling-restart.test.ts (receipt absence). No wire shape changes: gateway/frame clients, startup probes, web/nvim and previous-wire clients unaffected. Searches across hub/web/nvim/shared/docs/.agents/qa found docs in hub/README.md and guides for telegram-inbound and telegram-polling-restart; no shipped skill examples parse the receipt. Optional field preserves decoding of historical receipts; legacy recovery needs an explicit compatibility regression. Album targets from T-1386 share the receipt identity; media queue untouched. Tests use the authorized production frame + loopback fake Bot API seam.

### rev-31 · 2026-10-28T11:49:51.789Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1424-source1
commit: acd2fe86ab8b48f931592fbca4d238e89cbaaa7c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13266 full source1 clear: Standards 0 / Spec 0. Captured numeric receipt identity is checked before/after reaction I/O and at recovery; display names do not authorize. Optional-field legacy chat-id recovery is retained with a dedicated compatibility arm. Three held-native-result controls retain actual delivery, joined reaction completion, confirmed poll offset and exact reaction census. Existing pacing owner/helper bounds and cleanup inspected; consumer inventory/docs/skill CHANGES match. Local reported macOS 36/36/typecheck remains distinct from absent configured/Linux proof; C1 runtime-unverified. Per Coordinator 44f2af85, wait for T-1386 landing, authorized dev merge and album replacement regression, then request fresh delta source review before mode-free verify. No media queue changes or per-item QA.
