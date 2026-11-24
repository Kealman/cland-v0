---
id: T-1910
kind: task
title: The site import-boundary lint reports site/test/users-docs.test.ts's import of ../scripts/capture-safety.ts as a missing dependency
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1731
branch: t/T-1910-the-site-import-boundary-lint-reports
created: 2026-11-16T11:27:13.181Z
updated: 2026-11-24T10:13:06.931Z
---

## Summary

The whole-source lint's Site import boundary check (report-only) reports `site/test/users-docs.test.ts:6` importing `../scripts/capture-safety.ts` as a missing dependency, though the file exists (`site/scripts/capture-safety.ts`, from T-1838/T-1871). Found by impl-1859 on 2026-11-16 (topic-1549). The finding adds noise to every lint run and could hide a real boundary miss.

## What to build

Make the Site import boundary lint accept imports of the site's own `scripts/` from site tests, or move the helper where the boundary expects it, so the report-only finding disappears without widening the boundary to hub code.

## Acceptance criteria

- [x] C1. The whole-source lint reports no Site import boundary finding for `site/test/users-docs.test.ts`, and a site test importing a hub-internal module outside the allowed set is still reported (test).
  - done: impl-1910 · 2026-11-24T10:11:43.713Z

## Comments

### impl-1910 · 2026-11-24T10:06:36.408Z

Consumer search: siteImportFindings is used only by lint-prerequisites.ts and prerequisite-guards.test.ts. Report command is wired by package.json test:static; docs reference it in tests.md, running.md and prerequisite-and-packaging-reports.md. No wire/help/policy shape changes. Shared source collector adds site/scripts; package allowlist and report-only outcome unchanged. Regression reproduced exact users-docs.test.ts:6 missing dependency before fix.

### rev-35 · 2026-11-24T10:13:06.931Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1910-source-1
commit: 142dd5c376ec791ef8f214e6cfbe51d8bd004369
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22823: source clear, Standards0/Spec0 findings. Reviewed four-file task diff against parent960c45747, not unrelated earlier dev work. Shared collector adds site/scripts for both lint and real candidate-entry regression; exact planted hub-only package finding remains, package allowlist/evaluator/report-only exit semantics unchanged. Source reader regression acquires no writable fixture/native resources or global seams; per-file guidance matches. C1 remains done/unverified pending same-head whole-source report and generated test/load receipts. A-22821 reports scoped local red/green and lint/typecheck; not configured proof. No reviewer execution/edits. Hold releases; seek Coordinator mode-free window at unchanged head. No full task-head suite, dev merge or duplicate run requested.
