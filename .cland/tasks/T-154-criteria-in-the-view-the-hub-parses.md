---
id: T-154
kind: task
title: "Criteria in the view: the hub parses Acceptance criteria into ids, text
  and marks, returned as criteria; legacy checkboxes read unmarked; hand edits
  keep ids and marks"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-112
blocked_by: []
topic: topic-67
branch: t/T-154-criteria-in-the-view-the-hub-parses
created: 2026-10-10T07:49:35.981Z
updated: 2026-10-10T08:30:57.745Z
closed: 2026-10-10T08:30:57.765Z
---

## Parent

T-112 (Criteria that live), slice 1 of 5. Spec §3.4 (Format, Migration).

## What to build

The hub parses `## Acceptance criteria` in an item file into structured criteria and returns them as `criteria` in `cland task view --json` and `task.view`: each has its id (`C1`, `C2`, …, or none yet), its text, and its marks (done, verified, failed, each with who, when and, for verified, the run; failed with its note), in the sub-item format §3.4 shows. Plain checkboxes from before read as criteria without ids or marks. Hand edits to the section are re-indexed and keep the ids and marks they have. Nothing writes to the section yet.

## Acceptance criteria

- [ ] `task view --json` and `task.view` return `criteria` for an item: ids, text and marks parsed from the §3.4 format; an item with no section returns an empty list.
- [ ] Legacy checkboxes read as criteria without ids or marks; a checked legacy box reads as unmarked, with its checkbox state kept.
- [ ] A hand edit of the section (reworded text, reordered items, a mark sub-item added by hand) is re-indexed, and ids and marks survive; a frame-protocol test edits a real item file.
- [ ] Malformed mark lines are kept verbatim and reported, not dropped.
- [ ] `hub/README.md` documents `criteria` in the view's JSON.
- [ ] `npm run typecheck && npm test` pass.

## Blocked by

None (can start immediately).

## Comments

### impl-154 · 2026-10-10T07:50:20.432Z

Starting slice 1: standalone parser, read-only criteria in the task view, frame-protocol tests including hand edits. Item topic: topic-67.

### impl-154 · 2026-10-10T07:55:31.674Z

Implementation complete in hub/src/tracker/criteria.ts with four-line tracker.ts integration. criteria JSON includes ids, text, independent checkbox state and parsed marks; malformed source is retained with per-criterion and aggregate warnings. Protocol tests pass for CLI/MCP, real file hand edits/restart, legacy boxes and Markdown boundaries. npm run typecheck passed; starting the locked npm test suite on Node v24.21.0.

### impl-154 · 2026-10-10T08:20:12.195Z

Validation complete on Node v24.21.0: npm run typecheck passed; targeted tracker-criteria.test.ts passed 5/5; locked npm test passed with 877 hub tests + 201 Neovim tests, zero failures. Four-file change: standalone parser, four tracker.ts additions, frame-protocol regression tests, README JSON documentation. No acceptance-criteria writes or merge-gate changes.

### rev-8 · 2026-10-10T08:23:19.088Z

verdict: review
result: not clear
by: rev-8 [reviewer]
run: rev-8-20261010-154-1
commit: 79ea46d6a505d3a54a9b316611b7734fe46e1b81

Medium — hub/src/tracker/criteria.ts:75: mark detection requires exactly one ASCII space after the bullet, so `  -  verified: qa-2 [QA] · run q-3 · 2026-10-09T11:00Z` (two spaces) or a tab after `-` appears in neither marks nor malformedMarks/criteriaWarnings. Independently reproduced with the pinned parser in memory. This misses “Malformed mark lines are kept verbatim and reported, not dropped”; recognizable mark lines should parse or produce a verbatim warning.

Standards clear (0 findings); Spec not clear (1 medium). Canonical format, legacy boxes, hand edits/restart and read-only integration otherwise match the slice. Reviewed A-496 and A-501 (877+201 passed); no reviewer suites or file edits. Artifact A-502: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-502-t-154-review-mark-spacing-silently-bypasses-warnings.md.

### impl-154 · 2026-10-10T08:24:15.450Z

Addressing rev-8-154-1/A-502: tokenize list sub-items once, tolerate spaces/tabs after bullets, and report every unrecognized criterion list sub-item verbatim. Regression coverage adds both review probes, a tab-indented mark, malformed values, unknown/misspelled marks, empty bullets and ordered supporting items. Per Coordinator: rerun typecheck, criteria and tracker tests; full-suite evidence from A-501 carries forward for this parser-only delta.

### impl-154 · 2026-10-10T08:28:56.432Z

Fixed rev-8-154-1/A-502 at 3baf2227d1d5239b7851027b069256ef66d567e2, pushed to origin. All criterion list sub-items now either parse or produce verbatim diagnostics; marks tolerate spaces/tabs after bullets, while tab indentation and unrecognized/empty/ordered sub-items are reported. Protocol regressions include both review probes and tab sub-items below an indented criterion. Final Node v24.21.0 validation: typecheck passed; tracker-criteria.test.ts 6/6 passed; tracker.test.ts 16/16 passed; diff clean. Full-suite A-501 carries forward per Coordinator; no full rerun.

### rev-8 · 2026-10-10T08:30:46.096Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-154-2
commit: 3baf2227d1d5239b7851027b069256ef66d567e2

No high, medium, or low findings. Prior medium A-502 is resolved: both extra-space and tab-after-bullet marks now parse; eight malformed/unsupported sub-item classes returned verbatim per-criterion and aggregate warnings in independent pure-parser probes. Standards and Spec both clear for the full item, carrying forward unchanged canonical-format, legacy, hand-edit/restart and read-only integration review. Checked A-503 typecheck and targeted 6/6 + 16/16 evidence; A-501 full-suite evidence carries forward per Coordinator instruction. No reviewer edits or suites run. Artifact A-505: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-505-t-154-re-review-mark-tokenization-clear.md.

### coord · 2026-10-10T08:30:57.745Z

Merged 59f3aa52d095c90d8e61279ea3c869b4681c0523 onto dev.
