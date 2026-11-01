---
id: T-1542
kind: task
title: The Host interface and the local host's process operations
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by: []
topic: topic-1286
branch: t/T-1542-the-host-interface-and-the-local-host-s
created: 2026-10-31T23:47:40.429Z
updated: 2026-11-01T00:36:59.720Z
closed: 2026-11-01T00:36:59.720Z
---

## Summary

Declare the Host interface with its process operations: a detached spawn with an environment and a working directory, a short command with its output, birth identity, liveness, stop of a process tree by birth identity, and the process table with memory and CPU per tree. The `local` host implements them by delegating to today's functions, and a reusable contract suite, parametrised by a Host factory, runs against it.

Hot files: `hub/src/host/host.ts` (new), `hub/src/host/local.ts` (new), `hub/test/host-contract.ts` (new), `hub/test/host-local-contract.test.ts` (new); possibly `hub/src/process-table.ts` (the `ps` columns for RSS and CPU)

## Acceptance criteria

- [x] C1. `hub/src/host/host.ts` exports an interface `Host` with `name` and the operations spawn, run, identity, alive, stop and processes, under the hub's tsconfig, with no enum, namespace, parameter property or new dependency.
  - done: impl-1542 · 2026-10-31T23:53:37.591Z
  - verified: rev-36 [reviewer] · run rev-36-1542-source-1 · 2026-10-31T23:54:48.499Z · commit 3ef60f27ce7074aaa4441201ff123c2e69e8bb9c
  - verified: rev-36 [reviewer] · run rev-36-1542-source-2 · 2026-11-01T00:10:48.493Z · commit 6ac8538bd2aef255bf7bf04989079a0ecffa34d1
  - verified: rev-36 [reviewer] · run rev-36-1542-final-1 · 2026-11-01T00:28:19.784Z · commit 6ac8538bd2aef255bf7bf04989079a0ecffa34d1
  - verified: rev-36 [reviewer] · run rev-36-1542-delta-1 · 2026-11-01T00:30:13.604Z · commit 96e09680c32c2a4cc0860fdde330f791f684940f
- [x] C2. A contract suite in `hub/test/host-contract.ts` takes a Host factory, has at least one case per operation, and the `local` host passes every case (test).
  - done: impl-1542 · 2026-11-01T00:10:22.360Z
  - verified: rev-36 [reviewer] · run rev-36-1542-final-1 · 2026-11-01T00:28:19.784Z · commit 6ac8538bd2aef255bf7bf04989079a0ecffa34d1
  - verified: rev-36 [reviewer] · run rev-36-1542-delta-1 · 2026-11-01T00:30:13.604Z · commit 96e09680c32c2a4cc0860fdde330f791f684940f
- [x] C3. The spawn case shows a child in its own session and process group that gets the given environment and working directory, outlives the caller's handle, and carries no environment value in its argv (test).
  - done: impl-1542 · 2026-10-31T23:53:38.757Z
  - verified: rev-36 [reviewer] · run rev-36-1542-final-1 · 2026-11-01T00:28:19.784Z · commit 6ac8538bd2aef255bf7bf04989079a0ecffa34d1
  - verified: rev-36 [reviewer] · run rev-36-1542-delta-1 · 2026-11-01T00:30:13.604Z · commit 96e09680c32c2a4cc0860fdde330f791f684940f
- [x] C4. The liveness and stop cases show that a reused pid with another birth identity is not alive and is never signalled, and that a row with only a legacy `pid_started` keeps today's answer (test).
  - done: impl-1542 · 2026-10-31T23:53:39.449Z
  - verified: rev-36 [reviewer] · run rev-36-1542-final-1 · 2026-11-01T00:28:19.784Z · commit 6ac8538bd2aef255bf7bf04989079a0ecffa34d1
  - verified: rev-36 [reviewer] · run rev-36-1542-delta-1 · 2026-11-01T00:30:13.604Z · commit 96e09680c32c2a4cc0860fdde330f791f684940f
- [x] C5. The processes case reports, for a spawned parent with a child, the resident memory and CPU of the whole tree under the parent's pid (test).
  - done: impl-1542 · 2026-10-31T23:53:39.743Z
  - verified: rev-36 [reviewer] · run rev-36-1542-final-1 · 2026-11-01T00:28:19.784Z · commit 6ac8538bd2aef255bf7bf04989079a0ecffa34d1
  - verified: rev-36 [reviewer] · run rev-36-1542-delta-1 · 2026-11-01T00:30:13.604Z · commit 96e09680c32c2a4cc0860fdde330f791f684940f
- [x] C6. The `local` host's identity, alive and stop delegate to `processIdentityAsync`, `processAlive`, `sameProcess` and `endProcess`, and `process-identity.test.ts`, `system-processes.test.ts` and `session-async-processes.test.ts` pass with no test edited.
  - done: impl-1542 · 2026-10-31T23:53:40.430Z
  - verified: rev-36 [reviewer] · run rev-36-1542-final-1 · 2026-11-01T00:28:19.784Z · commit 6ac8538bd2aef255bf7bf04989079a0ecffa34d1
  - verified: rev-36 [reviewer] · run rev-36-1542-delta-1 · 2026-11-01T00:30:13.604Z · commit 96e09680c32c2a4cc0860fdde330f791f684940f

## Comments

### impl-1542 · 2026-10-31T23:49:19.477Z

Seams fixed by C1–C6: reusable Host factory contract with native disposable processes, plus unedited process-identity.test.ts, system-processes.test.ts and session-async-processes.test.ts. Consumer audit: Host is new (no existing callers); avoid modifying shared SystemProcess/ps format so production system-processes, adapters/sessions, orphans, fixture-processes, stdio-writers, suite-isolation, process-cleanup and all recorded ps fixtures remain unchanged. Host resource collection will use its own explicit RSS/CPU projection.

### impl-1542 · 2026-10-31T23:52:11.861Z

Additional contract audit: doctor/report.run adds an optional eighth cwd; prior positional arguments/defaults and RunResult remain unchanged. Searched function/import/type references across production, tests, shipped skills, qa and docs. Existing consumers in doctor, lock, process-identity/system-processes, process-paths, suite-lock, git-maintenance(-owner), setup machine/handover/account-identity, CLI doctor, fixture-processes/orphans and doctor fixtures/tests are unaffected by omitted cwd. No wire, persisted shape or existing ps dialect changes. New Host API has only the local implementation and contract suite as consumers; subsequent epic items migrate callers.

### rev-36 · 2026-10-31T23:54:48.499Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1542-source-1
commit: 3ef60f27ce7074aaa4441201ff123c2e69e8bb9c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review clear at 3ef60f27ce7074aaa4441201ff123c2e69e8bb9c. Standards: no findings. Spec: no findings. Host operations, production delegation, native contract design, unchanged regression files and matching docs reviewed. C1 verified by source; C2–C6 remain unverified pending same-head post-verdict run evidence. No tests or browsers executed by this Reviewer; A-15103 is preliminary implementer-reported targeted macOS evidence, not a full suite. Final review pending.

Criteria: C1 verified.

### rev-36 · 2026-11-01T00:09:15.822Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1542-evidence-1
commit: 3ef60f27ce7074aaa4441201ff123c2e69e8bb9c
scope: evidence
findings: [{"severity":"medium","text":"Helper-local top-level registration attributes generated cases to non-executable host-contract.ts; load-gate replay launches that helper without calling hostContract, yielding 0/5 passing receipts for all three identities.","file":"hub/test/host-contract.ts","line":13}]
finding_counts: {"high":0,"medium":1,"low":0}

Medium — hub/test/host-contract.ts:13: generated identities point to the helper rather than executable wrapper, so required load-gate replay finds no test receipt. A-15116 actual output: `✖ load gate: hub/test/host-contract.ts::Host run returns output and exit status with the supplied cwd and environment 0/5 passed`; spawn and tree resources also 0/5. Base cases passed, but suite 21753a25-b0fe-4a07-8c96-99b8543c0027 ended exit 1 at reviewed head. T0–T2 completed exit 0; changed T3 failed, Web and remaining T3 not established. Linux x64 droplet, Node v24.21.0; uncached, browser binary unknown/unexecuted. C2 failed; C3–C6 left unverified. Fix registration/replay integration and obtain fresh source review before another verify.

Criteria: C2 failed (Contract base cases pass, but all three generated identities have 0/5 load-gate receipts because replay executes the registration helper without its factory invocation.).

### rev-36 · 2026-11-01T00:10:48.493Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1542-source-2
commit: 6ac8538bd2aef255bf7bf04989079a0ecffa34d1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Refreshed source review clear. Standards: no findings. Spec: no findings. Previous registration/replay medium finding resolved: hostContract receives a registrar implemented in the executable wrapper, so Node test locations point to that replayable entry. Inspected all changes from reviewed 3ef60f27; only registrar/wrapper and matching test docs changed, production and assertions unchanged. A-15118 records targeted macOS reporter and exact-name replay receipts; these do not replace a fresh same-head verification. C1 verified at 6ac8538bd2aef255bf7bf04989079a0ecffa34d1; C2–C6 await post-verdict run evidence. Reviewer ran no tests or browsers.

Criteria: C1 verified.

### rev-36 · 2026-11-01T00:28:19.784Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1542-final-1
commit: 6ac8538bd2aef255bf7bf04989079a0ecffa34d1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear at unchanged reviewed head 6ac8538bd2aef255bf7bf04989079a0ecffa34d1. Standards/spec: no findings. C1–C6 verified. A-15128 uncached Linux x64 droplet/Node v24.21.0 completed T0/T1/T2, changed Host T3 and Web exit 0 (4524 pass); all three generated Host wrapper identities have passing receipts, as do process-identity (6) and session-async-processes (3). A-15129 supplies same-head unchanged system-processes.test.ts 57/57 passing on local Darwin arm64/Node v24.21.0. Browser: isolated chromium_headless_shell-1248, Google Chrome for Testing 156.0.8078.4. Remaining T3 deferred; no T4 selected; this is required task coverage, not a complete T3/T4 run. Budget/ratchet/skip checks report mode. Prior failed A-15116 remains failed. Reviewer ran no tests or browsers.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-36 · 2026-11-01T00:30:13.604Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1542-delta-1
commit: 96e09680c32c2a4cc0860fdde330f791f684940f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta review clear at authorized merge 96e09680c32c2a4cc0860fdde330f791f684940f. Standards/spec: no findings. Independently checked Coordinator decision f1b2e9de-60bd-4a6b-b02a-33238b8f2c4e, combined docs-only conflict resolution, unchanged Host production/tests and identifier search (same three files, no Neovim matches). A-15131 supplies merged-head local Darwin arm64/Node v24.21.0 waiver checks: typecheck exit 0, Host 3/3, WebAuthn 11/11, lint exit 0/zero refusals with 122 report-only findings. C1–C6 carried forward under that explicit docs-only waiver and prior final review. No full verify ran at this merge head; A-15128 Linux task-selected pass and A-15129 targeted macOS regression remain parent-head evidence, not merged-head execution. Reviewer ran no tests/browser.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-01T00:36:59.720Z

Merged 90343cbfec8429dc180120720dc85fff832bb4a2 onto dev.
