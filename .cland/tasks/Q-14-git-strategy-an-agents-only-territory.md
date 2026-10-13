---
id: Q-14
kind: question
title: "Git strategy: an agents-only territory and what flows to GitHub"
state: closed
labels:
  - wayfinder:grilling
assignee: Kealman
parent: M-1
blocked_by:
  - Q-5
topic: null
branch: null
created: 2026-10-07T14:52:30Z
updated: 2026-10-08T13:17:15.595Z
github:
  repo: Kealman/cland-v0
  number: 14
  url: https://github.com/Kealman/cland-v0/issues/14
---

## Question

How do agents work with git? Decide:

- The agents-only territory: a local or self-hosted git engine where agents branch, open PR-like changes, get them reviewed by gpt 6.1 sol through `/codex:rescue`, and merge without a human reading the code.
- What flows to GitHub and how: release-ready versions rather than many PRs; who pushes; what the GitHub history looks like.
- How the territory relates to the task tracker.
- How collaborators' work in GitHub flows back.

Produce an ADR.

## Comments

### Kealman · 2026-10-07T17:33:56Z

<!-- github-comment: 6043297840 -->

## Resolution

Decided on 2026-10-07 in a grilling session with the human, on the findings of #5. `GLOSSARY.md` (592e8f5) carries the terms; ADR 0004, `docs/adr/0004-agents-work-on-a-local-git-territory.md`, records the choice and the rejected options.

**Territory: plain git, no forge.** The agents' territory is the project repository plus a layer cland owns: a branch and a worktree per item, review and QA verdicts in the tracker (decided in #8), and a merge command that checks the verdicts, the gate git itself lacks. Gitea is rejected for v0 (a second system with accounts, force-pushing mirrors, slow merges at hundreds of open PRs) and stays the fallback if a PR interface for humans becomes necessary. Radicle is rejected.

**Remotes.** The project's `origin` is a local bare repository, the territory, inside the project's cland folder (the sub-folder name is decided with the state layout). Agents and their tools may push to `origin` freely. GitHub is the remote `github`; only the release step and the human push to it. Tools that push to `origin` on their own therefore stay on the machine.

**Branches.** `main` is the release branch, the mirror of GitHub. `dev` is the agents' integration branch. Task branches `t/T-123-slug` start from `dev`. A task lands on `dev` as one squash commit whose message comes from the item; the task branch is rebased before the merge and the Implementer resolves conflicts. cland serializes merges.

**Merge gate.** `cland merge T-123` (a hub tool, available to the Coordinator) checks: a `clear` review verdict from a session holding the Reviewer role; a `clear` QA verdict from the QA role where the item is marked as requiring QA; the branch rebased on `dev`. Otherwise it refuses with the reason. The hub guarantees the reviewer's identity because it knows the calling session's role. Commit signing is not used in v0 (fog).

**Worktrees.** cland creates a worktree per item at claim time (a path inside the cland folder; exact location decided with the state layout); Implementer sessions start with `cwd` = the worktree; the worktree is removed after the merge. Harnesses do not create their own worktrees: Claude Code's creation is intercepted with the `WorktreeCreate` hook, Codex has none, OpenCode's are experimental.

**Release to GitHub.** `cland release` fast-forwards `main` to `dev` (GitHub receives one commit per task and no pull requests), tags it `vX.Y.Z` with a number the human chooses, and pushes `main` and the tag to `github`. Release notes are built from the titles of the items in `main..dev` and go into the tag message. Collaborators' work comes back with `fetch github main`, after which `dev` is rebased on or merged with `main`. Squashing a whole release into one commit is rejected: it loses the task history.

**Initialising an existing project.** `cland init` in a repository whose `origin` is GitHub: creates the local bare repository from the current one, renames the current `origin` to `github`, adds the bare repository as `origin`, creates `dev` from `main` if absent. It pushes nothing to GitHub and is reversible with `cland init --undo`.

**Abandoned tasks.** When an item closes without a merge (`wontfix`, cancelled), cland removes the worktree and the task branch after the human confirms.

**Not decided here.** Sub-folder names in the cland folder (state layout, fog); commit signing per role (fog); how Reviewer and QA sessions run against a task worktree (process layer, #17, and implementation).
