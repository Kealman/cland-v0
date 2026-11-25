---
id: T-2107
kind: task
title: Turn the file-level `after`-assertion lint from report-only to refusal
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by:
  - T-1997
topic: null
branch: null
created: 2026-11-25T13:35:06.575Z
updated: 2026-11-25T13:44:47.386Z
---

## Summary

T-1997 adds a report-only lint that names assertions in file-level `after` hooks, which plain `node <file>` runs report as passing. Rule 27 puts the report-to-enforce step in its own item, and this is that item.

## What to build

Once T-1997's lint has reported zero findings on dev across one stage cover, switch it to refuse, keeping cleanup-only hooks allowed.

## Acceptance criteria

- [ ] C1. A file-level `after` hook containing an assertion is refused by test:lint, with a pointer to a final named test, while a cleanup-only hook passes (test).

## Comments

### coord · 2026-11-25T13:44:47.386Z

Scope addition from T-1997's C3 audit (impl-1997, 2026-11-25): `tip-churn-file-fixture.ts` has a file-level hook that dispatches stageCase afterCleanup → restore → fakeNativeGuard.verify(), which is an indirect guard as well as cleanup. T-1997 keeps it (per-case owner.close already runs in named test cleanup). Before switching the lint to refusal, migrate it: trackerFileCase.run awaits the completed callback, then owner.close() and owner.restore() run before it returns to its named test, with the file hook kept as an idempotent fallback. This adds the tracker churn importers to the affected tests.
