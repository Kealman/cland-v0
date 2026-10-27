---
id: T-1401
kind: task
title: The application checks, the fatal close codes and cland remote test discord stop only this remote with its cause and fix
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1398
topic: null
branch: null
created: 2026-10-27T23:38:46.051Z
updated: 2026-10-27T23:38:46.051Z
---

## Summary

At start the hub checks the Message Content flag and the empty Interactions Endpoint URL. A wrong one, or a fatal close code, stops only the Discord remote with its cause and fix in General, while the hub and the Telegram remote serve on. A 4003 gets one fresh identify, and `cland remote test discord` checks the token with Discord.

## What to build

**The checks.** Before connecting, `getCurrentApplication` must show `GATEWAY_MESSAGE_CONTENT` (1<<18) or `GATEWAY_MESSAGE_CONTENT_LIMITED` (1<<19); otherwise the cause is `message-content`. The `interactions_endpoint_url` must be empty; otherwise the cause is the new `interactions-endpoint`, with the fix "clear the Interactions Endpoint URL in the application, then run cland hub reload".

**Close codes.**
- 4004 means `token`, and 4014 means `message-content`.
- 4010 to 4013 mean the new `gateway-refused`, naming the code.
- A 4003 gets exactly one fresh identify. A second 4003, or a fatal code after it, stops the remote.

**REST.** A 401, 40001 or 50014 means `token`.

**Every stop** goes through 03's stop path. It writes one General line with the cause and fix, a status row with `stopCause`, and the `cland remote status` reason. It closes the socket with 1000 and never reconnects. `cland hub reload` retries, as it does for Telegram.

**`test`.** `Remote.test` reads the application and, when the remote is paired, posts exactly one line in the channel. The fake's control can set the flags and the endpoint URL and close the socket with any code.

**Contract:** `RemoteStopCause` gains `interactions-endpoint`, `gateway-refused` and `identify-budget`; ticket 08 uses the last, so the union changes once. Consumers to migrate:
- `protocol.ts`, `shared/wire/index.ts` and `hub/test/wire-conformance.ts`;
- `notices.ts` (`STOPS` and the `remoteStopCause` guard);
- `doctor/remotes.ts` and `cli/remote.ts` (generic through `remoteStopDetails`);
- `remote-state` persistence (`stop_cause` is TEXT);
- T-1372, which owns doctor's Discord wording;
- the tests `doctor-remotes`, `remote-cli`, `remote-workbench`, `remote-state-migration` and `web-area-state`;
- `docs/agents/secrets.md` and `hub/README.md`.

The web and Neovim show only `lastError` and need no change.

Spec §3.1 (failure stays in the gateway), §3.8 (application, close codes), §3.9 (telling the human), §3.10 (`test`); research rules 2, 8 and 11.

## Acceptance criteria

- [ ] C1. With the Message Content flag off on the fake, the Discord remote stops before identifying, General gets one line naming the toggle, and the Telegram remote on the same hub keeps mirroring (test).
- [ ] C2. An Interactions Endpoint URL set on the fake application stops the remote with one General line telling the human to clear it, and no identify is sent (test).
- [ ] C3. Close codes 4004, 4010, 4011, 4012, 4013 and 4014 each stop only the Discord remote with their structured cause and fix in General, the status row and `cland remote status`, and no reconnect follows (test).
- [ ] C4. A 4003 is followed by exactly one fresh identify, and a second 4003 stops the remote (test).
- [ ] C5. A REST 401 stops the remote with the `token` cause, and `cland remote test discord` reads the application and posts exactly one line in the paired channel (test).

## Notes

Shared files: discord.ts, discord-socket.ts, hub/src/remote/notices.ts, hub/src/protocol.ts, shared/wire/index.ts, hub/test/wire-conformance.ts
