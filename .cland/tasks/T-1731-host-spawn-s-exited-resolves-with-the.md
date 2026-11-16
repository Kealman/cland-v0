---
id: T-1731
kind: task
title: Host spawn's `exited` resolves with the raw `process-exited` event instead of `{code, signal}` when reconciliation wins the race after a dropped commit reply
state: closed
status: done
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
updated: 2026-11-16T11:15:13.454Z
closed: 2026-11-16T11:15:13.454Z
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
  - verified: rev-37 [reviewer] · run rev-37-1731-evidence-1 · 2026-11-16T08:41:58.750Z · commit 60e82345182cd4060ba024773813927b14748427
  - verified: rev-37 [reviewer] · run rev-37-1731-final-1 · 2026-11-16T09:27:43.562Z · commit 60e82345182cd4060ba024773813927b14748427
- [x] C2. `host-ssh-contract.test.ts` passes 10/10 in the four-file parallel mix under a Linux `--init` container at load 8 or more (evidence).
  - done: impl-1731 · 2026-11-16T09:24:50.564Z
  - verified: rev-37 [reviewer] · run rev-37-1731-final-1 · 2026-11-16T09:27:43.563Z · commit 60e82345182cd4060ba024773813927b14748427

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

### impl-1731 · 2026-11-16T08:41:26.915Z

Evidence provenance correction: my first comment's 'base d642982 tree' was incorrectly copied from the epic's older cover tree. Original red/green actually ran against source commit dc05121d7be984867926f6e57c93f2172517dcd9 (raw Git tree07358021c182b39858112e2510d1199a512d3376) plus the displayed two tests then source projection. Subsequent dc05121d7→edbe8da2c merge changed only11 tracker files. Final source head60e82345182cd4060ba024773813927b14748427 has raw tree d7aa63fc68cd8ba754aa2ad4c32f135cbc006947, canonical verification tree45ecfa9d1a4bdf267d5dcd5af718f6ef0e3b4301; ssh-host blob92b4603a24f7e5d26ae4945faa73fcc76a068db8 and test blob6f6f5686a49111343d044108afe337f0dbd97e51. A-19864 retains original command/cwd/exit excerpts; final packet will retain this explicit correction. No provenance-only rerun. Same-head uncached verification ac9a6214/A-19894 passed6382 base tests with no negatives; C2 remains pending9 loaded mixes.

### rev-37 · 2026-11-16T08:41:58.750Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1731-evidence-1
commit: 60e82345182cd4060ba024773813927b14748427
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Partial evidence clear: C1 verified, C2 remains incomplete/unverified, not final item settlement. A-19894/runac9a6214 matches source-clear60e823451 and independently recomputed canonical tree45ecfa9d1a4bdf267d5dcd5af718f6ef0e3b4301. Uncached Linux x64 droplet Node24.21/Nvim0.12.5, isolated Headless Shell1248 Chrome156.0.8078.4. T0/allT1/fallback allT2/Web passed;6382 base test+700 file passes, separate220 load test+220 file passes, no negatives. File13/13 base; legacy and extended recovery names each1 base+5 load passes. A-19864 original-tool red/green excerpts establish the pre-fix exact-shape failure. Independently confirmed dc05121d7's ssh-host.ts blob equals final parent ad778415d3735d505955ee8569ddc5676e8282f9; older comment base label awaits reconciliation. C2 needs remaining9 loaded four-file Linux --init mixes under the narrow T-1906 exception, which is not a whole-mix/configured pass waiver. NoT3/T4 here; budgets/lint report-only. No Reviewer runs/edits. A-19901 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19901-t-1731-configured-evidence-c1-loaded-mix-pending.md

Criteria: C1 verified.

### rev-37 · 2026-11-16T09:27:43.563Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1731-final-1
commit: 60e82345182cd4060ba024773813927b14748427
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1/C2 verified. Independently parsed all10 original A-19932 TAPs:40 required Host names exactly once per mix,400/400 Host passes,60 result rows/mix,0cancel/skip/todo. Whole-mix592pass/8fail retained (five whole mixes exit1); failures quote 'autonomous retry publishes up: not within 3000 ms', 'explicit incomplete cleanup receipt: not within 2000 ms', and 'changed publication completed before up: not within 2000 ms', exclusively T-1906 identities authorized by Coordinator eb7791e3/3c13e6e3. Entry load8.01–9.55; end7.54–13.33 retained;1f0892fc explicitly accepts entry-only accounting/mix6. C2 is satisfied under that narrow disposition, not10 clean whole-mix passes. Linux Docker --init/network-none/4CPU Node24.21, exact four-file concurrency4; no incomplete file counted. Original missing-zod/load-readiness setup failures and mix7 original accounted:false retained. Corrected source-base provenance reconciled. Configured ac9a6214/A-19894 unchanged uncached60e823451/tree45ecfa9d1a4bdf267d5dcd5af718f6ef0e3b4301 remains green6382base tests/700files plus220load tests/files; Linuxx64 droplet Node24.21/Nvim0.12.5, pinned isolated Headless Shell1248 Chrome156.0.8078.4; T0/allT1/fallback allT2/Web, no taskT3/T4. Budgets/lint report-only, QA none. No Reviewer runs/edits. A-19934 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19934-t-1731-final-same-head-c1-c2-evidence-review.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T11:15:13.454Z

Merged 66bce8751d6dc928f9d28fe73fd3a61956a600d6 onto dev.
