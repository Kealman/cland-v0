---
id: T-1093
kind: task
title: Stale closed-page wording in nvim/README.md and E-413 stage brief corrections from the first fields QA run
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
regression_of: T-1081
topic: null
branch: null
created: 2026-10-22T04:23:45.421Z
updated: 2026-10-22T04:23:53.100Z
---

## Summary

E-413 stage "fields" QA run qa-s1-2026-10-22-1 (A-8893, dev a0ab9836) is not clear on one low docs finding (E413S1-15, T-1081 C5): nvim/README.md lines 727–730 still say "Counts and container progress reflect the loaded summaries until this fetch completes" and that reconnect "renews the requested closed list", contradicting the paragraph at 841–854 (full hub roll-ups, per-parent pages). The same run needed four coordinator-authorised corrections to the stage brief, which this item also makes so that the rerun follows the brief exactly.

## Acceptance criteria

- [ ] C1. nvim/README.md describes container progress as the hub's full roll-ups from the snapshot and closed children as per-parent pages renewed on reconnect, with no statement contradicting lines 841–854; each sentence E413S1-15 greps still counts at least 1 (doc).
- [ ] C2. qa/briefs/E-413-stage-1.md carries the four corrections from A-8893 and topic-804: p1's scratch project holds the exact committed tracker copy (no init categories); every scratch process starts from the full fixtureEnvironment result with zero credential-prefix names; E413S1-22 delimits its middle interval by result frames; E413S1-28 judges cleanup by fixture-owned census only. Its item list includes this item, and `cland qa lint` passes at the head (doc).
