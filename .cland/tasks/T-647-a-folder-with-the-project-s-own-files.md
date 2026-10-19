---
id: T-647
kind: task
title: A folder with the project's own files and a repository without commits get the same first commit, and the human's files stay as they were
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-646
topic: topic-545
branch: t/T-647-a-folder-with-the-project-s-own-files
created: 2026-10-16T16:23:59.744Z
updated: 2026-10-19T03:06:48.806Z
closed: 2026-10-19T03:06:48.806Z
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

- [x] C1. In a folder holding `README.md` and `src/app.js` without Git, `cland init` makes one commit of cland's paths only, and `git status --porcelain` lists exactly `?? README.md` and `?? src/` (init-first-commit.test.ts).
  - done: impl-647 · 2026-10-19T03:06:14.634Z
  - verified: rev-30 [reviewer] · run rev-20261019-647-final · 2026-10-19T03:06:39.146Z · commit df590fa872983c87eef1bede766cc5671568df52
- [x] C2. Those files' bytes and mtimes are unchanged (ticket T-639's `snapshot` of the folder minus cland's paths).
  - done: impl-647 · 2026-10-19T03:06:14.956Z
  - verified: rev-30 [reviewer] · run rev-20261019-647-final · 2026-10-19T03:06:39.146Z · commit df590fa872983c87eef1bede766cc5671568df52
- [x] C3. In a repository without commits holding a staged `notes.txt`, init's commit does not contain `notes.txt`, and `git status` still shows it staged as a new file.
  - done: impl-647 · 2026-10-19T03:06:15.371Z
  - verified: rev-30 [reviewer] · run rev-20261019-647-final · 2026-10-19T03:06:39.146Z · commit df590fa872983c87eef1bede766cc5671568df52
- [x] C4. In a repository without commits whose unborn branch is `master`, the first commit lands on `master` and `dev` starts from it.
  - done: impl-647 · 2026-10-19T03:06:15.788Z
  - verified: rev-30 [reviewer] · run rev-20261019-647-final · 2026-10-19T03:06:39.146Z · commit df590fa872983c87eef1bede766cc5671568df52
- [x] C5. A human's own `AGENTS.md` and `.claude/settings.json` present before init are not in the first commit, and init's managed block and hooks are in their working-copy content.
  - done: impl-647 · 2026-10-19T03:06:16.141Z
  - verified: rev-30 [reviewer] · run rev-20261019-647-final · 2026-10-19T03:06:39.146Z · commit df590fa872983c87eef1bede766cc5671568df52
- [x] C6. In each of the three cases the root ends on `dev` and the territory holds `dev` at the first commit.
  - done: impl-647 · 2026-10-19T03:06:16.568Z
  - verified: rev-30 [reviewer] · run rev-20261019-647-final · 2026-10-19T03:06:39.146Z · commit df590fa872983c87eef1bede766cc5671568df52

## Comments

### impl-647 · 2026-10-19T02:33:14.866Z

Implemented first-commit handling for non-empty folders and unborn repositories. Native Git regressions cover untouched README/src bytes and mtimes, staged blob plus distinct working-copy preservation on main/master, pre-existing managed-file exclusion, and ignored-path reporting. First-commit tests: 14/14, 17.89 s. Waiting for Coordinator's T-649 landing note before merging dev and requesting first source review.

### rev-30 · 2026-10-19T02:38:07.678Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-647-source
commit: c49d568964d270e91849bef8430daa9d6b0c8417
scope: full
findings: [{"severity":"low","text":"L1: older territory paragraphs (also line 1013) still say non-Git folders get no territory and unborn repositories must commit main then rerun init, contradicting the new first-commit behavior. Refresh those sentences; qualify existing dirty-root rules as applying to repositories with history.","file":"hub/README.md","line":1009}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear with one low documentation finding; no high/medium findings. A-5730 records both axes and all eight files. Pre-provision inventory, ignore-aware newly-created selection, commit --only index preservation, actual unborn branch reporting and exact-first-commit dev switch match the spec; T-649 awaited seeding retained. C1–C6 remain unverified pending accepted exact-head gate. L1: README older territory paragraphs at 1009/1013 still describe the superseded non-Git/unborn behavior. QA scope none.

### rev-30 · 2026-10-19T02:38:53.072Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-647-readme-delta
commit: df590fa872983c87eef1bede766cc5671568df52
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear; L1 resolved. A-5731 records the exact two-paragraph README correction against c49d5689; executable source/tests unchanged, no dev merge. Full source audit A-5730 remains applicable. No findings on either axis; C1–C6 remain unverified pending accepted exact-new-head runtime evidence. QA scope none.

### impl-647 · 2026-10-19T03:05:52.496Z

Same-head mode-free droplet verify 8a0a3863-ce84-4809-b4cc-bed46a89c8e5 passed at df590fa872983c87eef1bede766cc5671568df52: auto exit 0; 2393 tests, 2388 passed, 5 skipped, zero failed/cancelled. Linux x64 c-8 lon1, lifetime 1549 s, cost $0.1076. Log A-5736 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5736-suite-8a0a3863-ce84-4809-b4cc-bed46a89c8e5-auto-at-df590fa.log). Receipt delivered to responsible Reviewer; awaiting final same-head verdict.

### rev-30 · 2026-10-19T03:06:39.146Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-647-final
commit: df590fa872983c87eef1bede766cc5671568df52
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear from source A-5730/A-5731 and accepted exact-head gate 8a0a3863/A-5736; audit A-5737. Hub-only plus Neovim smoke: 2388 passed, 5 skips, zero failures/cancellations. First-commit 15/15 and all 75 corresponding repetition bodies pass; init 13/13, territory CLI 14/14 and shared init-process 4/4 pass. Exact human file bytes/mtimes/status, staged and distinct working blobs on main/master, excluded merged settings/instructions, ignore reports and root/territory refs established. L1 resolved; no remaining findings. Three known T-803 report-only trips and other diagnostics disclosed. C1–C6 verified; QA scope none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-19T03:06:48.806Z

Merged 716e3315cd5d4d07c3906bf2ca48101ce4750a56 onto dev.
