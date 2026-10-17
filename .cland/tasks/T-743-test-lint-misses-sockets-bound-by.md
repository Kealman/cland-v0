---
id: T-743
kind: task
title: "Test lint misses sockets bound by constructors such as new WebSocketServer({ port: 0 })"
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: topic-453
branch: t/T-743-test-lint-misses-sockets-bound-by
created: 2026-10-17T16:00:31.334Z
updated: 2026-10-17T16:52:37.026Z
---

## Summary

impl-690 found (T-690, 2026-10-17) that the test lint says `hub/test/spoke-readiness.test.ts` qualifies T1, although it creates `new WebSocketServer({ port: 0 })` and uses real sockets. The socket rule only checks `.listen(...)` calls, so a constructor that binds a port goes unseen. Once T-684 makes the lint refuse, this would let socket tests sit at T1.

## What to build

Count servers bound at construction as socket use, the same as `.listen`: `ws` WebSocketServer with a port or server option, `net.createServer(...).listen` chains and http(s) createServer. Keep the inert-data negatives.

## Acceptance criteria

- [x] C1. A planted T1 file constructing `new WebSocketServer({ port: 0 })` gets the socket finding, an inert string mentioning it doesn't, and spoke-readiness.test.ts no longer qualifies T1, proved by lint tests. The review request lists every dev file whose qualification changes.
  - done: impl-743 · 2026-10-17T16:44:48.314Z
  - verified: rev-30 [reviewer] · run rev-20261017-743-source · 2026-10-17T16:45:58.597Z · commit 430bac7f3de8ba9faec3e0ec8985e1aeabf1805d
  - verified: rev-30 [reviewer] · run rev-20261017-743-final · 2026-10-17T16:52:37.026Z · commit 430bac7f3de8ba9faec3e0ec8985e1aeabf1805d

## Comments

### impl-743 · 2026-10-17T16:38:01.461Z

Implemented ws constructor option detection through existing lexical binding analysis. T1 regression covers port/server, alias/namespace/require bindings, const options, inert data and noServer negatives; existing net/http/https listen chains explicitly covered. Full manifest comparison against pre-change origin/dev baseline (306 files): only hub/test/spoke-readiness.test.ts changes qualifies T1→T2, because its WebSocketServer binds port 0. It is already declared T2. qaPolicy is after-stage scope none; no per-item QA required. Required serial checks next.

### rev-30 · 2026-10-17T16:45:58.597Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-743-source
commit: 430bac7f3de8ba9faec3e0ec8985e1aeabf1805d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-743 source review — clear

Head 430bac7f3de8ba9faec3e0ec8985e1aeabf1805d on t/T-743-test-lint-misses-sockets-bound-by; fixed point 0ffa17c33df21a4bcb2f0d3830e2c1a220ce01c7. One commit, two changed files. Read-only review, no Reviewer execution.

## Standards
No findings. socketOptions reuses lexical declarations, follows const initializer aliases, unwraps parentheses/as/satisfies/non-null expressions and checks object spreads with a visited-node bound. ws constructor identity reuses existing bindingOf import/require/dynamic-import/alias handling; imported foreign constructors, local classes and shadowed parameters are excluded. Only recognized WebSocketServer/Server bindings (or undeclared WebSocketServer syntax) with a visible port/server option raise socket use to T2. noServer-only objects remain unbound. The existing listen-call detector is unchanged.

New regressions remain T1: source strings are parsed as data, never executed; reading the real spoke-readiness source uses filesystem only. No subprocess, socket setup or real-time wait is added to the changed test. No manifest, baseline, allowance or production networking behavior changes.

## Spec
C1 verified from source plus supplied targeted evidence. The planted port:0 constructor has a socket finding at the constructor line, qualifies T2, and touchesMachineResources refuses T1. Imported aliases, namespace/default imports, require destructuring, dynamic-import aliases, server shorthand, constant option aliases and spread/wrapper inputs are covered. Inert strings/comments, noServer-only, foreign bindings, locals, shadowing and cyclic options have explicit negatives. Existing net/http/https createServer().listen chains retain their socket finding.

The actual spoke-readiness source regression reads heldWelcome's new WebSocketServer({port:0,host:...}) and asserts T2 plus machine admission. The request and A-4628 explicitly enumerate every changed qualification in the supplied 306-file comparison: only hub/test/spoke-readiness.test.ts T1→T2, already declared T2. Read-only constructor inventory also finds resilience.test.ts, whose other existing machine/process resources already prevent T1; source strings in test-lint.test.ts remain inert. I did not execute the complete qualification comparison myself.

## Evidence and pending runtime
A-4627 independently contains five complete green runs each of test-lint (14 cases), suite-tiers (8) and suite-runner (43): 325 passing executions, zero failures/cancellations/skips. Supplied subprocess-wall ranges: lint 0.358–0.415s; tiers 0.695–0.935s; runner 68.988–75.535s. Raw Node file durations are separate measurements. Static typecheck/tiers/report-only lint green; max sampled load 8.01. A-4628 records the source/qualification audit.

Full source clear; findings []. Verify C1 at this head. This is source clearance, not final suite evidence. Normal mode-free exact-head droplet verification may follow, subject to any Coordinator submission hold. Final evidence verdict awaits its result. QA scope none/after-stage; no per-item QA.

Standards: 0 findings. Spec: 0 findings.

Durable review: A-4630.

Criteria: C1 verified.

### rev-30 · 2026-10-17T16:52:37.026Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-743-final
commit: 430bac7f3de8ba9faec3e0ec8985e1aeabf1805d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-743 final evidence review — clear

Exact source-reviewed head430bac7f3de8ba9faec3e0ec8985e1aeabf1805d remains the task branch tip. Prior full source verdict rev-20261017-743-source/A-4630 verifies C1 with no findings. Task view shows current source criterion mark and finished passed droplet verify fca8a4e1-d286-405a-8b76-4405f3e6e942 at that same head. No new source review is required.

A-4634 independently audited: normal automatic hub-selected mode, function coverage A-4620; host npm run check/typecheck/report-only lint, then actual tests and Neovim smoke, Finished: exit0. Phase receipts14+208+12=234passed,0failed/cancelled/skipped. There are234positive suite-timing records, not merely tier-list entries. test-lint.test.ts executes14cases at lines413–426; suite-runner.test.ts43at937–979; suite-tiers.test.ts8at1074–1081. All four new constructor/inert/listen-chain/real-source identities pass ordinarily and5/5each (20/20). All nine load-gated lint identities pass5/5 (45/45); no partial gate.

Supplied durable executor result: Linux x64 6.8.0-142-generic, c-8 lon1, Node24.21.0/Neovim0.12.5,2workers, lifetime267s,cost$0.0185. Suite197.92s,peak1mload4.06,load-gate extra wall12.46s. Known duration regressions and tier budget diagnostics are report-only; there is no failing functional, hard-duration or load-gate result. Pinned-base T3 ratchet4358.593s equals base4358.593s. Raw package runner's earlier unavailable ratchet diagnostic is followed by the host's pinned-base report, not a conflicting failure.

Mac5/5 supplied regressions remain audited A-4627 (325passes across lint/tiers/runner), qualification/source audit A-4628 and full Reviewer source analysis A-4630 apply unchanged. All C1 checks are established at this head. No per-item QA.

Final evidence clear; findings[]; C1 reverified with rev-20261017-743-final. Standards0/Spec0 findings. No further task run requested.

Durable final review: A-4636.

Criteria: C1 verified.
