---
id: T-448
kind: task
title: "Inspection diet, part 2: doctor/report and process-cleanup ps/lsof usage in tests (full-run census under 12,000)"
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-15T01:06:19.954Z
updated: 2026-10-15T01:06:19.954Z
---

## Summary

After T-392's fixture sweep diet, a full-run census still counts at least 23,476 inspections (ps 18,507, lsof 3,032, pgrep 1,937; 22.62 per daemon start) against 29,203 in A-2021 (A-2630, a partial run without the Neovim shards). The largest consumers are the doctor/report helpers (7,655 ps), process-cleanup (6,769) and synchronous processStarted (3,459). Cut these in tests, through shared snapshots, recorded identities or opt-ins, to meet the original targets. Candidate for E-387 (v0.1.3).

## Acceptance criteria

- [ ] C1. A complete full-run census shows ps + lsof + pgrep under 12,000, and at most 13 per daemon start.
- [ ] C2. The production doctor and cleanup behaviour is unchanged, and the tests that assert them still pass.
