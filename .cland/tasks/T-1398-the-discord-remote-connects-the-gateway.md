---
id: T-1398
kind: task
title: "The Discord remote connects: the gateway socket on ws with intents 33281, jittered heartbeats and its status"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1396
topic: null
branch: null
created: 2026-10-27T23:38:45.406Z
updated: 2026-10-27T23:38:57.964Z
---

## Summary

With Discord enabled and a token present, the hub builds a Discord remote instead of failing, connects to the gateway URL on `ws` and identifies with intents 33281. It keeps the connection alive with jittered heartbeats and shows as connected only while they are acknowledged. `cland remote status` shows the connection and the invite link.

## What to build

**The remote.** `messengerFactory` builds a `DiscordRemote` for `discord`, with the API root from the daemon's environment and the store `forMessenger('discord')`. `start` reads the application and keeps its id; ticket 06 adds the checks. `run` reads `GET /gateway/bot` and accepts the URL only as `wss://` under `discord.gg`, or as a loopback `ws://` when the API root is the loopback fake. It connects with `?v=10&encoding=json`, without compression.

**The socket.** On Hello, the first heartbeat follows `heartbeat_interval × random()`, the next ones follow the interval, and an op 1 gets an immediate heartbeat. Identify sends the token, intents 33281 and the properties, with no shard and no presence. READY gives the session id, the resume URL, the sequence and the bot's user id, held in memory; ticket 17 persists them. Dispatches go to the remote's handlers, which later tickets add, and are logged by type and ids only.

**Status and stopping.** `status()` counts the remote as connected only after READY and a heartbeat acknowledgement within the last interval. It carries `lastInbound`, `lastOutbound` and the invite link with `permissions=117824` as `botLink`. One internal stop path (`stopWith(cause, detail)`) writes the General notice once, records the status with its cause and closes the socket. Later tickets only call it. `stop()` closes the socket; ticket 17 makes that close resumable.

**The fake gateway.** It is a `ws` server on the fake's loopback port. It sends Hello with a configurable interval, validates Identify (token, intents, version, encoding, no compression), answers READY with ids above 2^53 and acknowledges heartbeats. Its control API dispatches events and counts identifies, heartbeats and payloads.

**Contract:** `MessengerFactory` no longer throws for `discord`. The `cland remote` help text drops "Discord requires an injected client" and gains the `CLAND_DISCORD_API_ROOT` line. `cland remote status` shows Discord's invite as its bot link. Consumers: `daemon.ts`, `configuration.ts` callers and tests (`gateway-secrets`, `config-reload`), `cli-help.test.ts`, `remote-docs.test.ts`, `remote-cli.test.ts`, `hub/README.md`, `docs/agents/pairing.md`, and T-1371 through the invite link.

Spec §3.8 (the connection), §3.12 (known hosts, one redactor); research rules 6, 7, 9 and 15.

## Acceptance criteria

- [ ] C1. With Discord enabled and a made-up token from the environment, the hub identifies on the fake with intents 33281, API v10, JSON, no compression and no shard, and `cland remote status` shows Discord connected with an invite link carrying `scope=bot&permissions=117824` (test).
- [ ] C2. Under the injected clock the first heartbeat waits interval × jitter, later ones follow the interval, an op 1 gets an immediate heartbeat, and the remote shows connected only while acknowledgements arrive (test).
- [ ] C3. A gateway URL outside Discord's hosts, or a non-loopback one under the fake root, stops only the Discord remote with its reason in General, while the Telegram remote on the same hub keeps mirroring (test).
- [ ] C4. The token appears only in the identify payload and the REST authorization header, never in a frame, log line, error, status row or `cland remote status` output (test).

## Notes

Shared files: hub/src/remote/messenger.ts, hub/src/cli/usage.ts; new hub/src/remote/discord-socket.ts, discord.ts; hub/test/fakes/discord/ (gateway)
