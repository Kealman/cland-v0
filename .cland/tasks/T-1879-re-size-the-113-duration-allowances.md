---
id: T-1879
kind: task
title: Re-size the 469 duration allowances renewed on 2026-11-16 from the v0.4.0 release logs (C-216 entries expire 2026-11-23)
state: open
status: backlog
size: S
labels:
  - release-blocker
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:04:58.109Z
updated: 2026-11-16T07:08:56.321Z
---

## Summary

469 dated duration allowances were due to expire between 2026-11-18 and 2026-11-23: 138 owned by C-216 and 331 by the legacy owner E-880 (274 of those on 2026-11-19). An expired allowance makes the manifest lint throw (`expired duration allowance …`, `lintDurationManifest` in `hub/src/suite-durations.ts`), and that would fail every suite. On 2026-11-16 the Coordinator renewed their dates only, with sizes unchanged and a renewal note appended to each reason (commit on dev before 8195993ca):
- C-216 entries: added 2026-11-16, expires 2026-11-23, the 7-day limit;
- E-880 entries: added 2026-11-16, expires 2026-12-16, inside D72's 31-day limit. 4 E-880 entries renewed in the first pass expire on 2026-11-23.

This item re-sizes them from evidence. **The C-216 entries expire again on 2026-11-23 at 00:00 UTC.** Before that, re-size or renew them, or every suite fails again.

## What to build

For each renewed allowance, read the slowest passing Linux sample in the v0.4.0 release-period logs: the release suite A-19794, the stage covers A-19785 and A-19789, the soak A-19799 (partial) and recent batch logs. Then either:
- set the allowance to about 1.5× that sample, with owner C-216, at most 7 days, and a reason naming the sample;
- or remove it when the test now fits its tier default.

For the E-880 legacy entries, follow D72 and D73: they stay owned by E-880 until T-931 decides how enforcement returns, but a test now under its tier default loses its allowance. Use the hub's duration tooling where it supports this. Separately, the heartbeat warns only 48 h ahead, and the 274 entries expiring 2026-11-19 didn't show in it. Add a lint warning at about 5 days, or file that.

## Acceptance criteria

- [ ] C1. Every renewed C-216 allowance is re-sized or removed from a named log sample before 2026-11-23 00:00 UTC, and `npm run test:tiers` and the manifest lint pass at a simulated date after that (test).
- [ ] C2. The E-880 entries are re-sized or removed from a named sample, or kept with D72's owner and a reason naming the sample, before 2026-12-16 (test).
- [ ] C3. Expiry warnings reach the Coordinator far enough ahead to act, at least 5 days, or a filed item says why not (test).
