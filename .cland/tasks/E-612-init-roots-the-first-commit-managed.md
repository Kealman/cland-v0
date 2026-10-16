---
id: E-612
kind: epic
title: "Init: roots, the first commit, managed settings, categories"
state: open
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by: []
topic: null
branch: null
created: 2026-10-16T15:34:18.478Z
updated: 2026-10-16T16:24:51.547Z
---

## Summary

`cland init` becomes safe and complete on any folder: it serves only the folder it is given and never HOME, makes the first commit of cland's files where there is none, accepts any default branch, writes the managed `bgIsolation` key and the four categories, refuses a shallow clone with a hint, and ends with "next: cland setup". cland's version becomes the root package's, equal to the tag.

## Goal

A newcomer runs `cland init` in any folder and gets a project ready for `cland setup`, and nothing outside that folder changes. Today init walks up and takes HOME as the project root when HOME holds the hub's `~/.cland/` state: on 2026-10-16 it wrote cland's files into HOME, and undoing that by hand deleted the droplet spend ledger (T-609). An empty folder stops with "main has no commit yet: create main, then run cland init", and a repository whose default branch is not `main` gets no `dev`. Background Claude Code sessions cannot edit the main checkout until they enter a worktree (Q-600 question 12). A new project has no categories although every clause files into them, a shallow clone fails deep in the territory with "shallow update not allowed", and every tag from v0.0.1 to v0.1.3 reports version 0.1.0.

## Contents

- **Roots** (Q-599 resolution 1, T-609). `cland init` and `cland update` serve the current folder or `--dir` only; when the root they discover differs, they refuse and name both paths. HOME is never a project root.
- **The state directory** (Q-599 resolution 1, T-609). The hub's machine-wide state moves from `~/.cland/executor` to `~/.local/state/cland`, so nothing under HOME looks like a project, and the droplet spend ledger (`spend.json`) moves there once.
- **The first commit** (Q-599 resolution 1, Q-597). An empty folder, a repository without commits and a non-empty folder without Git get `git init -b main` where no repository exists, then a first commit holding only cland's files (`AGENTS.md`, `.cland/`, `.agents/`, `.claude/`, `docs/agents/`); the human's files stay as they were. Without a Git identity, init commits as `cland <cland@local>`.
- **Any default branch** (map decision 8). An existing repository's default branch, `main`, `master` or another, is accepted, and `dev` and the territory start from it.
- **The territory** is created from that commit, and the root is left on a clean `dev`.
- **The closing line.** Every init ends with `next: cland setup`, and `--json` carries `next`.
- **Managed settings** (map decision 14, Q-599 resolution 5). `.claude/settings.json` holds `"worktree": {"bgIsolation": "none"}` as a managed key beside cland's hooks, `cland update` restores it, and the hub's Claude Code launch settings carry the same key. `.claude/settings.local.json` overrides it, and cland never touches that file.
- **The four categories** (Q-600 resolution 3). Init seeds Bugs, Tech debt, Follow-ups and Ideas.
- **Shallow clones** (Q-600 resolution 6). Init refuses a shallow clone with "the territory needs the full history" and the command that fetches it (`git fetch --unshallow`).
- **Outside a project** (Q-599 resolution 6). `cland` in a folder without `.cland/` prints "not a cland project: run cland init" and starts no hub. `cland open` in a project initialised but not set up prints "next: cland setup" in one line and opens the workbench as usual.
- **The package version** (Q-599 resolution 7, Q-592). The root `package.json` version is the only source and equals the tag. `cland --version`, the spoke's version (hard-coded 0.1.0 today) and the managed marks read it, and `cland release` refuses with `release-version` when `dev`'s version differs from the release's. The bump is an ordinary commit before the dry run; `cland release` never writes it.

Not in this epic: the one-command install from the GitHub tag and the rest of Q-592's fixes, deferred by the human on 2026-10-16; `cland setup` ("Setup: the guided step ending in the workbench").

Left to the spec (§3.2) and the plan: what marks a project as set up for `cland open`'s line (the setup prototype marks the favourite harness's line in `[aide.launch]`).

## Tracer-bullet order

1. **Roots and the state directory.** The refusal, HOME, and the move of the state directory with its ledger. Demo: under a scratch HOME holding the hub's state, `cland init` in a folder without a repository writes nothing outside it, `cland init` in a subfolder of a project refuses and names both paths, and the spend ledger is read from `~/.local/state/cland`.
2. **The first commit and the territory.** The three kinds of folder, the fallback identity, any default branch, the shallow refusal and the closing line. Demo: on an empty folder, a repository without commits and a non-empty folder without Git, init leaves one commit of cland's files on a clean `dev` and prints `next: cland setup`; a clone whose default branch is `master` gets its `dev`; a shallow clone is refused with the hint.
3. **Settings and categories.** Demo: a fresh project's `.claude/settings.json` holds `bgIsolation = "none"`, `cland update` restores it after an edit, a value in `.claude/settings.local.json` is left alone, and `cland task list --kind category` lists the four categories.
4. **The lines outside a project, and the version.** Demo: `cland` in a plain folder prints its line and starts no hub, `cland open` before setup prints `next: cland setup`, `cland --version` prints the root package's version, and `cland release --dry-run` refuses a version that differs.

## Definition of done

QA runs the demo below on `dev`, through the demo lease where no macOS is needed, playing the human through the `cland` CLI and a headless workbench, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

Under a scratch HOME holding the hub's state directory, QA runs `cland init` in an empty folder, a repository without commits, a non-empty folder without Git and without a Git identity, a clone whose default branch is `master`, a shallow clone, a subfolder of an initialised project, and HOME itself. It reads each result in `git log`, `git status`, `git branch`, the territory and `cland task list`, and checks that nothing outside the target folder changed. It then runs `cland` in a plain folder, `cland open` in a project not yet set up, `cland --version`, and `cland release --dry-run` with a version that differs from the root package's.

- [ ] C1. `cland init` and `cland update` serve only the current folder or `--dir`, refuse a different discovered root naming both paths, never take HOME as a root, and the hub's state lives in `~/.local/state/cland` with the spend ledger moved there.
- [ ] C2. An empty folder, a repository without commits and a non-empty folder without Git get a first commit of cland's files only, as `cland <cland@local>` when Git has no identity, with the human's files left as they were.
- [ ] C3. Init accepts any default branch, creates the territory, leaves the root on a clean `dev`, seeds the four categories, refuses a shallow clone with its hint, and ends with `next: cland setup` (`next` in `--json`).
- [ ] C4. `.claude/settings.json` holds the managed `"worktree": {"bgIsolation": "none"}`, which `cland update` restores and the Claude Code launch settings carry, and `.claude/settings.local.json` overrides it untouched.
- [ ] C5. `cland` outside a project prints "not a cland project: run cland init" and starts no hub, and `cland open` before setup prints "next: cland setup" and opens the workbench.
- [ ] C6. The root `package.json` version is the one `cland --version`, the spoke and the managed marks report, and `cland release` refuses with `release-version` when it differs from the release's.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **The prototypes.** prototype/setup is never merged; the implementation takes from it what fits (Q-601 resolution 5).
- **ADRs.** 0003 (The hub is a per-project daemon): a project root is the folder the human names, never HOME. 0004 (Agents work on a local git territory): the territory starts from the first commit.
- **Tests.** Init runs against temporary folders with a temporary HOME and Git configuration, without an identity for the fallback case, never against the human's HOME.
- **Risks.**
  - The spend ledger is what the daily droplet cap counts: losing it in the move resets the day's spend (T-609).
  - Init commits in a folder that may already hold the human's files: the first commit names cland's files only.
- **Order.** Second in the hub lane: after "The Aide's reach and the settings commands" in the lane's order, with no blocking edge. "Setup: the guided step ending in the workbench" waits for it.

## Links

- Spec: `docs/spec/v0.1.4.md`, §3.1 (the install, deferred), §3.2 (Init) and §4 (The cut).
- Items: map M-591, decisions 3, 8 and 14; Q-599 (question 10 and resolutions 1, 5, 6 and 7); Q-600 (questions 3, 4 and 12, resolutions 3 and 6); Q-597 (the setup prototype); Q-592 (the version rule and the deferred install); T-609, the HOME incident filed under R-577, whose three criteria this epic meets.
- Prototype: prototype/setup 5028220a (the first commit and the closing line) and 24ca0729 (the managed key), never merged.
- Research: `docs/research/install-from-github.md` on research/install-from-github (87b77611).
- Code: `hub/src/cli/init.ts`, `hub/src/init/provision.ts`, `hub/src/init/claude-settings.ts`, `hub/src/project.ts` (`projectRoot`), `hub/src/territory.ts`, `hub/src/executor/droplet/spend.ts` (`spendPath`), `hub/src/version.ts`, `hub/src/spoke/spoke.ts`, `hub/src/release.ts`, `hub/src/cli/open.ts`, `hub/bin/cland.ts`.
- GLOSSARY: Hub, Territory, Category.

## Plan

```yaml
stages:
  - name: roots, the state directory, the closing line, the managed key and the version
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-639
        - T-609
        - T-640
        - T-641
      - - T-642
        - T-643
      - - T-644
        - T-645
  - name: the first commit, the categories, any default branch and the lines outside a project
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-646
        - T-647
        - T-648
      - - T-649
      - - T-652
        - T-653
      - - T-650
        - T-651
```

## Comments

### coord · 2026-10-16T16:24:51.547Z

Coordinator decisions on the ticket cut (D51), 2026-10-16: (1) 'set up' = setup's CHOSEN mark on [aide.launch] harness (this repo prints the line until setup runs once); (2) the first commit takes only the paths init created in this run, never a pre-existing file it merged into; (3) 'clean dev' for a folder with the human's files = cland's files committed, the human's untracked or staged as before; (4) only an explicit Git identity counts; the first commit runs without hooks or signing; (5) T-653 stays in E-612; default-branch order origin/HEAD, main, master, the only branch, else refuse; (6) the root version stays 0.1.3 until E-617's bump, hub/package.json drops its version; (7) the release-version check covers any project whose dev package.json declares a version; (8) the ledger move honours XDG_STATE_HOME, and all hubs restart together; (9) cland outside a project exits 1, cland hub start unchanged; (10) init --undo after the first commit keeps the repo, the commit and dev; (11) T-609 is M and blocked by T-639; (12) T-643 also reads settings.local.json; (13) T-652's implementer writes the ADR 0004 amendment line in the same change.
