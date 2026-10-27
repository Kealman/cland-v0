---
id: T-1396
kind: task
title: The Discord REST client on fetch and a fake Discord REST server with a control API
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by: []
topic: null
branch: null
created: 2026-10-27T23:38:44.881Z
updated: 2026-10-27T23:38:57.736Z
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

- [ ] C1. Two `createMessage` calls with one nonce and `enforce_nonce` return the same message id and store one message on the fake, and every create and edit the client sends carries `allowed_mentions` with an empty `parse` (test).
- [ ] C2. The client reads the fake's application flags, `bot_public`, endpoint URL, session start limit, channel `last_message_id` and newest-first `before` pages, and every id above 2^53 comes back as the identical string (test).
- [ ] C3. No token appears in any error, log line or receipt, including a fault whose body echoes the token, a redirect is refused, and an API root that is not an explicit loopback HTTP URL with a port is refused before any request (test).
- [ ] C4. The fake refuses content over 2000 code points, a sixth action row, a sixth button in a row, a label over 80 code points and a custom id over 100 characters (test).

## Notes

Shared files: new hub/src/remote/discord-api.ts, new hub/test/fakes/discord/ (core, REST messages)
