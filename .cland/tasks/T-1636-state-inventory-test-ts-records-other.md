---
id: T-1636
kind: task
title: state-inventory.test.ts records other test files' writes under the shared suite TMPDIR
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1621
topic: topic-1345
branch: t/T-1636-state-inventory-test-ts-records-other
created: 2026-11-02T16:36:06.327Z
updated: 2026-11-02T18:23:00.031Z
closed: 2026-11-02T18:23:00.031Z
---

## Summary

The E-1532/E-1536 macOS stage cover 2d036b1d (dev ad295a54, log A-15905, 4 workers, peak load 15) failed one T2 test: `hub/test/state-inventory.test.ts:19` "hub state writes stay in scratch HOME with a fake-provider lease and fake harness". The `unexpected(writes)` list held `/private/tmp/cland-suite-5b41c873-…`, `…/.h6dec45` and `…/cland-spoke-2a0cc832334b9694.sock`. Those paths sit under the suite's shared TMPDIR root and belong to other test files. The test passes 5/5 alone on macOS, including once with a suite-style `TMPDIR`. Linux batches (2 workers) have passed it.

Likely cause: the test wraps `fs` write functions for the whole process. When the runner shares a process or a TMPDIR root across files, writes by other tests during its window count as its own.

## What to build

Attribute writes to this test only. Either run the file process-isolated and give it its own TMPDIR subdirectory, or filter recorded writes to those under the test's own scratch roots plus the explicit outside-HOME allow-list. Keep the positive controls (ledger write, transient lock).

## Acceptance criteria

- [x] C1. A regression test runs a concurrent writer under the shared suite TMPDIR during the inventory window, and the inventory test stays green (test).
  - done: impl-1636 · 2026-11-02T17:07:04.337Z
  - verified: rev-36 [reviewer] · run rev-36-1636-final-1 · 2026-11-02T17:32:51.549Z · commit cb286c1de8fbb4edb2253c36f279c378ee1bf95f
- [x] C2. A write by the hub under test outside HOME and the allow-list still fails the test (test).
  - done: impl-1636 · 2026-11-02T17:07:04.454Z
  - verified: rev-36 [reviewer] · run rev-36-1636-final-1 · 2026-11-02T17:32:51.549Z · commit cb286c1de8fbb4edb2253c36f279c378ee1bf95f
- [x] C3. hub/test/state-paths-lint.test.ts 'hub source conforms to the named state path inventory' fits its T1 budget on the Linux droplet (8.459 s > 5 s enforced in the stage cover A-15910): the scan is made bounded and faster, or it gets a dated durations.json allowance under the budget rules (category owner, ≤31 days) sized from several droplet samples (test)
  - done: impl-1636 · 2026-11-02T17:07:04.537Z
  - verified: rev-36 [reviewer] · run rev-36-1636-final-1 · 2026-11-02T17:32:51.549Z · commit cb286c1de8fbb4edb2253c36f279c378ee1bf95f

## Comments

### impl-1636 · 2026-11-02T17:06:51.579Z

Implementation and C1 red/green evidence: A-15916 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15916-t-1636-targeted-red-green-evidence.md). Four explicit files at macOS 4 workers passed 28/28; both regression cases retain ledger/lock controls. No shared production contracts changed. C3 uses Coordinator-approved 13s allowance C-216 Nov 2–9; T-1638 owns optimization/removal. npm run typecheck and npm run test:lint completed exit 0 (lint report-only existing findings, zero refusals).

### rev-36 · 2026-11-02T17:08:53.875Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1636-source-1
commit: cb286c1de8fbb4edb2253c36f279c378ee1bf95f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Owned async context excludes observed/durably written sibling input but hub database callback escape still rejects exact stray. SQLite/stream/ledger/transient-lock controls and joined cleanup retained. Exact successful production-layout socket publication grants staging/target/parent only, no TMPDIR subtree exception. Coordinator-approved13s scan allowance C216 open category Nov2–9 has samples/reason/T1638 removal owner; checker unchanged. C1–C3 remain run-dependent pending exact-head mode-free Linux inventory/state-path outcomes and fresh scan timing/allowance result. A15916 earlier four-fileMac28 predates final minor cleanup; request final2/static summaries supplemental. No Reviewer execution.

### rev-36 · 2026-11-02T17:32:51.549Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1636-final-1
commit: cb286c1de8fbb4edb2253c36f279c378ee1bf95f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1–C3 verified, no findings. Independently streamed exact-head uncached A-15924/run1bf44a01 exit0,4817/4817. Inventory base passes0.646s; hub-owned escape case0.321s plus load5/5; reviewed sibling/escape/SQLite/stream/ledger/lock assertions retained. Full-source Linux scan2.028372202s below original5/approved13; four planted lint controls/state-path1/spend20 pass. This task runs budget/lint/ratchet/skip in report mode, not enforcing cover; allowance source-valid C216 Nov2–9. Linux x64 c8sfo2 Node24.21/Neovim0.12.5 T0/T1/fallback allT2/Web complete, T3batch/T4 unexecuted; isolated HeadlessShell1248 Chrome156.0.8078.4, skipsmissing0. No Reviewer execution/QA required.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-02T18:23:00.031Z

Merged ef7b25068a75c9166e3134a59465a4bdfdd449a0 onto dev.
