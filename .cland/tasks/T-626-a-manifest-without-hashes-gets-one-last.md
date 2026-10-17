---
id: T-626
kind: task
title: A manifest without hashes gets one last overwrite with a warning on the first cland update
state: open
status: planned
size: S
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by:
  - T-625
topic: null
branch: null
created: 2026-10-16T15:57:49.714Z
updated: 2026-10-17T21:48:42.897Z
---

## Summary

A project initialised by cland 0.1.3 or earlier has a manifest without hashes, so its first `cland update` cannot tell an edit from an old copy. That update treats every listed skill as untouched one last time, says so in a warning line, and writes the hashes, so the rules of 05 and 06 apply from the next run on.

## What to build

When update reads a manifest in the old form (a list of paths per skill), it applies today's behaviour once: every shipped skill the manifest lists is rewritten to cland's current copy, every listed skill cland no longer ships is removed, edited or not, and a file the project added inside a cland skill stays where it is. It then writes the manifest in the hashed form. The report carries one warning line saying that the manifest had no hashes, that every skill cland listed was overwritten this once and edits made to them before this update are lost, and that from now on `cland update` keeps a skill edited in the project. `--json` carries the same warning on the manifest's entry.

No table of past releases' hashes ships. A manifest already in the hashed form never triggers the warning.

## Acceptance criteria

- [ ] C1. In a temporary project whose manifest is in the old list form, with one listed skill edited, `cland update` rewrites that skill to cland's copy and the report has exactly one warning line about the overwrite, naming the skills whose copies differed from cland's so their edits can be recovered from git.
- [ ] C2. The same update removes a listed skill cland no longer ships, edited or not, and writes the manifest with a hash for every file.
- [ ] C3. A second `cland update`, after an edit to another skill and with a newer set simulated, keeps that skill and reports "edited in the project", with no warning line.
- [ ] C4. `cland update --json` carries the warning on the manifest's entry in the first run and not in the second.
- [ ] C5. The update tests cover C1 to C4 with a hand-written old-form manifest and `CLAND_SKILLS_SOURCE_OVERRIDE`.
- [ ] C6. Demo: a scratch project initialised by the v0.1.3 tag's `cland init`, then updated by this branch's `cland update`, shows the warning once and a hashed manifest afterwards.
- [ ] C7. `cland doctor` warns on a manifest in the old list form and names `cland update` as the fix, proved by a doctor test.
