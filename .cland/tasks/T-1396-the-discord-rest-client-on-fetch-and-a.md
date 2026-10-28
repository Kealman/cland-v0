---
id: T-1396
kind: task
title: The Discord REST client on fetch and a fake Discord REST server with a control API
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by: []
topic: topic-1129
branch: t/T-1396-the-discord-rest-client-on-fetch-and-a
created: 2026-10-27T23:38:44.881Z
updated: 2026-10-28T00:18:33.585Z
closed: 2026-10-28T00:18:33.585Z
---

## Summary

A hand-written Discord REST client on `fetch` reads the application, the gateway URL, the channel and its history, and creates and edits messages with an enforced nonce and no mentions. A fake Discord REST server in the suite plays by Discord's documented rules, with a control API that later tickets extend to play the human and another member.

## What to build

**The client.** `DiscordApi` uses the base `https://discord.com/api/v10`, overridable through `CLAND_DISCORD_API_ROOT`, which accepts only an explicit loopback HTTP URL with a port, as Telegram's root does. It sends a fixed `User-Agent: DiscordBot (<url>, <version>)`, and the token travels only in `Authorization: Bot <token>`. It refuses redirects. Errors are `DiscordError` values with a route template (never a URL), the HTTP status, the JSON code and `retry_after`, all passed through the shared redactor.

Vendored v10 types keep every snowflake a string, and nothing calls `Number()` on an id. The methods:
- `getCurrentApplication`: id, `flags`, `bot_public`, `interactions_endpoint_url`;
- `getGatewayBot`: `url`, `session_start_limit`;
- `getChannel`: `last_message_id`;
- `listMessages(channel, { before, limit })`;
- `createMessage`: always sends `allowed_mentions: { parse: [] }`, plus a `nonce` of at most 25 characters with `enforce_nonce`;
- `editMessage`: also always sends the empty `allowed_mentions`.

**The fake.** `fakeDiscordFixture(t, { clock })` is an in-process loopback HTTP server with a fabricated token. It has one application, one guild, a channel to pair, a second channel, the human (a server administrator) and another member, and every id is above 2^53. It stores messages and lists them newest first with `before` and `limit`, and honours `enforce_nonce` within a window under the injected clock. Like Discord, it refuses:
- content over 2000 code points;
- more than 5 action rows or 5 buttons in a row;
- a label over 80 characters or a custom id over 100.

It records which users, roles and `@everyone` a create or edit would ping under Discord's default mention rules. Its control API sets the application's flags, `bot_public`, endpoint URL and `session_start_limit`. It posts messages as the human, the other member, a bot or a webhook, injects faults (a status with a JSON code, a body that echoes the token, a hold, a disconnect) and lists every request and stored message.

Spec §3.8 (REST, the client), §3.12; research rules 15, 19 to 21 and 34.

## Acceptance criteria

- [x] C1. Two `createMessage` calls with one nonce and `enforce_nonce` return the same message id and store one message on the fake, and every create and edit the client sends carries `allowed_mentions` with an empty `parse` (test).
  - done: impl-1396 · 2026-10-27T23:44:23.180Z
  - verified: rev-26 [reviewer] · run rev-20261028-1396-evidence-2 · 2026-10-28T00:11:48.391Z · commit 6dd6b253c9ea545ce1e1b35f090f341988bbb968
- [x] C2. The client reads the fake's application flags, `bot_public`, endpoint URL, session start limit, channel `last_message_id` and newest-first `before` pages, and every id above 2^53 comes back as the identical string (test).
  - done: impl-1396 · 2026-10-27T23:44:23.579Z
  - verified: rev-26 [reviewer] · run rev-20261028-1396-evidence-2 · 2026-10-28T00:11:48.391Z · commit 6dd6b253c9ea545ce1e1b35f090f341988bbb968
- [x] C3. No token appears in any error, log line or receipt, including a fault whose body echoes the token, a redirect is refused, and an API root that is not an explicit loopback HTTP URL with a port is refused before any request (test).
  - done: impl-1396 · 2026-10-27T23:44:23.829Z
  - verified: rev-26 [reviewer] · run rev-20261028-1396-evidence-2 · 2026-10-28T00:11:48.391Z · commit 6dd6b253c9ea545ce1e1b35f090f341988bbb968
- [x] C4. The fake refuses content over 2000 code points, a sixth action row, a sixth button in a row, a label over 80 code points and a custom id over 100 characters (test).
  - done: impl-1396 · 2026-10-27T23:44:24.207Z
  - verified: rev-26 [reviewer] · run rev-20261028-1396-evidence-2 · 2026-10-28T00:11:48.391Z · commit 6dd6b253c9ea545ce1e1b35f090f341988bbb968

## Notes

Shared files: new hub/src/remote/discord-api.ts, new hub/test/fakes/discord/ (core, REST messages)

## Comments

### impl-1396 · 2026-10-27T23:40:10.725Z

Rule 20 inventory: searched hub/, web/, nvim/, shared/, qa/, .agents/, docs/ for DiscordApi, DiscordError, fakeDiscord, CLAND_DISCORD_API_ROOT and discord-api. No shipped production/client/probe/persisted-record/test consumers exist for these new modules. Spec/research describe future consumers (gateway, application startup checks, pacing, pairing, history and QA). Existing Telegram API and redactor consumers retain their contracts; this item imports the shared redactor without changing it. New API is additive and has no hub wire shape to migrate or previous Discord wire client to regress. Seam authorized by launch: fake REST; no frame handler exists at this stage.

### rev-26 · 2026-10-27T23:46:28.557Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1396-source-1
commit: 3732d429062d33f4ddb895d04be7e0b236c3679f
scope: full
findings: [{"severity":"medium","text":"M1 Standards: discord-api.test.ts inserted in Telegram section violates lexical tier order; move only owned T2 row, retain unchanged guard red/green.","file":"hub/test/tiers.json","line":548},{"severity":"medium","text":"M2 Standards: guide H1 must be exact test path # hub/test/discord-api.test.ts; retain unchanged test-docs guard red/green.","file":"docs/agents/tests/hub-test-discord-api.test.ts.md","line":1},{"severity":"medium","text":"M3 Standards: shared native fixture does not cancel/fence late setup acquisition; cleanup can skip handler join after close failure. Held test at167–174 leaves call/outcome unjoined when setup receipt fails. Pre-own idempotent lifetime/cancellation and bounded server/socket/handler/observer drain; cover omitted/aborted serving/held setup through same disposer.","file":"hub/test/fakes/discord/fake-api.ts","line":144}]
finding_counts: {"high":0,"medium":3,"low":0}

Full consolidated source audit complete: Standards3 medium M1/M2/M3, Spec no independent finding. REST roots/auth/UA/redaction/string ids/nonce/mention suppression and fake protocol constraints reviewed. A-12939 local8/8/typecheck is not configured/Linux proof; A-12941 static guard red/green pertains uncommitted corrections. C1–C4 runtime marks pending. Push all corrections and request fresh source review before verification; no further dev merge. QA none.

### rev-26 · 2026-10-27T23:48:43.024Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1396-source-2
commit: 651e0a77aae3ae97cbd13e4ab337f71ca510e883
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source-2 clear on Standards and Spec. M1 lexical T2 entry and M2 exact guide H1 corrected with A-12941 guard reds/greens. M3 owner now cancels/fences setup and late sockets, independently drains native/socket-handler/observer resources and joins held outcomes on failed setup; omitted/aborted/pre-acquisition controls retain final zero-resource/timer assertions. Production client unchanged from full source1/A-12946. A-12948 local11/11/typecheck is not configured/Linux proof. Runtime C1–C4 marks pending. One unchanged-head mode-free verification then original-record review; no further dev merge. QA none.

### rev-26 · 2026-10-27T23:53:59.168Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1396-evidence-1
commit: 651e0a77aae3ae97cbd13e4ab337f71ca510e883
scope: evidence
findings: [{"severity":"medium","text":"M4 Standards: added 'It is not yet a running Discord remote' fails unchanged README stale-feature guard. A-12955 exact AssertionError: hub/README.md must describe shipped features. State current REST module boundary directly, retain guard red/green and request corrected-head source review before retry.","file":"hub/README.md","line":6580}]
finding_counts: {"high":0,"medium":1,"low":0}

Original configured be15015e/A-12955 failed on owned README wording. Independent progress1121 ordinary pass/1 fail plus25 separate load pass, not1147 ordinary. T0green,T1red; new DiscordT2/Web/T3/T4 unexecuted, so C1–C4 runtime marks remain pending. Linux droplet provenance does not prove unrun phases. Budget/lint report-only; host typecheck reused98b3362c not remote. Keep failed log, correct documentation/source-review before any configured retry. QA none.

### rev-26 · 2026-10-27T23:54:18.084Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1396-source-3
commit: 6dd6b253c9ea545ce1e1b35f090f341988bbb968
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source-3 clear. Only README changed from source2: current REST boundary/caller responsibilities replace the M4 feature-deferral sentence; owning guard unchanged, reported local red2/3->green3/3. Runtime client/fake/tests identical to full source2/A-12950; no new findings. A-12955 remains failed old-head with new DiscordT2/Web unexecuted. C1–C4 runtime marks pending. One mode-free configured run at unchanged corrected head then original-record evidence review; no further dev merge. QA none.

### rev-26 · 2026-10-28T00:11:48.391Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1396-evidence-2
commit: 6dd6b253c9ea545ce1e1b35f090f341988bbb968
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear, A-12979. Exact-head run 7aefe309/A-12977 passed: independently counted 3778 ordinary passes plus80 separate load passes; eleven Discord identities each base pass+5/5 load (55 Discord repeats). Inspected C1 nonce/mentions, C2 string ids/application/history, C3 redaction/root/redirect and C4 limits; maximum Discord base .064253022s/load .157742770s, none >=3s. README guard now passes. T0/allT1/fallback allT2/Web complete on Linux droplet; T3/T4 unexecuted, no integrated-cover claim. Host typecheck reused, budgets/lint report-only. Failed old A-12955 retained separately. Source3 A-12958 unchanged; no findings. QA none; Coordinator owns landing.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-28T00:18:33.585Z

Merged 7c8a32950d8ecf2e5463818e823b49275613f530 onto dev.
