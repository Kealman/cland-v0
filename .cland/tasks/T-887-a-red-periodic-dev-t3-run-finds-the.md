---
id: T-887
kind: task
title: A red periodic dev T3 run finds the landed merge that broke it and files a Bug
state: open
status: backlog
size: M
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by:
  - T-886
topic: null
branch: null
created: 2026-10-19T16:17:32.779Z
updated: 2026-10-19T16:17:32.779Z
---

## Summary

D67, part two: when a periodic dev T3 run (T-886) goes red, the hub finds the landed merge that broke it among the merges since the last green periodic run. It reruns only the failing files at chosen commits, then files a Bug naming that merge and notifies the Coordinator and the merge's last claimant. A red periodic run never stops the merge queue.

## Acceptance criteria

- [ ] C1. A red `dev-t3` run with merges M1…Mn since the last green periodic run reruns only its failing files, bisecting over those landed commits, and names the first merge at which they fail. A failing file that also fails at the last green head is reported as pre-existing, not blamed (T1 test over the search with a fake runner).
- [ ] C2. The hub files one Bug under the Bugs category for the named merge, with the failing files, run ids and both heads. It notifies the Coordinator in General and the merge's last claimant session if live. A failing file that passes on rerun at the red head is reported as a flake and files nothing (T2 test).
- [ ] C3. While the search runs, merge batches keep forming and landing (T1 test over the controller).
