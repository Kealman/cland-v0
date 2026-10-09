---
id: T-58
kind: task
title: "task branches: claiming a task makes its branch from dev in its own worktree, and its Implementer launches there"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: impl-58
parent: T-20
blocked_by:
  - T-53
topic: topic-16
branch: t/T-58-task-branches-and-launch-with-item
created: 2026-10-09T08:34:54.694Z
updated: 2026-10-09T10:13:18.337Z
---

## Parent

Part of T-20 (slice 2, ticket 3 of 12). Spec sections 4.7 and 7(a); ADR 0004.

## What to build

In a project with a territory (T-53), the first claim of an open item of kind `task` creates its task branch `t/T-<n>-<slug>` (the slug of the item's file name) at `dev`'s tip, and the linked worktree `.cland/worktrees/T-<n>/`, linked to the project's own repository, as today (decision D3). It writes `branch` into the item and records a worktree notice in Agents; later claims reuse both (decision D7). `session.launch` takes `item`, in the spoke tool, as `cland session launch … --item T-12` and as an item line in the launcher form: the hub ensures the worktree, launches the session there and claims the item for it, so the worktree always exists before its session. `item` is for Implementers; a Reviewer or QA session that should stand in the worktree gets `cwd`. A Claude Code session launched with an item gets a worktree-creation hook that refuses and names the session's own worktree; the Coordinator's sub-agent worktrees are untouched and start from `dev` (decision D8). `cland worktree list` shows each worktree with its item, branch, the item's state and the sessions whose cwd is inside it. `cland worktree prune`, the human's command, lists the worktrees of closed items with their unmerged commits, and removes each worktree and branch only after a `y` (`--yes` for all); the merged worktrees of T-48 and T-49 are its first job on cland's own repository.

## Acceptance criteria

- [ ] `cland task claim T-12` on an open task creates `t/T-12-<slug>` at `dev`'s tip and `.cland/worktrees/T-12/`, sets `branch:` in the item file, and Agents shows the notice; a second claim, or one after a release, reuses both.
- [ ] `cland session launch impl-12 --role implementer --item T-12` starts the session in `.cland/worktrees/T-12`, with the claim held by `impl-12` (taken over from the Coordinator's, if it had one) and T-12 beside it in the sessions panel. The launcher form and the spoke's `session.launch` with `item` do the same.
- [ ] An epic, spec, question or map, a closed item, or a project without a territory gets no worktree; the claim works as today and the result says why.
- [ ] A real Codex Implementer launched with `--item` commits on its task branch inside its sandbox, and a real Claude Code Implementer's worktree creation is refused with the path of its own; both runs are recorded on the item.
- [ ] `cland worktree list` shows item, branch, state and the sessions inside each worktree.
- [ ] `cland worktree prune` shows a closed item's unmerged commits, removes its worktree and branch only after `y`, and is refused from a session's shell as a human-only command.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` documents claims, `--item`, the hook and the worktree commands.

## Notes

Test seam: real git on disk in a temp project with a territory; the CLI and spokes against a real hub with the fake harnesses (the launch cwd, the claim, the fake Claude Code running the hook); one real Codex and one real Claude Code launch, recorded on the item. Size L. Implementer: Claude Code (two criteria need real launches in a worktree, beyond the fakes). Serial with ticket 4 (T-20's merge ticket): both extend the territory module.

## Comments

### coord · 2026-10-09T08:39:13.264Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/53 (a sub-issue of #20; the item is the source of truth).
