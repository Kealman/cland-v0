---
id: T-1347
kind: task
title: "Telegram pacing: one request in flight per chat and a bot-wide 429 hold"
state: closed
status: done
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
updated: 2026-10-27T04:48:06.659Z
closed: 2026-10-27T04:48:06.659Z
---

## Summary

Pacing: one queue per chat with one request in flight, about a message a second, cards first. A 429 holds the whole bot for its `retry_after`, capped at 5 minutes, with nothing lost or reordered.

## What to build

Bind T-1324's and T-1325's outbox drain to the Telegram client: per-chat ordering, priority for cards, bot-wide 429 hold. Hard-code no limit beyond the documented ones. Use an injected clock. Spec §3.7 and §3.9.

## Acceptance criteria

- [x] C1. A burst of 20 General messages against a fake that answers one 429 arrives complete and in order after the wait, with one request in flight per chat and the hold applied bot-wide under an injected clock (test).
  - done: impl-1347 · 2026-10-27T04:04:56.358Z
  - verified: rev-26 [reviewer] · run rev-20261027-1347-evidence-1 · 2026-10-27T04:42:18.164Z · commit fa9396f198689507be4e7b0e5516fcc24b2a7d5b

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

### impl-1347 · 2026-10-27T03:01:09.139Z

T-1349 dev f5ae21c8/tracker7c227fdf merged, pushed7728ca749, clean tree. Conflicts resolved retaining queue-only General send path and 400-only rich fallback; T-1349 cause/fix-first diagnostics, bounded poll/conflict behavior and fake long-description controls preserved. Existing four-class controls all green after merge. Complete serial local macOS/Node24: liveness11, outbox26, inbound8, pacing31, rendering6, pairing3 =85 runtime tests; full typecheck/wording lint pass. No Linux/suite/browser/QA claim. Added Coordinator-requested T-1351 source comment at rejected-startup fixture; its invalid-config rejected-startup cleanup assertions remain. T-1348 acknowledged ownership of poll availability/resume, nonfatal outage handling and source-deduplicated missed General after this queue lands. Awaiting T-1346 landing before fresh final-head review; no mode-free verify.

### rev-26 · 2026-10-27T03:55:17.020Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1347-source-2
commit: 321734b2b3d6eac924cdd769f3e9ba8862fc3dad
scope: full
findings: [{"severity":"medium","text":"M4 Standards/rules9,12: actual projectHub acquisition precedes setup cancellation/deadline; dispose joins starting before invoking held-resource closers. Held getMe during pre-serving startup ignores owner abort and blocks cleanup ahead of fake.close. Own/bound/cancel actual startup and release/stop its held resources before joining; prove same-disposer held-start abort/missing receipt and final close/Store cleanup.","file":"hub/test/telegram-pacing-fixture.ts","line":35},{"severity":"low","text":"L1 Standards/rule16: integration reintroduces three /control/fault rows and duplicated response-mode/held-request prose. Consolidate one row/paragraph preserving description, accept-disconnect/hold-after-send, release/menu/reaction semantics.","file":"docs/agents/tests/hub-test-telegram-api.test.ts.md","line":77}]
finding_counts: {"high":0,"medium":1,"low":1}

Integrated full source audit complete at321734b2b, base4713904c. H1/M1/M2/M3 source corrections resolved; no new Spec finding. Standards M4 medium/L1 low remain. Production admission/persisted deadlines/atomic fallback plus reaction own-settlement and entities-aware command redirect audited. Direct base/head comparison confirms consumed-kick exact offset, single fixed General cause/fix history, reply/native-close/zero-timer assertions unchanged; only Coordinator-approved stopped1s fake advance added. Read Coordinator reaction46e5bf51/1f1965b6 and T1351 split138602ea directly. Full A-12573: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12573-t-1347-integrated-source-review-at-321734b2b-held-start-ownership.md. A-12572 local102 is reported macOS evidence, no configured Linux/full proof. No Reviewer execution/delegation or suite request; corrected pushed head needs fresh source review before Coordinator's all occasion.

Criteria: C1 failed (Fixture owner can deadlock on actual pre-serving startup; existing missed/aborted controls cover only a synthetic post-serving receipt.).

### rev-26 · 2026-10-27T04:06:01.530Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1347-source-3
commit: fa9396f198689507be4e7b0e5516fcc24b2a7d5b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source clear; A-12545/A-12573 full audits retained. All eight changed correction files read: M4 setup observer arms before native acquisition; separate raw ownership; startup-only fake/custom releases before join; late-hub stop before SQLite. Added real held-getMe abort/deadline controls retain primary rejection, completed stop, exact native closed census, closed Store/frozen behavior clock/zero timers before emergency release. L1 guide consolidated with all modes/description/menu/reaction semantics. No production or dev merge changes; prior H1/M1/M2/M3 fixes and consumed-kick exact offset/single-history/native-close assertions unchanged. A-12575: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12575-t-1347-final-corrected-source-clearance-at-fa9396f19.md. A-12574 local48 affected passes remain macOS targeted reports; prior102 is old-head, no fresh104 claim. C1 done restored; runtime unverified pending exact-head Coordinator rule6 all. No Reviewer execution/delegation, suite request or QA claim; keep explicit no-mode-free occasion.

### impl-1347 · 2026-10-27T04:07:08.958Z

Ready reported to Coordinator under directed source-only disposition: full source-3 clear atfa9396f198689507be4e7b0e5516fcc24b2a7d5b, zero findings (A-12575). Fresh origin/dev4713904c fetch and merge-tree check exit0/conflict-free (treee7362543358b033866504c0626dd5f5a395338e8); worktree clean and head pushed. Coordinator verification submission admitted as5ec36505-789d-4e27-9bd9-7f11d3e7deb3. This is admission, not a pass; runtime/C1 evidence remains pending. Retaining claim until merge.

### impl-1347 · 2026-10-27T04:41:26.838Z

Exact-head Coordinator rule6 all/full5ec36505 atfa9396f19 exited0:4978 tests/4970 pass/0 fail/0 cancelled/8 platform-prerequisite skips, log A-12576. Droplet Linux x64 c-8 lon1, Node24.21.0, Neovim0.12.5; T0/T1/T2/T3/Web completed, T4 not run. Lint/duration gates report-only (135 lint findings plus reported overages), not enforced-clean. Parsed structured receipt facts independently: pacing33/33 pass max0.432293s, commands7/7 pass max0.261392s; named C1, all four fallback classes, atomic planning, admission/reopen, reactions/commands and real held-start controls pass. Coordinator confirmed no new >=3s pacing identity allowance. Final evidence review requested with --verified all(C1), scope evidence; head/worktree unchanged.

### rev-26 · 2026-10-27T04:42:18.165Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1347-evidence-1
commit: fa9396f198689507be4e7b0e5516fcc24b2a7d5b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1 evidence clear at unchangedfa9396f19 from original Coordinator all5ec36505/A-12576. Independently deduplicated4970 ordinary passes+8 reasoned unrelated skips, zero fail/cancel/TODO; T0/T1/T2/T3/Web exit0, T4 absent, no scoped load repetitions. All33 pacing generated identities pass(max0.432293093s), including exact20-frame C1, bot-wide cap/chat ownership/priority, four fallback classes,8revocation combinations, persisted reopen deadlines, atomic fallback recovery, stop and post/pre-serving acquisition cleanup. Own-settlement reaction and public command integration pass0.031308042/0.103866402s, command7 and related inbound/liveness/pairing/rendering/polling/messenger/Outbox files complete. No >=3s new pacing identity. Source-confirmed exact consumed-kick offset/single-history/native-close assertions retained. Linuxx64 c-8lon1, Node24.21/Neovim0.12.5, isolated HeadlessShell156.0.8078.4/v1248; host gate8fe61431 is prepared tree/not remotely repeated. Budgets/lint/incomplete ratchet report-only. Detailed A-12577: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12577-t-1347-final-evidence-clearance-at-fa9396f19.md. Source chain retained; T1348/T1351 accepted scope separate. No Reviewer execution/delegation/live/QA/epic claim or additional run requested. Coordinator owns landing.

Criteria: C1 verified.

### coord · 2026-10-27T04:48:06.659Z

Merged fedeb4f7443b5102de36c7a507478dabb13084d0 onto dev.
