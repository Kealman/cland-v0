---
id: T-1347
kind: task
title: "Telegram pacing: one request in flight per chat and a bot-wide 429 hold"
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
topic: topic-1099
branch: t/T-1347-telegram-pacing-one-request-in-flight
created: 2026-10-26T19:09:07.525Z
updated: 2026-10-27T02:18:39.492Z
---

## Summary

Pacing: one queue per chat with one request in flight, about a message a second, cards first. A 429 holds the whole bot for its `retry_after`, capped at 5 minutes, with nothing lost or reordered.

## What to build

Bind T-1324's and T-1325's outbox drain to the Telegram client: per-chat ordering, priority for cards, bot-wide 429 hold. Hard-code no limit beyond the documented ones. Use an injected clock. Spec §3.7 and §3.9.

## Acceptance criteria

- [ ] C1. A burst of 20 General messages against a fake that answers one 429 arrives complete and in order after the wait, with one request in flight per chat and the hold applied bot-wide under an injected clock (test).
  - failed: rev-26 [reviewer] · 2026-10-27T01:28:13.711Z · note Durable paced delivery lacks current-pairing fencing, recovered flood-wait deadlines and atomic complete fallback planning; fixture setup cleanup also needs correction.

## Comments

### coord · 2026-10-27T00:23:10.245Z

Scope note (coord, 2026-10-27 00:24Z): T-1343 (General mirror parts) and T-1346 (command replies) send directly through the Telegram client with no outbox; neither claims lost-receipt replay. T-1347 moves every Telegram send — mirror parts, command replies, notices — behind the per-chat queue with one request in flight and the bot-wide 429 hold. Command replies rank with ordinary messages; cards first. Durable reply ids keep going through RemoteStore.putMessage.

### impl-1347 · 2026-10-27T01:09:04.566Z

Contract/consumer audit before implementation (rule 20): additive Outbox options for chat ownership and priority preserve default FIFO; add ordinary message kind for notices/replies so cards alone have priority and outages do not misclassify replies as General. Consumers searched: hub/src/remote/outbox.ts and state.ts (persisted kind remains TEXT/string), TelegramRemote/messenger factory, gateway/configuration status readers, hub/test/outbox.test.ts, outbox-gateway.test.ts and fakes/outbox-messenger.ts; remote-state/gateway-state fixtures; all hub/web/nvim/shared test tiers, qa briefs, startup probes, .agents skill examples, docs/agents outbox guides and hub README. No wire reply/frame/schema changes; other callers keep default FIFO and unchanged payloads, persisted readers accept string kinds. Existing no-options outbox regressions retain previous-client compatibility. Telegram’s new payload is internal to Telegram queue ownership, not a frame. T2 production gateway frames + loopback fake Bot API are the agreed primary seam; native frame receive/old-chat notice and queue/fake API are secondary seams for cross-chat concurrency and priority. No real messenger or credentials.

### impl-1347 · 2026-10-27T01:13:03.888Z

Audit addendum: Telegram rich rejection replaces its queued rich intent with pre-rendered plain-part intents at the same per-chat order. Additive internal DeliveryResult `superseded` settles only that intent as dropped (not a missed General); existing sent/never-left/unknown clients are unchanged. Optional Outbox beforeNext/compare hooks let pacing finish before selecting the current highest-priority pending card and before the durable attempt timestamp. All consumers in prior audit accept/add this internal outcome; no frame or CLI shape changes.

### impl-1347 · 2026-10-27T01:24:30.395Z

Implementation committed as 8885622db on task branch and pushed to origin. Red→green receipts: chat filtering/priority failed FIFO assertion before Outbox hooks; 20 General frames failed `0 !== 20` queued intents before Telegram integration; early lastOutbound failed null versus 12:00:08 before per-send traffic callback. Local macOS/Node24: outbox.test.ts 26/26 T1, telegram-pacing.test.ts 16/16 T2, telegram-rendering.test.ts 6/6 T2, telegram-pairing.test.ts 3/3 T2, each file run alone. Full npm run typecheck passed. Pacing controls cover 400 fallback parts/order/maps, rich and plain-fallback 401/403, rich429 same-request retry, 5xx/disconnect and positively accepted/lost receipt fencing, bot-wide 300s cap, per-chat flight counts, card priority, active-drain arrivals, notices/tests and all stop boundaries. Docs/skill/consumer audit updated. No Linux, suite, browser or QA evidence claimed; Coordinator instructed no mode-free verify and will run verify all. Awaiting T-1344/T-1349/T-1346 landings for final merged source review.

### rev-26 · 2026-10-27T01:28:13.711Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1347-source-1
commit: 8885622db174279a08ee001222b693665885c14f
scope: full
findings: [{"severity":"high","text":"H1 (Spec): queued project content retains captured chat_id without current-pairing admission; unpair/re-pair leaves old-chat sends live during pacing/429 and on resume. Fence actual send/recovery against current pairing, preserving only explicitly authorized old-chat notice/stranger-reply purposes, with unpair/re-pair/reopen controls.","file":"hub/src/remote/telegram-outbox.ts","line":107},{"severity":"medium","text":"M1 (Standards/rule12): caller Store is acquired before awaited projectHub setup and cleanup registered only after success. Pre-register unconditional ownership, drain hub/queue before SQLite/root disposal, and cover missed/aborted setup through that owner without weakening final assertions.","file":"hub/test/telegram-pacing.test.ts","line":28},{"severity":"medium","text":"M2 (Spec): holdUntil/last-start pacing facts are memory-only; recreate over durable never-left429 rows and resume retries immediately, including other chats, before the outstanding hold expires. Persist/recover capped deadlines and remaining chat spacing; prove injected-clock reopen ordering.","file":"hub/src/remote/telegram-outbox.ts","line":124},{"severity":"medium","text":"M3 (Spec): replacement parts and superseded receipt commit separately; failure between parts leaves a partial group and unknown original on recovery. Atomically commit the complete fallback plan/proof or deterministically recover it once, with a planted between-parts failure control.","file":"hub/src/remote/telegram-outbox.ts","line":130}]
finding_counts: {"high":1,"medium":3,"low":0}

Consolidated full Standards/Spec audit complete at fixed base ce423359b0f766889b48c7b49eba31803c79bd4a. Standards: M1 medium. Spec: H1 high, M2/M3 medium. No additional findings after shared consumers, old Outbox defaults, changed tests/docs/skill/tier audit. Detailed A-12545: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12545-t-1347-full-source-review-at-8885622db-pairing-fence-and-durable-pacing.md. A-12542 local reported targeted runs remain separate; no Reviewer execution/delegation or configured runtime evidence. Fix/review the eventual corrected pushed head, including Coordinator-ordered sibling landings; preserve explicit no-mode-free-verify disposition. No suite requested.

Criteria: C1 failed (Durable paced delivery lacks current-pairing fencing, recovered flood-wait deadlines and atomic complete fallback planning; fixture setup cleanup also needs correction.).

### impl-1347 · 2026-10-27T01:29:06.510Z

Review-correction contract audit before H1/M2/M3 changes: Telegram payloads gain an internal admission purpose (paired project content versus explicit pairing reply/old-chat notice), checked against RemoteStore.pairing at dispatch and recovery. Consumers searched: remote.unpair/approve handlers in hub/src/hub/dispatch.ts, PairingCodes approval in remote/pairing.ts, configuration test/replacement callbacks, Telegram receive/start/test/#send and all 15 setPairing fixtures across tiers; previous CLI/Remote optional callback shape remains unchanged. Outbox gains optional synchronous admit(job), default true so old clients keep behavior. RemoteStore gains an additive synchronous transaction wrapper used for an all-parts+superseded-receipt write; existing writeOutbox, remote-state readers, tests/fakes and guides stay compatible. New persisted bot hold/chat-start scalars are private remote_state keys, not wire fields. Prior audit covers Outbox/fake/QA/skill/startup consumers; each unchanged wire consumer remains unaffected.

### impl-1347 · 2026-10-27T01:38:56.697Z

Source-1 corrections pushed at 9c45badf2: H1 current-pairing admission with explicit old-chat/pairing purpose; M2 persisted absolute bot hold and per-chat request starts; M3 transactional entire fallback plan+superseded proof and durable definite400 reconstruction; M1 pre-acquisition owner drains all hub/queue/remote writers before SQLite. Red controls reproduced sent!=dropped, early restarted sends and partial2!=1 rows. Latest complete serial local macOS/Node24 runs: outbox26 T1, rendering6/pairing3/pacing30 T2 (65 tests), full typecheck and wording lint pass. Earlier admission timeouts were not results; subsequent retry authorized by Coordinator. Existing kick-restart assertion unchanged, fake time now passes persisted spacing. Four-class fallback controls retained. No suite/Linux/QA claim and no replacement review requested yet; final ordered sibling integration remains pending.

### impl-1347 · 2026-10-27T02:10:24.074Z

T-1344 landed-contract integration audit before reaction transport changes: preserve Remote.start's fourth receipt callback and trusted RemoteSend ingress metadata. setMessageReaction consumers are TelegramApi, TelegramInbound.#flush and recover, held-reaction fake, telegram-inbound.test.ts, Telegram API fake and its guide; no other production/QA/skill/startup consumer invokes that method. TelegramInbound will accept the compatible Pick<TelegramApi,'setMessageReaction'> interface and Remote will supply the queued transport. Stored/delivered/seen flags stay in telegram.inbound:<message> exactly as T-1344 shipped. Internal DeliveryResult.sent gains optional message because a reaction succeeds without creating a new Telegram message; Store.writeOutbox already accepts absent map, and old Outbox clients still return their required message maps. Existing Outbox/fake/client consumers from earlier audit are unaffected; no wire/protocol/role change.

### impl-1347 · 2026-10-27T02:18:39.492Z

Reaction integration also needs each operation's own receipt rather than the end of the whole chat drain: accepted 👌 must let TelegramInbound persist its existing stored bit while later ordinary/👀 work remains queued. Add an optional internal OutboxClient.settled(job,result) observer after atomic settlement; previous clients omit it. All existing Outbox/fake consumers remain compatible and no wire fields change. The new reaction/429 control now retains an early-completion bound before advancing to later feedback.
