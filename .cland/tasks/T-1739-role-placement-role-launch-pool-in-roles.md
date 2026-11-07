---
id: T-1739
kind: task
title: "Role placement: `[<role>.launch] pool` in `roles.toml`"
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by: []
topic: topic-1429
branch: t/T-1739-role-placement-role-launch-pool-in-roles
created: 2026-11-07T16:01:57.008Z
updated: 2026-11-07T16:16:26.688Z
---

## Summary

A role binds to a host pool with `[<role>.launch] pool = "<pool>"`, and the default is `local`. The Coordinator and the Aide may only be `local`. A `roles.toml` that binds either to a pool is refused at load and by `cland role launch`, and the last good roles stay. `cland role launch <role> --pool <pool>` writes the key.

## What to build

Parse and validate the `pool` launch key with the pool-name syntax of `parsePoolName`. Whether the pool exists is checked at launch (T-1743), so a pool edit in `config.toml` never invalidates `roles.toml`. The resolved pool shows in the role's launch defaults and in the `roles-loaded` log.

## Acceptance criteria

- [x] C1. `[implementer.launch] pool = "agents"` parses into the role's launch defaults, and a role without the key reads `local` (test).
  - done: impl-1739 · 2026-11-07T16:14:56.406Z
- [x] C2. `cland role launch implementer --pool agents` writes the key, and `cland role launch --help` names `--pool` (test).
  - done: impl-1739 · 2026-11-07T16:08:26.695Z
- [x] C3. A `roles.toml` with `[coordinator.launch] pool = "agents"` or `[aide.launch] pool = "agents"` is refused at load naming that the Coordinator and the Aide run only on `local`, and the last good roles stay in force (test).
  - done: impl-1739 · 2026-11-07T16:08:27.132Z
- [x] C4. `cland role launch coordinator --pool agents` is refused with the same reason and leaves the file unchanged (test).
  - done: impl-1739 · 2026-11-07T16:08:28.725Z

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/roles/config.ts`, `hub/src/roles/launch.ts`, `hub/src/cli/role.ts`, `hub/src/host/role-placement.ts`.
- Tests: roles parsing (T1, edit, or new `hub/test/roles-pool.test.ts`); `cland role launch` (T2).
- Serves epic C1.

## Comments

### impl-1739 · 2026-11-07T16:04:49.462Z

Rule 20 sweep: roles/config LaunchDefaults consumers: hub configuration/core/dispatch, adapters/sessions, doctor/project, setup aide/favourite/trust and role CLI. LaunchFields consumers: roles/launch, protocol validation, CLI, shared/wire (wire-conformance). RoleList: CLI/web/nvim; additive optional wire pool preserves old-hub compatibility. roles-loaded serializes defaults wholesale; no positional log readers found. Tests cover config reload, roles editor/template/snapshot/component/refresh/timing/clauses/permissions, session-host-placement and direct config importers (full inventory in evidence). Current docs/skills updated; historical specs/audits unaffected. No host pool config contract changed.

### rev-36 · 2026-11-07T16:14:27.460Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1739-source-1
commit: e8b1c875493b04a93fa8ccdaa2dbebe29041a9b0
scope: full
findings: [{"severity":"medium","text":"Existing whole-launch expected objects omit the new pool: local field, so the direct runtime consumer's legacy-default assertion fails. Migrate all affected full-object expectations without weakening their existing approval/sandbox assertions and retain the red/green named/native receipts.","file":"hub/test/roles-component.test.ts","line":247}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17494 supersedes the pre-failure clear source assessment A-17491; no clear verdict was recorded. Production policy/editor/reload/wire/docs source review otherwise found no issue. Fresh source review is required after the consumer migration; all criteria remain unverified pending configured and directed importer preservation evidence.

Criteria: C1 failed (Legacy default launch regression remains red because roles-component whole-object assertions omit pool: local.).

### rev-36 · 2026-11-07T16:16:26.688Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1739-source-2
commit: dfa66b8609a89231b04ec03f9c525b69edd2ea86
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, A-17499. Prior whole-launch finding resolved without weakened assertions; role-list expectations, Coordinator clause reserve and README reference inclusion corrected. A-17493 original failures preserved; A-17497 named 44/44 corrected outcomes read with candidate/provenance limits. C1–C4 remain unverified until unchanged-head configured evidence plus directed native importer preservation. No Reviewer tests executed; affected after-stage QA separate.
