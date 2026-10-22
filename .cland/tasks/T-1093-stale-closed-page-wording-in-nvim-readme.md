---
id: T-1093
kind: task
title: Stale closed-page wording in nvim/README.md and E-413 stage brief corrections from the first fields QA run
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
regression_of: T-1081
topic: topic-833
branch: t/T-1093-stale-closed-page-wording-in-nvim-readme
created: 2026-10-22T04:23:45.421Z
updated: 2026-10-22T04:28:03.797Z
---

## Summary

E-413 stage "fields" QA run qa-s1-2026-10-22-1 (A-8893, dev a0ab9836) is not clear on one low docs finding (E413S1-15, T-1081 C5): nvim/README.md lines 727–730 still say "Counts and container progress reflect the loaded summaries until this fetch completes" and that reconnect "renews the requested closed list", contradicting the paragraph at 841–854 (full hub roll-ups, per-parent pages). The same run needed four coordinator-authorised corrections to the stage brief, which this item also makes so that the rerun follows the brief exactly.

## Acceptance criteria

- [x] C1. nvim/README.md describes container progress as the hub's full roll-ups from the snapshot and closed children as per-parent pages renewed on reconnect, with no statement contradicting lines 841–854; each sentence E413S1-15 greps still counts at least 1 (doc).
  - done: impl-1093 · 2026-10-22T04:26:41.461Z
  - verified: rev-26 [reviewer] · run rev-20261022-1093-source-1 · 2026-10-22T04:28:03.796Z · commit cc14477892798bb11d6695b886bd9cb245180f5e
- [x] C2. qa/briefs/E-413-stage-1.md carries the four corrections from A-8893 and topic-804: p1's scratch project holds the exact committed tracker copy (no init categories); every scratch process starts from the full fixtureEnvironment result with zero credential-prefix names; E413S1-22 delimits its middle interval by result frames; E413S1-28 judges cleanup by fixture-owned census only. Its item list includes this item, and `cland qa lint` passes at the head (doc).
  - done: impl-1093 · 2026-10-22T04:26:41.531Z

## Comments

### impl-1093 · 2026-10-22T04:25:42.722Z

Implementation restricted to the two requested Markdown files. Read A-8893 report.md and topic-804 coordinator decisions 7b31ad72, 43149d5a and 79502bbb. Applying exact tracker replacement after observed scratch-hub exit, full fixtureEnvironment exports after overlays with broad prefix removal, result-frame interval boundaries, and fixture-owned Web cleanup census. No product/test/role-clause changes.

### rev-26 · 2026-10-22T04:28:03.797Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1093-source-1
commit: cc14477892798bb11d6695b886bd9cb245180f5e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, audit A-8902. README removes stale loaded-only counts/closed-list wording and agrees with open+ancestor membership, full hub roll-ups and per-parent reconnect reloads. All10 E413S1-15 literal matching-line counts are1 at committed head. C2 brief corrections match direct Coordinator7b31ad72/43149d5a/79502bbb: exact replacement tracker after bounded CLI stop/PID exit, complete fixtureEnvironment exports/final zero-prefix filter, result-to-result filter interval, fixture-owned cleanup census; T-1093 in stage/build/merge checks. Standards0; Spec0; only2 Markdown files. C1 verified. A-8901 reports committed local macOS typecheck/qa lint but is a summary note; C2 explicit lint receipt and final configured same-head verification pending. Original receipts requested without transcription rerun. Historical stage QA stays not clear; new after-stage QA separate.

Criteria: C1 verified.
