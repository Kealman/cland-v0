---
id: T-624
kind: task
title: cland update refreshes an untouched skill and keeps one edited in the project
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by:
  - T-623
topic: null
branch: null
created: 2026-10-16T15:57:49.170Z
updated: 2026-10-16T15:57:50.130Z
---

## Summary

`cland update` decides per skill, on the manifest's hashes, whether the project edited a skill cland installed: an untouched copy is refreshed to cland's current version, an edited one is kept whole and reported "edited in the project". A skill new to the set is added unless the project already has a folder of that name.

## What to build

For every skill in cland's set that the manifest lists, update compares three states: each file as cland wrote it (the manifest's hash), as it is in the project, and as cland ships it now. The decision covers the whole skill, because a skill's files refer to each other and a folder mixing two versions can break.

- **Untouched**: every listed file is present with its recorded hash, and the folder holds no file the manifest does not list. The copy is refreshed to cland's current version, files cland no longer ships in it are removed, and the new hashes are recorded: `updated`, or `unchanged` when nothing differed.
- **Edited in the project**: a listed file differs from its hash or is missing, or the folder holds a file the manifest does not list. The skill is kept whole, reported `kept` with the note "edited in the project", plus "cland ships a newer version" when cland's copy differs from what it installed. Its entry keeps the install hashes, so the next run reaches the same verdict, and an edit undone by hand makes the copy untouched again.
- **Edited to match cland**: the project's files equal cland's current copy. `unchanged`, with cland's hashes recorded.
- **New to the set**: a skill the manifest does not list is installed (`created`), unless the project already has a folder of that name, which stays the project's own (`kept`, as today).

Taking cland's version of an edited skill stays the human's act: remove the folder, then run `cland update`. The per-file conflict for a file the human added inside a cland skill gives way to the per-skill rule, so the test "a file of the human's inside a managed skill is never adopted" is rewritten to the new meaning. The human-readable report shows each kept skill on its own line with its note; `--json` carries the same note. `hub/README.md`'s managed-files paragraph and its `.agents/skills/<name>/` row describe the curated set and these rules, in place of the vendored set with per-file ownership. The tests run on temporary projects with the set simulated through `CLAND_SKILLS_SOURCE_OVERRIDE`, never on this repository's own skills.

## Acceptance criteria

- [ ] C1. With a newer set simulated, `cland update` rewrites an untouched skill to the new version and records the new hashes.
- [ ] C2. A skill with an edited file, a deleted file or an added file is left byte for byte as it was and reported `kept` with the note "edited in the project".
- [ ] C3. The note adds "cland ships a newer version" only when cland's current copy of that skill differs from the hashes it installed.
- [ ] C4. A second `cland update` reports the edited skill the same way, and after the edit is undone by hand the next update refreshes it.
- [ ] C5. A skill whose project copy equals cland's current copy is reported `unchanged` and its manifest entry takes cland's hashes.
- [ ] C6. A skill new to the simulated set is `created`, and one whose folder already exists in the project is `kept` as the project's own and stays out of the manifest.
- [ ] C7. The update tests cover C1 to C6 in a scratch project with `CLAND_SKILLS_SOURCE_OVERRIDE`, and the rewritten "never adopted" test asserts the per-skill verdict.
- [ ] C8. `cland update` prints one line per kept skill with its note, and `cland update --json` lists the same action and note for that skill's path.
