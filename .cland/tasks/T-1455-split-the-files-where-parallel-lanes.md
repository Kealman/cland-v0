---
id: T-1455
kind: task
title: Split the files where parallel lanes keep conflicting
state: open
status: review
size: M
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1471
  - T-1474
  - T-1476
  - T-1453
  - T-1454
  - T-1458
  - T-1460
  - T-1461
  - T-1462
  - T-1456
  - T-1464
  - T-1463
  - T-1479
topic: topic-1257
branch: t/T-1455-split-the-files-where-parallel-lanes
created: 2026-10-30T05:44:57.189Z
updated: 2026-10-31T02:33:04.825Z
---

## Summary

Make skill CHANGES one file per entry, keep palette help expectations per area, give usage.ts one module per command, and derive `docs/agents/tests/index.md` from the directory, so parallel lanes stop conflicting on shared lists. Sources: T-1385, T-1405, T-1406, T-1133, T-1136, T-1188, T-1198, T-1018, T-542, T-1144, T-421. Chosen by the human over a rule (rule batch 4, P8 → C3, A-14151).

## Acceptance criteria

- [x] C1. Two branches that each add an implement-skill note, a usage entry and a test guide merge without conflict.
  - done: impl-1455 · 2026-10-30T23:52:44.739Z

## Comments

### impl-1455 · 2026-10-30T23:48:38.345Z

Consumer inventory before changes (rule 20): CHANGES/frontmatter read by hub/test/lint-skill-provenance.ts, skill-provenance.test.ts, skill-provenance-merge.test.ts, hub/src/init/skills.ts recursive copy/hash/update, .agents/skills/implement and writing-for-agents instructions, docs/agents/tests.md provenance procedure. usage.ts exports consumed by hub/src/cli/* and help dispatch; cli-usage/cli-help/cli-imports tests and frozen fixtures remain compatibility oracles. Palette per-area JSON already shipped (web/test/palette.test.ts); preserve values and structure. Test index consumed by test-docs-index.ts, test-docs.test.ts, test-docs-merge.test.ts, docs/agents/tests.md, README/skill/QA guide links; retain index URL and guide filenames. No wire/schema changes; T3 native merge fixtures cover copied skill and object-merge behavior. Planned: per-entry provenance directory, static per-command usage modules with compatibility exports, deterministic index generator/check with report-only drift.

### impl-1455 · 2026-10-30T23:50:54.408Z

Expanded consumer audit: cli/help.ts, task.ts, task-import.ts, crew/doctor/open/subscriptions and remaining CLI exports use compatibility facade; cli-usage-compatibility.test.ts freezes every export. cli-imports.test.ts now separates new pure usage/ modules from unchanged implementation import budget. Historic qa/briefs E-417 stage 3/4, E-418 stage 3 and E-419 stage 2/4 mention CHANGES as historical per-commit path evidence (unaffected; not current file readers). Test guide index historical anchors and all skill/brief/doc links checked by test-docs.test.ts; union membership utility remains for old merge-fixture coverage. Init/update recursively enumerate/hash entire skill folders, so directory entries migrate without copy-code changes. Palette JSON consumers: web/test/palette.test.ts and its guide; no key binding/help value changes.

### impl-1455 · 2026-10-30T23:52:05.827Z

Exact usage consumers from field/importer search: hub/src/cli/{task,merge,web,release,artifact,suite,models,remote,task-import,subscriptions,hook,session,role,hub,setup,crew,open,inbox,worktree,account,init,help,qa,qa-lint,publish,doctor,executor,push}.ts; hub/src/qa-lint.ts; hub/test/{skills-onboarding,cli-usage,cli-usage-compatibility,cli-usage-merge}.test.ts and cli-usage-fixture.ts. All retain facade exports/bytes; cli-usage-merge migrated from monolithic source-row parsing to per-command modules and passed both native merge/object merge cases. Adapter files named usage.ts are unrelated harness accounting modules, unaffected. Command fixture commands.json unchanged. New generated-index check added to test:static in report mode; old membership guard remains enforced.

### rev-26 · 2026-10-31T02:30:46.219Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1455-source-1
commit: 7b5ed74428e20f167379d4bce3a66c1e937e24ba
scope: full
findings: [{"severity":"medium","text":"M1: owning guide still instructs editing monolithic usage.ts table rows/separators, removed by this change. hub/README.md2362–2376 also retains old static-only/≤10 help import claim while actual guard separates36pure help modules from implementation budgets. Replace superseded current guidance with per-command facade/composition and correctly scoped counts; retain unchanged help bytes/guards.","file":"docs/agents/tests/hub-test-cli-usage-merge.test.ts.md","line":3}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14790: consolidated full source not clear for M1 only. Provenance migration retains every nonempty historical entry; facade/fixtures, derived-index report mode, native merge/squash fixture and installer ownership reviewed. C1 remains runtime-unverified; local A-14787 targeted summaries do not establish configured full evidence. Lead's draft M1 fixes not part of reviewed7b5ed7442. Complete current docs correction, fresh pushed-head source review before Coordinator verify all; preserve all semantic/compatibility/native assertions.

### rev-32 · 2026-10-31T02:32:33.286Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261031-1455-source2
commit: 649a6d4d32e3f2499ebbec237daa6221dec574c5
scope: full
findings: [{"severity":"low","text":"L1: guide says four real CLI launches, but cli-help.test.ts has five: full help, task criterion, remote, hub, session. Adjacent guide omits remote/understates frozen comparisons; source header also says four. Correct count/list/header together; nonblocking documentation accuracy, runtime unchanged.","file":"docs/agents/tests/hub-test-cli-usage-merge.test.ts.md","line":5}]
finding_counts: {"high":0,"medium":0,"low":1}

Successor source clear A-14793, M1 blocking drift closed. Exactly3docs files since rev-26/A-14790 predecessor, no runtime/test/fixture/help-byte/dev merge changes. Per-command ownership/facade/group composition match source; 36pure help modules separated from unchanged <=10/17/21 implementation budgets. Prior observed39/51/56 remain attributed local measurements. One low L1 launch count/list recorded; lead preparing correction. C1 remains runtime-unverified; request's docs4/4 local summary and priorA-14787 not configured full proof. Any count-fix changed head needs fresh source review before Coordinator-owned verify-all handoff. No Reviewer workload.

### rev-32 · 2026-10-31T02:33:04.825Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261031-1455-source3
commit: 1cd10dea577609e0093a8713a04572bb329b1e35
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear: L1 count/list/header closed. Successor diff is3docs files plus cli-help first comment only; five actual launches/four frozen comparisons now match source. Executable statements/assertions/fixtures/help/runtime unchanged; no dev merge, diffcheck clean. M1 corrected ownership/facade/import-budget guidance retained. Local Darwin cli-help5/5/docs4/4 are summary validation, not configured full evidence. C1 remains runtime-unverified; ready for Coordinator-owned verify-all handoff then original-record final review. No Reviewer execution.
