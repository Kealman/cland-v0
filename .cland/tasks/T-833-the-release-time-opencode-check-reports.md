---
id: T-833
kind: task
title: The release-time OpenCode check reports and never refuses
state: open
status: planned
size: XS
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-832
topic: null
branch: null
created: 2026-10-19T06:34:12.430Z
updated: 2026-10-19T06:34:21.591Z
---

## Summary

E-424's release-time OpenCode range check (T-533) becomes informational. It reports how the newest 2.x compares with the adapter's operations and events, and it never moves a bound, files a Bug or stops a release (the amendment to Q-599 §4).

## What to build

- `npm run check:opencode` still compares the newest 2.x's OpenAPI document and event names with the adapter's, and prints the result. It exits 0 whatever it finds, unless the network or the probe itself fails. It writes nothing to the repository.
- The release skill (its copy in this repository and the copy `cland init` writes) names the check as an informational step before the dry run. A difference is a note in the release report, not a stop.
- The adapters' behavioural checks are untouched.

## Acceptance criteria

- [ ] C1. Given a recorded newer 2.x document with a changed operation, the check prints the difference, exits 0, and leaves the repository's files byte-identical (T1 over the script's comparison with a recorded document).
- [ ] C2. Both copies of the release skill describe the check as informational and no longer say it moves a bound or files a Bug (diff review).
