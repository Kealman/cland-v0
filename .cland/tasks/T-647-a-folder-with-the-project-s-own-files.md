---
id: T-647
kind: task
title: A folder with the project's own files and a repository without commits get the same first commit, and the human's files stay as they were
state: open
status: planned
size: S
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-646
topic: null
branch: null
created: 2026-10-16T16:23:59.744Z
updated: 2026-10-18T20:04:45.804Z
---

## Summary

A non-empty folder without Git and a repository without commits get what an empty folder gets (Q-599 resolution 1): `git init -b main` where no repository exists, then a first commit holding only cland's files. The human's files, untracked or staged, stay exactly as they were, and the root ends on `dev` (spec v0.1.4 §3.2).

## What to build

- **The folder with files.** `createRepository` (ticket T-646) no longer stops at the project's own files: it runs `git init -b main` in any folder outside a repository. The prototype's "kept: put the project in git, then run cland init again" line goes.
- **The repository without commits.** An unborn branch gets the first commit too; it lands on that branch, whatever its name (an unborn `master` gets a first `master` commit), and `dev` starts from it.
- **Only cland's paths.** The commit holds the paths init created in this run under cland's five folders and files; a file that existed before init (a human's `AGENTS.md`, `.claude/settings.json` or `CLAUDE.md` that init merged into, a human's own file under `.claude/` or `docs/`) stays out of the commit and keeps its content as init left it (the rule is an open question in the README). A path the human's `.gitignore` ignores is left out and reported, never forced in.
- **The index.** The commit is built so that entries the human staged before init stay staged and are not part of it (a temporary index, or `git commit --only` with the paths); cland's committed paths are in the real index afterwards, so `git status` does not show them as deleted.
- **The root on `dev`.** After a first commit init has just made, the territory's second pass switches the root to `dev` although the human's files are untracked: `main` and `dev` are the same commit, so the switch touches no file of theirs (`hub/src/territory.ts`, the root-branch step, which today requires a clean status).
- **Existing tests that change.** `hub/test/territory-cli.test.ts`'s "non-Git folders get a note" now expects a repository; `hub/test/init.test.ts`'s `gitRepo` helper gains one commit of a README, so its tests keep describing a repository with history.
- **Docs.** The hub README's init section covers the three kinds of folder.

## Acceptance criteria

- [ ] C1. In a folder holding `README.md` and `src/app.js` without Git, `cland init` makes one commit of cland's paths only, and `git status --porcelain` lists exactly `?? README.md` and `?? src/` (init-first-commit.test.ts).
- [ ] C2. Those files' bytes and mtimes are unchanged (ticket T-639's `snapshot` of the folder minus cland's paths).
- [ ] C3. In a repository without commits holding a staged `notes.txt`, init's commit does not contain `notes.txt`, and `git status` still shows it staged as a new file.
- [ ] C4. In a repository without commits whose unborn branch is `master`, the first commit lands on `master` and `dev` starts from it.
- [ ] C5. A human's own `AGENTS.md` and `.claude/settings.json` present before init are not in the first commit, and init's managed block and hooks are in their working-copy content.
- [ ] C6. In each of the three cases the root ends on `dev` and the territory holds `dev` at the first commit.
