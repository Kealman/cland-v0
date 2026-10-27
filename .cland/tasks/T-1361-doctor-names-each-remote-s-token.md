---
id: T-1361
kind: task
title: Doctor names each remote's token, connection, pairing and stopped cause with its fix
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by: []
topic: topic-1102
branch: t/T-1361-doctor-names-each-remote-s-token
created: 2026-10-27T05:46:49.627Z
updated: 2026-10-27T05:48:13.177Z
---

## Summary

`cland doctor` gains one block per messenger: whether its token is present (with the fingerprint), whether it is enabled, its connection state and pairing, and, for a stopped remote, the cause and the fix. Doctor reads only presence and the running hub's local status, and makes no platform or paid call.

## What to build

Spec §3.11 (doctor) and §3.9 (telling the human). Today a stop is recorded as one free-text reason ("cause; fix; message") in the remote's status row. Record a structured stop cause beside it: `token` for 401 or 4004, `message-content` for 4014, `blocked` for 403, and `other-consumer` for a lasting 409. Keep one cause table that gives the cause and fix wording for both General's notice (the remote notices module) and doctor, so the two cannot drift.

Add the cause to `remote.status`'s row as an additive field. Rule 20: list every consumer of the changed row (the CLI's `remote status` renderer, the daemon's status builder, the test fakes).

Doctor's remote checks:
- token presence and fingerprint, from the secrets file and the environment overrides through the existing secret resolution, never the value;
- the enabled key from `config.toml`;
- connection, pairing (name and numeric id) and cause from `remote.status` on a running hub. Without a hub the line says the hub is not running.

The lines follow doctor's ok, warn and fail shape. A stopped remote is warn, with the fix naming the exact commands (`cland secret set telegram.token`, then `cland hub reload`, and so on). `cland remote test` stays the only way to check a token with the platform. Discord's 4004 and 4014 are produced on a real fake only in ticket 12. Here they are covered by the table and by the test messenger's structured stop.

**External wait and shared files:** none (Telegram's 401, 403 and 409 stops, T-1349, are on dev) · **Shared files:** hub/src/protocol.ts (RemoteStatusRow), hub/src/remote/state.ts, hub/src/remote/gateway.ts, hub/src/remote/telegram.ts, hub/src/remote/notices.ts, hub/src/cli/doctor.ts

## Acceptance criteria

- [ ] C1. With a made-up Telegram token in the secrets file or in `CLAND_TELEGRAM_TOKEN`, doctor shows it as present with its 12-character fingerprint, and neither the text nor the `--json` output contains the value (test).
- [ ] C2. Doctor shows each messenger's enabled state, connection and paired name and id from a running hub's remote status, and "hub not running" without one (test).
- [ ] C3. A 401, a 403 and a lasting 409 produced on the fake Bot API each give doctor's cause line with the fix that General's notice for the same stop names (test).
- [ ] C4. The test messenger's structured stops for 4004 and 4014 give doctor's "new token" and "Message Content toggle" lines with their fixes (test).
- [ ] C5. During a doctor run with an active Telegram remote, the fake Bot API records no request and doctor opens no network connection (test).

## Comments

### impl-1361 · 2026-10-27T05:48:13.177Z

Rule 20 consumer inventory before changes: RemoteStatusRow/Result in hub/src/protocol.ts and generated shared/wire/index.ts (wire-conformance.ts); daemon.ts builder, dispatch.ts local-management handler and web-authority.ts gate; cli/remote.ts renderer; new doctor reader; telegram-liveness-fixture and Telegram messenger/liveness/pairing/inbound/mute/rendering/pacing frame tests; remote-cli and web-authority tests. Durable RemoteStatus readers/writers: remote/state.ts and gateway.ts, telegram.ts terminal membership write, remote-state.test.ts, gateway-state tests plus their fixtures. Search covered hub/src, hub/test (all tiers), nvim, web, shared, shipped .agents skills, qa briefs and docs/startup guidance. nvim/web have no existing remote.status consumer; permissions and startup paths remain unchanged. Keep reason and every prior field; add optional stopCause, read older rows/replies without it, migrate SQLite additively. Existing legacy messenger/status fakes stay valid, with explicit previous-wire-shape doctor coverage. Shared cause/fix wording will live in notices.ts and structured terminal Error metadata, never parsed from native error text.
