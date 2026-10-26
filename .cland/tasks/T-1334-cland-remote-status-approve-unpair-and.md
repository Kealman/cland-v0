---
id: T-1334
kind: task
title: cland remote status, approve, unpair and test, and token rotation that keeps the pairing
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1333
  - T-1331
topic: topic-1090
branch: t/T-1334-cland-remote-status-approve-unpair-and
created: 2026-10-26T07:54:43.248Z
updated: 2026-10-26T19:14:16.700Z
closed: 2026-10-26T19:14:16.700Z
---

## Summary

`cland remote status|approve|unpair|test` manage remotes from the terminal. A rotated token keeps its pairing, since pairings key on numeric ids.

## What to build

`status` per messenger shows: token presence with its fingerprint, paired with whom, connection state, last inbound and outbound, outbox depth, mute, and the bot link. `approve <messenger> <code>` prints the paired name and id. `unpair <messenger>` forgets a pairing. `test <messenger>` checks the token through the messenger client seam and sends one line to the paired chat (the test messenger here; the platform side comes with the clients). Token rotation through `cland secret set` plus `cland hub reload` keeps the pairing. Spec §3.10 and §3.3.

## Acceptance criteria

- [x] C1. Each of `status`, `approve`, `unpair` and `test` behaves as spec §3.10 says against a test messenger, with no token value in any output (test).
  - done: impl-1334 · 2026-10-26T18:12:42.314Z
  - verified: rev-26 [reviewer] · run rev-20261026-1334-evidence-1 · 2026-10-26T18:29:05.232Z · commit c7b9aec8853ddddb9a750a17c81bad47ef47c40a
- [x] C2. After `cland secret set` with a new token and `cland hub reload`, the test messenger reconnects still paired (test).
  - done: impl-1334 · 2026-10-26T18:12:42.428Z
  - verified: rev-26 [reviewer] · run rev-20261026-1334-evidence-1 · 2026-10-26T18:29:05.232Z · commit c7b9aec8853ddddb9a750a17c81bad47ef47c40a

## Comments

### impl-1334 · 2026-10-26T17:51:06.797Z

Contract consumer inventory before implementation: add remote.status/unpair/test frames and optional Remote status/test callbacks, preserving all previous request/reply shapes and legacy Remote.start(send). Production consumers: hub/src/protocol.ts parser, hub/src/hub/dispatch.ts local authority/control, hub/src/hub/daemon.ts control and loaded secrets, hub/src/remote/{gateway,configuration,state,authority}.ts, shared/wire/index.ts and hub/test/wire-conformance.ts, new lazy hub/src/cli/remote.ts and bin/help/usage. Web policy hub/src/hub/web-authority.ts must deny all three; gateway remains default deny. Client consumers: web/src/protocol.ts shared re-export and Neovim generic result handling do not initiate these frames, no existing reply rows change. Shipped skills implement and pairing/secrets docs need current CLI guidance. Tests: protocol.test.ts, web-authority.test.ts, workbench.test.ts and record-nvim-frames.ts conformance; pairing-approval/codes, gateway/state/config-set/outbox, cli-help/cli-imports, project-hub-lifecycle; T3/T4 consumers and QA briefs searched repository-wide, no existing remote command consumer or persisted schema reader to migrate. Keep old adapter without optional callbacks serving and add explicit refusal regression for a new CLI meeting an older hub. Seams: sealed projectHub frame protocol + fake messenger, sealed real CLI subprocess for parsing/output/rotation. Existing storage fields remain unchanged; status is an additive dedicated result.

### impl-1334 · 2026-10-26T18:00:28.174Z

TDD receipts on macOS local working tree: remote approve red was `cland: unknown command "remote"`, then both messenger CLI cases green; status/unpair/test each red at unsupported command/usage, then green; rotation cases red at `false !== true` for new pairing mute_default, then green after applying default at the pairing transaction. Current remote-cli file has 13 passing T2 cases including redacted client failure, held-test shutdown drainage and previous-hub approval/refusal compatibility. cli-imports (T3, 3 cases), project-hub-lifecycle (T3, 4), web-authority (T2, 44), pure help (T1, 18), CLI help (T2, 4), usage compatibility (T1, 1) and npm run typecheck pass locally; these are targeted receipts, no suite/Linux evidence yet. Inventory clarification: the workbench consumer is nvim/test/scenarios/workbench.test.ts (not hub/test/workbench.test.ts); scoped frame refresh is running for that consumer. No platform/browser call or real credential used.

### rev-26 · 2026-10-26T18:10:47.116Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1334-source-1
commit: a720632c04f330d72742185d1d3549dd553278c6
scope: full
findings: [{"severity":"medium","text":"M1: setup/listening and server closure await unbounded callbacks without independent error/abort/deadline receipts. Register bounded ownership before acquisition and exercise omitted/aborted setup through the same disposer, preserving old-hub compatibility assertions.","file":"hub/test/fakes/legacy-remote-hub.ts","line":31},{"severity":"medium","text":"M2: Gateway.test treats Pairing.name as protocol routing, so a display name colliding with a rotated opaque credential refuses the test callback. Separate display content from unchanged numeric routing, with rotation/name-collision and numeric-id collision controls.","file":"hub/src/remote/gateway.ts","line":156}]
finding_counts: {"high":0,"medium":2,"low":0}

Full Standards/Spec source audit complete at fixed base 2ee64ba09d587b3820a801772e9649e8aef50d07. Exactly M1/M2; details and static recording comparison in A-12464, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12464-t-1334-full-source-review-at-a720632c-m1-and-m2.md. No Reviewer executions. C2 runtime verification remains pending; local macOS A-12463 is targeted evidence only. Request fresh corrected pushed-head source review before configured verification. Coordinator owns separate full cover and landing.

Criteria: C1 failed (M2: token/name collision prevents remote test from sending the fixed line to the unchanged paired numeric destination.).

### impl-1334 · 2026-10-26T18:12:12.943Z

Source-1 corrections: M1 now uses a pre-registered lifecycle owner with listening/error/native close/peer receipts, abortable injected-clock setup bound and independent close/stream/write drainage bounds. Missing receipt, aborted setup and native bind error all go through the same disposer; original old-hub approve/refusal assertions are unchanged. A temporary omitted-setup-deadline negative control failed at its independent live bound: `Error: executor operation deadline reached` (1.51 s test, macOS), and was restored. M2 red reproduced `cland: remote output would alter protocol routing` at a display-name token collision. Gateway.test now maps display name as content and keeps ids as routing. The new real stdin rotation/reload test asserts the masked callback name at the exact original numeric destination, then an id-colliding token refuses before any client test call; errors/logs/journal are token-safe. Corrected remote-cli T2 is 18/18 locally and root typecheck is green on the corrected working tree. Source audit is complete with exactly M1/M2 per Reviewer; preparing one fresh pushed source-review head, without merging dev or starting verification.

### rev-26 · 2026-10-26T18:13:43.183Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1334-source-2
commit: c7b9aec8853ddddb9a750a17c81bad47ef47c40a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards and Spec, retaining full A-12464 audit and inspecting all four correction files. M1 bounded/abortable legacy fixture ownership and omitted/aborted/bind-error controls are resolved; M2 content-masked display name and strict numeric routing are resolved with actual stdin rotation/reload regression. A-12466: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12466-t-1334-full-source-clearance-at-c7b9aec8.md. Candidate tree c108bca2aafb2cb9ae94036f64b943371b2ef669; no dev merge or unrelated delta. Local macOS A-12465 remains targeted evidence only; no Reviewer executions. C1/C2 runtime verification pending one same-head mode-free configured run. Coordinator's separate full cover and landing remain outstanding.

### rev-26 · 2026-10-26T18:29:05.232Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1334-evidence-1
commit: c7b9aec8853ddddb9a750a17c81bad47ef47c40a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1/C2 verified from original configured run 67919021-241f-4792-b042-af0a0ca515df / A-12467, terminal exit 0. Independently deduplicated 3,482 ordinary test passes and 115 separate load-gate passes (23 identities x 5), all 18 remote-cli cases and three Web-authority controls passed base + 5/5. Both actual stdin token rotations retain numeric pairing/mute; M1 disposal and M2 name/id-collision controls pass. Changed cli-imports T3: three existing identities once, selected added wall 7.805 s excluding machine wait, no repetitions. T0/all T1/fallback all T2/Web completed, remaining T3 and T4 unexecuted. Linux c-8 lon1, Node 24.21.0, Neovim 0.12.5, pinned Headless Shell 156.0.8078.4/v1248. Report-only lint/budgets and host-gate versus remote typecheck limits retained. Full audit in A-12468: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12468-t-1334-final-same-head-evidence-review-at-c7b9aec8.md. No Reviewer executions. Coordinator owns separate permission/shared-contract full cover and landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-26T19:14:16.699Z

Merged a3e5ac8b38e7d62ecf4100d7bcac63fd007786e3 onto dev.
