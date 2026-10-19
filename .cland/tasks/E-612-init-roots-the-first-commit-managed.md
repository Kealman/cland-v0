---
id: E-612
kind: epic
title: "Init: roots, the first commit, managed settings, categories"
state: closed
criterion_seq: 6
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by: []
topic: topic-557
branch: null
created: 2026-10-16T15:34:18.478Z
updated: 2026-10-19T06:25:46.774Z
closed: 2026-10-19T06:25:46.774Z
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

- [ ] C1. `cland init` and `cland update` serve only the current folder or the positional directory argument (`cland init <dir>`, as spec v0.1.4 §3.1 records; Q-599's `--dir` was not adopted), refuse a different discovered root naming both paths, never take HOME as a root, and the hub's state lives in `~/.local/state/cland`, the spend ledger moved there on first locked access while the legacy copy is kept for older hubs.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:25:12.217Z · commit 1e7600b3ea978fa99e767e34710470d7d9cb558f
- [ ] C2. An empty folder, a repository without commits and a non-empty folder without Git get a first commit of cland's files only, as `cland <cland@local>` when Git has no identity, with the human's files left as they were.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:25:12.217Z · commit 1e7600b3ea978fa99e767e34710470d7d9cb558f
- [ ] C3. Init accepts any default branch, creates the territory, leaves the root on a clean `dev`, seeds the four categories, refuses a shallow clone with its hint, and ends with `next: cland setup` (`next` in `--json`).
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:25:12.217Z · commit 1e7600b3ea978fa99e767e34710470d7d9cb558f
- [ ] C4. `.claude/settings.json` holds the managed `"worktree": {"bgIsolation": "none"}`, which `cland update` restores and the Claude Code launch settings carry, and `.claude/settings.local.json` overrides it untouched.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:25:12.217Z · commit 1e7600b3ea978fa99e767e34710470d7d9cb558f
- [ ] C5. `cland` outside a project prints "not a cland project: run cland init" and starts no hub, and `cland open` before setup prints "next: cland setup" and opens the workbench.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:25:12.218Z · commit 1e7600b3ea978fa99e767e34710470d7d9cb558f
- [ ] C6. The root `package.json` version is the one `cland --version`, the spoke and the managed marks report, and `cland release` refuses with `release-version` when it differs from the release's.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T06:25:12.218Z · commit 1e7600b3ea978fa99e767e34710470d7d9cb558f

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

### hub · 2026-10-19T06:14:43.155Z

demo 5e95a88a-de4d-4ce4-90fb-e692b418c981 created: droplet cland-v0-5e95a88a, commit 1e7600b3ea978fa99e767e34710470d7d9cb558f, deadline 2026-10-19T07:28:16.795Z.

### hub · 2026-10-19T06:23:37.041Z

demo 5e95a88a-de4d-4ce4-90fb-e692b418c981 destroyed: lifetime 360435 ms; cost $0.0250.

### qa-676 · 2026-10-19T06:25:12.218Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-19-1
commit: 1e7600b3ea978fa99e767e34710470d7d9cb558f
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Surface / executor | Result | Command / observation | Evidence |
| --- | --- | --- | --- | --- |
| G0 | hub-api / local | PASS | clean worktree atS; committed brief; on dev; Node24; zsh expansion corrected before completing subchecks | [G0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/G0.txt), [G0-shell-note.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/G0-shell-note.txt) |
| G1 | hub-api / local | PASS | 16 children closed;16 merge commits ancestors;criteriaC1-C6 mapped atSTART | [G1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/G1.txt), [G1-epic.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/G1-epic.json), [G1-children.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/G1-children.json) |
| G2 | hub-api / local | PASS | QA hold acquired and present | [G2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/G2.txt) |
| D0 | hub-api / droplet | PASS | one active droplet lease5e95a88a exactS deadline07:28:16.795Z | [D0-start.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D0-start.json), [D0-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D0-status.json) |
| D1 | hub-api / droplet | PASS | exactS clean Linuxx86_64 Node24.21.0 Git2.43; script timeout pgrep present | [D1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D1.txt) |
| D2 | hub-api / droplet | PASS | verbatim library SHA256 matches; every scratch machine fixture matches brief | [D2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D2.txt), [D2-local-sha.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D2-local-sha.txt), [D2-remote-sha.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D2-remote-sha.txt) |
| R1 | hub-api / droplet | PASS | ck R1 R1; all specified assertions matched | [R1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/R1.txt) |
| I1 | hub-api / droplet | PASS | ck I1 I1; all specified assertions matched | [I1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/I1.txt) |
| I1b | hub-api / droplet | PASS | ck I1b I1b; all specified assertions matched | [I1b.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/I1b.txt) |
| R2 | hub-api / droplet | PASS | ck R2 R2; all specified assertions matched | [R2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/R2.txt) |
| I2 | hub-api / droplet | PASS | ck I2 I2; all specified assertions matched | [I2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/I2.txt) |
| I3 | hub-api / droplet | PASS | ck I3 I3; all specified assertions matched | [I3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/I3.txt) |
| I4 | hub-api / droplet | PASS | ck I4 I4; all specified assertions matched | [I4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/I4.txt) |
| I5 | hub-api / droplet | PASS | ck I5 I5; all specified assertions matched | [I5.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/I5.txt) |
| I6 | hub-api / droplet | PASS | ck I6 I6; all specified assertions matched | [I6.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/I6.txt) |
| R3 | hub-api / droplet | PASS | ck R3 R3; all specified assertions matched | [R3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/R3.txt) |
| L1 | hub-api / droplet | PASS | ck L1 L1; all specified assertions matched | [L1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/L1.txt) |
| S1 | hub-api / droplet | PASS | ck S1 S1; all specified assertions matched | [S1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/S1.txt) |
| S2 | hub-api / droplet | PASS | ck S2 S2; all specified assertions matched | [S2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/S2.txt) |
| S3 | hub-api / droplet | PASS | ck S3 S3; all specified assertions matched | [S3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/S3.txt) |
| K | hub-api / droplet | PASS | ck K K; all specified assertions matched | [K.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/K.txt) |
| O1 | hub-api / droplet | PASS | ck O1 O1; all assertions matched; O4 nvim.log is knownT830 informational | [O1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/O1.txt) |
| O2 | hub-api / droplet | PASS | ck O2 O2; all assertions matched; O4 nvim.log is knownT830 informational | [O2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/O2.txt) |
| O3a | hub-api / droplet | PASS | ck O3a O3a; all assertions matched; O4 nvim.log is knownT830 informational | [O3a.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/O3a.txt) |
| O4 | hub-api / droplet | PASS | ck O4 O4; all assertions matched; O4 nvim.log is knownT830 informational | [O4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/O4.txt) |
| O3b | hub-api / droplet | PASS | ck O3b O3b; all assertions matched; O4 nvim.log is knownT830 informational | [O3b.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/O3b.txt) |
| V1 | hub-api / droplet | PASS | ck V1 V1; all specified assertions matched | [V1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/V1.txt) |
| V2 | hub-api / droplet | PASS | ck V2 V2; all specified assertions matched | [V2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/V2.txt) |
| V3 | hub-api / droplet | PASS | ck V3 V3; all specified assertions matched | [V3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/V3.txt) |
| V4 | hub-api / droplet | PASS | ck V4 V4; all specified assertions matched | [V4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/V4.txt) |
| E1 | hub-api / droplet | PASS | ck E1 E1; all specified assertions matched | [E1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/E1.txt) |
| E2 | hub-api / droplet | PASS | ck E2 E2; all specified assertions matched | [E2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/E2.txt) |
| E3 | hub-api / droplet | PASS | ck E3 E3; all specified assertions matched | [E3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/E3.txt) |
| X1 | hub-api / droplet | PASS | ck X1 X1; all specified assertions matched | [X1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/X1.txt) |
| T1 | hub-api / droplet | PASS | droplet: node --test hub/test/init-roots.test.ts; exit0 fail0; 6 tests, 6 passed | [T1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T1.txt), [T1-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T1-full.log) |
| T2 | hub-api / droplet | PASS | droplet: node --test hub/test/init-machine.test.ts; exit0 fail0; 1 tests, 1 passed | [T2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T2.txt), [T2-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T2-full.log) |
| T3 | hub-api / droplet | PASS | droplet: node --test hub/test/init-first-commit.test.ts; exit0 fail0; 15 tests, 15 passed | [T3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T3.txt), [T3-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T3-full.log) |
| T4 | hub-api / droplet | PASS | droplet: node --test hub/test/executor-spend.test.ts; exit0 fail0; 10 tests, 10 passed | [T4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T4.txt), [T4-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T4-full.log) |
| T5 | hub-api / droplet | PASS | droplet: node --test hub/test/territory-cli.test.ts; exit0 fail0; 22 tests, 22 passed | [T5.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T5.txt), [T5-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T5-full.log) |
| T6 | hub-api / droplet | PASS | droplet: node --test hub/test/init-categories.test.ts; exit0 fail0; 7 tests, 7 passed | [T6.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T6.txt), [T6-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T6-full.log) |
| T7 | hub-api / droplet | PASS | droplet: node --test hub/test/init-settings.test.ts; exit0 fail0; 4 tests, 4 passed | [T7.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T7.txt), [T7-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T7-full.log) |
| T8 | hub-api / droplet | PASS | droplet: node --test hub/test/claude-code-environment.test.ts; exit0 fail0; 5 tests, 5 passed | [T8.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T8.txt), [T8-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T8-full.log) |
| T9 | hub-api / droplet | PASS | droplet: node --test hub/test/open.test.ts; exit0 fail0; 5 tests, 5 passed | [T9.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T9.txt), [T9-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T9-full.log) |
| T10 | hub-api / droplet | PASS | droplet: node --test hub/test/cli.test.ts; exit0 fail0; 3 tests, 3 passed | [T10.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T10.txt), [T10-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T10-full.log) |
| T11 | hub-api / droplet | PASS | droplet: node --test hub/test/in-process-spoke.test.ts; exit0 fail0; 3 tests, 3 passed | [T11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T11.txt), [T11-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T11-full.log) |
| T12 | hub-api / droplet | PASS | droplet: node --test hub/test/release.test.ts; exit0 fail0; 21 tests, 21 passed | [T12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T12.txt), [T12-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T12-full.log) |
| T13 | hub-api / droplet | PASS | droplet: node --test hub/test/release-item.test.ts; exit0 fail0; 9 tests, 9 passed | [T13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T13.txt), [T13-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/T13-full.log) |
| D14 | hub-api / local | PASS | freshness.current=true at testedS;dev unchanged | [D14-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D14-status.json), [D14-dev.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D14-dev.txt) |
| D15 | hub-api / local | INCONCLUSIVE — provisional, superseded by D15-confirmed | provider destruction reported by Coordinator404;hub remains releasing knownT820;498352ms/$0.0346 provisional;verdict deferral authorized | [D15-stop.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D15-stop.json), [D15-known-accounting.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D15-known-accounting.json), [D15-provider-confirmation.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D15-provider-confirmation.txt), [D15-comments.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D15-comments.txt), [request.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/request.txt) |
| D15-confirmed | hub-api / local | PASS | hub now confirms released and destroyed comment;final360435ms cost$0.025030208333333335;supersedes provisional D15 deferral | [D15-after.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D15-after.json), [D15-comments-confirmed.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D15-comments-confirmed.txt), [D14-final-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D14-final-status.json) |

Findings by severity:

- High: none.
- Medium: none.
- Low: no new finding. **Known T-830** was observed in O4: `ck O4 O4` printed `HOME state dir [nvim.log spend.json ]`. The brief and requester classify this Neovim state-directory overlap as information, not a failed check. T-829 was not observed in this scratch flow; X1 reported zero scratch hubs and a clean delivered tree.

Cleanup transition: D15 initially remained releasing, known **T-820**. The Coordinator reported provider404 destruction at06:22:53Z and authorized provisional accounting. The final freshness read then returned released; the hub destroyed comment confirms360435ms/$0.025030208333333335, superseding498352ms/$0.0346. The command batch appended the provisional INCONCLUSIVE record before its final-state response was inspected, so D15-confirmed explicitly corrects that ordering. No product check was rerun. See [provider report](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D15-provider-confirmation.txt), [final receipt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D15-after.json), and [destroyed comment](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/D15-comments-confirmed.txt).

Criterion marks:

| Criterion | Result | Checks |
| --- | --- | --- |
| C1 | PASS / verified | R1–R3, I5, L1, E1 ledger; outside snapshots I1–I6/S2/E1; T1,T2,T4 |
| C2 | PASS / verified | I1–I3; T3 |
| C3 | PASS / verified | I1,I1b,I2–I6,K; T1,T5,T6 |
| C4 | PASS / verified | S1–S3; T7,T8 |
| C5 | PASS / verified | O1,O2,O3a,O4,O3b,R3b; T9 |
| C6 | PASS / verified | V1–V4,I1b,E2,E3; T10–T13 |

Build, execution and accounting:

- E-612; run `qa-2026-10-19-1`; tested full SHA `1e7600b3ea978fa99e767e34710470d7d9cb558f`; committed brief `qa/briefs/E-612.md`, merged on dev. Clean detached worktree, sixteen closed children and all sixteen child merge commits were ancestors of S.
- One demo lease `5e95a88a-de4d-4ce4-90fb-e692b418c981`, machine `cland-v0-5e95a88a`, Linux x86_64, Node v24.21.0, Git 2.43.0. Created 2026-10-19T06:13:18.286Z; deadline 2026-10-19T07:28:16.795Z. Final state **released**, confirmed by the hub’s destruction comment. Lifetime **360435 ms**, total remote cost **$0.02503021**. Per-case costs are cumulative snapshots and are not summed.
- Total wall time from hold acquisition through D15 accounting: approximately 719.4 seconds. Total cost $0.02503021. G0–G2/D14/D15 were local control/read checks; all product execution ran on the droplet. No local fallback and no second lease.
- **49 brief checks satisfied at final accounting** (D15’s provisional INCONCLUSIVE record is retained and superseded by D15-confirmed PASS), including **13 targeted files / 111 tests**, all first attempts. No full-suite verify was submitted because the brief expressly excludes it. D14 freshness.current=true.
- Library sha256 `05abf471a0d12b325cd89882c625dd8439affae0c1853cac3cb2af1f061bcfbb` matched locally and remotely; the committed library was not edited. Its env-i wrappers isolated HOME/XDG/Git identity and excluded the live session credentials. All remotes were local stand-ins. X1 stopped both scratch hubs and found zero delivered-tree changes.

What the manual checks established:

- Init refused HOME and a different discovered root, naming both paths; snapshots outside each intended target stayed unchanged. The legacy-only HOME also refused init/open as specified.
- Empty, nonempty and unborn folders received exactly one cland-only commit with fallback identity `cland <cland@local>`. Human files stayed byte/mtime identical and staged notes remained staged. Main/master/trunk territory defaults and shallow refusal/unshallow were correct.
- Ledger migration preserved legacy bytes/mtime, created the new spend ledger and receipt, and retained the expected spent amounts. The scratch hub read the new state path.
- Update restored bgIsolation=none, then became byte/mtime idempotent; settings.local.json stayed untouched. Four categories were committed and listed through the scratch hub.
- Bare cland on a terminal and open outside a project refused without starting a hub or changing files. Open before setup printed its one-line hint; the real headless workbench connected to the scratch root and exited0. The simulated setup mark suppressed the hint.
- CLI, spoke, managed marks and hub discovery all reported root version0.1.3. Both dry-run and real release rejected a mismatched version; an uncommitted bump was ignored. Committing the bump allowed only the preview, with stand-in refs unchanged and no tag/release.tmp.

Accepted gaps and brief clarifications:

- At START, C1 already used the positional directory argument and explicitly described first-locked-access migration with a retained legacy copy. This maps the revised task text to the same checks; the old --dir wording in the brief is not a new finding. R2e records the unsupported flag refusal as information.
- Migration was exercised through inspectSpend under scratch HOME2, as the committed brief specifies; executor status is a read-only observation. The retained legacy ledger is intentional.
- Real Claude Code was not launched. T8 covers adapter launch settings; S3 proves the local settings file was preserved. Claude Code’s own local-over-project precedence is an accepted boundary.
- I4 retained two historical commits and left cland files untracked, with no tracked change, as the brief permits. O2’s piped help output is informational. O3b simulated setup’s CHOSEN mark because setup is outside this epic.
- No real external GitHub, real harness/model, live-root init/update/release, or root workbench was exercised. Release commands used only the scratch stand-in remote.
- The brief’s C4 table has a stale T6/T7 cross-reference; the actual Part T list and final criteria map identify T7/T8. All thirteen files were run, so none was omitted.
- Recorder surface is hub-api; local macOS/droplet describe placement rather than the surface enum. A project-rule proposal to keep those distinct was sent to the Coordinator. The initial G0 shell invocation hit zsh’s $S: modifier parsing; the unexecuted subchecks were completed with ${S}: and retained in G0-shell-note.txt before PASS was recorded.

Evidence: [committed brief](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/brief.md), [request](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/request.txt), [all run records](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/run-records.jsonl), [raw scratch captures](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/scratch-captures/ev), [library](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence/lib.sh). Test summaries and full logs are linked in the table.

Evidence A-5823: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5823-e-612-qa-qa-2026-10-19-1-complete-demo-evidence

Verdict report A-5824: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5824-e-612-qa-clear-c1-c6-111-tests-confirmed-lease-accounting.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-19T06:25:46.774Z

Closed on QA clear qa-2026-10-19-1 at 1e7600b3 (C1–C6; 13 files / 111 tests; evidence A-5823, report A-5824). Known: T-830 (nvim.log in the hub state dir); T-820 (release confirmation lag) seen on its lease.
