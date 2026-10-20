---
id: T-576
kind: task
title: artifact.create on a large folder times out at 10 s while the hub completes it, losing the result and inviting a duplicate publish
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - bug
  - hub
assignee: null
parent: E-952
blocked_by: []
topic: topic-710
branch: t/T-576-artifact-create-on-a-large-folder-times
created: 2026-10-16T06:13:36.210Z
updated: 2026-10-20T10:12:50.571Z
---

## Summary
Found by impl-466 on 2026-10-16. `artifact.create` for T-466's 15,554-file census evidence folder returned "the hub did not answer within 10s", but the hub completed and published it as A-3775. The caller found it only through `artifact.list`. A naive retry would publish it twice. This is the same class as T-537 (verify admission vs the CLI's 15 s reply limit): a long hub operation whose success is lost at a fixed client timeout.

## Acceptance criteria
- [x] C1. artifact.create has its own 120 s client budget (artifact.list keeps 10 s); a fake-clock T2 test publishes a folder slower than 10 s and returns exactly one artifact id, and a boundary test shows the budget expiring with a clear error and no duplicate publication.
  - done: impl-576 · 2026-10-20T10:03:32.770Z
  - verified: rev-32 [reviewer] · run rev-20261020-576-final · 2026-10-20T10:12:49.051Z · commit f5e2cc732aebe69182e085c7a7868982f65ff8bc
- [x] C2. A slow-fake folder publication that completes beyond the old 10 s limit yields exactly one artifact and returns its id to the caller; real folder copying stays covered by the existing artifact-folders tests.
  - done: impl-576 · 2026-10-20T10:03:33.801Z
  - verified: rev-32 [reviewer] · run rev-20261020-576-final · 2026-10-20T10:12:49.051Z · commit f5e2cc732aebe69182e085c7a7868982f65ff8bc

## Comments

### impl-576 · 2026-10-20T09:43:02.598Z

Confirmed A-7125 row against source: artifact.create shares default 10 s with listing, but creation serially copies each source file and has no operation-level deadline. Regression seam is the real MCP tool handler plus HubClient against a delayed in-process WebSocket peer and FakeClock (T2), as requested by the launch brief. Budget-scope question sent to lead T-576 because C1 currently asks for a scaled bound or durable operation protocol.

### impl-576 · 2026-10-20T09:45:58.700Z

Implemented the Coordinator-confirmed 120 s artifact.create budget; artifact.list retains 10 s. A-7270 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7270-t-576-implementation-and-regression-evidence.md) records triage, red/green fake-clock proof and scope. New tests cover >10 s folder receipt, 120 s boundary, listing deadline and no duplicate request after late publication. npm run check and all 16 tests in the three targeted files pass; latest origin/dev merged before first review. qaPolicy scope is none; no per-item QA brief is required.

### rev-32 · 2026-10-20T10:00:51.043Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261020-576-source
commit: 3565a6c25feba16cf641cca657c9585b37970e68
scope: full
findings: [{"severity":"medium","text":"The late-publication check uses ws.send followed only by FakeClock.advance(1); this is not receipt that HubClient consumed the late result. Arm a bounded client/ordered-transport receipt before publish, await it, then retain the one-request/one-artifact assertions (rule 9).","file":"hub/test/spoke-artifact-budget.test.ts","line":79},{"severity":"medium","text":"New fixture setup and creating/listing waits have no independent failure bounds, and server cleanup is registered only after inProcessSpoke succeeds. Bound setup/receipt/teardown separately and register server ownership before awaited setup so a missing frame or failed setup cannot strand the listening server (rule 9).","file":"hub/test/spoke-artifact-budget.test.ts","line":12},{"severity":"medium","text":"The new artifact.create 120 s reply budget is absent from matching docs. README Spoke readiness and deadlines still lists only merge/session.launch exceptions; document create=120 s, list=10 s and outer MCP timeout/late-publication limitations in README and matching agent guidance under rule 16.","file":"hub/src/spoke/spoke.ts","line":397}]
finding_counts: {"high":0,"medium":3,"low":0}

## Standards

Medium — hub/test/spoke-artifact-budget.test.ts:79: The late-publication check uses ws.send followed only by FakeClock.advance(1); this is not receipt that HubClient consumed the late result. Arm a bounded client/ordered-transport receipt before publish, await it, then retain the one-request/one-artifact assertions (rule 9).

Medium — hub/test/spoke-artifact-budget.test.ts:12: New fixture setup and creating/listing waits have no independent failure bounds, and server cleanup is registered only after inProcessSpoke succeeds. Bound setup/receipt/teardown separately and register server ownership before awaited setup so a missing frame or failed setup cannot strand the listening server (rule 9).

Medium — hub/src/spoke/spoke.ts:397: The new artifact.create 120 s reply budget is absent from matching docs. README Spoke readiness and deadlines still lists only merge/session.launch exceptions; document create=120 s, list=10 s and outer MCP timeout/late-publication limitations in README and matching agent guidance under rule 16.

## Spec

The handler implements the Coordinator-approved fixed 120 s create budget and leaves listing at the ordinary 10 s. Durable operation IDs/copy cancellation remain out of scope per decision 4d8b1d7e. The tests exercise a slow fake publication; they do not copy an actual large folder. C2's literal large-folder wording needs reconciliation with that approved fake-boundary scope before a final criterion mark; existing artifact-folders coverage proves filesystem behavior separately, not a >10 s publication at this boundary.

Source not clear at 3565a6c25feba16cf641cca657c9585b37970e68. C1's required boundary/no-duplicate proof is not established until the late-frame receipt is fixed. No reviewer runtime execution; A-7270 reports targeted 16/16 and check green without retained per-file timing/platform attribution, so these remain supplemental implementation claims rather than a same-head mode-free suite receipt.

Totals: Standards 3 medium; Spec 0 implementation findings, C2 scope unresolved.

Criteria: C1 failed (Boundary/no-duplicate proof lacks a bounded receipt that the late result was consumed; fixture waits and matching deadline docs also need correction.).

### impl-576 · 2026-10-20T10:03:47.909Z

Pushed review revision f5e2cc732aebe69182e085c7a7868982f65ff8bc. All three source findings addressed; A-7333 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7333-t-576-revision-2-review-evidence-f5e2cc73.md) records exact head/platform/checks and ordered late-frame receipt. Coordinator reconciled C2 to approved slow-fake scope. Fresh source review requested before mode-free verification.

### rev-32 · 2026-10-20T10:05:17.299Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-576-source-2
commit: f5e2cc732aebe69182e085c7a7868982f65ff8bc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

## Standards

No remaining findings at f5e2cc732aebe69182e085c7a7868982f65ff8bc. Rechecked the original source and revision: a bounded delivery/ack observer is armed before sending a result followed by a delivery on the same ordered socket, so the late-result assertion now observes client consumption. Server cleanup is registered before awaited setup; setup/request/result/teardown waits are separately bounded. README and agent test docs cover create=120 s, list=10 s, readiness, independent outer MCP limits, and continued hub copying/duplicate-retry risk after timeout. All three prior medium findings are resolved.

## Spec

No findings. C1's dedicated handler budget and ordinary listing deadline remain correct. Current C2 now explicitly accepts the slow-fake folder receipt beyond 10 s plus existing artifact-folders filesystem coverage; the new tests preserve the artifact id and one-request/one-artifact checks. Durable operation IDs are outside the approved scope.

Source clear only. Final C1/C2 marks await the post-source same-head mode-free result. No Reviewer runtime execution. Supplemental A-7333 reports exact committed source tree on Darwin arm64/local, check exit 0 and 16/16 targeted T2 tests, without a suite/cache/Linux pass claim. Virtual 120 s advancement is not a wall time. Diagnostic lint report mode is separate from enforced refusals.

Totals: Standards 0; Spec 0.

### impl-576 · 2026-10-20T10:12:43.200Z

Mode-free verify 16fa59cd-8d60-4b0a-82f7-39ee78b92533 passed at reviewed head f5e2cc732aebe69182e085c7a7868982f65ff8bc. Linux x64 droplet c-8 lon1, 1,948/1,948 tests, T1 and T2 completed; both new budget identities have 5/5 load-gate receipts in A-7383. T3/T4 were not executed; T3 remains for periodic dev/integrated occasions. Static/test lint and duration budgets are report mode (one new-file duration baseline absent); no gate enforcement claim. Droplet lifetime 361 s, cost $0.0251. Durable log A-7383: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7383-suite-16fa59cd-8d60-4b0a-82f7-39ee78b92533-auto-at-f5e2cc7.log. Head remains clean and unchanged; Reviewer received the same result and final criterion marks are pending.

### rev-32 · 2026-10-20T10:12:49.051Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-576-final
commit: f5e2cc732aebe69182e085c7a7868982f65ff8bc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear at unchanged f5e2cc732aebe69182e085c7a7868982f65ff8bc, following full source verdict rev-20261020-576-source-2 (A-7342). No findings; C1 and current C2 verified.

A-7383 / run 16fa59cd-8d60-4b0a-82f7-39ee78b92533 is a fresh mode-free task run at this exact head, exit 0: 1948/1948 reported passes, T1 exit 0 (36s), T2 exit 0 (240s), with fallback all T2 across hub/Neovim. Linux x64 6.8.0-142-generic, droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5. Host check/typecheck at faf396008d56afd8f60a6c9bc12165c4912cde42 was reused, not repeated remotely. Census/duration/T3 ratchet diagnostics are report-only; policy refusals remained enforced.

The log records ordinary passes for both spoke artifact-budget regressions and separate 5/5 passed receipts for each. Existing artifact-folders filesystem cases also have ordinary passing receipts. Combined with source review, this proves the 120 s virtual create boundary, unchanged 10 s list boundary, one received id and no duplicate at the observed late-result consumption boundary under reconciled C2. The new budget file lacks a duration baseline; its actual ordinary timing is about 0.074 test-seconds, while any median projection remains a projection.

This is task T0–T2 evidence, not T3/T4 or an all-tier run. Outer MCP timeouts, continued hub copying after timeout, and lack of idempotent retries remain documented scope limits. No Reviewer runtime execution.

Criteria: C1 verified, C2 verified.
