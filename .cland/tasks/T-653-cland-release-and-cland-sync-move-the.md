---
id: T-653
kind: task
title: cland release and cland sync move the territory's recorded default branch, not a hard-coded main
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - init
  - hub
assignee: null
parent: E-612
blocked_by:
  - T-652
topic: null
branch: null
created: 2026-10-16T16:24:02.732Z
updated: 2026-10-16T16:24:13.691Z
---

## Summary

A project whose default branch is `master` keeps it (spec v0.1.4 §3.2): its releases fast-forward `master` to `dev`, tag it and push `master` to GitHub, and `cland sync` imports GitHub's `master`. The release and sync code read ticket T-652's recorded default branch wherever they name `main` today; a project without the record behaves exactly as before. Whether this belongs to E-612 is an open question in the README.

## What to build

- In `hub/src/territory-release.ts` and the hub's release and sync paths (`hub/src/hub/releases.ts`, `hub/src/cli/release.ts`): every `refs/heads/main` (the local ref, the territory's, GitHub's in `ls-remote` and the fetch, the receipt's `main` field as the branch's tip, the "main is checked out" and "main is not an ancestor of dev" refusals) takes `defaultBranch(root)`.
- Refusal messages name the branch (`master is checked out; …`, `github/master has commits dev lacks`).
- The receipt (`.cland/release.tmp`) keeps its shape; a receipt written before this change still resumes.
- The release skill (`.agents/skills/release/SKILL.md`) and the hub README's release and sync sections say "the default branch (`main` unless the territory records another)" where they say `main`.

## Acceptance criteria

- [ ] C1. In a test project whose territory records `master`, `cland release v0.1.0 --dry-run` previews `<dev>:refs/heads/master` and the tag (release.test.ts with the on-disk GitHub stand-in).
- [ ] C2. The release itself fast-forwards local and territory `master` to `dev`, pushes `master` and the tag to the stand-in, and creates no `main` anywhere.
- [ ] C3. With a commit on the stand-in's `master` that `dev` lacks, the release refuses with `release-behind` naming `github/master`, and `cland sync` imports it.
- [ ] C4. A project without `cland.defaultBranch` releases and syncs `main` as before (the existing release, release-item and sync tests pass unchanged).
