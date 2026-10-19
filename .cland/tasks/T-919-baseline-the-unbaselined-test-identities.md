---
id: T-919
kind: task
title: "Baseline the unbaselined test identities from stage cover #2's logs (refresh refuses budget-red logs)"
state: open
status: in progress
size: S
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: t/T-919-baseline-the-unbaselined-test-identities
created: 2026-10-19T23:28:04.295Z
updated: 2026-10-19T23:28:10.270Z
---

## Summary

Stage cover #2 at 15f9c308 had zero test failures on Linux (A-6792). It still failed on four hard `duration budget:` lines: test identities that are new since the last durations refresh, have no baseline, and ran 5.4–5.8 s against the 5 s default. Both covers report "budget missing baselines: 55". The documented stage-close refresh (`npm run test:durations -- <logs>`) refuses both logs as "not a green integrated log", so tests that hover near 5 s keep failing covers one at a time (T-910 C3, T-917, now four more).

## What to build

Give every identity observed in A-6792 (Linux) and A-6795 (macOS) that has no baseline and no allowance a baseline entry in `hub/test/durations.json`, at the per-test median of the two logs, as the refresh tool would write it. Then known identities follow their tier budget (report only for T3 at 10 s) instead of the hard 5 s new-test rule. If an identity is over its tier's hard limit even as known, give it an allowance with reason and owner E-677, 7-day expiry. Leave existing entries untouched. Either reuse `hub/test/durations.ts` (an explicit bypass of the green-log guard for this documented case, behind a flag the tool already has or a narrowly scoped new one with a test) or edit the manifest by script. Say which in the report.

## Acceptance criteria

- [ ] C1. A replay of A-6792's and A-6795's budget checks against the new manifest shows no hard `duration budget:` line and at most 5 missing baselines (receipt in the report).
- [ ] C2. Existing baseline and allowance entries are unchanged (diff limited to additions, listed in the report).
- [ ] C3. The durations tests and lint pass, and a mode-free verify at the reviewed head is green.
