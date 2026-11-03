---
id: T-1657
kind: task
title: registerFakeHosts reads host keys at the fake-host root, but createFakeHost now writes them behind the short-socket alias
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1365
branch: t/T-1657-registerfakehosts-reads-host-keys-at-the
created: 2026-11-03T05:54:51.539Z
updated: 2026-11-03T07:48:12.123Z
---

## Summary

T-1653 (macOS socket fixture fix) moved fake-host directories behind the short-socket alias. For `CLAND_FAKE_HOST_ROOT=R` and host `one`, `createFakeHost` now writes `<realpath(/tmp)>/ct-<32hex>/one/host-key.pub`, which resolves to `<realpath(R)>/.fixture-sockets/one/host-key.pub`. The hub's `registerFakeHosts` (hub/src/host/records.ts:119–120) still reads `R/one/host-key.pub` and points `clientKeyPath` at `R/one/client-key`, so a hub started on a fresh `createFakeHost` root throws ENOENT. Nothing hits this today, because host-records.test.ts writes keys by hand, but E-1532 stage 3 (the ssh Host and the remote spoke) will. Confirmed from source by impl-1653.

## What to build

One shared resolver for the fake-host directory, used by both `createFakeHost` and `registerFakeHosts`, so a hub started on a `createFakeHost` root registers every host with the right public key and client-key path. Socket paths stay within the macOS 104-byte limit.

## Acceptance criteria

- [x] C1. A hub started with `CLAND_FAKE_HOST_ROOT` pointing at a fresh `createFakeHost` root registers each fake host with the key `createFakeHost` wrote and a client-key path that exists (test).
  - done: impl-1657 · 2026-11-03T07:23:30.182Z
  - verified: rev-35 [reviewer] · run rev-35-1657-final-1 · 2026-11-03T07:48:11.990Z · commit acf4fecadfae3af59aa8a482abfc1ccacb1a078f
- [x] C2. The same test passes with TMPDIR at a `/private/tmp/cland-suite-<36-char uuid>` root on macOS (test).
  - done: impl-1657 · 2026-11-03T07:23:30.385Z
  - verified: rev-35 [reviewer] · run rev-35-1657-final-1 · 2026-11-03T07:48:11.990Z · commit acf4fecadfae3af59aa8a482abfc1ccacb1a078f

## Comments

### impl-1657 · 2026-11-03T07:22:01.626Z

Consumer audit (hostDirectory, CLAND_FAKE_HOST_ROOT, host-key.pub): registerFakeHosts was the mismatched reader; createFakeHost/fakeHost now share neutral shared/fake-host-directory.ts with it. fake-ssh-common reads returned directory and is unaffected; fake-ssh, transport-ssh, host-agent-files, host-supervisor and fixture-socket-path use createFakeHost or its existing hostDirectory compatibility export. host-records manual layout migrated to createFakeHost. Docs: host-records/fake-ssh test guidance and host fixture subsystem reference describe layout; stage-2 QA mentions resolver without constructing keys. No wire shape change. Red on macOS Node 24.21.0: host-records 8/10, both fresh-root startup cases fail ENOENT opening fake/f1/host-key.pub, including /private/tmp/cland-suite-<UUID>/cland-proj-*/fake/f1/host-key.pub. Embedded projectHub only, no spawned native processes.

### rev-35 · 2026-11-03T07:25:18.410Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1657-source-1
commit: acf4fecadfae3af59aa8a482abfc1ccacb1a078f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards/Spec zero findings. Existing hostDirectory logic moves unchanged to neutral shared module, imported by startup and fixture; compatibility re-export retained. Both-controls/absolute-root/id validation and skip-existing/revoked behavior unchanged. Tests use actual fresh two-host fixtures, exact pins/client-key path+contents and byte limits, including explicit macOS UUID-TMPDIR branch; missing-control and redaction assertions retained. Matching docs migrate obsolete layout; no wire/schema/tier/permission change. C1/C2 runtime-unverified pending fresh exact-head mode-free verify plus named macOS long-root receipt/native exit/source linkage; A-16203 local working-tree summary is supplemental. Reviewer read only, no tests/probes/browser/checks/edits. Affected after-stage QA separate. Detail A-16205: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16205-t-1657-source-review-shared-fake-host-directory-resolution.md.

### rev-35 · 2026-11-03T07:48:11.990Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1657-final-1
commit: acf4fecadfae3af59aa8a482abfc1ccacb1a078f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified, no findings. Same-head1149aa9b/A-16220 exit0,4908 pass/zero fail/cancel/skip/todo. Independently checked host-records10/helper4 ordinary outcomes, fresh enabled/suite-tmpdir cases and exactly5 Linux suite-tmpdir load passes. A-16207 pins reviewed head and raw macOSarm64 Node24.21 native exit0 with all10 named cases including actual /private/tmp UUID branch; C2 is established from that macOS receipt, not inferred from Linux. Exact pins/client-key bytes/path existence/socket limits retained. T0/T1/allT2/Web completed; T3 merge-batch deferred,T4 unexecuted. Uncached Linuxx64 c-8lon1 Node24.21/Nvim0.12.5, runner tree9751558710cf7d5cf53e621331a3be16b3162bde, isolated HeadlessShell1248/Chrome156.0.8078.4. Budget/lint/incomplete ratchet/skip checks report-only, skips[]/missing0. Affected after-stage QA separate. Reviewer read only. Detail A-16221: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16221-t-1657-final-evidence-fresh-fake-host-startup-on-both-platforms.md.

Criteria: C1 verified, C2 verified.
