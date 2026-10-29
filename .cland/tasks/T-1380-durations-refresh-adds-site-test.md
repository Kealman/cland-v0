---
id: T-1380
kind: task
title: durations refresh adds site/test identities that no tier owns, and periodic dev T3 then skips
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
regression_of: T-1368
topic: topic-1186
branch: t/T-1380-durations-refresh-adds-site-test
created: 2026-10-27T23:10:18.366Z
updated: 2026-10-29T16:09:15.261Z
---

## Summary

The stage-close refresh `node hub/test/durations.ts refresh --add-only <linux> <mac>` at c675faa3 added a file entry and five test keys under `site/test/remote-docs.test.ts`, because T-1368's hub wrapper `hub/test/remote-docs.test.ts` imports the site cases and the cover logs report them under the site file. No tier owns site/test, so the periodic dev T3 at 7ec62be1+ was skipped: `verify-tiers: duration key has no matching test identity: site/test/remote-docs.test.ts` (2026-10-27 23:09Z). Coord removed the six keys by hand; the next refresh would add them again.

## What to build

Either the refresh adds only identities the tier manifest owns (and says what it skipped), or the wrapper's imported cases are reported under the wrapper's own file, so logs and durations agree. Keep the failure as a refusal at shard planning, but make the refresh unable to create it.

## Acceptance criteria

- [x] C1. A refresh over a log that contains site/test identities adds no key the tier manifest does not own and prints the skipped identities (test).
  - done: impl-1380 · 2026-10-29T16:03:56.324Z
- [x] C2. `npm run test:tiers` passes after a refresh over the c675faa3 cover logs A-12925 and A-12929 (test against fixture copies).
  - done: impl-1380 · 2026-10-29T16:03:56.935Z

## Comments

### impl-1380 · 2026-10-29T16:00:50.503Z

Consumer inventory before refresh behaviour change: hub/test/durations.ts CLI and exported refreshDurations; direct T1 callers hub/test/durations-refresh.test.ts; CLI T3 callers hub/test/durations.test.ts; npm test:durations, Coordinator stage-close instructions in hub/README.md, docs/agents/tests.md, .agents/skills/merge/SKILL.md. All-tier readers/planners: suite-durations.ts, suite-shards.ts, suite-test-identities.ts, suite-selection.ts, suite-tier-report.ts, suite-duration-context/budget.ts, verification-commands.ts, hub/suites.ts, hub/dev-t3-probe.ts, run-suite.ts/load-gate.ts/selection-replay.ts and lint-repository-tier-plan.ts; their duration format and refusal stay unchanged. Existing durations/suite-tier/budget/context/legacy, runner/merge/Web tests and QA fixture readers unaffected (no schema or wire change). No startup/frame/client contract changes. No matching refresh QA briefs or persisted format migrations found.

### rev-26 · 2026-10-29T16:09:07.180Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1380-source-1
commit: d0d16251413f75f37f1a52901efb781dd821ad07
scope: full
findings: [{"severity":"medium","text":"M1: exact test-path H1 and owning Notes index row missing; unchanged docs guard red/green, fix owning rows only.","file":"docs/agents/tests/hub-test-durations-refresh.test.ts.md","line":1},{"severity":"medium","text":"M2: three new bare promisifyexecFile calls lack deadline/test-signal/ownedchildclose-resultdrain before rootcleanup onabort. Use existing sharedcommandIn fornewcalls, preserving successfulnpmadmission/nonzeroexactinvalidkeyrefusal.","file":"hub/test/durations.test.ts","line":418}]
finding_counts: {"high":0,"medium":2,"low":0}

A-13759 full8-file sourceaudit completeM1/M2only; noadditionalproductfinding. Full/addonly timing+fileenvelope filters ownership/skipdedup; no-manifestunfiltered/currentlegacymapping/previousinvalidkeyrefusal/addonlybytes preserved. All sharedconsumers inventoried/noformat/plannermigration orhubsrcchange. IndependentlycomparedA12925/A12929fixture6timingrows/head/greenmarker exactlyoriginaldurablelogs; excerptslabelled, T3nativeCLIreason/T1filterseamappropriate. Reportedworkingfixesoutsidehead; commit/freshsourcebeforemodefree. No runtimecriteriafailed/verified, no Reviewerworkloads. QA none/after-stage; skillproposalremainfrozen.
