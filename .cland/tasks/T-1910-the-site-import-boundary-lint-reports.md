---
id: T-1910
kind: task
title: The site import-boundary lint reports site/test/users-docs.test.ts's import of ../scripts/capture-safety.ts as a missing dependency
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1731
branch: t/T-1910-the-site-import-boundary-lint-reports
created: 2026-11-16T11:27:13.181Z
updated: 2026-11-24T10:05:35.868Z
---

## Summary

The whole-source lint's Site import boundary check (report-only) reports `site/test/users-docs.test.ts:6` importing `../scripts/capture-safety.ts` as a missing dependency, though the file exists (`site/scripts/capture-safety.ts`, from T-1838/T-1871). Found by impl-1859 on 2026-11-16 (topic-1549). The finding adds noise to every lint run and could hide a real boundary miss.

## What to build

Make the Site import boundary lint accept imports of the site's own `scripts/` from site tests, or move the helper where the boundary expects it, so the report-only finding disappears without widening the boundary to hub code.

## Acceptance criteria

- [ ] C1. The whole-source lint reports no Site import boundary finding for `site/test/users-docs.test.ts`, and a site test importing a hub-internal module outside the allowed set is still reported (test).
