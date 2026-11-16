---
id: T-1731
kind: task
title: Host spawn's `exited` resolves with the raw `process-exited` event instead of `{code, signal}` when reconciliation wins the race after a dropped commit reply
state: open
status: review
size: S
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1541
branch: t/T-1731-host-spawn-s-exited-resolves-with-the
created: 2026-11-06T23:09:27.734Z
updated: 2026-11-16T07:57:31.740Z
---

## Summary

impl-1670 found this aside while working T-1670. It ran a four-file Linux mix (`transport-forwards`, `transport-ssh`, `host-ssh-contract`, `remote-discovery-host`) in `docker run --init` at dev dd43ad65, plus T-1670's test-only diagnostics. `hub/test/host-ssh-contract.test.ts:158` "accepted spawn reconciles its durable token after the commit reply is dropped" failed its `assert.deepEqual(receipt, {code:7, signal:null})`.

The resolved value also carried `event: 'process-exited'`, `pid`, `identity`, `authority: 'closed'` and `ended: true`. So after a dropped commit reply, `child.exited` resolves with a different shape depending on which path settles it: the reply path gives `{code, signal}`, and the reconciliation path gives the raw native event. Callers that compare or destructure `exited` see an inconsistent contract. The test passes alone and in the merge batches.

## What to build

- Find where `exited` is settled on the reconciliation path, in the SSH Host spawn after a dropped commit reply (`hub/src/host/ssh-host.ts` and the reconcile or recovery path), and normalise it to the documented `{code, signal}` exit shape. Keep the native event as internal evidence only.
- A deterministic test forces the reconciliation path to win and asserts the exact `{code, signal}` shape, red before the fix.
- Rule 20 sweep of `exited` consumers.

## Acceptance criteria

- [x] C1. With the commit reply dropped and reconciliation forced to settle first, `child.exited` resolves exactly `{code: 7, signal: null}` (test, red before the fix).
  - done: impl-1731 · 2026-11-16T07:38:24.448Z
- [ ] C2. `host-ssh-contract.test.ts` passes 10/10 in the four-file parallel mix under a Linux `--init` container at load 8 or more (evidence).

## Comments

### impl-1731 · 2026-11-16T07:35:17.007Z

Rule 20 consumer sweep before source change: searched .exited, process-exited, native-receipts, HostSpawn and Host/sshHost imports across hub/src, hub/test (tiers.json includes T1–T4), nvim, web, shared, test-support, docs (QA briefs/evidence/startup guidance), and shipped .agents/skills. Native producers/readers: host/agent/{protocol,processes,server}.ts, host/ssh-host.ts and AgentClient; native wire and persisted process rows stay unchanged. Promise consumers: adapters/codex.ts, adapters/opencode/{server}.ts, adapters/opencode.ts, adapters/launch-files.ts; they read code/signal or await completion and require no migration. host/local.ts retains the exact existing Host.spawn shape. Tests consuming this promise: host-contract.ts (shared SSH/local contracts), host-ssh-contract, host-local-contract, host-agent, login-key-spawn, host-login-disk, host-relaunch; all remain compatible. Native-event consumers in host-prepared, host-agent-restart, host-agent, login-write-back, host-login-disk and host-relaunch retain their full events. Scripted native-receipts replies in host-command-environment, host-flush, host-settlement keep wire shape. Other Host importers only call other Host methods or supply the declared promise shape. AdapterHost.exited callbacks (codex-host, codex-remote-cleanup, claude-code-schedule, fakes/harness), daemon exited in edges, outbox exchange.exited and nvim sessions.exited are unrelated homonyms. Docs: docs/hub/ssh-host.md, docs/agents/host-agent.md, docs/spec/v0.4.md; update SSH Host promise wording only. No web/nvim wire, QA brief, startup probe or shipped skill consumes leaked extra keys. Previous wire-shape regression: scripted legacy native event without authority/ended, alongside current extended frame. No field removal on the wire; normalize solely at the existing public promise boundary.

Red receipt on macOS arm64, Node 24.21.0, task base d642982 tree plus new tests: host-command-environment T2 11 pass / 2 fail. Both failures are exact deepStrictEqual: actual includes event:'process-exited', pid:42, identity:'synthetic-birth'; extended also authority:'closed', ended:true. Expected {code:7,signal:null}. No native process, browser, full suite or verification run.

### impl-1731 · 2026-11-16T07:37:56.553Z

Supplemental rule 20 sweep explicitly included shipped skills/, qa/, .github/, packaging/, hub/bin/, web/test and nvim/test. QA brief matches: qa/briefs/E-1534{,-stage-1,-stage-2,-stage-3}.md, E-1533{,-stage-2,-stage-3}.md and E-1535-stage-1.md describe historical T-1731 failure signatures and stage rerun policy, rather than consuming native frames; unaffected historical evidence. No CLI/startup probe or skill example parses this exit promise. Note correction to prior evidence tier: host-command-environment.test.ts is existing T1 per tiers.json, not T2. Green after normalization: 13/13 on macOS arm64 Node 24.21.0, no native I/O or browser; full verification not yet run.

### rev-37 · 2026-11-16T07:57:31.740Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1731-source-1
commit: 60e82345182cd4060ba024773813927b14748427
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at exact 60e823451; Standards and Spec both clear, findings []. A-19859 checks shared intake projection for live/cached completions, exact pid/birth matching, deterministic dropped-commit recovery through initial native receipts before accepted settlement, previous/current wire regressions, cleanup and matching docs. C1/C2 remain runtime-unverified. Reported first Linux mix exited1 with all host-ssh-contract cases passing and the two unchanged T-1906 exceptions only; no full mix/configured pass inferred. C2 tracker says10 repetitions versus request's19 remaining; reconcile with Coordinator. Source may proceed to authorized same-head evidence/verification slots without head changes. No Reviewer runs/edits. Artifact /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19859-t-1731-exact-head-source-review.md
