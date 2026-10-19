---
id: T-883
kind: task
title: Fourteen T2 cases run 2.0–2.9 s against the 2 s T2 budget
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - needs-triage
  - v0.1.4
assignee: impl-882
parent: C-216
blocked_by: []
topic: topic-623
branch: t/T-883-fourteen-t2-cases-run-2-0-2-9-s-against
created: 2026-10-19T15:38:56.097Z
updated: 2026-10-19T18:34:18.940Z
---

## Summary

T-879's same-head receipt (A-6161, audited in A-6167) shows fourteen T2 cases between 2.0 s and 2.9 s against the 2 s T2 budget, reported only by the legacy gate. Found aside by rev-31 on 2026-10-19 while reviewing T-879. The roles-editor T1 row is T-875's, and the onboarding native-push trips are T-877's.

## Cases

- hub/test/tracker-rank.test.ts::the high migration ranks singleton groups, including closed items, and a rerun writes nothing 2.892 s > 2 s (T2)
- hub/test/config-reload-component.test.ts::hub reload publishes config and roles together and retains both after either file fails 2.86 s > 2 s (T2)
- hub/test/verdict-commit-component.test.ts::review scope is required through CLI and MCP, indexed and announced, while QA carries none 2.792 s > 2 s (T2)
- hub/test/tracker-component.test.ts::a verdict comment is stored in the file with its header and is queryable through the index 2.736 s > 2 s (T2)
- nvim/test/events-quiet.test.ts::events keys, warning/dim presentation, independent mutes, last look and cold persistence 2.683 s > 2 s (T2)
- hub/test/tracker-component.test.ts::task list queries the index with state, label, kind, assignee filters 2.564 s > 2 s (T2)
- hub/test/tracker-levels.test.ts::renamed top-level metadata survives restart; an empty ladder refuses former containers with a notice 2.519 s > 2 s (T2)
- nvim/test/vboard.test.ts::release versions appear once in the scope, all tree, top bar and item header 2.431 s > 2 s (T2)
- hub/test/task-card-component.test.ts::hub closes after a hand reopen replace retained closed times, while already-closed retries keep them 2.27 s > 2 s (T2)
- hub/test/tracker-component.test.ts::edit, close and link change the file; bad references are refused 2.216 s > 2 s (T2)
- nvim/test/explorer-component.test.ts::invalid explorer preferences reset alone and are reported while other ui.json keys survive 2.215 s > 2 s (T2)
- nvim/test/thread.test.ts::delayed initial history preserves focused composer modes and an unfocused composer 2.19 s > 2 s (T2)
- hub/test/task-plan.test.ts::a two-stage plan is written by CLI, shown by MCP and view JSON, changed and journalled 2.149 s > 2 s (T2)
- hub/test/crew.test.ts::crew set observes the session role boundary from CLI 2.053 s > 2 s (T2)

## Acceptance criteria

- [x] C1. Each case listed in the body or in the Coordinator's added-cases comment runs within the 2 s T2 budget in a mode-free task verify. A case that cannot is given an exact-key allowance with a written reason, owned by an open epic, or moves to T3 under the tier-move rule with its assertions kept. The receipt shows no report-only budget line for any of them.
  - verified: rev-30 [reviewer] · run rev-20261019-883-final · 2026-10-19T18:16:09.412Z · commit 11ecce1664a6e5ce6d12c1ac7f81bde7df6f04b9
  - done: impl-882 · 2026-10-19T18:34:09.013Z
  - verified: rev-30 [reviewer] · run rev-20261019-883-baseline-integration-final · 2026-10-19T18:34:18.292Z · commit 736e3df515f193eb3006f59edca252db1006df49

## Comments

### coord · 2026-10-19T15:58:38.052Z

Added cases (rev-31's A-6188 receipt from T-786, 2026-10-19 15:58Z), covered by C1 as listed cases: hub/test/suite-admission-cost.test.ts::suite.start admission over a repository-sized manifest 2.284 s; hub/test/tracker-component.test.ts::task claim keeps the live hold in the hub and persists Implementer status; view shows the assignee and claim 2.32 s; nvim/test/thread.test.ts::200 message rewrites and steady-state appends retain cached parsing and incremental cost 2.219 s.

### coord · 2026-10-19T17:12:01.130Z

Added cases (rev-31's A-6275 receipt from T-873, 2026-10-19 17:10Z), covered by C1 as listed cases: hub/test/tracker-component.test.ts::a CLI actor whose name or role is not one the hub knows is refused, and nothing is written 2.029 s > 2 s (T2);hub/test/tracker-hierarchy.test.ts::a release version and Notes survive writes and a hub restart; CLI and MCP expose them 2.236 s > 2 s (T2);hub/test/verdict-findings.test.ts::CLI and MCP verdicts expose all severities, clear lows and explicit empty findings in views and journal 2.166 s > 2 s (T2);hub/test/verdict-findings.test.ts::invalid findings refuse atomically and text headers carry findings through restart and evidence checks 2.022 s > 2 s (T2);nvim/test/explorer-component.test.ts::bench reports build and buffer medians for 300 items fully unfolded and restores the human view 2.261 s > 2 s (T2);

### impl-882 · 2026-10-19T17:50:24.559Z

Implemented all 22 cases at 11ecce1664a6e5ce6d12c1ac7f81bde7df6f04b9. Repeated CLI startup now uses production command functions with explicit IO/environment and real sockets; native entrypoint proofs remain. Client table cases reuse clients with fresh component state, held snapshots and all original assertions. The terminal mode uses Neovim's in-memory terminal. Repo-sized admission retains all 435 sources with deduplicated fake Git objects and a batch completion receipt. Component benchmark samples are bounded; 200-message/300-item fixtures and explicit long benchmark remain. No tier moves or new allowances; owned verdict-findings legacy allowance retired. All 22 actual serial Node 24 Mac times <2 s (max .738 s), all 15 complete files pass; check, recording contract and explicit benchmark pass. Four restored-source negative controls fail correctly. A-6301 contains diagnosis, raw receipts and preservation audit. Fetched/merged origin/dev (already current); fresh fetch and clean merge-tree before push. C1 awaits exact-head mode-free Linux receipt and review.

### rev-30 · 2026-10-19T17:52:41.522Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-883-source
commit: 11ecce1664a6e5ce6d12c1ac7f81bde7df6f04b9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; A-6302. All 22 identities reviewed. Real CLI parser/socket/identity semantics, file/index/restart/atomic-refusal assertions, fresh client variant state and benchmark sensitivity retained at cheaper seams. runCrew optional IO/env preserves real defaults. A-6301 raw 160/160 across 15 files, all 22 Mac bodies <2 s, explicit benchmark/recording contract green, four intended negative controls fail correctly. No tier moves/new allowance; one owned obsolete allowance retired. C1 awaits exact-head mode-free Linux overall green and each owned ordinary time <2 s/no owned budget row. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6302-t-883-full-source-review-at-11ecce16.md

### rev-30 · 2026-10-19T18:16:09.412Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-883-final
commit: 11ecce1664a6e5ce6d12c1ac7f81bde7df6f04b9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6311. A-6307 ordinary 1589/1589, 509 groups 5/5. All 22 owned ordinary receipts pass <2 s, no missing identity or owned budget row; max admission1.890626306s, events1.835498459s. C1 verified with source audit A-6302. Separately qualify admission's five load repetitions2.432–2.563s; do not claim they are <2 s or substitute them for ordinary budget evidence. Inherited T856/T877 and unowned T882 debt retained; native T3 landing evidence. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6311-t-883-final-22-case-evidence-review-at-11ecce16.md

Criteria: C1 verified.

### rev-30 · 2026-10-19T18:27:34.805Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-883-baseline-integration-source
commit: 736e3df515f193eb3006f59edca252db1006df49
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6320 source delta clear. Only durations.json changed from prior reviewed 11ecce16. Parsed final JSON equals refreshed dev 595c7f01 minus exactly the owned verdict-findings legacy allowance; no additions, other baseline fields/allowances/budgets/provenance unchanged. Coordinator 0b039f85 authorized integration. Owned code/tests/fixtures byte-identical. C1 awaits new exact-head mode-free overall pass plus all 22 ordinary owned Linux bodies <2 s and no owned budget row; old-head runtime evidence remains historical.

### rev-30 · 2026-10-19T18:34:18.292Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-883-baseline-integration-final
commit: 736e3df515f193eb3006f59edca252db1006df49
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6323 independently audits A-6321/run 9d0bf176 at the reviewed integrated head: 1589/1589, zero fail/cancel/skip/TODO; all 22 exact owned ordinary identities pass below 2 s, maximum events 1.546139361 s, no owned raw budget row. A-6320 source delta clear. Refreshed baseline selects zero new repetition groups; earlier qualified load evidence retained, no fresh 5/5 claim. Unowned T-882 costs and inherited T-856/T-877 resources retain separate disposition. Native T3 remains landing evidence. Standards/Spec findings [].

Criteria: C1 verified.
