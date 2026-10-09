---
id: T-63
kind: task
title: "cland release: main fast-forwards to dev, tagged with notes from the items, and goes to GitHub; cland sync brings GitHub back"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: null
parent: T-20
blocked_by:
  - T-59
topic: null
branch: null
created: 2026-10-09T08:35:16.599Z
updated: 2026-10-09T08:39:13.496Z
---

## Parent

Part of T-20 (slice 2, ticket 5 of 12). Spec sections 4.7, 4.9 and 7(a); ADR 0004.

## What to build

`cland release vX.Y.Z` is a `release` frame with a `release` grant for the Coordinator, from its shell, and for the human (decision D11: the human, or the Coordinator after the human answered the `release` skill's version ask; no spoke tool), and runs under the territory lock. It fetches `github` first and refuses, changing nothing, without a version, with a malformed or existing tag, with nothing in `main..dev`, without a `github` remote, or when `github/main` has commits `dev` lacks (named, with "run `cland sync`"). It then creates an annotated tag at `dev` whose message is the release notes: one line per `Item:` trailer in `main..dev` (`T-12 <title>`), then the other commits by subject. It pushes `dev`'s commit as `main` and the tag to `github` in one atomic push, and only then moves `main` locally and in the territory, so a rejected push leaves everything as it was. `--dry-run` prints the notes and the refs it would push. `cland sync` fetches `github`, fast-forwards `main` to `github/main` and replays `dev`'s unreleased commits on top in the root; a conflict aborts with the files named and `dev` unchanged, a dirty root refuses it, and it pushes nothing to GitHub. The `release` skill: commit the tracker, run `--dry-run`, ask the human for the number (the next patch, minor and major after the last tag, and a free answer), then release; the skill forbids delegating a release to a sub-agent. cland never edits the project's version files: cland's own bump of its package version is an ordinary item merged before a release. A release is one atomic push and makes no API calls; only `cland release` and `cland sync` reach GitHub.

## Acceptance criteria

- [ ] With two merged items on `dev`, `cland release v0.1.0` leaves the stand-in GitHub with `main` at `dev`'s tip and the annotated tag `v0.1.0` listing both items; local `main` and the territory match.
- [ ] Each refusal changes nothing locally or remotely: no version, `v1`, an existing tag, nothing to release, no `github` remote, `github/main` ahead with its commits named, a merge in progress, an Implementer, Reviewer or QA caller.
- [ ] A push the stand-in GitHub rejects with its own hook leaves local `main` and the tags as they were, and reports git's message.
- [ ] `--dry-run` prints the notes and the refs and changes nothing.
- [ ] `cland sync` brings a commit made on the stand-in GitHub into `main` and replays `dev`'s unreleased commits on top; with a conflict it stops, names the files and leaves `dev` as it was.
- [ ] The `release` skill is in `.agents/skills/release/` and in the Coordinator's skill list, and asks the human for the version before releasing.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents release, sync and the push rule; `AGENTS.md`'s managed block says only `cland release` pushes to `github`.

## Notes

Test seam: as the merge ticket (T-59), plus a bare repository on disk as `github`, with a `pre-receive` hook for the rejection case. Size L; `cland sync` can split off if it grows. Implementer: Codex gpt-6.1-sol.

## Comments

### coord · 2026-10-09T08:39:13.496Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/58 (a sub-issue of #20; the item is the source of truth).
