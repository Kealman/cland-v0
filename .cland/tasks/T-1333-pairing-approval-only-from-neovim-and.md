---
id: T-1333
kind: task
title: Pairing approval only from Neovim and the CLI, binding numeric ids and replacing an earlier pairing
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1332
topic: topic-1089
branch: t/T-1333-pairing-approval-only-from-neovim-and
created: 2026-10-26T07:54:42.979Z
updated: 2026-10-26T17:49:13.777Z
closed: 2026-10-26T17:49:13.777Z
---

## Summary

Approving a pairing is new access, like `web.link`. The hub accepts it only from Neovim's connection and from the CLI, and refuses it from the web edge and from remotes. Approval binds the messenger's numeric ids in `hub.db`, replaces an earlier pairing with a line to the old chat, and clears the other waiting codes. Usernames never identify.

## What to build

A pairing-approve request authorized for the Neovim client and the CLI only, refused by the web authority and by the gateway's table. On approval: store the numeric ids, notify the previously paired chat with one line and replace it, and clear every other waiting code of that messenger. Spec §3.2. See Q-1296 §13.

## Acceptance criteria

- [x] C1. Approving a waiting code is refused through the web edge and through the gateway, and accepted from a Neovim-client connection and from the CLI (test).
  - done: impl-1333 · 2026-10-26T16:49:08.165Z
  - verified: rev-26 [reviewer] · run rev-20261026-1333-evidence-1 · 2026-10-26T17:09:03.036Z · commit b82b0d84acd6d2f2a249f59a29a0c1c85b57d2b0
- [x] C2. An approval binds the numeric ids in hub.db and clears the other waiting codes, and a second approval replaces the first with one line to the old chat (test).
  - done: impl-1333 · 2026-10-26T16:52:37.207Z
  - verified: rev-26 [reviewer] · run rev-20261026-1333-evidence-1 · 2026-10-26T17:09:03.036Z · commit b82b0d84acd6d2f2a249f59a29a0c1c85b57d2b0

## Comments

### impl-1333 · 2026-10-26T16:39:01.659Z

Rule 20 inventory before edits: additive pairing.approve request ({messenger, code}, result {pairing}) consumers are protocol.ts validator/dispatcher, shared/wire ClientRequest + wire-conformance, CLI shared socket-client (T-1334 follows), Neovim rpc/workbench typed request unions and strict recorded fixtures/startup probe, web typed request union and exhaustive WEB_AUTHORITY, gateway deny-by-default authority and pairing-id answer refusal. No existing request/reply or Inbox rows will change. PairingCodes get/clear and Store.remotes pairing readers: inbox/needsYou/snapshot/budget invalidation, daemon gateway startup, pairing-service/pairing-codes/gateway-state/remote-state tests. Replacement notification will use an additive optional in-process Remote callback; callers/fakes under gateway, configuration, daemon, gateway-state/config-set/gateway-secrets/outbox tests keep existing start/receive shapes. Searched production, shared clients, skills, qa, docs, startup probes and tests all tiers; existing authority inventory tests enumerate the added action automatically. Retain old hello/Inbox/Remote compatibility controls and run strict nvim-fixtures + workbench, cli-imports and project-hub-lifecycle as requested. No existing wire field is removed.

### impl-1333 · 2026-10-26T16:44:22.158Z

TDD receipts (local macOS, in-process T2, no browser binary): C1 first failed with `unknown request type "pairing.approve"`, then local nvim + shared CLI socket acceptance passed. C2 both platform cases failed with replacement notifications [] instead of the expected old numeric destination/one line, then passed. Added expiry/consumption/forged extra-id checks and held-send shutdown receipt. A fabricated opaque-secret collision first exposed unredacted fixed text; after using the shared output boundary it passes. Current pairing-approval 6/6, web-authority 41/41; cli-imports 3/3 and full npm typecheck passed. These are targeted local receipts only, no task suite or Linux duration evidence yet. Running requested strict recorded Neovim refresh before source review.

### impl-1333 · 2026-10-26T16:47:17.998Z

Consumer inventory detail (all are additive/unaffected unless stated): request shape: hub/src/protocol.ts (new validator), hub/src/hub/dispatch.ts (new handler), shared/wire/index.ts (new union member), hub/test/wire-conformance.ts (exhaustive equality), hub/src/hub/web-authority.ts (explicit deny), hub/src/remote/authority.ts (absent = deny); shared/socket-client.ts and hub/src/cli/socket-client.ts retain transport/result behavior. web/src/connection.ts accepts the additive request union; human-marks.ts/core.ts and store.test.ts, web-area-state.test.ts, inbox-actions.test.ts, artifact-delete.test.ts only extract existing request members and need no changes. Neovim consumers: nvim/lua/cland/{hub,state,inbox}.lua (existing frames unchanged, parent-owned stdio is also an approval-capable Neovim connection); nvim/test/{stub-hub.ts,frame-fixtures.ts,startup-budget-probe.ts,startup-budget-support.ts,scenarios/workbench.test.ts}, hub/test/nvim-frame-source.ts consume unchanged Inbox/reply projections. Callback/persistence consumers: hub/src/remote/{gateway,configuration,pairing,state}.ts, hub/src/hub/{daemon,inbox,dispatch}.ts; harness.ts and fakes/messenger.ts, tests gateway, gateway-state, config-set, gateway-secrets, outbox-gateway, pairing-codes, pairing-service, remote-state and web/test/remote-via retain old Remote/start/Inbox contracts; optional replacement callback adds no required field. QA E-1307 excludes pairing; earlier briefs' ordinary inbox/session checks and startup probes see no changed existing reply or row membership. Shipped implement skill/docs pairing sections updated; no role permission or existing CLI command/help changes in this item (T-1334 owns CLI). Local source review checklist includes strict fixture refresh and workbench plus imports/lifecycle as Coordinator requested.

### rev-26 · 2026-10-26T16:52:12.669Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1333-source-1
commit: f61f31002f210c8c4e95790384127494ed5dba2a
scope: full
findings: [{"severity":"medium","text":"M1: hold.setup() uses heldRemoteBoundary's private FakeClock deadline, which this test never advances; missing callback entry leaves await entered unbounded until outer abort/phase kill. Add an independently live setup/actual-entry bound or drive the fake deadline, and a missed-receipt control through the same registered release/drain owner. Preserve exact old destination/one line and completion-before-shutdown assertions. A-12454.","file":"hub/test/pairing-approval.test.ts","line":87}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated full review complete: one medium Standards finding M1, no additional Spec/production findings. A-12454 records local/stdio/CLI versus web/gateway authority, stored numeric identity/transaction, captured old destination, shared redaction and async failure/drain ownership, plus contract consumer/strict fixture audit. A-12453 remains targeted macOS evidence only. Correct M1, restore done and request fresh pushed-head source review before one mode-free verify. Coordinator permission-change full cover remains separate; no Reviewer execution.

Criteria: C2 failed (M1 leaves the held replacement-notice regression unable to bound a missing setup receipt; corrected lifecycle proof is required.).

### rev-26 · 2026-10-26T16:53:49.408Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1333-source-2
commit: b82b0d84acd6d2f2a249f59a29a0c1c85b57d2b0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; M1 resolved, no remaining Standards/Spec findings. A-12455 records complete source audit plus two-file correction: setup/actual-entry waits are prearmed with live bounds, false-receipt case observes actual entry and drives the private fake deadline, same pre-start owner releases/drains work, and all exact old-destination/completion/shutdown assertions remain. Production and prior authority/transaction/compatibility tests unchanged. Local 10/10 and typecheck are reported targeted macOS receipts, not configured proof. C1/C2 done restored; final verification awaits one same-head mode-free run. Coordinator full cover remains separate; no Reviewer execution.

### rev-26 · 2026-10-26T17:09:03.036Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1333-evidence-1
commit: b82b0d84acd6d2f2a249f59a29a0c1c85b57d2b0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head task evidence clear; C1/C2 verified. A-12457 independently audits original A-12456 / run fa4149f7: exit 0, 3456 ordinary passes across 463 files plus 60 separate scoped load-test passes. All 10 pairing-approval and 2 new Web authority identities have base + 5/5, including both M1 held-notice receipt variants, stdio/local CLI authority, signed-in Web denial, both numeric binding/clear/replacement cases and redacted configured failure. Max new observation 0.253371728s; no allowance needed. T0/all T1/fallback all T2/Web complete; no T3/T4. Prepared host-tree reuse, pinned browser and report-only diagnostics retained. Local strict fixture/import/lifecycle observations remain separately attributed. Coordinator permission-change full cover and enqueue remain outstanding; no Reviewer execution or full-cover claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-26T17:49:13.777Z

Merged 751d4bc27e56d32e22b2319017f17e6ca2011b66 onto dev.
