---
id: T-488
kind: task
title: "cland hub reload: re-read config.toml and roles.toml without a restart (SIGHUP too)"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: topic-329
branch: t/T-488-cland-hub-reload-re-read-config-toml-and
created: 2026-10-15T11:30:17.553Z
updated: 2026-10-15T22:46:20.248Z
---

## Problem

`.cland/config.toml` and `.cland/roles.toml` are read only when the hub starts, so every routine change waits for a hub restart. On 2026-10-15 the remote budget (D31) and the spend cap (D33) both waited for a restart, and a restart waits for an empty verify queue and no droplets. `hub/src/cli/hub.ts:238` ignores SIGHUP today. The human decided on hot reload (D34).

## Solution

Add `cland hub reload`, which also runs on SIGHUP. It re-reads `.cland/config.toml` and `.cland/roles.toml`, validates both, and applies them atomically. On a parse or validation error the old config stays in force, and a `config-reload-failed` event with the file and error is journaled. A new config applies only to verifications, leases and launches that start after the reload; running ones keep the config they started with. Reuse the last-good pattern from T-455's RULES.md reload.

## Acceptance criteria

- [ ] C1. `cland hub reload` and SIGHUP both re-read config.toml and roles.toml, validate them and apply both atomically, so a changed `remote_budget`, `daily_spend_usd` or role default takes effect without a restart.
- [ ] C2. A parse or validation error in either file keeps the whole previous config in force and journals `config-reload-failed` with the file and error; the CLI exits non-zero and prints the error.
- [ ] C3. Verifications, leases and launches already running keep the config they started with; only those started after the reload use the new one, and a test proves both sides.
- [ ] C4. `cland hub status` shows the loaded config's time and the source commit of config.toml.

## Comments

### impl-488 · 2026-10-15T22:37:51.531Z

Implemented staged config/roles publication, CLI+SIGHUP reload, rollback journaling and status provenance. Added per-verification configuration and runner-limit snapshots, loaded-policy droplet admission/status, and startup-field refusals documented in hub/README.md. Full typecheck green. Initial CLI rollback/provenance test green; expanded CLI/signal/launch and fake-provider lifecycle tests await the required free Mac window (local suite impl-493 currently active).

### impl-488 · 2026-10-15T22:46:20.248Z

Coordinator clarified C3: capture and persist configuration at actual scheduler admission, not submission. Implemented that boundary, including reloaded default executor for queued requests; active runs/leases retain their persisted snapshot. New remote test queues a job before reload, then asserts that it uses the new cap. Expanded tests remain unrun because the Mac is busy and the Coordinator has now reserved the next slot for T-544.
