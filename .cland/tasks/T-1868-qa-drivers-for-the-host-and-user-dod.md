---
id: T-1868
kind: task
title: QA drivers for the host and user DoD journeys (live workbenches, hosts-view logins, scripted setup, combined doctor)
state: open
status: backlog
size: M
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-15T10:48:29.034Z
updated: 2026-11-16T07:29:30.491Z
---

## Summary

E-1537's Definition-of-Done demo (2026-11-15) couldn't show four criteria literally on one live scratch hub, because no driver for that journey ships. The Coordinator accepted substitute evidence for each, named in the demo verdict (decisions on qa/briefs/E-1537.md Q-1 to Q-4). The four journeys were:
- both workbenches showing the Hosts row and host-named session rows against a CLI-started hub with sessions on two fake hosts;
- adding and removing a login from the web hosts view, read back with `cland login list` and seen in the Neovim inbox;
- one scripted-terminal `cland setup` run through both the agent-hosts and sign-in steps, choosing users;
- doctor on one scratch hub combining a stale image, a signed-out login and no token.

Future host and user epics, and the v0.4 release run, would be better verified with these as runnable QA cases.

## What to build

Add QA drivers, as qa/cases or scratch helpers in the qa skill kit, for the four journeys above, on fakes only: the fake host provider, the fake DigitalOcean API and an isolated Headless Shell. Invite links are treated as credentials (stage 5's `inv.mjs` approach).

## Acceptance criteria

- [ ] C1. Each of the four journeys runs as a committed QA case or kit helper against a scratch hub on fakes and records its evidence through `qa-record.sh` (test).
- [ ] C2. The invite-link journey proves, with a planted positive control, that no link appears in any capture (test).
