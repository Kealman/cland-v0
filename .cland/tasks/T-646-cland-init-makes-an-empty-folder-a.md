---
id: T-646
kind: task
title: cland init makes an empty folder a repository whose first commit is cland's files, then the territory, ending on a clean dev
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-639
  - T-609
  - T-637
topic: null
branch: null
created: 2026-10-16T16:23:59.380Z
updated: 2026-10-16T16:24:10.839Z
---

## Summary

Today an empty folder stops with "main has no commit yet: create main, then run cland init". Init now runs `git init -b main` in a folder outside any repository, provisions as before, makes a first commit holding only cland's files, then creates the territory from that commit (ADR 0004), so the root ends on a clean `dev` (spec v0.1.4 §3.2, "The first commit"; prototype/setup 5028220a). This ticket is the empty folder; the next two extend it to folders with files, repositories without commits and a machine without a Git identity.

## What to build

- **A new module** `hub/src/init/repository.ts`, taking from the prototype what fits:
  - `createRepository(report, root)`: `git init -q -b main` when `root` is in no repository and holds nothing beside cland's own paths and `.DS_Store`; T-609's root check has already refused a folder inside another repository, so a nested repository cannot arise.
  - `commitClandFiles(report, root)`: the first commit on the new branch holding only the paths cland provisioned (`AGENTS.md`, `.cland/` as its `.gitignore` leaves it, `.agents/`, `.claude/`, `docs/agents/`), with the message `Initial commit: cland init` and the list of paths in its body. It runs Git with `-c core.hooksPath= -c commit.gpgsign=false`, as the release's own commits do (`hub/src/territory-release.ts`).
  - `foldReport(report, again)`: one line per path when the territory runs twice.
- **The order in `provision`** (`hub/src/init/provision.ts`): create the repository, the territory's first pass (as today, before generated files appear), the managed files, then, for a repository init has just made, the first commit and a second territory pass that seeds `main` and `dev` in the territory, sets `origin/HEAD` and switches the clean root to `dev`.
- **The report** shows `created .git` (git init -b main) and `created … main` (first commit <sha>: <paths> (<n> files)); the territory's "main has no commit yet" line no longer appears for this folder.
- **`cland update`** never creates a repository or a commit.
- **Tests** in a new `hub/test/init-first-commit.test.ts` (with its line in `hub/test/shards.json`) on the scratch machine of ticket T-639, with an identity configured.
- **Docs.** The hub README's init section describes the empty folder's path.

## Acceptance criteria

- [ ] C1. `cland init` in an empty folder leaves exactly one commit (`git log --oneline --all`), whose tree holds only `AGENTS.md`, `.cland/`, `.agents/`, `.claude/` and `docs/agents/` paths (init-first-commit.test.ts).
- [ ] C2. Afterwards `git status --porcelain` is empty, `git branch --show-current` prints `dev`, and `main` and `dev` point at that commit.
- [ ] C3. The territory exists with `main` and `dev` at that commit, its HEAD is `dev`, and `origin/HEAD` in the root is `origin/dev`.
- [ ] C4. A second `cland init` makes no commit and reports nothing to change.
- [ ] C5. The first commit carries none of `.cland/`'s volatile files (`hub.db`, `secret`, `territory.git/`, `log/`).
- [ ] C6. A Git commit hook installed through the scratch machine's global `core.hooksPath` does not run during init's commit.
- [ ] C7. Demo: in a scratch HOME, `mkdir x && cd x && cland init`, then `git log`, `git status` and `git branch` show the one commit on a clean `dev`.
