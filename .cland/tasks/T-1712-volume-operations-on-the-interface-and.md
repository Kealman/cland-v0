---
id: T-1712
kind: task
title: Volume operations on the interface and the fake host provider
state: open
status: ready
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1707
topic: topic-1408
branch: t/T-1712-volume-operations-on-the-interface-and
created: 2026-11-06T10:48:15.245Z
updated: 2026-11-06T15:09:57.093Z
---

## Summary

The provider interface gains the login-disk volume operations: create, attach, detach, snapshot, delete and list, with deletion confirmed by a read. The fake provider models a provider's volume rules: one attachment at a time, a volume bound to its region, and a snapshot rate limit with a retry time. Logins (E-1535) build on these; nothing here mounts or reads a volume.

Hot files: `hub/src/host/provider/provider.ts`, `hub/src/host/provider/fake.ts`, `hub/test/host-provider-contract.ts`, `hub/test/host-provider-volumes.test.ts` (new)

## What to build

Volume operations and their typed outcomes (`attached`, `refused: attached elsewhere`, `refused: rate limited until <t>`, `deleted` only after a confirming read), the fake's configurable snapshot window, and volume cases in the contract suite.

Notes: the contract suite is shared; the DigitalOcean volumes ticket runs its volume cases against DigitalOcean.

## Acceptance criteria

- [x] C1. On the fake provider, a volume attaches to one machine, and a second attach elsewhere is refused while the first holds it (test).
  - done: impl-1712 · 2026-11-06T14:42:31.092Z
  - verified: rev-35 [reviewer] · run rev-35-1712-final-1 · 2026-11-06T15:09:56.797Z · commit 72ed1ccc5919aefbbe8d641dff63101e5939d7d9
- [x] C2. A second snapshot inside the configured window is refused with its retry time, and one after the window succeeds (test).
  - done: impl-1712 · 2026-11-06T14:42:38.116Z
  - verified: rev-35 [reviewer] · run rev-35-1712-final-1 · 2026-11-06T15:09:56.797Z · commit 72ed1ccc5919aefbbe8d641dff63101e5939d7d9
- [x] C3. Attaching a volume to a machine in another region is refused (test).
  - done: impl-1712 · 2026-11-06T14:42:38.298Z
  - verified: rev-35 [reviewer] · run rev-35-1712-final-1 · 2026-11-06T15:09:56.797Z · commit 72ed1ccc5919aefbbe8d641dff63101e5939d7d9
- [x] C4. Volume deletion reports `deleted` only after a read finds it gone, and the volume cases of the contract suite pass on the fake provider (test).
  - done: impl-1712 · 2026-11-06T14:42:38.533Z
  - verified: rev-35 [reviewer] · run rev-35-1712-final-1 · 2026-11-06T15:09:56.797Z · commit 72ed1ccc5919aefbbe8d641dff63101e5939d7d9

## Comments

### impl-1712 · 2026-11-06T14:38:34.318Z

Rule 20 sweep: searched repository including hidden shipped skills, docs/QA/fixtures and every test tier for HostProvider, FakeHostProvider, hostProviderContract, ProviderScenario, provider module path and lifecycle method names. Consumers: provider.ts (add volume types/methods; preserve machine shape and old acquire inputs), fake.ts (implement), registry.ts (returns interface, unchanged), declarations.ts (independent, unchanged), host-provider-contract.ts (add separately exported mandatory volume suite), host-provider-fake.test.ts (existing lifecycle registration stays unchanged), host-provider-declarations.test.ts (declaration-only partial fake, unaffected), docs/hub/host-providers.md and docs/agents/tests/hub-test-host-provider-fake.test.ts.md (update extension guidance). No wire frame, persisted record reader outside fake, startup probe, web/nvim client or QA brief consumes this new interface. Preserve old acquire request regression; region is additive with fake default. Test seam is the assigned provider API and reusable contract registration; no mounting or native consumers.

### rev-35 · 2026-11-06T14:46:18.529Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1712-source-1
commit: ba733f2e9414b24d348635b6ddf13d09a090fdd9
scope: full
findings: [{"severity":"medium","text":"Persisted volume records are cast without validating attachedTo or snapshot/time coherence; missing/false/zero attachment state becomes unattached, permitting attach/delete, while missing/malformed snapshot timestamp can bypass pacing. Inventory also republishes malformed records. Share validation across identity/inventory reads; unknown state must fail/incomplete without mutation, with exact-byte faulted-record controls.","file":"hub/src/host/provider/fake.ts","line":52}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17157: full source not clear, one medium retained-state validation gap confirmed2da611f2. Nominal typed API/identity/region/serialization/snapshot/delete-read behavior and reusable mandatory contract/tests/docs/tier migration inspected; no further findings. C1–C4 remain unverified, no runtime criterion failure invented. A-17156 local summaries qualified; no Reviewer execution. Fresh corrected committed source review before configured verify; affected after-stageQA separate.

### impl-1712 · 2026-11-06T14:46:38.408Z

Source review A-17157 correction: shared parseFakeVolumeRecord now owns every persisted volume read (listVolumes and identity/mutation paths). Added malformed attachedTo and incoherent snapshot/timestamp fault controls, retaining exact bytes across failed inventory/mutations and incomplete delete. Red first: listed != failed; then green 46/46 targeted provider tests on local macOS Node 24.21.0, including the existing 45. Consumer extension is internal to fake; no wire or other provider changes. T0 rerun in progress.

### rev-35 · 2026-11-06T14:48:16.649Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1712-source-2
commit: 72ed1ccc5919aefbbe8d641dff63101e5939d7d9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17159: cumulative corrected source clear, no findings. Shared parser fences inventory and direct reads: explicit attachment state, immutable identity/shape and coherent snapshot/time pair. Twelve malformed variants assert failed/incomplete operations and unchanged bytes; nominal recreation/ownership/pacing/delete-confirmation contracts preserved. API/optional region, single-owner serialization, tiers/docs/consumer migration inspected. No Reviewer execution. C1–C4 remain unverified pending same-head configured evidence; local46/46/T0 reports qualified, prior A-17156 not relabelled current head. Real provider volumes and affected after-stageQA separate.

### rev-35 · 2026-11-06T15:09:56.797Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1712-final-1
commit: 72ed1ccc5919aefbbe8d641dff63101e5939d7d9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17163: final same-head clear, C1–C4 verified. A-17161 run26cb8682 exit0 hub5252pass/zero fail,cancel,skip,todo; base5116pass/four empty failure arrays. Independently matched source/execution tree4f925eb250952b5153d48a3d4dc0991c2054d309. All9 named volume cases basepass and5 distinct passing repetitions each: attachment/region, snapshot retry, read-confirmed/ignored deletion and actual-case false-ack control, persisted recreation/concurrency/invalid window and12-variant exact-byte malformed-state test. T0/T1/allT2/Web complete; T3deferred,T4unrun. A-17160 original-tool transcription/combined-command/source-timeline limits retained. Linuxx64 Node24.21/Nvim0.12.5 c8sfo2 uncached, HeadlessShell1248/CfT156.0.8078.4. Report diagnostics advisory. Real volume operations/mounting and affected after-stageQA not established here.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
