---
id: T-833
kind: task
title: The release-time OpenCode check reports and never refuses
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-832
topic: topic-574
branch: t/T-833-the-release-time-opencode-check-reports
created: 2026-10-19T06:34:12.430Z
updated: 2026-10-19T08:56:45.814Z
---

## Summary

E-424's release-time OpenCode range check (T-533) becomes informational. It reports how the newest 2.x compares with the adapter's operations and events, and it never moves a bound, files a Bug or stops a release (the amendment to Q-599 §4).

## What to build

- `npm run check:opencode` still compares the newest 2.x's OpenAPI document and event names with the adapter's, and prints the result. It exits 0 whatever it finds, unless the network or the probe itself fails. It writes nothing to the repository.
- The release skill (its copy in this repository and the copy `cland init` writes) names the check as an informational step before the dry run. A difference is a note in the release report, not a stop.
- The adapters' behavioural checks are untouched.

## Acceptance criteria

- [x] C1. Given a recorded newer 2.x document with a changed operation, the check prints the difference, exits 0, and leaves the repository's files byte-identical (T1 over the script's comparison with a recorded document).
  - done: impl-833 · 2026-10-19T08:38:39.417Z
  - verified: rev-30 [reviewer] · run rev-20261019-833-final · 2026-10-19T08:56:44.917Z · commit 1e595402242816d6dd3d62b435d51cd74ba45f35
- [x] C2. Both copies of the release skill describe the check as informational and no longer say it moves a bound or files a Bug (diff review).
  - done: impl-833 · 2026-10-19T08:38:39.827Z
  - verified: rev-30 [reviewer] · run rev-20261019-833-source · 2026-10-19T08:39:51.981Z · commit 1e595402242816d6dd3d62b435d51cd74ba45f35
  - verified: rev-30 [reviewer] · run rev-20261019-833-final · 2026-10-19T08:56:44.917Z · commit 1e595402242816d6dd3d62b435d51cd74ba45f35

## Comments

### impl-833 · 2026-10-19T08:38:40.360Z

Implemented a read-only informational release probe. Recorded newer OpenAPI + event differences return 0 and preserve every fixture repository file byte for byte; network/JSON/no-stable-2.x failures return 1. Existing contract comparison and adapter behavioural code are unchanged. Release-check tests now qualify as T1 (7 tests; file 0.081 s). Typecheck, static/test lint and diff whitespace checks passed. Init provisioning copied both release instruction files byte-identically from the updated single source. qaPolicy scope none; no per-item QA brief required.

### rev-30 · 2026-10-19T08:39:51.981Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-833-source
commit: 1e595402242816d6dd3d62b435d51cd74ba45f35
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-5908 audits all eight files. Document/event comparison remains intact and completed differences return 0; network/probe failures return 1. Script now has only repository reads, no bounds mutation, Bug filing or binary-smoke subprocess; adapter and contract-comparator source unchanged. New recorded-document T1 tests preserve repository file census/bytes and cover changed/compatible contracts and probe errors. Release instructions/reference and provisioned single-source path satisfy informational C2. C2 verified; C1 awaits same-head mode-free task gate. A-5907 host seven-test evidence retained; no live network/release action or Reviewer edits/tests.

Criteria: C2 verified.

### rev-30 · 2026-10-19T08:56:44.917Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-833-final
commit: 1e595402242816d6dd3d62b435d51cd74ba45f35
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-5925. Full A-5922/b7b80b25 audited: 1484/1484 ordinary pass, zero fail/cancel/skip/TODO, zero tier-mismatch rows and all 403 repetition groups 5/5. Seven OpenCode check cases pass; changed/compatible/error cases each pass 5/5 with recorded-document byte-preservation assertion retained. Source A-5908/A-5907 establish informational release wording and provisioning. C1/C2 verified, no findings. T3 remains landing evidence; report-only budget/lint diagnostics retained. No live provider or release action claimed.

Criteria: C1 verified, C2 verified.
