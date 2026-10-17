---
id: T-688
kind: task
title: "Coverage selection narrows instead of falling back: Neovim importers only, a file's covering tests for top-level edits, old maps that still map"
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
assignee: null
parent: E-676
blocked_by:
  - T-679
topic: null
branch: t/T-688-coverage-selection-narrows-instead-of
created: 2026-10-16T19:59:28.645Z
updated: 2026-10-17T04:13:59.141Z
---

## Summary

Coverage selection decided 13 of 475 task runs (median 59 s) because its forcers defeat it: `nvim test import <hub file>` forced full 66 times, and any top-level insertion, untested function or map older than two days falls back to full (report-strategy §1.3, §2.6, §3f; memo §5.2.6). This ticket widens the fallbacks the memo names; it keeps the shared-contract and suite-infrastructure fallbacks.

## What to build

- **Type-only imports do not count.** `nvimHubImports` (`hub/src/suite-selection.ts`) skips `import type` and `export type` specifiers, which the type-stripping loader erases; today eight Neovim files reach `hub/src/protocol.ts`, and `plan.test.ts` reaches the tracker, only through type imports.
- **Neovim importers only.** When a changed hub file is imported by Neovim tests, the Neovim phase runs the Neovim test files that import it, directly or through `nvim/test` helpers, plus `NVIM_SMOKE`, instead of the whole phase. The hub side is selected by coverage as today. A change to `hub/test/harness.ts` or `hub/test/process-cleanup.ts`, which most Neovim files import, still runs them all.
- **A file's covering tests.** A top-level insertion, or a hunk in a function with no covering test, in a `hub/src` file selects every test covering any function of that file, plus `HUB_SMOKE`, instead of falling back. The report names the widening.
- **Old maps that still map.** A map older than `[verification].coverage_max_age` still selects when every hunk maps through the intervening diff (the existing check); the report gives its age. A map with no ancestor, or any unmappable hunk, still falls back.
- **Measured.** `node hub/test/selection-replay.ts <range> --coverage` over the last 40 landings, before and after, recorded on this item.

## Acceptance criteria

- [ ] C1. A Neovim test that reaches a hub file only through `import type` does not make that file a Neovim import, proved by a selection test.
- [ ] C2. A diff touching `hub/src/tracker/criteria.ts` selects only the Neovim files importing it plus `NVIM_SMOKE` on the Neovim side, and a diff touching `hub/test/harness.ts` still runs the whole Neovim phase, proved by selection tests.
- [ ] C3. A top-level insertion in a covered `hub/src` file selects that file's covering tests plus `HUB_SMOKE` and names the widening, proved by a selection test.
- [ ] C4. A map older than the age limit selects when every hunk maps and reports its age, and falls back when one hunk does not, proved by selection tests.
- [ ] C5. The replay over the last 40 landings shows zero misses of the merges' own changed or added tests, and more landings selecting than the baseline replay at the merge base, with both counts recorded on this item.
- [ ] C6. `docs/agents/tests.md` describes the four narrowings.
