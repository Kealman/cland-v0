---
id: T-1097
kind: task
title: "T-1095's help-scroll regression fails at 1024×600 on Linux: a row is never fully visible after one PageDown"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by: []
regression_of: T-1095
topic: null
branch: t/T-1097-t-1095-s-help-scroll-regression-fails-at
created: 2026-10-22T07:39:15.709Z
updated: 2026-10-22T07:39:28.257Z
---

## Summary

T-1095's regression `web/test/palette.test.ts` "Items help stays inside small viewports and every row is reachable by keyboard scrolling" failed on Linux in T-1096's run 7be3f149 (A-9016, Linux x64 droplet c-8 lon1, head 7c1469bc on dev 90c54f5a): subtest `1024×600` threw "PageDown reveals open-other: not within 6000 ms", and the parent took 8.494 s against the 5 s new-identity gate. The 1280×720 subtest passed in 1.14 s. The same test passed on Linux in T-1095's own run 47bcfb0a (parent 2.538 s). The step loop requires each next unseen row to become fully visible after one PageDown; a row that straddles a page boundary under Linux font metrics, or a PageDown that lands before focus or scroll settles, can make that never true.

## Acceptance criteria

- [ ] C1. The regression still proves, at 1280×720 and 1024×600, that the help dialog stays inside the viewport and that keyboard scrolling (PageDown/End/Home) brings every one of the 32 rows fully into view, without depending on a row being fully visible after exactly one PageDown, and it fails on a planted unbounded `.keys` list (test).
- [ ] C2. The test passes 10/10 in Chrome Headless Shell on the Linux droplet through `cland verify`, with its parent under 5 s or a dated allowance (owner E-880, about 1.5× the worst Linux sample); the per-run times are listed in the item topic (test).
