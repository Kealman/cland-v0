---
id: T-1707
kind: task
title: The host provider interface and the fake host provider's machines
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: topic-1401
branch: t/T-1707-the-host-provider-interface-and-the-fake
created: 2026-11-06T10:47:48.096Z
updated: 2026-11-06T13:04:23.454Z
closed: 2026-11-06T13:04:23.454Z
---

## Summary

A `HostProvider` interface beside the Executor: acquire, prepare, status, release and reap, mirroring `executor.ts`, plus the transport kind a host is reached by. A provider registry resolves a pool's `provider` name. A fake host provider creates fake-transport hosts (directories with their own home, run directory, boot id and pinned key), with a configurable boot time and injected failures. A reusable contract suite runs against any provider.

Hot files: `hub/src/host/provider/provider.ts` (new), `hub/src/host/provider/registry.ts` (new), `hub/src/host/provider/fake.ts` (new), `hub/test/host-provider-contract.ts` (new), `hub/test/host-provider-fake.test.ts` (new)

## What to build

The interface and its result types: a machine handle with id, address, architecture and created time; acquire outcomes `created`, `refused` with a retry time, and `failed`; `released` only after a confirming read. The fake provider is selectable only when the test environment names a fake-host root, as `registerFakeHosts` is, so a project config cannot pick it in production. The contract suite takes a provider factory and checks every operation's outcome shape, so the DigitalOcean tickets run it against DigitalOcean.

Notes: the provider registry is shared; the DigitalOcean machines ticket adds `digitalocean`, and the pool-images ticket reads pools through it.

## Acceptance criteria

- [x] C1. The interface has acquire, prepare, status, release and reap, mirroring the Executor's operations, and names its transport kind, which is `ssh` only (test of the contract suite on the fake provider).
  - done: impl-1707 · 2026-11-06T11:39:48.786Z
  - verified: rev-36 [reviewer] · run rev-36-1707-final-1 · 2026-11-06T12:01:37.139Z · commit 96c5c702a7f17b90f5b93da7cf1c2676b0abeb22
- [x] C2. On the fake provider, acquire, status, release and reap pass the contract suite, and release reports `released` only after a read finds the machine gone (test).
  - done: impl-1707 · 2026-11-06T11:39:49.049Z
  - verified: rev-36 [reviewer] · run rev-36-1707-final-1 · 2026-11-06T12:01:37.139Z · commit 96c5c702a7f17b90f5b93da7cf1c2676b0abeb22
- [x] C3. A configured boot delay, a refused acquire with a retry time and a machine that never boots are each reported as their typed outcome, never as a thrown string (test).
  - done: impl-1707 · 2026-11-06T11:39:49.426Z
  - verified: rev-36 [reviewer] · run rev-36-1707-final-1 · 2026-11-06T12:01:37.139Z · commit 96c5c702a7f17b90f5b93da7cf1c2676b0abeb22
- [x] C4. `provider = "fake"` is refused outside the test environment with a message naming the reason, and the fake provider opens no network socket (test).
  - done: impl-1707 · 2026-11-06T10:59:42.663Z
  - verified: rev-36 [reviewer] · run rev-36-1707-final-1 · 2026-11-06T12:01:37.139Z · commit 96c5c702a7f17b90f5b93da7cf1c2676b0abeb22

## Comments

### impl-1707 · 2026-11-06T10:51:00.350Z

Rule 20 sweep: searched HostProvider, host/provider, registerFakeHosts, createFakeHost, fakeHost and hostDirectory across hub/src, hub/test (all tiers), shared, nvim, web, docs, qa/briefs and shipped .agents/skills. New provider interface/registry has no current consumers. Existing layout consumers: host/records.ts registerFakeHosts, host/registry.ts projectSshHosts, fake SSH/SCP/control helpers, host records/directory and SSH lifecycle fixtures; these retain their previous directory/key/boot shape. Shared initializer extraction preserves createFakeHost API and outputs; no Host member, frame, config table, executor key or client method changes. Existing nvim/web wire fixtures and persisted-record readers are unaffected. Contract suite is the new consumer; later T-1711/T-1712 extend this interface and T-1713 supplies another factory. Tests target the assigned provider public seam and registry selection, using disposable directories and fake clocks.

### impl-1707 · 2026-11-06T10:58:40.438Z

Implementation evidence A-17055: provider public contract/factory scenarios and directory-only fake. Direct helper consumers to preserve: hub/test/{host-reboot-native,transport-forwards,host-ssh-registry,transport-ssh,host-agent-restart,fixture-socket-path,host-relaunch-retry,host-relaunch-native,host-reboot-controller,host-records,adapter-generation-forward,fake-ssh,host-push-on-ref-move,host-relaunch,host-supervisor,host-survival-native}.test.ts. Their createFakeHost/fakeHostSocketPath signatures, physical layout, byte-budget validation and pinned key contents remain unchanged through shared re-exports. No nvim/web/QA wire consumers migrate. Current targeted provider receipt is 15/15 local macOS Node24.21.0 with inherited CLAND removed, no skipped tests/network/browser. T0 build/typechecks green; lints and heavy targeted regression pending. C4 tests were added after initial implementation; no separate pre-implementation C4 red claimed.

### rev-36 · 2026-11-06T11:06:29.053Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1707-source-1
commit: 7261169f07d63a5f1f4d86b8b129abdb61936230
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 7261169f07d63a5f1f4d86b8b129abdb61936230; no findings. Spec and Standards review: five-operation ssh provider contract, typed failure/boot/refusal states, explicit fake-root admission, serialized lifecycle writes and confirming deletion reads are consistent with C1–C4. Shared fake initializer/socket-budget extraction preserves existing consumers; reviewed the ownership inventory and test/docs coverage. Details A-17064: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17064-t-1707-source-review-at-7261169f0.md. C1–C4 remain unverified pending runtime evidence, including the sixteen direct consumer preservation files and configured verification at this unchanged head. Reviewer ran no tests or browser.

### rev-36 · 2026-11-06T11:07:15.890Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1707-source-2
commit: e3314796f97877862a9a77b76f88ac20ce101e06
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at e3314796f97877862a9a77b76f88ac20ce101e06; no findings. The only delta adds the six-scenario factory table and isolation/cleanup/readiness guidance to the file-specific test guide. Matched all entries to the unchanged union and contract assertions; no implementation/test/tier bytes changed. A-17064 full source review carries over; delta details A-17065: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17065-t-1707-documentation-delta-source-review-at-e3314796f.md. C1–C4 remain unverified pending exact-head configured results and named preservation evidence. Reviewer executed no tests.

### rev-36 · 2026-11-06T11:37:24.632Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1707-evidence-1
commit: e3314796f97877862a9a77b76f88ac20ce101e06
scope: evidence
findings: [{"severity":"medium","text":"Generated top-level tests are attributed to the helper file, so configured repetitions launch that helper without the provider factory; all seven contract identities lack receipts in all five repetitions. Make executable provider entrypoints own test registration while retaining shared assertions.","file":"hub/test/host-provider-contract.ts","line":11}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17081 actual diagnostic at14806: "[redacted] exit [redacted]; expected one passing receipt, received [redacted]". Confirmed seven contract base passes but 35 failed repetition receipts; helper file wrappers pass without generated test execution. Eight provider-specific cases each base+5 repetitions pass. T0/T1 exit0; T2/overall exit1; Web unexecuted, T3 deferred, no T4/browser. Exact e3314796f, uncached Linux x64 droplet Node24.21.0. These are missing receipt failures, not a claimed product assertion failure or report-only budget failure. Details A-17084: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17084-t-1707-failed-configured-evidence-contract-repetitions-target-the-helper.md. C1/C2/C3 failed; C4 left unverified. Fix requires fresh source review before another configured run. Reviewer ran no tests.

Criteria: C1 failed (Configured contract repetitions launch the helper alone and produce no named passing receipts; overall/T2 exit1.), C2 failed (All create/status/release/reap contract repetition receipts are missing despite base passes; configured evidence is not clear.), C3 failed (Refused, failed-acquire, delayed-boot and never-boot contract repetitions each fail receipt validation in all five attempts.).

### impl-1707 · 2026-11-06T11:37:59.110Z

Configured verify 8a78b39d / A-17081 failed at e3314796f: T0/T1 green, T2 exit1. Seven generated cases attributed their native file identity to host-provider-contract.ts, so standalone exact-name load reruns produced zero passing receipts (35 attempts failed). Production reporter probe reproduced native exit0 with seven helper-file receipts and driver exit1; caller-local registrar wrapper now yields seven entry-file receipts and driver exit0, ordinary15 cases green. Rule20 follow-up: new registrar parameter has only host-provider-fake.test.ts as current caller; updated it and both provider/QA guides. No production/wire consumers changed. Fresh review and verification required at fixed head; source changes are confined to test registration and matching docs.

### rev-36 · 2026-11-06T11:39:29.228Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1707-source-3
commit: 96c5c702a7f17b90f5b93da7cf1c2676b0abeb22
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 96c5c702a7f17b90f5b93da7cf1c2676b0abeb22; no findings. Caller-local registrar wrapper moves native registration ownership to the runnable provider entry; shared contract retains all seven exact names/scenarios/assertions. Only test registration and two matching guides changed; production, tier, duration and gate bytes unchanged. A-17084 medium finding addressed by source. Details A-17086: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17086-t-1707-registrar-correction-source-review-at-96c5c702a.md. C1–C4 remain unverified pending new configured evidence; A-17081 stays failed. C1–C3 still had prior failure/done-cleared marks at task.view read. Reviewer executed no tests/probes/lints.

### impl-1707 · 2026-11-06T11:45:38.229Z

Supplementary T-1721 retries completed at reviewed 96c5c702a: A-17093 contains two native child receipts, each 10/10 passed, exit0, signal null, zero skipped/cancelled/todo. Local macOS Node24.21.0, no browser; sampled maximum one-minute load 3.865/5.887. Version-delivery case 14.712s and19.183s under unchanged20s test timeout. Original red retained in A-17072; Coordinator baseline cover timings15.4s Linux A-17045 /17.1s macOS A-17051 support pre-existing margin T-1721. Credential scan passed with positive control before publishing receipt artifact; roots removed after child and log closure, preservation lock released. New configured verification2f53dffb at exact96c5c702a remains pending; A-17081 remains failed and is not reused.

### impl-1707 · 2026-11-06T12:00:03.456Z

Configured run2f53dffb / A-17098 passed at exact reviewed96c5c702a: T0,T1,T2,Web exit0;5182 passed,0failed/cancelled/skipped/todo. All15 provider case identities have explicit5/5 load-gate receipts under runnable host-provider-fake.test.ts. Droplet c-8 lon1/Linuxx64 kernel6.8.0-142-generic/Node24.21.0, Chrome Headless Shell Google Chrome for Testing156.0.8078.4; lifetime1036s,cost$0.0719. Duration budgets and report lints remain advisory. T3/T4 unexecuted by this task run; direct-consumer local macOS preservation evidence A-17072 and low-load retries A-17093 are separate, retaining the initial T-1721 timeout. Reviewer notified for final C1-C4 settlement. Tree clean; no new source changes or dev merge.

### rev-36 · 2026-11-06T12:01:37.139Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1707-final-1
commit: 96c5c702a7f17b90f5b93da7cf1c2676b0abeb22
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged source-reviewed 96c5c702a7f17b90f5b93da7cf1c2676b0abeb22. Independently matched all15 exact generated names at the runnable provider entry, each base+5 passing load-gate test receipts; no helper-file/missing receipt failures. Assertion facts settle C1–C4. Exact-head uncached2f53dffb/A-17098 overall0,5182pass/0fail/cancel/skip/todo, T0/T1/fallback allT2/Web green. Linuxx64 droplet Node24.21/Nvim0.12.5, isolated HeadlessShell1248/CfT156.0.8078.4; T0capture-tree61cd18bc not repeated remotely. T3/T4 task phases unexecuted. Native preservation: A-17072 fifteen predecessor-head files60/60, relevant production/shared/test bytes unchanged; original version-delivery cancellation retained, A-17093 exact-current-head two whole-file10/10/code0/signalnull passes. No timeout-fix or Linux-preservation claim; T-1721 separate. A-17081 stays failed. Budgets/lint/ratchet/skip report-only, affected after-stage QA separate. Details A-17099: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17099-t-1707-final-provider-and-preservation-evidence-at-96c5c702a.md. Reviewer ran no tests/probes/browser.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-06T13:04:23.454Z

Merged 61599ac1ffc9ca5c37e44925155b1b6831b29739 onto dev.
