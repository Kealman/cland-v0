---
id: T-1804
kind: task
title: "Explorer protocol recordings key on unrelated archive-loading state: the same task.plan/task.view frame records a new entry once closed archive rows arrive"
state: open
status: in progress
size: M
criterion_seq: 3
labels: []
assignee: null
parent: E-1886
blocked_by: []
topic: topic-1602
branch: t/T-1804-explorer-protocol-recordings-key-on
created: 2026-11-10T10:27:55.575Z
updated: 2026-11-17T12:09:41.797Z
---

## Summary

During T-1778's recording refresh (`npm run test:nvim-fixtures`, 2026-11-10, at 665554818), `nvim/test/fixtures/protocol-frames.json` and `protocol-frames/explorer-component.json` each gained 4 canonical entries, which represent 2 result frames (`task.plan` record 82ab3ab3…, `task.view` 89dbc2b6…) plus their normalized input nodes. Their frame and output shapes exactly match existing records. The nearest existing inputs differ only at `/items/21–23`: the archived fixture rows R-30, T-31 and T-32. The recording key therefore depends on whether closed archive rows had loaded when the frame was captured. That is scheduling-state nondeterminism, not a wire change. No timing reproducer has been shown.

## Evidence

impl-1778's classification in topic-1461 (2026-11-10 10:27Z). The generated commit was reverted, and the tree was restored to 665554818.

## Acceptance criteria

- [ ] C1. Recording keys for explorer frames don't depend on archive-loading progress: two recording runs, with archive rows loaded before and after the frame, produce the same canonical entries (test).
- [ ] C2. Ordinary replay covers both archive-loading states, or the explorer awaits a defined archive state before capture (test).
- [ ] C3. Two back-to-back `npm run test:nvim-fixtures` runs produce no archive-context duplicate keys, and the explorer-component slice after the second run is byte-identical to the deterministic migration; the remaining incidental task.view capture variance belongs to T-1944 (test).

## Comments

### impl-1804 · 2026-11-17T11:46:27.381Z

Consumer search: frame-fixtures canonical/replay consumed by stub-hub; client selects slice paths; frame-refresh and record-nvim-frames hash captured normalized inputs; nvim-fixture-check checks producer outputs and slice membership; boundary/refresh T1 tests cover format. All Neovim T2/T3/T4 consumers reach the shared stub/reader; no production protocol caller changes. QA E-1535-stage-1 reads outputs via parseRecordings (unchanged); docs/evidence/T-709 frame audit describes historical binding (still valid). Frozen protocol-frames catalog and all slices migrated with output-byte preservation; live-protocol-frames unaffected. Producers: stub task.plan builds id/plan/stages/approval/history, Visibility.frame only projects named record fields and never reads items for this shape; task.view value.item layer uses Visibility.currentItems open release and parent reachability. Normalize only these result contexts; keep every open row and its closed ancestors for view.
