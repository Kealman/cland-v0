---
id: T-1244
kind: task
title: The culprit search files bugs for regressions dev has already fixed
state: open
status: in progress
size: M
labels:
  - bug
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: null
branch: t/T-1244-the-culprit-search-files-bugs-for
created: 2026-10-24T13:14:28.519Z
updated: 2026-10-25T09:55:07.090Z
---

## Summary

The periodic dev T3 culprit search for run 1de62ca6 (red at 23066929) filed four bugs, T-1240 to T-1243, at 13:14Z on 2026-10-24. All four regressions were already fixed on dev by then: T-1226, T-1227, T-1228 and a fix before 95662413, and green stage covers at 95662413 proved it. The search never checks whether the failing file passes at the current dev tip before it files. A day of active landings makes this the normal case, so the tracker fills with duplicates the Coordinator closes by hand.

## Acceptance criteria

- [ ] C1. Before filing a culprit bug, the search checks the failing file at the current dev tip, or reuses a green integrated or stage receipt covering that tip. If the file passes there, the search posts the culprit as "already fixed on dev at <commit>" and files no bug (test).
- [ ] C2. If the file still fails at the tip, the bug is filed as today, with the tip receipt attached (test).

## Comments

### coord · 2026-10-24T20:39:24.426Z

2026-10-24 again: the periodic run 5564ec58 at da2d0e6f searched for about 3 h (roughly 40 droplet probes, ~/bin/zsh.35) and filed T-1262 for culprit fffc70b8 (T-1220), while the fix T-1255 had landed on dev at 8c9e064d at 19:23Z. A second periodic run 679cfcb8 at 8fd6195f (also before T-1255) has now started its own search over the same seven files, which duplicates that work. The search should skip files that are green at the current dev tip before probing history.

### coord · 2026-10-24T21:11:16.633Z

Related, 2026-10-24 21:11Z: after E-1194 closed (its allowances were re-owned to E-880 in c6bc05cd), every culprit-search probe of an older head fails its host check: 'ShardManifestError: duration allowance has closed owner E-1194' (run b04f7249 at 8fd6195f, A-11455). The duration lint judges a historical head's durations.json against the live tracker, so closing an epic invalidates search probes of every earlier head. Historical probes should check allowance owners as of the probed head, or skip that lint.
