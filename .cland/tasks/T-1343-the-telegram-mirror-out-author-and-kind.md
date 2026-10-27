---
id: T-1343
kind: task
title: "The Telegram mirror out: author and kind header, Rich Messages, entities fallback, numbered splits, silent notes"
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: topic-1096
branch: t/T-1343-the-telegram-mirror-out-author-and-kind
created: 2026-10-26T19:09:06.641Z
updated: 2026-10-27T01:06:43.242Z
closed: 2026-10-27T01:06:43.242Z
---

## Summary

General arrives in the Telegram chat under an "author · kind" header, as Rich Messages by default. It falls back to plain text with gateway-computed entities after a rejection or under `format = "entities"`, splits the plain path into numbered parts, and never echoes what the human wrote in the chat. Progress notes and hub notices arrive silently.

## What to build

Rendering of General messages. The header names "you" for the human's workbench messages and "you (Discord)" for Discord's. No answers or asks to the human are sent as messages. Rich Message is GitHub Flavored Markdown up to 32768 characters, with entity detection and link previews off. Never MarkdownV2. The plain path splits at 4096 code points and before the 101st entity, at block boundaries and never inside an entity, with parts numbered "n/m". A conversion error falls back to plain text. Progress notes and hub notices go with disable_notification. Spec §3.4.

## Acceptance criteria

- [x] C1. An agent's report with a heading, a table and code arrives as a Rich Message with its header, a message the fake rejects arrives as plain text with entities, and a long message under `format = "entities"` arrives in numbered parts that never split an entity (test).
  - done: impl-1343 · 2026-10-26T23:45:32.510Z
  - verified: rev-31 [reviewer] · run rev-20261027-1343-final1 · 2026-10-27T01:00:34.815Z · commit 1810eb43d43a28549165823fe8db5bf2dda27fe5
- [x] C2. A progress note and a hub notice arrive without notification, and nothing the human sent from the chat, no answer and no ask is mirrored back as a message (test).
  - done: impl-1343 · 2026-10-26T23:27:23.615Z
  - verified: rev-31 [reviewer] · run rev-20261027-1343-final1 · 2026-10-27T01:00:34.815Z · commit 1810eb43d43a28549165823fe8db5bf2dda27fe5

## Comments

### impl-1343 · 2026-10-26T23:18:31.818Z

Rule 20 inventory before changes: TelegramRemote consumed by remote/messenger.ts, telegram-messenger.test.ts and telegram-polling.test.ts; factory consumed by configuration.ts, daemon.ts, harness.ts, config-set, gateway-secrets, remote-cli and project-hub-lifecycle tests. Telegram API SendMessage/SendRichMessage consumed by telegram.ts, telegram-api.test.ts and fake-api.ts. Message/TopicMessage consumers remain unchanged (production hub/dispatch/core, web and nvim clients, startup probes, fixtures, QA briefs and T3/T4 tests); outbound adapter reads current type:message frames only, preserving old wire shape with no required fields. RemoteStore.putMessage readers: mirror-in/state/outbox tests; existing mapping schema unchanged. Config remote.telegram.format already exists: factory will begin honoring it. Shipped guidance consumers: implement skill, hub README, docs/agents/secrets.md and Telegram test guides. Plan: optional native request fields and constructor options only; no reply/snapshot/schema or admission changes; old constructor/factory/frame compatibility regressions retained.

### impl-1343 · 2026-10-26T23:27:23.457Z

Rule 20 completed native consumer census (`rg -l` over hub/web/nvim/shared/qa/docs/skills): telegram.ts, telegram-api.ts, telegram-render.ts, messenger.ts, daemon.ts; telegram-api.test.ts, telegram-polling.test.ts, telegram-polling-fixture.ts, fake-api.ts, new rendering tests; hub README and API test guide. Existing 3-argument constructor callers remain compatible; existing factory signature and optional API request additions preserve old requests. No frame/reply/schema/row change, so shipped client fixtures/startup probes/QA/T3/T4 readers remain unchanged. The existing gateway legacy-client regression and native Telegram/polling/API tests retain previous shapes. Factory now honors the already-parsed format setting. Source mappings use existing TEXT schema and putMessage, no migration.

### rev-31 · 2026-10-26T23:36:20.701Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261027-1343-source1
commit: d6334d12f3a529ab87889b4f4cb096f7dcd5fcd5
scope: full
findings: [{"severity":"medium","text":"M1 [Standards]: CONFIG_USAGE changed without its frozen commands.json row. Independent decoding confirms mismatch; claimant reproduced unchanged compatibility 0/1 and cli-help 4/5 with root help 146 bytes longer. Migrate only CONFIG_USAGE after retaining original red/green guards; preserve exact-byte/composition/order assertions.","file":"hub/src/cli/usage.ts","line":71},{"severity":"medium","text":"M2 [Spec]: Blockquotes call inline with unrestricted nesting, so ordinary quoted code or a quoted link produces code/text_link inside blockquote. Telegram forbids those non-emphasis entity combinations. In entities mode or after rich rejection, sendMessage can reject this body; its rejection reaches Gateway's disabling path, losing the message and stopping the remote. Emit only legal nesting or retain offending spans as unstyled text. Add pure quoted-code/link controls and a component provider-compatibility rejection/control that proves delivery and subsequent remote availability.","file":"hub/src/remote/telegram-render.ts","line":86},{"severity":"medium","text":"M3 [Spec]: table filters any row whose first cell begins with two hyphens as though it were the delimiter row. A normal data row such as | --force | overwrite | is silently discarded. Recognize the complete delimiter row/cells instead of a first-cell prefix; retain all actual data. Add a T1 flag-table regression with independently expected payload text.","file":"hub/src/remote/telegram-render.ts","line":55},{"severity":"medium","text":"M4 [Spec]: A code block closes on trim().startsWith(openingFence), so a literal content line such as ```not-a-close is consumed and discarded as a closing fence. GFM requires a closing fence with only allowed trailing whitespace. Match a complete legal closing line and preserve non-closing fence-prefixed content verbatim. Add a T1 control retaining that literal line and the subsequent code body.","file":"hub/src/remote/telegram-render.ts","line":70}]
finding_counts: {"high":0,"medium":4,"low":0}

First full source review not clear; A-12519 consolidates four medium findings, exact source reasoning/control inputs, primary API/GFM references, all-consumer/test-level audit and evidence limits. C1 failed; C2 appears implemented but remains runtime-unverified. Correct the consolidated set, preserve existing assertions/guard sources, retain original red/green native outputs and request fresh source review at a pushed replacement before ready. No Reviewer test/build/probe/browser/Git mutation. Coordinator4a08247d changed the path: after source clear report head to Coordinator for head-bound verify-all; no mode-free task submission.

Criteria: C1 failed (M1–M4: frozen CONFIG_USAGE mismatch; illegal quote/code/link entity nesting; flag-table payload rows dropped; non-closing fenced-code content discarded.).

### impl-1343 · 2026-10-26T23:40:31.088Z

Source1 corrections underway without dev merge: M1 original exact-byte failures retained; only CONFIG_USAGE frozen row migrated, guard sources unchanged. M2 pure red showed forbidden outer blockquote around code/link; renderer now keeps those spans/text and omits that quote style. Independent fake provider nesting validation adds positive malformed-payload refusals and frame delivery/subsequent availability proof. Fake consumers audited: telegram-api, telegram-polling/restart/fixture, telegram-messenger and new rendering tests; requests without entities remain unchanged; no protocol/schema fields change. M3 original red removed --force/overwrite row; complete second delimiter-row recognition fixes it. M4 original red deleted literal ```not-a-close; complete matching-character/count/indent/trailing-space close fixes it. Per-file docs and README updated. Linux/full evidence still pending source review and Coordinator-owned verify all.

### rev-31 · 2026-10-26T23:44:45.800Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261027-1343-source2
commit: d2bc519921f3b81794d269d8a0946a6ab3559ecf
scope: full
findings: [{"severity":"medium","text":"M5 [Standards]: The new provider-control sends two rejected sendMessage requests, awaits their parsed API errors, then arms a method-only sendMessage TCP-close observer for the positive General send. A late close from the second rejected request can satisfy quoteClosed; its id then differs from quoteRequest and the test fails despite correct rendering. Client body/error completion is not the fake server socket-close event. Pre-arm and await each rejected request's own request/id-matched native close before arming the positive observer, or extend the existing observation port to select the exact request id. Retain both explicit 400 assertions, accepted text, subsequent send and connected-status assertions; no sleep or relaxed id equality.","file":"hub/test/telegram-rendering.test.ts","line":170}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected full source review not clear only on new M5; A-12522. Frozen CONFIG_USAGE migration/order/unchanged guards and production quote/table/fence fixes are established. New provider component has two negative sendMessage requests before a method-only positive TCP-close observer; parsed API rejection is not native server-close completion. Drain/id-match each prior request before positive observation, preserving all 400/text/continued-send/status/id assertions. Narrow existing-test fix only; no new fixture/process/sleep/broader run. A-12520 local43targeted passes retained with limits, original import/lifecycle receipts stay prior-head. No Reviewer execution. After corrected pushed head/source clear, Coordinator4a08247d supplies head-bound all; no mode-free submission.

Criteria: C1 failed (M1–M4 resolved; M5 new provider test can consume a prior rejected send's late TCP-close event because close selection is method-only and the negative requests are not drained first.).

### rev-31 · 2026-10-26T23:48:18.688Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1343-source3
commit: 8f5d022ec5c52b4554b7b10ba175c47de153b30a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear at 8f5d022ec5c52b4554b7b10ba175c47de153b30a, tree 31d9252928e24eaa6b34922db3efa260e63c8bef. A-12525 records the Standards and Spec audit. M1–M5 are resolved. The narrow M5 correction pre-arms and joins each rejected request's matching native close before the next action; strict IDs and positive assertions remain intact. Source3 changes only the test and its guide; production and shared fake remain unchanged. No new findings. C1/C2 runtime verification remains pending the Coordinator's exact-head full verify all under decision 4a08247d-015b-4454-bc46-34c651caa869; no mode-free task run is requested.

### rev-31 · 2026-10-27T00:22:31.986Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1343-delta1
commit: 1810eb43d43a28549165823fe8db5bf2dda27fe5
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized pairing merge delta source clear; A-12533 records Standards0/Spec0 findings at tree dfde953bfa7bc1ca520ed83a63c2ac9f64bdec92. Parents independently confirmed as prior full-clear8f5d022ec and Coordinator-requested landed dev4446cecdd. Pairing callbacks/fatal handlers and render-format forwarding are both preserved; unchanged rendering source/tests/fake carry A-12525. Synchronous stopped/fatal receive fence prevents the terminal General notice from starting a second send and replacing the original blocked cause. Existing pairing assertions remain byte-identical to landed dev; guide/README updated. Both frozen help rows independently match. A-12532's selected local34 T2+1 T1 passes and typecheck remain local correction-tree evidence, no Linux/full/load result. C1/C2 runtime-unverified. Report ready at this exact head for Coordinator-owned sole full verify all under4a08247d/3d9b5436; no mode-free submission or further merge requested.

### rev-31 · 2026-10-27T01:00:34.815Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1343-final1
commit: 1810eb43d43a28549165823fe8db5bf2dda27fe5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified at unchanged reviewed head/tree dfde953bfa7bc1ca520ed83a63c2ac9f64bdec92. A-12536 independently audits original Coordinator-owned all run b476e9d5/A-12535, nativeexit0 and hub exact-head finished/passed. Typed unique test finishes4908pass/8skip/0fail/cancel/todo; all12 required pure/rendering identities pass once,41Telegram identities pass, membership blocked-cause and native restart controls included. New rendering max0.242528652s, no >=3s allowance. C1 rich/fallback/UTF16/entity-safe numbered parts/durable mappings and C2 silence/filtering/actual ask-answer exclusions established by unchanged assertions plus named completions. HostT0 plus LinuxallT1/T2/T3/Web completed; T4 absent, no separate candidate5/5 load records. Eight explicit platform/prerequisite skips are unrelated, not passes. HeadlessShell156.0.8078.4/v1248; Linuxc-8lon1 Node24.21.0/Neovim0.12.5; lifetime2009s/$0.1395 is machine accounting. Hostgate549f4806 is tree provenance, not alternate candidate or remote repeated typecheck. Report-only135lint findings/61files, seven missing baselines, timing/Web/T3overruns and incomplete-base ratchet retained; no enforce-budget claim. SourceA-12525+A-12533 carries. Coordinator enqueues on ready; no further run or merge requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-27T01:06:43.242Z

Merged 5e5bc6fde75029877078fa0ce308891f66e76a4f onto dev.
