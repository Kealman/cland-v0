---
id: T-1356
kind: task
title: 'Stale, foreign and late input: "Already answered", a privately refused foreign press, and a late message that answers no ask'
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1355
topic: topic-1115
branch: t/T-1356-stale-foreign-and-late-input-already
created: 2026-10-27T05:43:01.630Z
updated: 2026-10-27T13:40:27.382Z
---

## Summary

A press on a closed card gets "Already answered" and changes nothing. A press from anyone but the paired human is refused privately and changes nothing. A message that arrives late answers no ask by itself, and a reply answers only its own card, and only while that ask is open.

## What to build

A press whose key maps to a closed ask or approval answers the press "Already answered" and makes no hub request. If that copy still shows buttons, it queues the copy's outcome edit. When the hub refuses an answer because another client won, the press gets the same reply.

The poller admits one narrow exception to the silence of §3.2: a `callback_query` from a non-paired user on one of the bot's own mapped cards. It gets one private `answerCallbackQuery` ("This card is for the project's owner"). Nothing else happens, and the update is confirmed. Every other foreign update stays dropped.

A message that T-1348's catch-up marks as late never answers a waiting prompt (ticket 04). It goes to General as a late message. A late reply to a card answers that card only while its ask is open. A replayed press with the same callback id, or after a restart, changes nothing. Spec §3.5 and §3.9; builds on the polling's dedupe (T-1341) and T-1348's lateness.

## Acceptance criteria

- [x] C1. A press replayed on a card after its ask was answered gets "Already answered", sends no hub request, and the stored outcome is unchanged (test).
  - done: impl-1356 · 2026-10-27T12:50:18.306Z
  - verified: rev-32 [reviewer] · run rev-20261027-1356-final · 2026-10-27T13:04:17.603Z · commit 3caafb0b9b3df3011813413916fe02aa4afc52f2
- [x] C2. A press on a card from another Telegram user gets one private answer with `show_alert`, sends no frame to the hub, and leaves the card and the ask unchanged (test).
  - done: impl-1356 · 2026-10-27T12:45:14.741Z
  - verified: rev-32 [reviewer] · run rev-20261027-1356-final · 2026-10-27T13:04:17.603Z · commit 3caafb0b9b3df3011813413916fe02aa4afc52f2
- [x] C3. A late message that arrives while a prompt waits goes to General marked late and does not answer the ask, and a late reply to a closed card answers nothing (test).
  - done: impl-1356 · 2026-10-27T12:45:14.978Z
  - verified: rev-32 [reviewer] · run rev-20261027-1356-final · 2026-10-27T13:04:17.603Z · commit 3caafb0b9b3df3011813413916fe02aa4afc52f2

## Comments

### impl-1356 · 2026-10-27T12:38:01.773Z

Confirmed test seams: sealed frame protocol (hub/test/harness.ts) and loopback fake Bot API, as required by E-1310. Shared admission-contract consumer inventory before changes: TelegramUpdateHandler/pollTelegram production consumers telegram.ts, telegram-inbound.ts, telegram-cards.ts, telegram-prompts.ts; native registry fixtures telegram-polling.test.ts, telegram-polling-restart.test.ts, telegram-liveness*.ts, telegram-cards.test.ts and production-factory Telegram tests. Durable press/button/closure readers are telegram-cards.ts and telegram-cards.test.ts; prompt wait readers are telegram-prompts.ts and telegram-cards.test.ts. Guidance consumers: hub/README.md, docs/agents/tests/hub-test-telegram-{polling,cards,inbound}.test.ts.md and .agents/skills/implement/SKILL.md. Searched shipped skills/templates, QA briefs, startup probes, shared wire and all hub/nvim/web tests (including T3/T4); no other consumer of these native keys or handler shape. Existing pairing fixtures keep all non-card foreign updates silent; gateway previous-wire tests remain unchanged. Additive optional native admission callback only; no frame/schema/permission changes. Existing handler kinds remain compatible. Late-input classification reuses telegram.ts #late; no new public policy knob or command.

### impl-1356 · 2026-10-27T12:48:07.331Z

Source-review M1 red→green: added native stale repair edit-400 + fallback accept-disconnect test. Before the fix it failed `stale callback confirmation blocked by unknown fallback`. The fix catches only the exact press-keyed uncertain group, records additive native telegram.outcome-incomplete:<callback> metadata, and leaves the unknown reply fenced while confirming the callback. Test retains unchanged hub outcome, saved Already answered toast, exact callback/next-input offsets, component restart, later General history and exactly one accepted fallback with no retransmission. Consumer inventory extension: incomplete repair key is written only in TelegramCards and asserted by the card regression; existing outbox keyed-group reader/proof handles the uncertain job unchanged. No wire/schema/permission changes; no dev merge after first source review.

### rev-32 · 2026-10-27T12:48:18.913Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261027-1356-source
commit: 5d1774c2fa226e720e2248e5a47fd0dfefeeb6c3
scope: full
findings: [{"severity":"high","text":"M1 Spec: awaiting stale-copy outcome repair in the serial callback handler permanently blocks update confirmation and later input when the failed edit's fallback send is accepted but disconnects; replay and restart await the same uncertain fenced group. Preserve fencing while allowing durable repair ownership to release the callback cursor, and add the native fallback/restart/progression regression.","file":"hub/src/remote/telegram-cards.ts","line":88}]
finding_counts: {"high":1,"medium":0,"low":0}

Full source audit A-12781: Standards 0; Spec one high M1. New stale-copy repair awaits an outcome group inside the serial callback handler. Failed edit plus accepted/disconnected fallback leaves that group permanently uncertain; replay/restart cannot confirm the callback and later input is blocked. Preserve the send fence while releasing callback progression after durable repair ownership, with native uncertain-fallback/restart/later-input controls. Foreign refusal and late routing have no additional finding. A-12780 is local targeted summary only; no configured runtime receipt exists. C2/C3 runtime verification remains pending. Fresh corrected-head source review is required before verification.

Criteria: C1 failed (A stale-card repair with an uncertain fallback never confirms its callback and blocks replay/later input; preserve the fence while releasing cursor progress.).

### rev-32 · 2026-10-27T12:50:07.176Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261027-1356-source2
commit: 3caafb0b9b3df3011813413916fe02aa4afc52f2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source review clear. Standards 0, Spec 0; A-12783 carries the full A-12781 audit plus all six correction files. M1 resolved by releasing callback progress only for the exact uncertain repair group, retaining its unknown-send fence and an explicit incomplete marker. New native edit-refusal/accept-disconnect/restart control preserves saved toast, exact offsets, unchanged outcome, no retransmission and later General input; original criteria/race/refusal assertions remain. A-12782 is attributed local macOS evidence, not configured/Linux proof. C1–C3 runtime verification remains pending same-head configured evidence; restore the C1 claimant done mark cleared by source1. No source changes before mode-free verification.

### impl-1356 · 2026-10-27T13:03:42.433Z

Configured mode-free verify e5b179ff-f623-440c-89a7-82ed66cccc8e executed at unchanged source-clear 3caafb0b9; artifact A-12786. Linux x64 6.8.0-142-generic c-8 lon1 droplet, Node 24.21.0, Neovim 0.12.5, Chrome Headless Shell 156.0.8078.4/Playwright v1248. T0,T1,all T2 fallback,Web completed; 3702/3702 tests, 0 failure/cancel/skip/todo. Task T3/T4 deferred (none changed/mapped). Primary pass receipts exist for all eight new generated card cases; exact five load-gate finish/pass receipts per case (40/40), max .547921s, so no new >=3s Linux case. Timing/test-lint warnings report-only, lint refusals 0; 135 repository findings. Droplet lifetime 691s, cost $0.0480, configured workers2; Web phase actually workers4. Final evidence review requested. Fresh fetch dev c07b4bd0d + merge-tree exited0; coordinator directs another check after pending T-1358 landing and merge/delta-review/reverify if conflict. No source change or dev merge after source clear.

### rev-32 · 2026-10-27T13:04:17.603Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261027-1356-final
commit: 3caafb0b9b3df3011813413916fe02aa4afc52f2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-12787 records the raw A-12786 audit. Fresh configured e5b179ff: host T0 retained separately; Linux c-8 lon1 all T1/fallback all T2/Web passed, 3702 ordinary cases/486 files, no failures/cancellations/skips. All eight new identities passed ordinary plus five explicitly recorded load repetitions each (40 separate passes); M1 unknown fallback remains fenced while callback/later input progress, with no retransmission. All 46 ordinary card cases and prior receipt/race/failure controls passed. C1–C3 established jointly by source2 and named receipts. Budgets/lint/ratchet report-only, 135 findings/61 files; no T3/T4 or real-platform/QA claim. No findings. Any authorized integration after T-1358 still needs a fresh exact-head delta review and verification; Coordinator landing is separate.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1356 · 2026-10-27T13:38:43.526Z

Coordinator-authorized rule11 merge after T-1358 landed: fetched origin/dev a4acbcf07; resolved telegram-cards.ts, telegram-commands.ts and telegram.ts keeping both features. Stale outcome edits now use dev's shared telegramCard formatter while retaining exact press-keyed retry/filter and incomplete unknown fallback handling. Notices publishing, webOrigin and help remain; late callback/classification and foreign mapped-card-only admission remain. Auto-merged documentation/skill sections reread. Local macOS arm64 serial set rerun: 29 files including the new telegram-notices file, 300 tests passed, zero failures/cancellations/skips/todos; all 46 original card assertions retained, notices13/13 and API22/22. Typecheck, report-only test lint (135 findings, 0 refusals), tier lint passed. These are integrated candidate local receipts; prior Linux A-12786 and final A-12787 do not prove the changed head. Requesting delta source review before fresh mode-free verify.

### rev-32 · 2026-10-27T13:40:27.382Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261027-1356-delta
commit: cebca8e344e96d0042b92de387b5b8cef9eda99c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration delta source clear; A-12797 audits both parents and the three resolutions under Coordinator ae653945. Landed notice/shared renderer/webOrigin/inbound reference/help behavior remains, together with T-1356 late prompt exclusion, foreign-card refusal, exact-copy repair key/filter and unknown-fallback cursor release. Polling/prompts and all 46 card tests are unchanged from accepted task source; docs retain both flows. Standards 0, Spec 0. A-12796 is local macOS targeted 29-file/300-pass summary only. Old A-12786/A-12787 and criterion runtime marks cover 3caafb0b, not this merge. C1–C3 stay runtime-pending until fresh mode-free configured same-head evidence; no verified marks added at source.
