---
id: T-1341
kind: task
title: Telegram polling with store-then-confirm offsets, dedupe and paired-chat filtering
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1340
topic: topic-1093
branch: t/T-1341-telegram-polling-with-store-then-confirm
created: 2026-10-26T19:09:06.217Z
updated: 2026-10-26T23:17:03.038Z
closed: 2026-10-26T23:17:03.038Z
---

## Summary

The Telegram remote polls `getUpdates` and confirms the offset only after an update is handled and stored. It deduplicates by update id and by chat and message id, drops the bot's own messages and anything not from the paired chat and sender, and polls with a zero timeout while offline.

## What to build

Long poll with a 30 to 50 s timeout, an HTTP timeout above it, and explicit `allowed_updates`: messages, edited messages, callback queries, the bot's membership. Offset and dedupe state live in T-1323's remote tables. Updates from any chat, sender or type other than the paired ones are dropped before any work, downloads included. Spec §3.7 and §3.9.

## Acceptance criteria

- [x] C1. An update the fake delivers twice is handled once, and a hub killed mid-update handles it after the restart, because the offset advances only after the update is stored (test).
  - done: impl-1341 · 2026-10-26T21:46:51.369Z
  - verified: rev-26 [reviewer] · run rev-20261026-1341-evidence-2 · 2026-10-26T22:02:19.174Z · commit 2f4766fcd2367fd3945df87714042610ff02504e
- [x] C2. Updates from another chat, another sender or an unlisted type are dropped before any work, and the bot's own messages are ignored (test).
  - done: impl-1341 · 2026-10-26T21:31:35.184Z
  - verified: rev-26 [reviewer] · run rev-20261026-1341-evidence-2 · 2026-10-26T22:02:19.174Z · commit 2f4766fcd2367fd3945df87714042610ff02504e

## Comments

### impl-1341 · 2026-10-26T21:18:42.361Z

Rule 20 inventory before changes: TelegramRemote's native start/run/stop/status and constructor are consumed by remote/messenger.ts and telegram-messenger.test.ts; MessengerFactory is consumed by remote/configuration.ts, daemon.ts, harness.ts, config-set.test.ts, gateway-secrets.test.ts, remote-cli.test.ts, telegram-messenger.test.ts and project-hub-lifecycle.test.ts. RemoteStore generic keys/message map are read by remote-state.test.ts, gateway-state.test.ts, pairing/outbox and remote CLI implementations. TgUpdate/GetUpdates consumers: telegram-api.ts, telegram-api.test.ts, fake-api.ts. Shipped guidance: implement skill, hub README Telegram section, telegram-api and telegram-messenger test guides; QA briefs/startup probes/T3/T4 searches found no direct Telegram native consumers. Plan: additive Telegram poller and handler seam, no wire/schema changes; retain old constructor/factory injection and old-hub frame compatibility. Existing frame/read clients unaffected; migrate native request-list assertions because run now polls.

### impl-1341 · 2026-10-26T21:22:21.592Z

Registry refinement from Coordinator: first-matching handlers, allowing T-1342 pairing and T-1344 mirror-in to attach without editing the loop; no-handler retry emits one update-id-only log. Narrow private /start exception is required by spec §3.2 for unpaired chats; all other unpaired input drops. Consumers remain the inventory above; production wiring adds Store.remotes + LogFn via messengerFactory's optional fourth options argument, preserving existing 3-argument consumers. No protocol shape changes.

### impl-1341 · 2026-10-26T21:30:59.305Z

Implementation complete before source review. C1 red: missing poll receipt (executor operation deadline reached); C2 red: bot claiming paired id reached handler (actual handled ids [4,9], expected [9]); native crash proof red before production wiring. Final targeted macOS/darwin Node v24.21.0 runs, each file serial: telegram-polling 6/6, telegram-polling-restart 1/1, remote-state 5/5, telegram-api 15/15, telegram-messenger 4/4 (31 passed, no skips). Native SIGKILL identity measured 0.591 s on macOS only; Linux duration not yet measured. Assertions retain General receipts, stored offsets, SQLite rollback/reopen, exact poll/connection close and handler-writer drainage. No browser or real platform used. Latest static tier lint and test lint passed (0 refusals; report-only existing findings are not a failure); closed-item wording passed. Shared docs/skill updated; no CLI/role/wire changes. Broad suites not run locally; source review precedes the mode-free verifier.

### rev-26 · 2026-10-26T21:34:15.296Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1341-source-1
commit: eb1305da59caad25dfa2a1879017bc02a17e0e11
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full Standards/Spec source clear at fixed base abc789d2b819ea7e8556cf8ff996800a7c78c72a, no findings. Serial polling/authority filtering, durable handler boundary then atomic monotonic offset+dedupe savepoint, paced offline/unhandled retry, native kill/reopen and writer drainage audited. Approved no-handler intermediate state confirmed directly in Coordinator decision a2504f95-3e17-4db3-9ba0-d23296077f24. Native SIGKILL proof covers selected unconfirmed input before handler completion, not every partial effect; replay-safe handler obligation and local-only evidence limits remain explicit. A-12496: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12496-t-1341-full-source-clearance-at-eb1305da5.md. No Reviewer executions/delegation. C1/C2 runtime marks pending one exact-head mode-free run including changed native T3 identity; Coordinator owns additional cover and landing.

### rev-26 · 2026-10-26T21:45:32.290Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1341-evidence-1
commit: eb1305da59caad25dfa2a1879017bc02a17e0e11
scope: evidence
findings: [{"severity":"medium","text":"M1: original Linux configured native restart identity fails its post-kill native-exit assertion (pidAlive actual true, expected false), before recovered offset/General assertions. Diagnose captured incarnation and writer completion; retain positive native completion and bounded failure controls rather than deleting/weakening the assertion.","file":"hub/test/telegram-polling-restart.test.ts","line":51}]
finding_counts: {"high":0,"medium":1,"low":0}

Original bb40ef51-d9ce-45af-9682-831103d71669 / A-12497 exits 1 at same reviewed head. Exact failure lines 17977–17991 quoted in A-12498: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12498-t-1341-failed-linux-evidence-at-eb1305da5.md. Independently parsed 3,221 ordinary passes/one failure plus 40 separate load passes; banner totals include load, not 3,261 ordinary passes. T0/T1/T2 green, changed T3 failed; Web unexecuted, T4/broader T3 absent. Native body 1.293746019 s is failure timing; no zombie/reuse cause proven by this log. C2 component evidence passes but no final ready/clear claim on failed run. No Reviewer executions. Fix and request fresh source review before another configured verification; no automatic same-head retry.

Criteria: C1 failed (Configured Linux native-kill/restart identity failed at process-exit assertion before restart/offset/exactly-one General proof.).

### impl-1341 · 2026-10-26T21:46:24.160Z

Evidence-1 failure (Linux droplet, run bb40ef51 at eb1305da5, A-12497): `AssertionError [ERR_ASSERTION]: owned native process has exited before reopening its writers; true !== false`, telegram-polling-restart.test.ts:51. The case stopped before restart assertions; not a passing test or Linux duration sample. Ordinary summary 3221 passed/1 failed plus 40 separate load passes; T0/T1/T2 complete, Web unexecuted, changed T3 0 passing identities. Test-only correction uses recorded native birth plus live identity-match positive control before killDaemon's owned cleanup, then the shared nativePollerProcesses exited receipt after it. That boundary recognizes Z/X/SZOMB as exited independently of parent reaping. Existing restart/offset/General assertions retained. Original Linux log did not record OS state, so the exact zombie classification remains an inference until corrected Linux verification. Corrected targeted macOS crash test 1/1 (0.698 s), not Linux evidence. No dev merge after first source review; production files unchanged.

### rev-26 · 2026-10-26T21:47:26.695Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1341-source-2
commit: 2f4766fcd2367fd3945df87714042610ff02504e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected Standards/Spec source clear, retaining full A-12496 audit and inspecting both test/guide changes. M1 now retains recorded native birth plus matching positive live inspection before owned SIGKILL/drainage, then requires complete shared native exited receipt before database reopen. Unknown/live state still refuses; parent reaping is separate. Restart/offset/exactly-one General/close/timer assertions intact; production unchanged, no dev merge. A-12500: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12500-t-1341-corrected-source-clearance-at-2f4766fcd.md. A-12497 remains failed old-head Linux evidence; zombie cause for that PID is inference, not captured fact. A-12499 local corrected Mac pass is separate. No Reviewer execution/delegation. C1/C2 runtime pending one new exact-head mode-free verify including changed T3 and Web; Coordinator owns integration/landing.

### rev-26 · 2026-10-26T22:02:19.174Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1341-evidence-2
commit: 2f4766fcd2367fd3945df87714042610ff02504e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1/C2 verified from original exact-head run 1a2d58e9-c77b-4f44-8b94-2a1eca36e8e6 / A-12501, exit 0. Independently parsed 3,506 ordinary passes plus 40 separate scoped load passes (eight identities x5). All six polling controls, SQLite transaction/reopen and fake injection cases pass base+5/5. Native corrected SIGKILL/restart case passes once at line 17962, body 1.625961050 s; selected changed-T3 wall 2.681 s excludes machine wait, no repetitions. New identities below3s. T0/all T1/fallback all T2/changed T3/Web completed; broader T3/T4 absent. Linux c-8 lon1, Node24.21.0, Neovim0.12.5, isolated Headless Shell156.0.8078.4/v1248. Old A-12497 remains failed historical partial evidence; no retrospective OS-state claim. Full exact timings/report-only/host-gate limits in A-12502: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12502-t-1341-final-same-head-linux-evidence-at-2f4766fcd.md. No Reviewer execution/delegation. Coordinator owns additional cover and landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-26T23:17:03.038Z

Merged 4ae1d8070c78de63e1c1964600c8887c4e781eec onto dev.
