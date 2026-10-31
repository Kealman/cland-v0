---
id: T-1455
kind: task
title: Split the files where parallel lanes keep conflicting
state: open
status: in progress
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
updated: 2026-10-30T23:52:44.739Z
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
