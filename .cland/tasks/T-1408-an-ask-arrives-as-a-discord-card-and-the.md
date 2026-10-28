---
id: T-1408
kind: task
title: An ask arrives as a Discord card, and the paired human's click answers it with one update within 3 seconds
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1397
  - T-1404
topic: topic-1164
branch: t/T-1408-an-ask-arrives-as-a-discord-card-and-the
created: 2026-10-27T23:38:47.479Z
updated: 2026-10-28T22:18:14.114Z
---

## Summary

An open ask to the human becomes a legacy-message card in the paired channel. It has option buttons five to a row, then "Other answer…" and "Decline…". The paired human's click is stored in the hub first, then answered within 3 seconds by one update that turns the card into its outcome without buttons. Cards go out oldest first, even while General is muted.

## What to build

**Publication.** On an inbox publication, each open ask without a Discord card gets a `card` job, which goes ahead of General. Asks go oldest first through `inboxPublication`. The card is mapped in `remote_messages` with its ask.

**The card.** Its content is the bold title from `askCard`, then the question. When the buttons are numbered, the options are listed in the content.

**The buttons.**
- At most three action rows: the options five to a row, then a row with "Other answer…" (only when the ask takes free answers) and "Decline…".
- Each option is labelled with its text when every option fits in 34 characters, and with its number otherwise.
- Labels stay within 80 characters.
- Custom ids are `ask:<id>:<n>`, `ask:<id>:other` and `ask:<id>:decline`, within 100. They are checked against the hub's record and the card's mapped message, never trusted.

**A click.** The paired human's click sends `topic.answer` with the option, `via = "discord"` and the ingress `interaction:<id>`. After the hub stores the answer, one `UPDATE_MESSAGE` (type 7) sets the outcome line from `outcomeLine` and `components: []`. When the hub's result is not back within 2 seconds, a `DEFERRED_UPDATE_MESSAGE` (type 6) goes out and the card is edited afterwards through an outbox edit. Until ticket 14, "Other answer…" and "Decline…" answer ephemerally "not available yet".

The fake enforces the 3-second deadline and records each callback's arrival time under the injected clock.

Spec §3.5 (Discord cards, one gate, order); research rules 23 and 24; Q-1293 (0.42 to 0.69 seconds per click).

## Acceptance criteria

- [x] C1. A nine-option free-answer ask whose options fit 34 characters arrives as one card with the options five to a row labelled with their text, then "Other answer…" and "Decline…", in three rows, every label within 80 and every custom id within 100 (test).
  - done: impl-1408 · 2026-10-28T22:12:56.353Z
- [x] C2. An ask with one option over 34 characters gets numbered buttons with the options listed in the card's content (test).
  - done: impl-1408 · 2026-10-28T22:12:56.443Z
- [x] C3. The paired human's click records the answer with `via = "discord"` before the callback, and one `UPDATE_MESSAGE` turns the card into its outcome with no components within 3 seconds under the injected clock (test).
  - done: impl-1408 · 2026-10-28T22:12:56.537Z
- [x] C4. A click whose hub result takes longer than 2 seconds is deferred before 3 seconds and the card is edited to its outcome afterwards (test).
  - done: impl-1408 · 2026-10-28T22:12:56.792Z
- [x] C5. Two asks published together arrive oldest first, and a card still arrives while General is muted (test).
  - done: impl-1408 · 2026-10-28T22:12:56.938Z

## Notes

Shared files: new hub/src/remote/discord-cards.ts, discord-interactions.ts, discord.ts, discord-outbox.ts; hub/test/fakes/discord/ (components)

## Comments

### impl-1408 · 2026-10-28T22:07:56.491Z

Consumer inventory before additive native card contract: DiscordMessageInput/ActionRow: discord-api.ts, discord-outbox.ts and fake-api.ts; DiscordOutbox: discord.ts, discord-inbound.ts and discord-messages/render tests; fake DiscordState/control interact: exchange/hub fixtures, discord-api, messenger, pairing, commands, messages, render tests and their docs/agents/tests guides. Production frame consumers remain unchanged: gateway.ts, protocol.ts, hub topic.answer, Telegram cards, web/nvim clients; no reply/list/schema/authority shape changes. Persisted outbox readers retain legacy optional components/edit fields. QA briefs/startup probes/skills do not construct native component callbacks (repository-wide search). New native callbacks are additive; existing command callback/defer methods and historical message jobs retain their shapes.

### rev-26 · 2026-10-28T22:17:15.443Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1408-source-1
commit: c554cb23fa53a4f1b44d116e8e105cd363ce8d79
scope: full
findings: [{"severity":"medium","text":"M1: New discord-cards T2 test is unclassified and its per-test guide is absent from docs index; add sorted owning entries with unchanged guard red/green.","file":"hub/test/tiers.json"},{"severity":"medium","text":"M2: Awaiting defer response before persisting outcome edit loses owed completion after committed topic.answer when type6 response is lost/refused. Persist owed edit independently, keep/join original native acknowledgement, and test accepted-type6/lost-response without a second initial callback.","file":"hub/src/remote/discord-cards.ts","line":90},{"severity":"low","text":"M3: Explicit optionAt proxy table omits new update method; exchange.api.update bypasses native bound/composed cancellation/pending owner. Add options index3 and retain shared ownership contract.","file":"hub/test/fakes/discord/exchange.ts","line":59}]
finding_counts: {"high":0,"medium":2,"low":1}

A-13479 consolidated full source1 not clear, M1–M3 only; full8-file scope and consumers inspected. Implementer reports corrections/red-green in held tree, not yet reviewed. Existing layout/provenance/order/mute/content-limit assertions retained; downstream cross-client/modals/stale/catch-up remain separate. No reviewer workloads, runtime marks or fabricated failed criterion. Commit/push corrections then fresh exact-head source review before mode-free verification.

### rev-26 · 2026-10-28T22:18:14.114Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1408-source-2
commit: 870118383e3d75c776c26ffea9da90b53ef160c5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13481 source2 clear resolves M1–M3. Full11-file task scope covered by prior full audit+complete correction diff: sorted T2/index, durable edit invoked independently of caught/joined defer response, accepted-type6/lost-response control retaining one callback and final sent edit, update:3 shared proxy ownership. Original C1–C5 assertions unchanged; downstream scope remains separate. A-13480 local narrative10-case/guard/typecheck evidence only; runtime verification pending. No reviewer workloads or extra full run/QA requested. One unchanged-head mode-free run may proceed.
