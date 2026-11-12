---
id: T-1828
kind: task
title: The provider token's presence and fingerprint from the hub's environment
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by: []
topic: topic-1493
branch: t/T-1828-the-provider-token-s-presence-and
created: 2026-11-12T10:07:21.146Z
updated: 2026-11-12T19:25:47.259Z
closed: 2026-11-12T19:25:47.259Z
---

## Summary

A local-only frame reports, for each host provider that a pool uses, whether its token is present in the hub's own environment, with the token's fingerprint. Nothing calls the provider. Doctor and setup read it, because the token lives in the hub's environment and not in the human's shell.

## What to build

A `host.providers` frame, or a field of `host.status` (the implementer chooses; the review checks it), answered from the running hub:
- per provider named by a configured pool: the provider, whether a token is needed, and whether it is present, with the 12-character fingerprint that `cland secret list` uses;
- `digitalocean` reads `DIGITALOCEAN_TOKEN`, as the executor does;
- the fake provider reports that no token is needed.

The value is never in a reply, a log line or the journal. The frame is for the local human CLI or Neovim only, like the other `host.*` frames.

## Acceptance criteria

- [x] C1. With a made-up `DIGITALOCEAN_TOKEN` in the hub's environment and a `digitalocean` pool, the frame reports the token present with its 12-character fingerprint, and neither the reply nor any hub log line contains the value (test).
  - done: impl-1828 · 2026-11-12T18:14:11.738Z
  - verified: rev-35 [reviewer] · run rev-35-1828-final-1 · 2026-11-12T18:44:27.379Z · commit 9497222374286db28d000e3f175216078526f5a6
- [x] C2. Without the token it reports absent, and a fake-provider pool reports that no token is needed (test).
  - done: impl-1828 · 2026-11-12T18:14:12.068Z
  - verified: rev-35 [reviewer] · run rev-35-1828-final-1 · 2026-11-12T18:44:27.379Z · commit 9497222374286db28d000e3f175216078526f5a6
- [x] C3. Answering the frame makes no request to the fake DigitalOcean API (test).
  - done: impl-1828 · 2026-11-12T18:14:12.267Z
  - verified: rev-35 [reviewer] · run rev-35-1828-final-1 · 2026-11-12T18:44:27.380Z · commit 9497222374286db28d000e3f175216078526f5a6
- [x] C4. The frame is refused from a session, the web and a remote (test).
  - done: impl-1828 · 2026-11-12T18:14:12.591Z
  - verified: rev-35 [reviewer] · run rev-35-1828-final-1 · 2026-11-12T18:44:27.380Z · commit 9497222374286db28d000e3f175216078526f5a6

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/host/status.ts` or a new `hub/src/host/provider-tokens.ts`. Registration points: `hub/src/protocol.ts`, `shared/wire/index.ts`, `hub/src/hub/dispatch.ts`, `hub/src/hub/web-authority.ts`.
- Tests: new `hub/test/host-provider-tokens.test.ts` (T2, `projectHub`, the fake DigitalOcean API with a request log).
- Serves epic C4 and C5.

## Comments

### impl-1828 · 2026-11-12T18:12:04.218Z

Rule-20 sweep before implementation: shared import graph over all 960 hub/nvim/web test files reached 705, with 15 unknowns conservatively reached (inventory /tmp/T-1828-consumers.json, to be published as artifact after scan). Explicit contract consumers: protocol.ts validator, shared/wire/index.ts request union, dispatch.ts local authority, web-authority.ts deny table; CLI host.ts/login.ts and host/status.ts, host/settle.ts, adapters/sessions.ts, host-contract/host-ssh-contract, host-secret-admission, host-provision-recovery, login-list/wait/capacity-list, host-status, web-authority/unit, web-hosts-authority and web hosts tests. Docs host-providers/logins and their per-test docs inspected. Only a new request is added: old status/list/connect shapes, persistence, native provision/launch/destroy/restart paths and fingerprint implementation remain unchanged; no existing consumer requires migration. No push or connect-sequence change; no positional reader affected. Previous wire shape remains covered by host-status and existing contract tests. Native host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop, login-write-back are transitively reached via dispatch but their lifecycle behaviour is unchanged; full T3 deferred to merge/stage, no local native file drives this pull-only diagnostic.

### impl-1828 · 2026-11-12T18:14:21.651Z

Published sweep/evidence: A-19090 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19090-t-1828-implementation-evidence-and-consumer-inventory/report.md (consumer inventory sibling consumers.json). Export scan positive control detected and files scan exited 0 before publication. Source review requested from reviewer at 165bb90f6fe5bb9549a06a9f708311ae96c3f7c9; resolved to rev-35. No per-item QA: after-stage policy.

### rev-35 · 2026-11-12T18:20:04.638Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1828-source-1
commit: 9497222374286db28d000e3f175216078526f5a6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Complete first source pass clear at final949722237; A-19095. Additive local-only environment diagnostic uses shared secretFingerprint, no provider/persistence/native operation; transport/session/web/gateway authorization precedes handler. New3 T2 cases cover C1–C4; old status shape retained, docs/index/tier updated. A-19093 preserves724 correctly tiered test consumers+53 non-test dispositions; unknowns reached, Web selection pending/planned, native/recording/default boundaries explicit. A-19091 development excerpts and missing capture/candidate linkage limits retained; no Reviewer execution. Source clear only: C1–C4 await same-head mode-free positive case/file reconciliation, base/load scopes separate. Hold released; unchanged head before verification. Remaining T3/T4 standing split.

### impl-1828 · 2026-11-12T18:43:09.276Z

Same-head verification: run 3ed52429-5ebb-4f84-8c98-c195b533ea20 at 9497222374286db28d000e3f175216078526f5a6; exit 0, 6215 pass, no skips/fails. T0 local host gate; T1/all-T2 fallback/Web Linux droplet, Node24.21.0, Headless Shell1248 Chrome156.0.8078.4. A-19104 raw log; A-19105 positive named ordinary and load-scope receipts and complete consumer reconciliation. All 3 new ordinary cases pass and each 5/5 load repetitions pass with file completions. Zero missing T1/T2/Web file receipts among 724 inventory paths; 53 Web paths executed. Remaining T3 merge/stage; T4 stage/epic; no native run required by this diagnostic. Report-only lint/budget advisories retained. Source unchanged and clean; reviewer settling final evidence. Stage QA after-stage; Coordinator enqueues.

### rev-35 · 2026-11-12T18:44:27.380Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1828-final-1
commit: 9497222374286db28d000e3f175216078526f5a6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, A-19106. Independently streamed A-19104:6215 base test/688 base file passes, separate140 load test/file passes, no negatives. Exact3 new cases each base1+load5 with positive ordinary file and prior-status-shape regression. Normalized tree independently matches fa19f299c26ecdaa902f13ea4c8791185c18972c; clean unchanged949722237. A-19105 retains724 tests+53 non-test consumers/15 unknowns;472 required ordinary file receipts(74T1/345T2/53Web),0 missing; all521 exported receipt references checked against raw records,0 mismatches.238T3/14T4 deferred. Local T0 and remote Linux/browser provenance separated; report-only lint/budgets and development capture limits retained. All C1–C4 verified for readiness, evidence hold released. No further rerun/change requested; retain claim until normal merge handoff.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-12T19:25:47.259Z

Merged fecc95468e435d4fa5e537996e56a8859f480bf8 onto dev.
