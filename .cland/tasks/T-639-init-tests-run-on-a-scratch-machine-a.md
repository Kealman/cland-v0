---
id: T-639
kind: task
title: "Init tests run on a scratch machine: a temporary HOME, Git configuration and the folder kinds init meets"
state: open
status: review
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by: []
topic: topic-395
branch: t/T-639-init-tests-run-on-a-scratch-machine-a
created: 2026-10-16T16:23:56.312Z
updated: 2026-10-16T16:32:22.294Z
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

- [x] C1. A `cland` process started through `initIn` sees the scratch HOME as `HOME`, and `git config user.email` run in its folders prints nothing on a machine made with `identity: false` (init-machine.test.ts).
  - done: impl-639 · 2026-10-16T16:32:19.144Z
- [x] C2. Each folder builder yields its kind as Git reports it: no repository, `rev-parse --verify HEAD` failing for the repository without commits, `origin/HEAD` naming `master` for the clone, and `rev-parse --is-shallow-repository` printing `true` for the shallow clone (init-machine.test.ts).
  - done: impl-639 · 2026-10-16T16:32:20.341Z
- [x] C3. `snapshot` reports a file written outside the excepted folder and ignores one written inside it (init-machine.test.ts).
  - done: impl-639 · 2026-10-16T16:32:21.216Z
- [x] C4. No file under the real HOME is read or written by the self-test: the fixture never falls back to `os.homedir()` (the self-test runs with `HOME` pointing at a folder it checks is untouched).
  - verified: rev-30 [reviewer] · run rev-20261016-639-source · 2026-10-16T16:31:46.844Z · commit faa26007c541970dc43212d5075ad852e18ddc63
  - done: impl-639 · 2026-10-16T16:32:22.294Z

## Comments

### impl-639 · 2026-10-16T16:28:16.503Z

Added isolated init-machine fixture, all folder builders, legacy/XDG ledger helpers and non-following filesystem snapshots. Self-tests run under a scratch-owned inherited HOME with hostile Git configuration/identity; targeted init-machine.test.ts passes (exit 0, 4.17 s total; 1-minute load 13.55 before start). No production or existing harness/init test changes.

### impl-639 · 2026-10-16T16:30:13.752Z

Ready for source review at faa26007c541970dc43212d5075ad852e18ddc63, pushed to origin. Fetched/merged origin/dev 4555eafe before review. Final checks: npm run typecheck exit 0 (hub + Neovim); targeted init-machine.test.ts exit 0 in 4.367 s, wrapper 4.173 s, starting 1-minute load 14.15; shard lint and staged diff check exit 0. No test >5 s, no duration allowance needed. QA policy scope none / after-stage; requesting review only.

### rev-30 · 2026-10-16T16:31:46.844Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-639-source
commit: faa26007c541970dc43212d5075ad852e18ddc63
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-639 source review

Commit faa26007c541970dc43212d5075ad852e18ddc63; fixed point 4555eafe0f84c91649c962dbf432bd9f911eb320. Local and origin task tips agree. Three test-only files reviewed against T-639. Production, existing harness and existing init tests are unchanged. Both axes performed in-session; role delegation is disabled.

## Standards
No findings. Subprocess environment is explicit; every CLAND_ and GIT_ override plus EMAIL is excluded before scratch HOME/XDG and Git configuration are set. Global configuration points to an owned file, system configuration is disabled and signing is off. Optional identity is written only to that scratch file. Seed commits use command-local identity and hooks settings, retaining identity:false for later commands.

CLI and Git subprocess calls are asynchronous with a 30-second execution bound and preserve exit/stdout/stderr. Owned temporary roots use existing cleanup. snapshot walks sorted directory entries, hashes ordinary files, records directories and symlink targets without following those links, and uses exact subtree equality rather than prefix matching. Object.fromEntries safely preserves ordinary __proto__ filenames. The new self-test is classified machine; whitespace diff check passes.

## Spec
C1 implementation: initIn invokes the actual CLI with the machine environment. A scratch-owned Node preload checks the actual subprocess HOME/XDG values and writes a receipt. The self-test checks absent Git email/removed author and injected-config variables for identity:false, and exact configured identity/signing for identity:true.

C2 implementation: all requested builders live under the machine HOME. Empty and project-files folders remain nonrepositories; unborn repositories optionally stage a file. The bare upstream has master HEAD and one seed commit. Full and depth-1 clones use file://; Git assertions check origin/HEAD, exact commit count and real shallow status. The initialized-project builder seeds a repository, invokes init and returns its subfolder with Git root and managed-file checks.

C3 implementation: the snapshot self-test changes both excepted and outside paths, checks content hashes change, records an empty directory and symlink, and checks relative/absolute exclusions agree.

C4 established by source: the fixture imports tmpdir, not homedir, and does not runtime-import harness.ts (its CliResult import is type-only). The wrapper launches all six inner scenarios with a poisoned scratch-owned inherited HOME/Git identity; it snapshots that HOME before/after and requires equality. Fixture subprocesses receive a distinct new HOME. This is the specified unchanged-snapshot check, not a claim of filesystem read tracing.

Legacy ledger helper stages the v0.1.3 path under scratch HOME; the current ledger reader honors XDG_STATE_HOME. Its self-test selects a custom XDG state directory. No user home path is chosen as a fallback.

## Evidence and criteria
A-4008 summarizes exact-head validation: one outer wrapper with six enclosed scenarios passes, 4.367 seconds total/4.173 seconds wrapper, starting load 14.15; root typecheck and shard lint exit 0. This is a summarized targeted receipt, not a raw full task result. No Reviewer tests/compiler/CLI init execution occurred.

Source clear, zero findings. C4 source verified; C1–C3/final runtime evidence await same-head droplet verification, including the new wrapper's repetitions. Claimant done marks were absent at the item read; record them as evidence is completed. No per-item QA required. A changed head needs fresh source review.

Standards 0 findings; Spec 0 findings.
Artifact: A-4011 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4011-t-639-source-clear-isolated-init-machine-and-folder-builders.md

Criteria: C4 verified.
