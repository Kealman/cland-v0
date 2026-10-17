---
id: T-689
kind: task
title: cland verify all is reserved to the Coordinator, the human and occasions; task runs use the diff selection
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-413
branch: t/T-689-cland-verify-all-is-reserved-to-the
created: 2026-10-16T19:59:28.743Z
updated: 2026-10-16T23:44:50.171Z
---

## Summary

142 of 475 task runs were full because a session typed `all`, mostly for the flaky gate's second receipt, experiments and briefs (report-strategy §1.3). With quarantine (T-657) in place, the memo reserves `all` to the Coordinator and occasions (memo §5.2.6, §5.5 step 1). The flaky gate's second run (spec v0.1.3 §5) becomes an ordinary diff-selected verify.

## What to build

A `verify` request with mode `all` (CLI `all` or `--all`, MCP `mode: "all"`) from a session that holds neither the Coordinator role nor the human's shell is refused with `verify-all-reserved`, naming the diff selection it would get without the mode. The Coordinator, the human shell and `--occasion` requests keep `all`. Integrated `dev` runs stay full as today. `docs/agents/tests.md`, the Implementer and Lead clause lines that mention `all`, and spec v0.1.4's flaky-gate sentence say the second receipt is a diff-selected run; the clause change stays within `roles.test.ts`'s byte headroom.

## Acceptance criteria

- [x] C1. An Implementer's `cland verify all` and MCP `verify` with mode `all` are refused with `verify-all-reserved` and leave no queue entry, proved by CLI and frame tests.
  - done: impl-689 · 2026-10-16T23:43:09.841Z
- [x] C2. The Coordinator's and the human shell's `all` and any `--occasion` request are admitted, proved by the same tests.
  - done: impl-689 · 2026-10-16T23:43:10.056Z
- [x] C3. `docs/agents/tests.md`, the role clauses and `docs/spec/v0.1.4.md` describe the reserved mode and the diff-selected second receipt, and `roles.test.ts` passes its byte headroom.
  - done: impl-689 · 2026-10-16T23:43:10.329Z
  - verified: rev-30 [reviewer] · run rev-20261016-689-source · 2026-10-16T23:44:50.171Z · commit 19be0a95a8303ecca6ffef474a2d4790a920c5b2

## Comments

### impl-689 · 2026-10-16T23:29:19.096Z

Implementation started. Agreed acceptance seams: verify CLI and suite.run/verify frame admission. Will refuse explicit all before queue admission and retain occasion/Coordinator/human behavior; docs and role clause changes remain scoped.

### impl-689 · 2026-10-16T23:34:36.363Z

Implemented e70ea5a7: shared CLI/MCP admission checks hub-held role, refuses all before scheduler entry, and describes auto diff selection. Added T2 frame/CLI proof and actual MCP check in existing selection-report test; existing fixture callers now auto, while tests requiring forced full use Coordinator. Docs and Implementer/Lead clauses updated; QA default's stale exception removed. origin/dev merged (already current). Typecheck and test:tiers pass at committed head; serial touched-file checks underway.

### rev-30 · 2026-10-16T23:44:50.171Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-689-source
commit: 19be0a95a8303ecca6ffef474a2d4790a920c5b2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-689 full source review clear at 19be0a95a8303ecca6ffef474a2d4790a920c5b2 on t/T-689-cland-verify-all-is-reserved-to-the. Fixed point incoming dev 8c0a2b8fc959f13f7c915be39f08ebc6eb515783; git diff 8c0a2b8f...19be0a95, including the pre-review merge of T-686. Origin tip matches. Task hold/spec/criteria read; both axes reviewed in-session under the no-delegation role.

## Standards

No findings. The new verify-all component is T2 with a declared header, projectHub and real session/UI frames; CLI subprocesses exercise the CLI contract and Git processes prepare the fixture. It launches no package worker: a planted hand-holder keeps admitted jobs observable until cancellation. The CLI all/--all permutations reuse one fixture. No literal sleep, timer wait or elapsed-time assertion is added. The actual MCP refusal is added to the existing T3 selection-report contract rather than launching another binary fixture. Existing process/restart/cache/queue tests retain their lifecycle scenarios; this change does not add processes to them.

## Spec

No findings. Both CLI and MCP suite.start routes enter the same startSuite admission closure. It checks current caller identity and reporting permissions, then refuses explicit mode all for a session that does not currently hold Coordinator and has no occasion. Hub-held role is re-read, so a stale CLAND_ROLE shell hint does not grant the exception. The closure is retained as the existing scheduler reauthorization callback.

VerifyAllReserved maps to a structured verify-all-reserved result with describeSelection(selectPackageSuite(cwd, auto)), before calling Suites.start on the initial refusal. No job/queue/worker/lease reservation is made there; automatic selection may perform its existing Git fetch/read work. The human caller remains actor null. An occasion bypasses only this new reserved-mode condition, then must still pass the existing Coordinator/QA-epic role check and Suites.start's integrated clean dev, fresh fetched-head and full-mode proof. Integrated dev automatic selection remains full; suites.ts itself is unchanged.

The new real-frame/CLI test covers Implementer all and --all refusals, the automatic mode/reason/deciding path, unchanged empty queue/suite state, current hub role promotion despite stale shell hints, Coordinator frame/CLI admission and human CLI/frame admission. Existing suite-close tests retain authorized Coordinator occasions and QA epic, plus unauthorized/task-head/non-full refusals. The selection-report test exercises the real MCP verify tool's typed refusal/no new suite, then promotes the caller for the original forced-full assertion.

Fixture default mode becomes auto; corresponding result-label assertions change all to auto without dropping their exit/count/cleanup assertions. The cache test whose subject requires different effective full/reduced modes explicitly promotes its fixture caller to Coordinator and retains forced all. This preserves the distinction rather than weakening that assertion.

C3 documentation is established: docs/agents/tests.md, v0.1.4's flaky-gate sentence, shipped/project Implementer and Lead clauses, QA default and QA skill consistently reserve all and direct a diff-selected second receipt. roles.test.ts adds both clause assertions and retains its existing 512-byte headroom check beneath MAX_TEXT_BYTES; raw A-4257 shows both default/project snapshots and all eight role cases green.

A-4257 records all thirteen serial touched/compatibility files green below load 15: roles, verify-all, suite, admission, cache/recovery, candidate, human, queue/recovery/scheduling, selection-report and close. The new component takes 1.375 test-seconds (1.616 Node total); no allowance added. Typecheck and tier lint reported green at the committed head; independent whitespace check passes. Reviewer performed read-only inspection only, no tests/compiler/provider.

C3 verified from source/docs and the exact-head headroom receipt. C1/C2 and final runtime verdict remain pending accepted exact-head normal mode-free droplet verification. Source clearance does not lift the Coordinator's daily-spend submission hold; wait for its explicit lift. No per-item QA criteria. Standards 0 findings; Spec 0 findings.
Review artifact A-4258.

Criteria: C3 verified.
