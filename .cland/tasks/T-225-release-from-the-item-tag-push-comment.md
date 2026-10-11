---
id: T-225
kind: task
title: "Release from the item: tag, push, comment the tag on the item and close it; the release skill and Coordinator clause release from the item"
state: open
status: backlog
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-117
blocked_by:
  - T-224
topic: null
branch: null
created: 2026-10-11T15:38:17.485Z
updated: 2026-10-11T15:39:27.581Z
---

## Parent

T-117 (Release from the item), tracer bullet 3 plus the release flow. Builds on T-224, the `--item` dry run and its notes.

## What to build

`cland release --item T-n` without `--dry-run` does the following:
- Tags `v<version>`, fast-forwards `main` to `dev` and pushes to GitHub as today, with the notes from T-224.
- On success, the hub comments the tag on the release item and closes it. The next open release becomes the current one.
- A release without `--item` behaves as before.

The `release` skill (.agents/skills/release) and the Coordinator's clause (the shipped default and the project's .cland/roles.toml, with a handover listing the exact lines) release from the item: dry run first, then the notes and version shown to the human in an `ask`, then the real run after approval.

Under decisions D18 and D19 (docs/spec/v0.1.md §4), the human's stand-in, an Aide or the session the human named, may answer that ask with the version the human decided. The skill's current step 3, saying the stand-in "cannot choose or authorize the version", must be reconciled with that: the stand-in relays a version the human chose and does not invent one.

## Acceptance criteria

- [ ] A scratch release from a test release item tags `v<version>`, moves and pushes `main` to the GitHub stand-in, comments the tag on the item, and closes it.
- [ ] A release without `--item` is unchanged.
- [ ] The `release` skill and the Coordinator clause describe releasing from the item after the human's approval, consistent with D18/D19. The roles.toml handover lines are listed.
- [ ] `npm run typecheck && npm test` pass.

## Comments

### coord · 2026-10-11T15:39:27.581Z

Notes from cland-impl (2026-10-11 15:42Z): (1) The Coordinator clause and the release skill must say the version comes from the human, and the stand-in may relay it only when the human has recorded it (D18 names v0.1.0); the stand-in never invents a version. (2) The notes from the item carry T-130's Notes, which list T-109 C1 and T-111 M7 as 'verified in v0.1.1' (D19). Check the release output shows them. T-224 and T-225 are hub-risky: each needs its own pre-merge full suite. T-117's former C8 (tag on GitHub, item closed) is now T-130's post-release check.
