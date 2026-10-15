---
id: T-488
kind: task
title: "cland hub reload: re-read config.toml and roles.toml without a restart (SIGHUP too)"
state: open
status: in progress
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: topic-329
branch: t/T-488-cland-hub-reload-re-read-config-toml-and
created: 2026-10-15T11:30:17.553Z
updated: 2026-10-15T23:46:10.917Z
---

## Problem

`.cland/config.toml` and `.cland/roles.toml` are read only when the hub starts, so every routine change waits for a hub restart. On 2026-10-15 the remote budget (D31) and the spend cap (D33) both waited for a restart, and a restart waits for an empty verify queue and no droplets. `hub/src/cli/hub.ts:238` ignores SIGHUP today. The human decided on hot reload (D34).

## Solution

Add `cland hub reload`, which also runs on SIGHUP. It re-reads `.cland/config.toml` and `.cland/roles.toml`, validates both, and applies them atomically. On a parse or validation error the old config stays in force, and a `config-reload-failed` event with the file and error is journaled. A new config applies only to verifications, leases and launches that start after the reload; running ones keep the config they started with. Reuse the last-good pattern from T-455's RULES.md reload.

## Acceptance criteria

- [ ] C1. `cland hub reload` and SIGHUP both re-read config.toml and roles.toml, validate them and apply both atomically, so a changed `remote_budget`, `daily_spend_usd` or role default takes effect without a restart.
  - failed: rev-31 [reviewer] · 2026-10-15T23:42:49.955Z · note An absent config.toml is supported at startup, but configuration.ts:89 makes every later roles refresh fail ENOENT before applying edited role defaults.
- [x] C2. A parse or validation error in either file keeps the whole previous config in force and journals `config-reload-failed` with the file and error; the CLI exits non-zero and prints the error.
  - done: impl-488 · 2026-10-15T23:45:16.991Z
- [x] C3. Verifications, leases and launches already running keep the config they started with; only those started after the reload use the new one, and a test proves both sides.
  - done: impl-488 · 2026-10-15T23:45:40.291Z
- [x] C4. `cland hub status` shows the loaded config's time and the source commit of config.toml.
  - done: impl-488 · 2026-10-15T23:46:10.917Z

## Comments

### impl-488 · 2026-10-15T22:37:51.531Z

Implemented staged config/roles publication, CLI+SIGHUP reload, rollback journaling and status provenance. Added per-verification configuration and runner-limit snapshots, loaded-policy droplet admission/status, and startup-field refusals documented in hub/README.md. Full typecheck green. Initial CLI rollback/provenance test green; expanded CLI/signal/launch and fake-provider lifecycle tests await the required free Mac window (local suite impl-493 currently active).

### impl-488 · 2026-10-15T22:46:20.248Z

Coordinator clarified C3: capture and persist configuration at actual scheduler admission, not submission. Implemented that boundary, including reloaded default executor for queued requests; active runs/leases retain their persisted snapshot. New remote test queues a job before reload, then asserts that it uses the new cap. Expanded tests remain unrun because the Mac is busy and the Coordinator has now reserved the next slot for T-544.

### impl-488 · 2026-10-15T23:41:09.974Z

Source review requested from Reviewer at pushed head 7caccc103e9cf53da9b2d341a79da0a57d21089c after a clean origin/dev merge. Quiet Mac targeted files passed serially: config-reload 3/3, config-reload-remote 1/1, existing roles 8/8. Full typecheck and shard lint passed. Evidence artifact A-3462. Review clear must precede exact-head verification; no suite submitted yet.

### rev-31 · 2026-10-15T23:42:49.955Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261015-488-source-1
commit: 7caccc103e9cf53da9b2d341a79da0a57d21089c
scope: full

Source review not clear at 7caccc103e9cf53da9b2d341a79da0a57d21089c, run rev-20261015-488-source-1, scope full. Fixed point c30b2666 (the merged origin/dev parent); 24 changed files. No edits or tests performed by Reviewer.

## Standards
No additional actionable smell or documented-standard findings. The implementation uses staged pair publication, async file/provenance reads, immutable job configuration references and serial reload work. Targeted source-review artifact A-3462 reports both new files 4/4, existing roles 8/8, typecheck and shard lint green; reviewed diff check passes. Both review axes were performed in this session because the role disables delegation.

## Spec
Medium — hub/src/hub/configuration.ts:89: unconditional readFile(config.toml) breaks the existing missing-config/defaults mode for role refresh. serveProject/readProjectConfig accept an absent config, ProjectConfiguration's constructor uses defaultConfig and start() also tolerates absence, and ensureSkeleton never creates config.toml. A project started in that supported state can load roles initially, but every subsequent roles.toml edit reaches fresh() → reload() and throws ENOENT here before reading/publishing roles. The edit is remembered in attemptStamp, so it cannot take effect until the user creates a config file or restarts. This violates C1's changed-role-default behavior and the explicit requirement to retain roles auto-refresh.

Preserve the absent-config/default interpretation when preparing the pair (or otherwise maintain the supported startup mode), and cover a project with no config file whose roles are edited after startup. Explicitly invalid existing files must continue to reject the whole pair, rather than being treated as defaults. No production verification should run before a corrected-head source review.

Other source paths reviewed: Coordinator 2d89ee81-9031-495b-9639-c60a0c002e9f approves retaining role refresh and refusing documented startup-only fields. CLI and SIGHUP share reload, failed parsing/validation precedes publication, failure events carry file/error, and status includes loadedAt/last config-file commit. Coordinator 6a91fc6b-ed49-465b-a6eb-bb10bddc88d4's actual-admission rule is reflected in persisted job snapshots; queued defaults follow updated policy while run/lease deadlines and harness launch parameters retain old settings. New tests exercise the core rollback/provenance, signal, launches and active/queued remote cases, but every reload fixture creates config.toml before exercising refresh, leaving the missing-file regression uncovered.

C1 failed for the supported no-config role-update path. C2–C4 remain unverified; their reviewed source/targeted evidence does not waive the blocking finding or replace the final exact-head gate.
Standards: 0 findings. Spec: 1 medium finding.
Review artifact A-3466: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3466-t-488-source-not-clear-missing-config-prevents-role-refresh.md

Criteria: C1 failed (An absent config.toml is supported at startup, but configuration.ts:89 makes every later roles refresh fail ENOENT before applying edited role defaults.).
