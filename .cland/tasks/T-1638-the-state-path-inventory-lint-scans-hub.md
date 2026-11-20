---
id: T-1638
kind: task
title: The state-path inventory lint scans hub source within its T1 budget
state: closed
status: done
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1621
topic: topic-1682
branch: t/T-1638-the-state-path-inventory-lint-scans-hub
created: 2026-11-02T17:05:38.472Z
updated: 2026-11-20T20:52:04.047Z
closed: 2026-11-20T20:52:04.047Z
---

## Summary

`hub/test/state-paths-lint.test.ts` "hub source conforms to the named state path inventory" took 8.459 s on a Linux droplet in stage cover cd742656 (A-15910), against its 5 s T1 budget. Other runs are 1.1–2.2 s. T-1636 added a dated 13 s allowance owned by C-216 that expires 2026-11-09. Before then the scan must fit the budget, and the allowance must be removed.

## What to build

Bound the lint's work: read only the source files the inventory names or can reach, parse each file once, and share the parsed result across assertions, so wall time no longer scales with the whole of hub/src.

## Acceptance criteria

- [x] C1. The lint test runs under 5 s on the Linux droplet in three samples, recorded in the item (test).
  - done: impl-1638 · 2026-11-20T19:16:11.684Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1638-final · 2026-11-20T19:16:39.016Z · commit 55f4cedca4786a0a1e74a410bc00e282e1cd5424
- [x] C2. The T-1636 allowance for this identity is removed from `hub/test/durations.json`.
  - done: impl-1638 · 2026-11-20T17:43:22.455Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1638-source2 · 2026-11-20T17:50:51.398Z · commit 55f4cedca4786a0a1e74a410bc00e282e1cd5424
  - verified: rev-40 [reviewer] · run rev-40-20261120-1638-final · 2026-11-20T19:16:39.016Z · commit 55f4cedca4786a0a1e74a410bc00e282e1cd5424
- [x] C3. The lint still fails a planted unnamed per-user state path (test).
  - done: impl-1638 · 2026-11-20T17:50:05.551Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1638-source2 · 2026-11-20T17:50:51.398Z · commit 55f4cedca4786a0a1e74a410bc00e282e1cd5424
  - verified: rev-40 [reviewer] · run rev-40-20261120-1638-final · 2026-11-20T19:16:39.016Z · commit 55f4cedca4786a0a1e74a410bc00e282e1cd5424

## Comments

### impl-1638 · 2026-11-20T17:39:32.096Z

Consumer search: statePathFindings/scanStatePaths have only hub/test/state-paths-lint.test.ts callers; PATH_EXCEPTIONS is owned by hub/test/state-paths-inventory.ts. No production, wire, raw reader or frozen-help contract changes. Preserving full source discovery avoids hiding new files outside inventory/import reachability. Red regression observed 100 irrelevant files parsed; green now observes zero irrelevant parses, one parse for planted unnamed HOME and escaped /tmp candidates. Local macOS Node v24.21.0: all 8 tests pass; latest inventory test 1.590916458 s at ambient load 6.15 (not Linux C1 evidence). C1 three Linux samples to follow clear review per Coordinator decision.

### rev-35 · 2026-11-20T17:47:33.445Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1638-source-1
commit: c70413ac05397a8d6ef08f736808647f1284a8ed
scope: full
findings: [{"severity":"medium","text":"M1: add Coordinator6eea040b's required actual discovery control for an unnamed candidate outside inventory/import reachability and explicit filter path/command-literal control. The new test calls statePathFindings on supplied strings, so it does not prove scanStatePaths discovery. Missing required proof; no functional false negative observed.","file":"hub/test/state-paths-lint.test.ts","line":6}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22191: Standards0 findings; Spec1 medium proof gap M1. Coordinator6eea040b explicitly accepts complete text discovery with bounded candidate AST parsing, superseding inventory-only reading; design scope itself is accepted. Predicate and structural AST changes reviewed without functional regression; synchronous parser counter/control is pure. JSON comparison proves only the exact12.994s inventory allowance removed; C2 source implementation satisfied, no partial verification mark on not-clear pass. C1 remains pending three literal under5s Linux samples after corrected-head source clear under Coordinator3f9bc7d6. Local A-22186 is authored evidence, not configured/Linux receipt. No Reviewer checks/experiments. Hold released for announced correction; no verification requested at superseded head.

Criteria: C3 failed (Required discovery/filter controls under Coordinator6eea040b are absent at the pinned head; add them and request fresh source review.).

### rev-40 · 2026-11-20T17:50:51.399Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1638-source2
commit: 55f4cedca4786a0a1e74a410bc00e282e1cd5424
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source review clear: Standards 0 findings; Spec 0 findings. Prior M1 resolved by actual detached TS/shell discovery with exact diagnostics and path/command/template/escape filter controls requiring one parse. Conservative candidate filter and single AST preserve existing checks; Coordinator6eea040b scope disposition independently confirmed. C2 exact allowance removal and C3 planted-path detection established. C1 remains unverified: needs three literal under5s producing Linux timings at this head, recorded in item. A-22194 local macOS T1/lint/typecheck evidence does not supply C1 or configured verify. Reviewer performed source inspection only, no tests/browser. Await unchanged-head verification and Linux receipts before final verdict.

Criteria: C2 verified, C3 verified.

### impl-1638 · 2026-11-20T18:21:13.851Z

C1 sample1: run4926e0d4-9434-4c61-bd01-3d69bb88f2b7, A-22211 lines8119–8120 producing pass receipt for hub/test/state-paths-lint.test.ts::hub source conforms to the named state path inventory =1.962321462 seconds (<5s). Head55f4cedca4786a0a1e74a410bc00e282e1cd5424; treec75e2175a9d49eec6d5c2c1fb2061d8bf59f19d0. Linuxx64 6.8.0-149-generic, droplet c-8 ams3, Nodev24.21.0. T0/T1/T2/Web green7130/7130; T3 deferred to merge batch, T4 not run. Browser Chrome Headless Shell1248, Google Chrome for Testing156.0.8078.4. Duration budgets report-only; lint exceeds current0.5s T1 budget while satisfying item's5s criterion. No cache. Droplet lifetime1409s, cost$0.0978. C1 remains pending samples2/3.

### impl-1638 · 2026-11-20T18:48:41.624Z

C1 sample 2: run afff1a7b-2272-4a58-922d-a66fb3b8f302, A-22232 line 8115: hub/test/state-paths-lint.test.ts::hub source conforms to the named state path inventory pass = 1.866961673 s (<5 s). Same head 55f4cedca4786a0a1e74a410bc00e282e1cd5424, tree c75e2175a9d49eec6d5c2c1fb2061d8bf59f19d0. Noncached Linux x64 6.8.0-149-generic, droplet c-8 ams3, Node v24.21.0. Configured T0/T1/T2/Web green 7130/7130, no skips; T3 deferred to merge batch, T4 not executed. Headless Shell 1248 / Google Chrome for Testing 156.0.8078.4. Duration budgets report-only (above current 0.5 s T1 budget, below item 5 s criterion). Lifetime 1428 s; cost $0.0991. Sample 1 retained: A-22211 / 1.962321462 s. C1 has 2 of 3 required samples.

### impl-1638 · 2026-11-20T19:16:11.580Z

C1 sample 3: run bb6e69d8-a045-437c-95c2-0eb5486b00fe, A-22246 line 8115 producing suite timing: hub/test/state-paths-lint.test.ts::hub source conforms to the named state path inventory pass = 1.77932295 s. Head 55f4cedca4786a0a1e74a410bc00e282e1cd5424, tree c75e2175a9d49eec6d5c2c1fb2061d8bf59f19d0, noncached Linux x64 6.8.0-149-generic, Node v24.21.0, droplet c-8 ams3. Configured T0/T1/T2/Web all green, 7130/7130, no skips; T3 deferred to merge batch, T4 unexecuted. Browser Chrome Headless Shell 1248 / Google Chrome for Testing 156.0.8078.4. Duration budgets report-only; this remains above current 0.5 s T1 budget while meeting item's <5 s criterion. Lifetime 1329 s, cost $0.0923. All three independent same-head Linux samples retained: A-22211 1.962321462 s; A-22232 1.866961673 s; A-22246 1.77932295 s. All below 5 s; C1 complete. No source change or dev merge after reviewed head.

### rev-40 · 2026-11-20T19:16:39.016Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1638-final
commit: 55f4cedca4786a0a1e74a410bc00e282e1cd5424
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, no findings. C1 independently checked from structured pass finishes of the exact inventory identity: A-22211/run4926e0d4 line8119 1.962321462s; A-22232/runafff1a7b line8114 1.866961673s; A-22246/runbb6e69d8 line8114 1.77932295s. Each noncached at this head/tree c75e2175a9d49eec6d5c2c1fb2061d8bf59f19d0, Linuxx64 c-8ams3 Node24.21.0. All three samples recorded in item, C1 done. Individual case durations exclude host/setup/other-tests/transfer/machine lifetime and satisfy <5s; report-only 0.5s T1 advisory is still exceeded. C2 allowance removal/C3 planted-path detection retain source2 proof, with positive third-run discovery/filter control finishes. All three configured T0/T1/T2/Web exit0, aggregate7130pass zero fail/cancel/skip; T3 deferred to merge batch, T4 unexecuted. Web Chrome Headless Shell1248 / CfT156.0.8078.4; host gate at admitted tree not repeated remotely, budgets/lint report-only. Reviewer ran no tests/native/browser.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-20T20:52:04.047Z

Merged 23c0612a4b29c7840b312f8efb4e4d8a209c2e0d onto dev.
