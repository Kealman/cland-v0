---
id: T-53
kind: task
title: "cland init: the project's origin becomes a local territory, GitHub becomes `github`, and `--undo` puts it back"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: impl-53
parent: T-20
blocked_by: []
topic: topic-10
branch: t/T-53-cland-init-territory
created: 2026-10-09T08:33:53.643Z
updated: 2026-10-09T08:39:12.987Z
---

## Parent

Part of T-20 (slice 2, ticket 1 of 12). Spec sections 4.9 and 7(a); ADR 0004.

## What to build

In a git project, `cland init` gains a territory step. It creates the bare repository `.cland/territory.git`, renames an existing `origin` to `github` (git carries the branches' upstreams along) and adds the territory as `origin`, creates `dev` from `main` when absent, and seeds the territory with `main` and `dev` by a local push: nothing reaches GitHub. The territory's `HEAD` points at `dev`, so tools that branch from the remote's default branch start from `dev`. Its `update` hook refuses every update or deletion of `main` and `dev` that does not carry cland's marker, naming `cland merge` and `cland release`; task branches stay free, force-pushes included. A clean root on `main` is switched to `dev`: the root lives on `dev`, the Coordinator's tracker and docs commits land there directly, task work reaches `dev` only through `cland merge`, and `main` moves only by `cland release` and `cland sync` (decision D1). The step lives in one territory module that `cland init` runs without a hub and the hub runs later for worktrees, merges, releases and syncs under one lock (decision D2; spec 4.2's "git operations stay outside" is amended to "git state stays in git; the hub runs the territory's commands"). `AGENTS.md`'s managed block reads "only `cland release` pushes to `github`" in a project with a territory and keeps today's rule without one. `cland doctor` checks the territory. `cland init --undo` restores the remotes and the root's branch, and deletes the territory only when it holds no ref the project's repository lacks; otherwise it names them and needs `--force`. It keeps `dev`. A project with no remote gets a territory and no `github`; a folder that is not a git repository gets none, with a note.

Interim rule for cland's own repository (decision D15 with checkpoints): cland moves onto its territory right after this ticket merges. Until ticket 5 (`cland release`) lands, the Coordinator squashes merged task work onto `dev` by hand, and the human's stand-in pushes a verified checkpoint of `main` to the `github` remote by hand at each step-level milestone, so GitHub does not go dark meanwhile. Say so in the docs where the push rule is described.

## Acceptance criteria

- [ ] In a temp project whose `origin` is a bare repository on disk standing in for GitHub, `cland init` reports each territory step. Afterwards `origin` is `.cland/territory.git`, `github` is the old URL, the territory holds `main` and `dev` with `HEAD` on `dev`, and the stand-in GitHub's refs are unchanged.
- [ ] The root is on `dev` afterwards; a root with uncommitted changes, or on another branch, is left where it is and the report says so.
- [ ] A second `cland init` reports every territory step `unchanged`, also in `--json`.
- [ ] From the project, `git push origin HEAD:dev` and `git push origin :main` are refused with a message naming `cland merge` and `cland release`; pushing and force-pushing `t/T-1-x` succeed.
- [ ] `cland init --undo` restores `origin` to the old URL, removes `github` and the territory, and puts the root back on `main`. With a branch only the territory holds, it refuses and names it, and `--force` proceeds.
- [ ] `AGENTS.md`'s managed block carries the new push rule with a territory and today's rule without one; `cland update` rewrites it the same way.
- [ ] `cland doctor` reports `territory` ok, or fails with a fix when `origin` is not the territory, `dev` is missing or the territory's `HEAD` is not `dev`.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents the territory, the interim rule and `--undo`.

## Notes

Test seam: the CLI as a process in temp projects with real git, as the worktree CLI tests do; assertions on remotes, refs, hooks, config and files; never on this repository. Size M. Implementer: Codex gpt-6.1-sol (plain git and provisioning, testable on disk inside its sandbox). Can start immediately.

## Comments

### impl-53 · 2026-10-09T08:38:07.498Z

Claimed. Using the ticket's agreed CLI-process seam in temporary real-Git projects. Inspecting init/update/doctor and ADR 0004 before adding territory provisioning, protection, and undo.

### coord · 2026-10-09T08:39:12.987Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/48 (a sub-issue of #20; the item is the source of truth).
