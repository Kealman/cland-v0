---
id: T-639
kind: task
title: "Init tests run on a scratch machine: a temporary HOME, Git configuration and the folder kinds init meets"
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by: []
topic: topic-395
branch: t/T-639-init-tests-run-on-a-scratch-machine-a
created: 2026-10-16T16:23:56.312Z
updated: 2026-10-16T16:25:38.610Z
---

## Summary

A test fixture gives every init test of this epic a scratch machine: a temporary HOME with the hub's state directory in it, a Git configuration of its own (with or without an identity), and builders for the folder kinds `cland init` meets. Prefactoring: no behaviour of cland changes, and no init test touches the human's HOME or Git configuration again.

## What to build

- **The fixture module** `hub/test/init-machine.ts`, beside `harness.ts` (which stays as it is: the change is for this epic's new test files).
  - `scratchMachine(t, { identity })`: a temporary HOME under the test's temp folder; `XDG_CONFIG_HOME`, `XDG_DATA_HOME` and `XDG_STATE_HOME` under it; `GIT_CONFIG_GLOBAL` pointing at a file in it and `GIT_CONFIG_NOSYSTEM=1`; `GIT_AUTHOR_*`, `GIT_COMMITTER_*` and `EMAIL` removed from the environment. With `identity: true` the Git file holds a test name and email; with `identity: false` it holds none. `commit.gpgsign` is off either way.
  - The hub's state in that HOME: `legacyLedger(machine, entries)` writes `~/.cland/executor/spend.json` as v0.1.3 kept it, and `ledger(machine)` reads `~/.local/state/cland/spend.json`, so T-609 and the QA demo can stage both.
  - Folder builders, each under the scratch HOME: an empty folder; a folder with the project's own files and no Git; a repository without commits (optionally with a staged file); a bare upstream whose HEAD is `master` with one commit, and a full clone of it; a shallow clone (`--depth 1`, over `file://` so Git really makes it shallow); an initialised project with a subfolder.
  - `initIn(machine, folder, ...args)`: the CLI run as its own process (as `clandWithEnv` runs it) with the machine's environment.
  - `snapshot(dir, { except })`: a map of every path under `dir` to its content hash (links by target), minus the excepted folder, for "nothing outside the target folder changed".
- **A self-test** `hub/test/init-machine.test.ts` that proves the isolation, and its line in `hub/test/shards.json`.

## Acceptance criteria

- [ ] C1. A `cland` process started through `initIn` sees the scratch HOME as `HOME`, and `git config user.email` run in its folders prints nothing on a machine made with `identity: false` (init-machine.test.ts).
- [ ] C2. Each folder builder yields its kind as Git reports it: no repository, `rev-parse --verify HEAD` failing for the repository without commits, `origin/HEAD` naming `master` for the clone, and `rev-parse --is-shallow-repository` printing `true` for the shallow clone (init-machine.test.ts).
- [ ] C3. `snapshot` reports a file written outside the excepted folder and ignores one written inside it (init-machine.test.ts).
- [ ] C4. No file under the real HOME is read or written by the self-test: the fixture never falls back to `os.homedir()` (the self-test runs with `HOME` pointing at a folder it checks is untouched).
