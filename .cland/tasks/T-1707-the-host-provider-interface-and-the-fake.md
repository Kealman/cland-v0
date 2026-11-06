---
id: T-1707
kind: task
title: The host provider interface and the fake host provider's machines
state: open
status: review
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
updated: 2026-11-06T11:07:15.890Z
---

## Summary

A `HostProvider` interface beside the Executor: acquire, prepare, status, release and reap, mirroring `executor.ts`, plus the transport kind a host is reached by. A provider registry resolves a pool's `provider` name. A fake host provider creates fake-transport hosts (directories with their own home, run directory, boot id and pinned key), with a configurable boot time and injected failures. A reusable contract suite runs against any provider.

Hot files: `hub/src/host/provider/provider.ts` (new), `hub/src/host/provider/registry.ts` (new), `hub/src/host/provider/fake.ts` (new), `hub/test/host-provider-contract.ts` (new), `hub/test/host-provider-fake.test.ts` (new)

## What to build

The interface and its result types: a machine handle with id, address, architecture and created time; acquire outcomes `created`, `refused` with a retry time, and `failed`; `released` only after a confirming read. The fake provider is selectable only when the test environment names a fake-host root, as `registerFakeHosts` is, so a project config cannot pick it in production. The contract suite takes a provider factory and checks every operation's outcome shape, so the DigitalOcean tickets run it against DigitalOcean.

Notes: the provider registry is shared; the DigitalOcean machines ticket adds `digitalocean`, and the pool-images ticket reads pools through it.

## Acceptance criteria

- [x] C1. The interface has acquire, prepare, status, release and reap, mirroring the Executor's operations, and names its transport kind, which is `ssh` only (test of the contract suite on the fake provider).
  - done: impl-1707 · 2026-11-06T10:59:37.368Z
- [x] C2. On the fake provider, acquire, status, release and reap pass the contract suite, and release reports `released` only after a read finds the machine gone (test).
  - done: impl-1707 · 2026-11-06T10:59:40.201Z
- [x] C3. A configured boot delay, a refused acquire with a retry time and a machine that never boots are each reported as their typed outcome, never as a thrown string (test).
  - done: impl-1707 · 2026-11-06T10:59:41.058Z
- [x] C4. `provider = "fake"` is refused outside the test environment with a message naming the reason, and the fake provider opens no network socket (test).
  - done: impl-1707 · 2026-11-06T10:59:42.663Z

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
