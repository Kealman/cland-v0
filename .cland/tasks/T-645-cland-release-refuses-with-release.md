---
id: T-645
kind: task
title: cland release refuses with release-version when dev's package.json version differs from the release's
state: open
status: planned
size: S
labels:
  - v0.1.4
  - init
  - hub
assignee: null
parent: E-612
blocked_by:
  - T-644
topic: null
branch: null
created: 2026-10-16T16:23:58.697Z
updated: 2026-10-16T16:24:32.983Z
---

## Summary

The version a release tags must be the version its build reports. `cland release` and `cland release --dry-run` read the root `package.json` at `dev`'s tip and refuse with the code `release-version` when its version differs from the release's; the bump is an ordinary commit merged before the dry run, and the release never writes it (spec v0.1.4 §3.1; Q-599 resolution 7, Q-592).

## What to build

- **The check**, in the release's preparation (`hub/src/territory-release.ts`, beside the existing `release-version` checks in `hub/src/hub/releases.ts`), for the item flow (`--item R-<n>`) and the version flow (`cland release vX.Y.Z`) alike, dry run included: `git show <dev tip>:package.json`, its `version` compared with the release's `X.Y.Z`. A mismatch throws `ReleaseError('release-version', 'dev's package.json says 0.1.3, the release is v0.1.4: commit the bump on dev, merge it, then preview again')`. The working copy is never read, so an uncommitted bump does not pass.
- **Scope.** The check applies when `dev`'s root `package.json` declares a `version`; a project without that file or that key releases as today (an open question in the README).
- **Never a write.** The release creates no commit and changes no file to fix the version.
- **The release skill.** `.agents/skills/release/SKILL.md` step 2 names the bump: before the dry run, the root `package.json` version equals the release's, through an ordinary merged commit. The hub README's release section lists the refusal.

## Acceptance criteria

- [ ] C1. `cland release --item R-<n> --dry-run` on a test project whose `dev` says 0.1.3 while the item's version is 0.1.4 refuses with `release-version` and names both versions (release-item.test.ts).
- [ ] C2. The same refusal for `cland release v0.1.4 --dry-run` and for the release without `--dry-run`, and nothing moves: `main`, the tags and the territory are unchanged (release.test.ts).
- [ ] C3. A bump committed on `dev` to 0.1.4 lets the dry run pass; the bump left uncommitted in the working copy does not.
- [ ] C4. A project whose root has no `package.json` previews and releases as before (the existing release tests pass unchanged).
- [ ] C5. The release skill's step 2 names the bump commit before the dry run.
