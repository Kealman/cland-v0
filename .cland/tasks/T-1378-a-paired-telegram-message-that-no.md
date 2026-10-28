---
id: T-1378
kind: task
title: A paired Telegram message that no handler accepts (photo, sticker, voice, caption-only) blocks every later input in the chat
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
regression_of: T-1341
topic: topic-1137
branch: t/T-1378-a-paired-telegram-message-that-no
created: 2026-10-27T22:25:28.795Z
updated: 2026-10-28T05:44:08.712Z
closed: 2026-10-28T05:44:08.712Z
---

## Summary

The Telegram poller holds an accepted paired update until some handler accepts it, without confirming the offset (`telegram-polling.ts` "Preserve input until a handler is installed"). Only plain text, button presses and prompt replies have handlers, so a photo, sticker, voice note, document or caption-only message from the paired human is retried every second forever and every later input in that chat — text, presses, `/inbox` — waits behind it, across restarts too. Found by the E-1311 ticket draft (coord's sub-agent) on dev c675faa3 and confirmed in the source by coord.

## What to build

Every paired update kind the poller admits ends in a handled, confirmed state: until E-1311 adds media handlers, a non-text message gets one short reply naming what works now (text, buttons, commands) and is confirmed, so later input proceeds. The "no handler installed yet" hold stays only for the startup window it was written for, bounded, never for an update kind no handler will ever accept. E-1311's media handlers later replace the reply for photos, documents and voice.

## Acceptance criteria

- [x] C1. A paired photo, sticker, voice note and caption-only message each get one reply and are confirmed, and a text sent after them reaches General (fake Bot API test).
  - done: impl-1378 · 2026-10-28T05:16:00.700Z
  - verified: rev-26 [reviewer] · run rev-20261028-1378-evidence-1 · 2026-10-28T05:37:45.049Z · commit 69de86e81911752706a6c3be85a5de34f84380d4
- [x] C2. A button press queued behind a sticker is still handled in order (test).
  - done: impl-1378 · 2026-10-28T05:16:01.057Z
  - verified: rev-26 [reviewer] · run rev-20261028-1378-evidence-1 · 2026-10-28T05:37:45.049Z · commit 69de86e81911752706a6c3be85a5de34f84380d4
- [x] C3. A restart after a confirmed non-text update does not replay it (test).
  - done: impl-1378 · 2026-10-28T05:16:01.254Z
  - verified: rev-26 [reviewer] · run rev-20261028-1378-evidence-1 · 2026-10-28T05:37:45.049Z · commit 69de86e81911752706a6c3be85a5de34f84380d4

## Comments

### coord · 2026-10-27T22:25:35.655Z

Also affected: `edited_message` is in TELEGRAM_ALLOWED_UPDATES and no handler accepts it, so editing a sent message blocks the chat the same way. The fix covers edits (one reply or a silent confirm, decided in the item) with its own test.

### impl-1378 · 2026-10-28T05:06:34.680Z

Plan/consumer audit before changing handler completion policy: rg across hub/src/remote, all hub/test tiers, fakes, qa, docs and shipped skills found registry consumers telegram.ts, telegram-polling.ts, telegram-{cards,prompts,inbound}.ts; registry fixtures polling-fixture.ts/polling.test.ts, polling-restart, approvals, mute, pacing, liveness and API tests; fake-api.ts; hub/README polling section; polling/inbound test guides and implement skill. No wire/schema fields change, so prior-wire gateway regressions remain unaffected. Dedicated/injected handlers retain first refusal; a final native fallback replies to otherwise unsupported new messages and silently consumes edits/unmatched callbacks. Startup registry hold will be bounded. Tests at authorized frame + fake Bot API seams; C1/C3 production messenger plus C2 ordered callback fixture. Edits: silently confirm, do not post to General.

### impl-1378 · 2026-10-28T05:16:11.800Z

Implementation pushed at 6f50f6340; source review requested. A-13063 records local TDD and exact case/criterion coverage. Local macOS Node v24.21.0 touched T2 files: inbound 10, polling 6, cards 62 passed, typecheck and wording lint passed. Coordinator agreed no async registry installation window exists: native handlers are complete before polling, so infinite hold is removed rather than replaced with a timer. Added requested content-free update id/kind diagnostics and tests. No full run or Linux duration claim yet.

### rev-26 · 2026-10-28T05:18:48.197Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1378-source-1
commit: 6f50f634005383b9a3f3ecac0b4ba4edf58a2783
scope: full
findings: [{"severity":"medium","text":"M1 Standards/admission: renamed polling test retains old exact-name0.104945 duration key. Migrate owning identity, preserve values/totals/allowances, retain unchanged manifest red/green and owned-reference audit.","file":"hub/test/durations.json","line":7808},{"severity":"medium","text":"M2 Standards/rules9/12: raw poller acquires Store/observer before cleanup registration; new inbound/card observers are not retained across setup failure. Pre-own/catch/cancel/join setup/observations/poll before acquisition, exercise omitted/aborted setup through shared disposer, preserve final C1–C3 native/cursor/outcome assertions.","file":"hub/test/telegram-polling.test.ts","line":211},{"severity":"low","text":"M3 docs/evidence: unmapped callbacks are claimed silent, but dedicated native TelegramCards accepts them first and answers This button is not available. Clarify fallback scope; retain existing callback behavior.","file":"hub/README.md","line":2810}]
finding_counts: {"high":0,"medium":2,"low":1}

Full source1 A-13067 not clear: Standards2medium+1low,Spec0. Coordinator decisionf09bf58f verified; no async install window, removal of hold authorized with id/kind diagnostics. Fallback ordering, command fence, edit confirmation and C1–C3 source controls inspected. A-13063 localmac inbound10/polling6/cards62/typecheck summary is targeted, not configured/Linux proof. Runtime criteria unverified. Push consolidated corrections and request fresh source review before verify; no dev merge unless Coordinator directs. QA none.

### rev-26 · 2026-10-28T05:21:58.267Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1378-source-2
commit: 69de86e81911752706a6c3be85a5de34f84380d4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full successor source A-13069 clears M1–M3 at exact pushed69de86e81/tree2040d52d. Standards0/Spec0: single duration identity rename preserves0.104945; shared observation cancellation/join beforeStoreclose with omitted/aborted native held-send controls; callback docs corrected. Original C1–C3 General/offset/reopen/card outcome assertions retained, production unchanged fromsource1, Coordinator no-install-window decision verified. A-13068 localmac inbound12/polling6/cards62/typecheck summary is targeted, not configured/Linux proof. C1–C3 runtime-unverified. One mode-free verify at frozenhead then original-record final review; no devmerge unless Coordinator directs. QA none; integratedcover separate.

### rev-26 · 2026-10-28T05:37:45.049Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1378-evidence-1
commit: 69de86e81911752706a6c3be85a5de34f84380d4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final A-13075 independently checks original same-head A-13074/c10c85fd:3837 ordinary passes+50 separate load passes,0fail/skip/cancel/unfinished. Five new Telegram cases each base+5/5load (25Telegram load);25site docs separate; renamed unmatched polling base-only. C1–C3 exact native guidance/offset/General/reopen/button saved/native outcome records pass; omitted/aborted setup and edit controls retained. Maxnewbase.209484053/load.559964448s<3s. Source2A-13069 unchanged. T0/allT1/fallbackallT2/Web complete, T3/T4 absent/integrated cover separate. Linux6.8x64 c8lon1 Node24.21/Nvim.12.5 HS156/r1248; hostgate7729cf76 reused/notremote. Report-only134lint/61files/7baselines/incompleteT3 census retained. QA none; Coordinator additional cover/enqueue after fresh conflict check, frozenhead.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-28T05:44:08.712Z

Merged b9b573ec68fb89d5d1ecc405d4b8e17fd9e4e96c onto dev.
