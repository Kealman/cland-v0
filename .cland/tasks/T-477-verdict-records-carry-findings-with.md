---
id: T-477
kind: task
title: Verdict records carry findings with severity, and lows are recorded
state: open
status: in progress
size: M
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-468
blocked_by:
  - T-529
  - T-478
topic: topic-338
branch: t/T-477-verdict-records-carry-findings-with
created: 2026-10-15T09:13:19.683Z
updated: 2026-10-15T22:46:05.500Z
---

## Summary

Retrospective A-2783, START 2 and STOP 5: severity was parsed from prose, and only 2 lows were recorded in the whole run. A verdict records its findings as structured entries, `{severity: high|medium|low, file?, line?, text}`, and the Reviewer clause says to record lows rather than writing 'no high or medium'.

## What to build

`task comment --verdict` and the MCP `task.comment` accept `--finding <severity>:<text>[@file:line]` (repeatable), and `findings: []` in the tool. The verdict header records counts by severity. `task view --json` and the journal's verdict record carry them. The Reviewer clause and the code-review skill say to list every finding, lows included.

## Acceptance criteria

- [ ] C1. A verdict with findings of each severity stores them, and `task view --json` returns them with the counts.
- [ ] C2. A clear verdict with only low findings is accepted and shows the lows.
- [ ] C3. The Reviewer clause (both copies) and the code-review skill require recording lows.

## Comments

### impl-477 · 2026-10-15T22:46:05.500Z

Dependencies T-478/T-529 are merged and branch starts from dev 55497c72. Plan: additive optional findings plus derived findingCounts, single-line JSON verdict headers, strict write validation, CLI repeated --finding and MCP array, index/journal propagation and low-only clear coverage. Legacy omission stays unknown; tests wait for Coordinator's reserved T-544 slot.
