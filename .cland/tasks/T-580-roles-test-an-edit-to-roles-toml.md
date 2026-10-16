---
id: T-580
kind: task
title: "roles test: an edit to roles.toml sometimes isn't seen by the next launch (old model 'claude-fable-5-1') on a loaded droplet"
state: open
status: backlog
size: S
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T07:00:56.384Z
updated: 2026-10-16T07:00:56.384Z
---

## Summary
In T-470's droplet run 0b939cc1 at 311933f1 (A-3815, lines 4466–4489), hub/test/roles.test.ts:181, in the case "roles.toml is written at the first start, and an edit changes the next launch", got model 'claude-fable-5-1' where the edited 'claude-fake-edited' was expected, after 8.5 s. T-470 doesn't touch roles. The file passed 8/8 alone on dev ac20175b on the Mac. Likely the edit-detection boundary (mtime granularity or a watcher debounce) racing the next launch under load. T-488's config hot reload, still unmerged, touches the same reading path.

## Acceptance criteria
- [ ] C1. Find how the next launch decides roles.toml changed, and make an edit made before a launch always visible to it, or make the test wait on the observed reload, with the cause recorded on this item.
- [ ] C2. roles.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet.
