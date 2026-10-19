---
id: T-883
kind: task
title: Fourteen T2 cases run 2.0–2.9 s against the 2 s T2 budget
state: open
status: backlog
size: S
criterion_seq: 1
labels:
  - needs-triage
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-19T15:38:56.097Z
updated: 2026-10-19T17:12:01.130Z
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

- [ ] C1. Each case listed in the body or in the Coordinator's added-cases comment runs within the 2 s T2 budget in a mode-free task verify. A case that cannot is given an exact-key allowance with a written reason, owned by an open epic, or moves to T3 under the tier-move rule with its assertions kept. The receipt shows no report-only budget line for any of them.

## Comments

### coord · 2026-10-19T15:58:38.052Z

Added cases (rev-31's A-6188 receipt from T-786, 2026-10-19 15:58Z), covered by C1 as listed cases: hub/test/suite-admission-cost.test.ts::suite.start admission over a repository-sized manifest 2.284 s; hub/test/tracker-component.test.ts::task claim keeps the live hold in the hub and persists Implementer status; view shows the assignee and claim 2.32 s; nvim/test/thread.test.ts::200 message rewrites and steady-state appends retain cached parsing and incremental cost 2.219 s.

### coord · 2026-10-19T17:12:01.130Z

Added cases (rev-31's A-6275 receipt from T-873, 2026-10-19 17:10Z), covered by C1 as listed cases: hub/test/tracker-component.test.ts::a CLI actor whose name or role is not one the hub knows is refused, and nothing is written 2.029 s > 2 s (T2);hub/test/tracker-hierarchy.test.ts::a release version and Notes survive writes and a hub restart; CLI and MCP expose them 2.236 s > 2 s (T2);hub/test/verdict-findings.test.ts::CLI and MCP verdicts expose all severities, clear lows and explicit empty findings in views and journal 2.166 s > 2 s (T2);hub/test/verdict-findings.test.ts::invalid findings refuse atomically and text headers carry findings through restart and evidence checks 2.022 s > 2 s (T2);nvim/test/explorer-component.test.ts::bench reports build and buffer medians for 300 items fully unfolded and restores the human view 2.261 s > 2 s (T2);
