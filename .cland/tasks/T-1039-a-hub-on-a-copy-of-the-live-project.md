---
id: T-1039
kind: task
title: A hub on a copy of the live project takes 39 s to start serving, and hub.status takes 310 ms to compose
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: topic-788
branch: t/T-1039-a-hub-on-a-copy-of-the-live-project
created: 2026-10-21T06:41:50.480Z
updated: 2026-10-21T08:42:05.773Z
---

## Summary

impl-1038 measured a scratch hub on a consistent copy of the live project's `.cland` (1,036 items, 1,628 suite statuses, 8,163 artifacts) on 2026-10-21. It took 39.4 s and 47 s in two starts before it served its first request. `hub.status` took 310 ms to compose, the live hub 1,977 ms. Restarts have to stay under 60 s, or the Claude Code mod bridge expires.

## What to build

Profile the startup on such a copy, with the V8 inspector or `--cpu-prof`. Name the phases: tracker indexing, store open/migrations, suite and artifact restore, journal replay. Then make the hub serve within 5 s on the copy, deferring work that serving does not need. With T-1038's bounded projection in place, also measure `hub.status` compose time and bring it under 50 ms.

Evidence: T-1038 topic-785, impl-1038's table of 2026-10-21 06:41Z.

## Acceptance criteria

- [x] C1. A startup profile on the live-copy fixture names the time spent per phase, posted in the item topic (local evidence).
  - done: impl-1039 · 2026-10-21T08:42:05.756Z
- [ ] C2. On that copy, the hub answers `hub.status` within 5 s of `cland hub start` (measured wall time, local evidence), and a T3 test guards the startup time on a generated fixture of comparable size.
- [ ] C3. `hub.status` composes in under 50 ms on the copy (measured, local evidence).

## Comments

### coord · 2026-10-21T08:27:13.077Z

Live data point, hub restart #36 on 2026-10-21 (cland-impl), at dev 7c5e4028. The old hub stopped at 08:25:48Z. The new hub logged listening at 08:25:57Z and started serving at 08:26:25.0Z: 28 s from listening to serving, and a 37 s gap in total. That is within 23 s of the 60 s mod-bridge limit. With T-1038 live, hub.status on the live hub is now 6.8 kB.

### impl-1039 · 2026-10-21T08:42:05.773Z

C1 evidence A-8199 published in topic-788. Primary regression isolated and fixed test-first: generated fixture first hub.status red14.444s, then total test green2.395s after skipping unconditional full history saves in requesterExited. Unoptimized live-copy after that single fix8.892s/143.487ms compose, still above C2/C3. Remaining tracker/one-journal/inbox candidate changes prepared; enhanced fixture now includes four250-child plans and800closed topics. Local runtime paused for cover-quiet per Coordinator; no full suite run before source review.
