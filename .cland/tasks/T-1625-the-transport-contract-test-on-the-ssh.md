---
id: T-1625
kind: task
title: The transport contract test on the ssh carrier and the fake transport
state: open
status: review
size: M
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1623
  - T-1595
  - T-1589
topic: topic-1361
branch: t/T-1625-the-transport-contract-test-on-the-ssh
created: 2026-11-02T03:34:18.725Z
updated: 2026-11-03T06:06:54.671Z
---

## Summary

A shared contract suite names the four host-side sockets (`hub.sock`, `spoke.sock`, `git.sock`, `agent.sock`) as what a transport must carry. It runs against the `ssh` carrier, driven by E-1532's fake sshd stand-in, and against the fake transport, with stub endpoints on both sides. The suite proves relay, socket placement, no TCP and reconnect, so a 0.4.x `outbound` carrier can pass the same suite unchanged.

Hot files: new `hub/test/transport-contract.ts`, new `hub/test/transport-ssh-contract.test.ts`, new `hub/test/transport-fake-contract.test.ts`, new `docs/agents/tests/hub-test-transport-contract.md`; reads but never edits E-1532's transport, carrier and fake transport

## Acceptance criteria

- [x] C1. The contract exports one list naming `hub.sock`, `spoke.sock`, `git.sock` and `agent.sock` as the transport's host-side endpoints, for a later carrier to import (test).
  - done: impl-1625 · 2026-11-03T05:44:15.032Z
- [x] C2. Once connected, each of the four is a Unix socket in the host's agent-owned run directory at mode 0700 (test).
  - done: impl-1625 · 2026-11-03T05:44:15.182Z
- [x] C3. Bytes cross each endpoint both ways: `hub.sock`, `spoke.sock` and `git.sock` from the host to stub listeners on the hub's side, and `agent.sock` from the hub's side to a stub host agent (test).
  - done: impl-1625 · 2026-11-03T05:44:15.296Z
- [x] C4. After the carrier drops and reconnects, all four endpoints answer again (test).
  - done: impl-1625 · 2026-11-03T05:44:15.997Z
- [x] C5. Neither side binds a TCP port for any of the four endpoints (test).
  - done: impl-1625 · 2026-11-03T05:44:16.107Z
- [x] C6. Each carrier reports its kind through the transport kind type of ticket 9 (test).
  - done: impl-1625 · 2026-11-03T05:44:16.223Z
- [x] C7. The suite passes on the `ssh` carrier with the fake sshd stand-in and on the fake transport, with no real network or remote machine (test).
  - done: impl-1625 · 2026-11-03T06:06:17.582Z
- [x] C8. The contract's guide states what a second carrier must pass to replace `ssh`, naming `outbound` (0.4.x) as the expected one.
  - done: impl-1625 · 2026-11-03T05:44:16.567Z
  - verified: rev-35 [reviewer] · run rev-35-1625-source-1 · 2026-11-03T05:46:52.996Z · commit 5a97036c8189a781d266f1396a309e31f6dfc696
  - verified: rev-35 [reviewer] · run rev-35-1625-source-2 · 2026-11-03T06:06:54.671Z · commit 4b50ce3ad6528bd4180c2bf55ad7114d816e8234

## Notes

Shared files: see Hot files

## Comments

### impl-1625 · 2026-11-03T05:42:13.295Z

Contract design: exported TRANSPORT_ENDPOINTS and carrier-neutral fixture factory; both named entry files bind the same approved SshTransport/fake-SSH pairing (A-15561), not a second in-process carrier. Production Transport, ssh carrier, fake host and stand-in remain unchanged. C2 interprets 0700 as the agent-owned run directory (socket nodes 0600). Native C5 positive control detects a transient loopback listener before carrier start; subsequent scans cover worker and scratch-root children. No shared production contract changes; consumers added here are the two entry files and fixture helper.

### impl-1625 · 2026-11-03T05:43:20.732Z

Coordinator decision 3ef5f1e: hot-file guide path changed from docs/agents/tests/hub-test-transport-contract.md to docs/agents/tests/hub-test-transport-ssh-contract.test.ts.md; fake entry pointer at docs/agents/tests/hub-test-transport-fake-contract.test.ts.md. The original requested name is rejected by the existing guide index lint, which requires exact *.test.ts heading/filename matching. Generator/lint unchanged; C8 still covered without criterion changes.

### rev-35 · 2026-11-03T05:46:52.996Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1625-source-1
commit: 5a97036c8189a781d266f1396a309e31f6dfc696
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards/Spec zero findings. Single exported endpoint list/shared suite; both T3 entries use same approved SshTransport+stand-in pairing per independently read A-15561. Production carrier/interface/fakes untouched. Contract retains exact endpoint replies, stub byte receipts, Unix socket/private run assertions, actual master drop and final post-reconnect exchanges. Native TCP scanner has pre-start planted listener positive control, then checks worker/live carrier children; Linux branch remains runtime-unverified. Fixture sealed disposable root/cwd and stop/drain/peer/listener/storage/root cleanup reviewed. C8 guide established/verified, including outbound0.4.x and standard paths approved by Coordinator3ef5f1e0. C1–C7 unverified pending fresh same-head mode-free verify and actual named contract/unchanged carrier outcomes. Local A-16185 macOS summaries not queued/Linux evidence. QA full after-stage separate. Reviewer ran no tests/probes/browser/checks/edits. Detail A-16186: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16186-t-1625-source-review-reusable-transport-contract.md.

Criteria: C8 verified.

### rev-35 · 2026-11-03T06:04:32.557Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1625-evidence-1
commit: 5a97036c8189a781d266f1396a309e31f6dfc696
scope: evidence
findings: [{"severity":"medium","text":"Shared helper calls node:test, so Node attributes generated identities to transport-contract.ts. Load gate reruns that helper, which alone registers no tests; both required contract identities report0/5 despite ordinary body passes. Register from actual .test.ts entry files while retaining shared assertions/load repetitions (hostContract's register callback is an existing pattern).","file":"hub/test/transport-contract.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Exact-head edce9e0b/A-16187 overall/T3 exit1. Actual output: both `load gate: hub/test/transport-contract.ts::<contract name> 0/5 passed`; ordinary contract bodies pass but helper-only reruns have no named test receipt. Source/event-file trace confirms registration at helper22 causes rerun target mismatch; not classified as Linux scanner or duration failure. T0/T1/allT2 completed, Web unexecuted; remainingT3 deferred,T4 unexecuted. C7 failed; C1–C6 remain unverified, C8 prior source mark unaffected. Uncached Linuxx64 c-8lon1 Node24.21/Nvim0.12.5, tree4e7cb425b12dfa6cf4194c2604fc4ec13bbb8e5e; browser null. Report-only budgets/lint not cause. Fresh corrected-head source review before another verify. Reviewer read only. Detail A-16188: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16188-t-1625-evidence-not-clear-shared-registration-points-reruns-at-helper.md.

Criteria: C7 failed (Both contract entries fail load-gate execution0/5 because generated identities point at helper that registers no tests when rerun.).

### impl-1625 · 2026-11-03T06:05:40.819Z

Fixed replay attribution in 4b50ce3ad6528bd4180c2bf55ad7114d816e8234 (pushed). Both entry files now own test() registration; shared transportContract is async assertions only. Production runLoadGate API probe locally on macOS/Node 24.21.0 returned 5/5 for each exact entry-file identity, ten targeted executions, no synthetic background load. A-16189 contains reproduction and receipts. No production carrier/fake/runner edits or dev merge. Fresh source review follows static checks; prior Linux run remains failed overall.

### rev-35 · 2026-11-03T06:06:54.671Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1625-source-2
commit: 4b50ce3ad6528bd4180c2bf55ad7114d816e8234
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-16188 medium finding resolved, no findings. Both .test.ts entries own test() registration/name/20s bound; shared async transportContract(t,fixture) owns assertions only. Exact delta retains all assertion bodies, fixture/carrier/fakes/runner/tier policy unchanged. Guide/CHANGES explain runnable entry identities; C8 source verified. A-16189 local production runLoadGate5/5 each on macOS Node24.21 workers1/no synthetic load is supplemental candidate-fix evidence, not queued/Linux. C1–C7 runtime-unverified until fresh same-head mode-free verify; A-16187 remains failed history. Full after-stage QA separate. Reviewer read only, no tests/probes/browser/edits. Detail A-16190: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16190-t-1625-corrected-source-review-entry-owned-registration.md.

Criteria: C8 verified.
