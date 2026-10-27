---
id: T-1361
kind: task
title: Doctor names each remote's token, connection, pairing and stopped cause with its fix
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by: []
topic: topic-1102
branch: t/T-1361-doctor-names-each-remote-s-token
created: 2026-10-27T05:46:49.627Z
updated: 2026-10-27T07:12:19.888Z
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

- [x] C1. With a made-up Telegram token in the secrets file or in `CLAND_TELEGRAM_TOKEN`, doctor shows it as present with its 12-character fingerprint, and neither the text nor the `--json` output contains the value (test).
  - done: impl-1361 · 2026-10-27T05:55:57.160Z
- [x] C2. Doctor shows each messenger's enabled state, connection and paired name and id from a running hub's remote status, and "hub not running" without one (test).
  - done: impl-1361 · 2026-10-27T05:55:57.246Z
- [x] C3. A 401, a 403 and a lasting 409 produced on the fake Bot API each give doctor's cause line with the fix that General's notice for the same stop names (test).
  - done: impl-1361 · 2026-10-27T05:55:57.735Z
- [x] C4. The test messenger's structured stops for 4004 and 4014 give doctor's "new token" and "Message Content toggle" lines with their fixes (test).
  - done: impl-1361 · 2026-10-27T05:55:57.821Z
- [x] C5. During a doctor run with an active Telegram remote, the fake Bot API records no request and doctor opens no network connection (test).
  - done: impl-1361 · 2026-10-27T05:55:58.337Z

## Comments

### impl-1361 · 2026-10-27T05:48:13.177Z

Rule 20 consumer inventory before changes: RemoteStatusRow/Result in hub/src/protocol.ts and generated shared/wire/index.ts (wire-conformance.ts); daemon.ts builder, dispatch.ts local-management handler and web-authority.ts gate; cli/remote.ts renderer; new doctor reader; telegram-liveness-fixture and Telegram messenger/liveness/pairing/inbound/mute/rendering/pacing frame tests; remote-cli and web-authority tests. Durable RemoteStatus readers/writers: remote/state.ts and gateway.ts, telegram.ts terminal membership write, remote-state.test.ts, gateway-state tests plus their fixtures. Search covered hub/src, hub/test (all tiers), nvim, web, shared, shipped .agents skills, qa briefs and docs/startup guidance. nvim/web have no existing remote.status consumer; permissions and startup paths remain unchanged. Keep reason and every prior field; add optional stopCause, read older rows/replies without it, migrate SQLite additively. Existing legacy messenger/status fakes stay valid, with explicit previous-wire-shape doctor coverage. Shared cause/fix wording will live in notices.ts and structured terminal Error metadata, never parsed from native error text.

### rev-26 · 2026-10-27T05:59:06.245Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1361-source-1
commit: e3e20e6a27a7af1097ac2a361d92ab90d0493829
scope: full
findings: [{"severity":"medium","text":"M1 Standards: two added DOCTOR_USAGE lines are absent from its owning frozen commands.json row; reproduce unchanged compatibility/help red, fix only that row, retain original red/green output/exits.","file":"hub/src/cli/usage.ts","line":23},{"severity":"medium","text":"M2 Standards: doctor-remotes entry precedes doctor-harness-probe; place it after doctor-isolation and before doctor-run, preserving T2. Retain unchanged lint-tiers refusal and actual corrected pass.","file":"hub/test/tiers.json","line":121},{"severity":"medium","text":"M3 Spec: CLI status still formats legacy reason only, without shared-table stopCause rendering required by Coordinator decision1adaee6e. Known structured Discord stops can disagree with doctor when reason is generic. Render known causes/fixes from the shared table with no-cause legacy fallback and unchanged JSON compatibility; add a non-incidental red/green regression.","file":"hub/src/cli/remote.ts","line":29}]
finding_counts: {"high":0,"medium":3,"low":0}

Consolidated full source audit complete: A-12600 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12600-t-1361-full-source-1-consolidated-findings-at-e3e20e6a.md. Standards M1/M2, Spec M3; no other source/fixture findings. Optional state/wire migration, shared Telegram notices/doctor table, local-only diagnostics, literal previous-wire regression and cleanup reviewed. A-12599 remains local macOS targeted summary, not configured/Linux proof; C1–C5 unverified. Fresh exact-head source review after corrections and Coordinator-required serial Telegram/remote-cli/gateway/outbox-gateway matrix. No item verification; Coordinator owns all occasion and landing.

### impl-1361 · 2026-10-27T06:01:41.977Z

Corrected source head 994f534a95b809997f9ba27a35fd5de8ea689fb9 (tree a88def3fa683d9a513f656fb64f2121b98b3cb4d), pushed clean to origin. M1/M2/M3 from A-12600 fixed; native guard/CLI red→green outputs preserved in A-12604. Coordinator-expanded serial matrix: all 12 Telegram files + remote-cli/gateway/outbox-gateway passed (148 cases); doctor-remotes 9 and remote-state 6 also passed, 163 total logged matrix cases with no fail/cancelled/skipped. Separate help compatibility 1 and full-help 5 passed; typecheck and static guards passed. macOS/local targeted T1/T2/T3 receipts only, no Linux/full suite/Web browser gate. A-12604 durable path: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12604-t-1361-corrected-source-and-serial-test-receipts-supersedes-a-12599. Legacy CLI renderer now directly consumes shared wording and has a previous-wire/no-cause regression; reason and JSON remain compatible. Coordinator owns rule-6 all after source clear.

### rev-26 · 2026-10-27T06:02:39.024Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1361-source-2
commit: 994f534a95b809997f9ba27a35fd5de8ea689fb9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-12606 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12606-t-1361-source-2-clearance-at-994f534a9.md. M1/M2/M3 resolved: frozen doctor-help only, sorted new tier row, CLI shared-table structured cause/fix with opaque-reason and literal old-wire regressions, unchanged legacy reason/JSON. A-12604 original guard red/green and serial matrix logs inspected: 17 files163 targeted macOS passes, all counters match manifest; requested15-file set148 plus doctor/state15, separate help6. No Linux/browser/full-suite claim; C1–C5 configured-runtime-unverified. Keep head stable and report ready for Coordinator all occasion/landing; no item verify.

### impl-1361 · 2026-10-27T07:11:31.719Z

Configured Linux full run 78578e27 at 994f534a9 did not pass: T0/T1/T2 exit 0, T3 exit 1 in cli-identity.test.ts with `Error: database is locked` from Store:439 via actorCredential; Web/T4 not completed. A-12635 is the durable raw receipt. Reported shared-defect candidate to lead T-1361; holding diagnosis and reviewed head for Coordinator classification/shared fix. All 13 newly added T-1361 generated cases in the Linux timing records passed, maximum observed 0.208066787 s, so none reaches the 3-second new-test allowance threshold. This partial evidence does not satisfy the full gate.

### impl-1361 · 2026-10-27T07:11:49.877Z

Coordinator classified run 78578e27's cli-identity/session-credential SQLite-lock failure as known unrelated flake T-1335, and reports 5/5 isolated passes at 994f534a. Those are Coordinator-reported targeted reruns, not a full gate pass. Coordinator will submit one flaky-rule retry after E-1309 stage covers; enqueue also waits for E-1309 demo verdict because this item touches its shared files. Holding source-clear head 994f534a95b809997f9ba27a35fd5de8ea689fb9 unchanged; no independent retry or diagnosis.

### rev-26 · 2026-10-27T07:12:19.887Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1361-evidence-1
commit: 994f534a95b809997f9ba27a35fd5de8ea689fb9
scope: evidence
findings: [{"severity":"medium","text":"M1 Evidence: required full run 78578e27/A-12635 exits 1. Credential fixture opens Store after the owned daemon is SIGSTOPed and throws database is locked before the native CLI call/refusal assertions. T3 fails; Web/T4 coverage is incomplete. Shared/pre-existing classification remains unproven; preserve this failed receipt and obtain Coordinator diagnosis/recovery disposition before final runtime clearance.","file":"hub/test/cli-identity.test.ts","line":194}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-12636 records the independently inspected original failure. 4,575 ordinary passes, one failure and five reasoned skips; no scoped load records. T0/T1/T2 exit 0; executed T3 exits 1, Web zero executed tests. Nine doctor cases passed, but C1–C5 remain unverified pending accepted final evidence. Source-2 A-12606 remains unchanged; no new source-design finding and no Reviewer runtime reproduction. Coordinator owns diagnosis, recovery occasion and landing.
