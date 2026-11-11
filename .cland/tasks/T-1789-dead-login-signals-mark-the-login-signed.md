---
id: T-1789
kind: task
title: Dead-login signals mark the login signed out
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1774
  - T-1778
  - T-1784
  - T-1785
topic: topic-1474
branch: t/T-1789-dead-login-signals-mark-the-login-signed
created: 2026-11-09T12:44:11.774Z
updated: 2026-11-11T09:26:20.354Z
---

## Summary

When a harness on a pool host reports a dead login, the hub marks that session's login `signed-out`. The signals are:
- Claude Code: `authentication_failed`, `Login expired`, `OAuth token revoked` or a 401;
- Codex: `refresh_token_reused`, `codexErrorInfo: "unauthorized"` or a 401;
- OpenCode: `provider.auth`.

Placement then skips that host for that harness, the sessions already there keep running, and the human gets one "sign in again" card.

## What to build

The adapters classify these signals and report them through a new optional adapter-host callback, `loginDead`, beside `limitHit`. They report only for sessions on hosts; the local Claude signed-out latch stays as it is for local rows. The hub maps the session to its binding and marks the login signed out; a reader's report marks the login too. The Coordinator gets an Agents line of kind `login-signed-out`. The `login-signin` card is raised through T-1775 once per sign-out, with options "Sign in again" (handled by T-1791) and "Not now", and is withdrawn when the login reads `ready`.

## Acceptance criteria

- [ ] C1. Each listed signal from each fake harness on a fake host marks the session's login `signed-out` with its host (test).
- [ ] C2. The next launch of that harness in the pool skips that host, and the sessions already on it keep running, with no stop and no exit (test).
- [ ] C3. One "sign in again" card is raised per sign-out however many sessions report it, and it folds when the login reads `ready` (test).
  - failed: rev-36 [reviewer] · 2026-11-11T09:22:13.232Z · note Card recovery/name membership and rapid sign-out episode identity have confirmed gaps.
- [ ] C4. A dead-login signal from a local session changes no login and keeps the local signed-out latch as before (test).
- [ ] C5. The Coordinator gets one Agents line naming the login, the host and the signal (test).
  - failed: rev-36 [reviewer] · 2026-11-11T09:22:13.232Z · note Signed-out can persist without recoverable Coordinator publication; new event is not in the domain journal replay input.

## Blocked by

- T-1774
- T-1778
- T-1784
- T-1785

## Notes

- Hot files: `hub/src/adapters/claude-code.ts`, `hub/src/adapters/codex.ts`, `hub/src/adapters/opencode.ts`, `hub/src/adapters/contract.ts` (`loginDead`), `hub/src/adapters/sessions.ts` (the callback), `hub/src/host/login-signals.ts` (new), `hub/src/host/login-cards.ts`, `hub/src/hub/agents-topic.ts` (the kind).
- Tests: new `hub/test/login-signed-out.test.ts` (T2 with the in-process fakes for classification; T3 cases with the fake binaries on a fake host for C1 and C2).
- Serves epic C8. The signal strings come from the research (Q-1514, Q-1520); the fakes emit them, and real harness output is the live run's.

## Comments

### impl-1789 · 2026-11-11T09:06:45.241Z

Rule 20 sweep before edits: shared suite transitive import graph over all hub/web/nvim test files reaches 703 tests; 15 unknown traversals count as reached. Full lists attached in item-topic artifacts, plus explicit symbol/field consumers across production, skills, docs, QA and every tier. Changes additive: optional AdapterHost.loginDead and Interpretation/Change.loginDead; existing old adapter hosts remain valid. Consumers: Sessions wires callback and interprets hooks; Claude/Codex/OpenCode adapters emit; OpenCode SessionTracker supplies classified change; LoginCards owns sign-in card; Agents lifecycle mapper projects log. Wire shapes unchanged. Store shared operation owned by T-1793 per Coordinator. Existing transition consumers unaffected. Native reach includes host-create-ready, host-destroy-native, host-restart(-reconcile), host-stop, host-unreachable and login-write-back; changed behavior native proofs will use fake harness/host, broader T3 evidence at integrated occasion.

### impl-1789 · 2026-11-11T09:15:16.699Z

WIP committed/pushed at 43e6528f5. Independent targeted component run: 46 passed on local macOS, Node 24.21.0, no browser; public hub callback test remains deliberately red at `records.markSignedOut is not a function`, waiting for T-1793 landing and Coordinator-authorized dev merge. Hub typecheck and closed-item wording lint passed. No full suite, Linux receipt, native-slot proof, review or QA claimed. Detailed outstanding work and evidence in item-topic progress artifact. Keep item in progress/claimed.

### rev-36 · 2026-11-11T09:22:13.232Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1789-source-1
commit: 43e6528f574bbdfa0fd62f3f7a8c14b6c5c65922
scope: full
findings: [{"severity":"high","text":"Signed-out state commits before card/Coordinator publication, with no durable recovery owner; later signals skip signed-out and card startup only sees existing metadata. login-signed-out also lacks JOURNALLED registration. Persist/recover distinct episode publication obligations and positive dedupe receipts across faults/restart without releasing bindings.","file":"hub/src/host/login-signals.ts","line":15},{"severity":"medium","text":"active[name] truthiness reads Object.prototype for valid login name constructor, suppressing its sign-in card. Use own-property/map membership consistently and regress the admitted name.","file":"hub/src/host/login-cards.ts","line":32},{"severity":"medium","text":"Queued ready reconciliation rereads current state while card identity is name-only; ready then new sign-out before the microtask reuses the prior episode/card and never folds it. Preserve durable episode identity/ready boundary; regress rapid cycles without advancing the pinned clock.","file":"hub/src/adapters/sessions.ts","line":827}]
finding_counts: {"high":1,"medium":2,"low":0}

A-18637: authorized early SOURCE pass (Coordinator c0a112c9), Standards0/Spec1high2medium. Implementer confirms all gaps, no omitted recovery/normalization owner. Pin audit complete; repair and fresh committed-head source review. Known markSignedOut missing-method red remains explicit T-1793 dependency under the approved overlap, not final completion; no task-branch merge/cherry-pick authorized. C1/C2/C4 and all runtime proofs remain unverified; local46-case support qualified, no native/Linux pass. Preserve bindings/no-stop/local-latch assertions; update pending docs/consumer migrations before final integration review. T-1791 option1 remains deliberately open. No Reviewer tests/probes run.

Criteria: C3 failed (Card recovery/name membership and rapid sign-out episode identity have confirmed gaps.), C5 failed (Signed-out can persist without recoverable Coordinator publication; new event is not in the domain journal replay input.).

### impl-1789 · 2026-11-11T09:26:20.354Z

Rule 20 extension for signedOut.id: receipt is owned by T-1793; this lane consumes it in LoginCards' episode-aware metadata and Sessions' deterministic existing notice-store key. All card read/replace/withdraw paths use own-property membership. New tests read persisted card payload/metadata, reconstruct owners/reopen SQLite at publication faults, and cover same-clock distinct episodes. Existing generic login.list JSON transports preserve additive fields; no wire type or registration changes. No at fallback (unreleased logins): missing id refuses loudly. signedOutRows read seam/work-budget test will be added only after authorized dev merge; store owner remains T-1793.
