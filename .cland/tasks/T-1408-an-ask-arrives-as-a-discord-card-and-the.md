---
id: T-1408
kind: task
title: An ask arrives as a Discord card, and the paired human's click answers it with one update within 3 seconds
state: closed
status: done
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
updated: 2026-10-28T22:55:49.712Z
closed: 2026-10-28T22:55:49.712Z
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
  - verified: rev-26 [reviewer] · run rev-20261028-1408-evidence-1 · 2026-10-28T22:49:50.984Z · commit 1c1c1d726138e2c083910d977051a39f4adac0bb
- [x] C2. An ask with one option over 34 characters gets numbered buttons with the options listed in the card's content (test).
  - done: impl-1408 · 2026-10-28T22:12:56.443Z
  - verified: rev-26 [reviewer] · run rev-20261028-1408-evidence-1 · 2026-10-28T22:49:50.984Z · commit 1c1c1d726138e2c083910d977051a39f4adac0bb
- [x] C3. The paired human's click records the answer with `via = "discord"` before the callback, and one `UPDATE_MESSAGE` turns the card into its outcome with no components within 3 seconds under the injected clock (test).
  - done: impl-1408 · 2026-10-28T22:12:56.537Z
  - verified: rev-26 [reviewer] · run rev-20261028-1408-evidence-1 · 2026-10-28T22:49:50.984Z · commit 1c1c1d726138e2c083910d977051a39f4adac0bb
- [x] C4. A click whose hub result takes longer than 2 seconds is deferred before 3 seconds and the card is edited to its outcome afterwards (test).
  - done: impl-1408 · 2026-10-28T22:12:56.792Z
  - verified: rev-26 [reviewer] · run rev-20261028-1408-evidence-1 · 2026-10-28T22:49:50.984Z · commit 1c1c1d726138e2c083910d977051a39f4adac0bb
- [x] C5. Two asks published together arrive oldest first, and a card still arrives while General is muted (test).
  - done: impl-1408 · 2026-10-28T22:12:56.938Z
  - verified: rev-26 [reviewer] · run rev-20261028-1408-evidence-1 · 2026-10-28T22:49:50.984Z · commit 1c1c1d726138e2c083910d977051a39f4adac0bb

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

### rev-26 · 2026-10-28T22:32:24.566Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1408-source-delta-1
commit: 1c1c1d726138e2c083910d977051a39f4adac0bb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13490 authorized shared-fix merge delta clear. Independently read Coordinator95b367c9. All11 source2 task blobs unchanged; diff exactly durations.json three owner strings (uploads→openR-1278, copied Items case/file→openC-326) plus4tracker records; caps/dates/reasons/numeric timings unchanged. Old96a38290/A-13488 cancelled143/partialWeb retained, no new-head runtime or criterion proof. Fresh unchanged-head mode-free run allowed, final original-record review required. No reviewer workload or extra full/QA run.

### rev-26 · 2026-10-28T22:49:50.984Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1408-evidence-1
commit: 1c1c1d726138e2c083910d977051a39f4adac0bb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13503 original-record final evidence clear, C1–C5 verified. A-13502:4027 ordinary+85 separate load passes (50card/35site), unfinished0; all10card identities base+5/5load, maxbase0.362695427s/maxload0.528767856s. Native exact2000ms defer, durable outcome/lost-response and callback-before-store/order assertions retained. T0/T1/allT2/Web green, T3/T4 unrun; independent Coordinatora5424954 confirms no extra full run. Provenance/host-gate reuse/report-only diagnostics and922s/$0.0640 in artifact. Cancelled A-13488 old-head excluded. No reviewer workload or per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-28T22:50:15.327Z

Coordinator record of rev-26's wording correction (reported 22:50Z, msg 71a3c1b4): the evidence1 verdict comment says 'callback-before-store/order' by mistake. C3 is STORE-BEFORE-CALLBACK, as A-13503 and the named test correctly state. The verdict, head, receipts and verified marks are unchanged.

### coord · 2026-10-28T22:55:49.712Z

Merged d25d15690514240de3bf3b0c854ebe9073488f18 onto dev.
