---
id: T-625
kind: task
title: cland update removes a dropped skill left untouched and hands an edited one to the project
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by:
  - T-624
topic: null
branch: null
created: 2026-10-16T15:57:49.588Z
updated: 2026-10-16T15:57:50.261Z
---

## Summary

A skill the manifest lists but cland's set no longer holds is removed when the project never touched it, and handed to the project when it was edited: kept, taken out of the manifest, and reported, so `cland update` never writes it again.

## What to build

For each skill listed in the manifest that cland no longer ships, update applies the same untouched-or-edited test as for the shipped skills (05).

- **Untouched**: every listed file is removed, with the folders it leaves empty: `removed`, note "no longer in cland's set".
- **Edited**: the folder stays byte for byte, its entry leaves the manifest, and it is reported `kept` with the note "edited in the project; no longer in cland's set". From then on it is a skill of the project's own: a later update never lists, writes or removes it, even if a newer cland ships a skill of that name again.

In a project with its own `.claude/skills/` folder, cland's link to a removed skill goes, and the link to a skill handed to the project stays, since its folder is still there. Today's handling of a link on the skill's path (kept, reported `symlink:`) holds for both cases.

## Acceptance criteria

- [ ] C1. With a simulated set that drops a skill the project never edited, `cland update` removes its folder and reports `removed` with the note "no longer in cland's set".
- [ ] C2. With a simulated set that drops a skill the project edited, the folder is left byte for byte, the skill is no longer in the manifest, and it is reported `kept` with the note "edited in the project; no longer in cland's set".
- [ ] C3. A second `cland update` does not mention the handed-over skill, and a simulated set that ships that name again leaves the project's folder as it is.
- [ ] C4. In a project with its own `.claude/skills/` folder, the link to the removed skill is gone and the link to the handed-over skill remains.
- [ ] C5. The update tests cover C1 to C4 in scratch projects with `CLAND_SKILLS_SOURCE_OVERRIDE`.
