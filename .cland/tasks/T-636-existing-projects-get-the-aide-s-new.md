---
id: T-636
kind: task
title: Existing projects get the Aide's new tools once, at the hub's first 0.1.4 start
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by:
  - T-628
  - T-630
topic: null
branch: null
created: 2026-10-16T16:04:12.845Z
updated: 2026-10-16T16:04:14.111Z
---

## Summary

Every existing `roles.toml` lists the Aide's tools explicitly and cland never rewrites the file, so without a migration an existing project, this repository included, never gets the Aide's reach. At its first start of 0.1.4 the hub appends `session.launch`, `session.stop`, `session.resume`, `task.import` and `push` to an explicit `[aide.permissions] tools` list, once, and reports the change in Agents (the human's comment on E-611, 2026-10-16).

## What to build

- At start, when `[aide.permissions] tools` exists and lacks any of the five tools, the hub appends the missing ones with the roles.toml editor, keeping every other line and the list's order, and marks the file so the migration never runs again on it: a human who removes a tool afterwards keeps it removed. The mark is a comment line under the table (recommended; see the README's open question).
- One Agents notice names the tools added and says that a running Aide gets them only at its next launch, since role tools are fixed at launch.
- A file with no `tools` key under `[aide.permissions]` already takes the built-in list: nothing is written. A file that already holds the five, or carries the mark, is left alone. A file that does not parse is left unchanged and the notice says the migration waits for a valid file.
- The Aide's clause in an existing file still says it cannot launch, stop or resume sessions or `cland push`: what the migration does with it follows the Coordinator's answer (recommended: replace that line with the 0.1.4 lines when it matches the shipped v0.1.3 text exactly, else name it in the notice for the human).

## Acceptance criteria

- [ ] C1. A hub started on a project whose roles.toml lists the v0.1.3 Aide tools appends the five tools, keeps every other line, writes the mark and posts one Agents notice naming them (frame-protocol test).
- [ ] C2. A second start writes nothing, and neither does a start after the human removed one of the added tools again.
- [ ] C3. A roles.toml without an `[aide.permissions] tools` list, one that already holds the five tools and one that does not parse are left byte-identical, the last with an Agents notice.
- [ ] C4. The existing Aide clause line that forbids launching, stopping, resuming and `cland push` is handled as the Coordinator decided, verified in the same test.
- [ ] C5. After the migration and the Aide's relaunch, the Aide in that project launches a session from its shell (frame-protocol test with the fake harnesses).
