---
id: T-837
kind: task
title: "`cland setup` reports the project, the harnesses and their logins, one line each; without a terminal it exits 1 while a step is open, and `--json` prints doctor's shape"
state: open
status: planned
size: M
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-835
topic: null
branch: null
created: 2026-10-19T06:34:12.801Z
updated: 2026-10-19T06:34:21.698Z
---

## Summary

Tracer bullet 1 lays the skeleton the other steps join. `cland setup [dir]` runs ordered steps that each detect and print one line (`ok`, `done`, `skip`, `open` or `fail`, the detail and the fix), then a summary. Without a terminal it asks nothing and exits 1 while any step is open or failed. `--json` prints `{root, version, interactive, steps, summary, next}`.

## What to build

- **The command.**
  - `cland setup [dir]` takes the same root rules as `cland init` (E-612 C1): the current folder or the positional directory, never HOME.
  - Its usage appears in `cland --help`.
  - Exit codes: 0 when nothing is open or failed, 1 otherwise, 130 when the human ends input at a question (question 17).
- **The runner.** The eight steps are named and ordered as spec §3.3 has them (question 1): `project`, `harnesses`, `logins`, `accounts`, `favourite`, `trust`, `hub`, `aide`.
  - Each step is its own module behind one ordered list and one options type, so N7–N13 each add a module and one line.
  - A step not built yet is absent, not stubbed.
  - Each step detects first, offers, acts, and detects again. The re-check decides, never an exit code (Q-594).
- **The steps this ticket builds.**
  - `project`: without `.cland/` it fails with "run cland init first", and setup stops.
  - `harnesses`, detection only, through N1's probe. Each harness gets one line with its version or "not installed".
    - A harness found only in an installer's folder says "not on your PATH yet: open a new shell".
    - A missing harness is `open` with "run: <official installer>" when none is installed (cland needs one), and `skip` with the installer as a hint otherwise.
  - `logins`, detection only. Each harness a role uses (N3's function, once N3 lands; until then all installed harnesses) gets one line. A signed-out one is `open` with "run: <its login command>", and OpenCode's is `skip` (optional: the free model needs none).
- **Without a terminal** (stdin or stdout not a TTY, or `--json`): nothing is asked, installed, written or launched. The heading says so, and the closing line names `cland setup` in a terminal.
- **`--json`**: the steps on stdout as doctor's shape. Narration goes to stderr. `next` is `cland setup` while a step is open, else `cland`.
- **`--yes`** is parsed and passed to the steps. Its meaning is fixed here, and N7–N13 honour it: it answers only the questions marked harmless, with their defaults; it never installs, signs in or launches (questions 2 and 3).
- **Running a child.** A shared helper runs a command with the terminal: stdio inherited, Ctrl+C and Ctrl+\ ignored by setup while the child runs, exit code or signal returned. N7, N8 and N14 use it. Nothing in this ticket calls it yet except a test.
- The hub README gets a `cland setup` section, which later tickets extend.

## Acceptance criteria

- [ ] C1. With an in-memory machine where Codex is missing and Claude Code is signed out, the flow reports `project ok`, one line per harness, and one line per login in the spec's order, and exits 1 without a terminal (T1 with the fake prompter, asserting it is never asked).
- [ ] C2. With no harness installed, each harness line is `open` and names its official installer, and with one installed the missing ones are `skip` with the installer as a hint (T1).
- [ ] C3. A folder without `.cland/` prints one `fail` line, "run cland init first", and exits 1 (T1), and `cland setup` in HOME refuses as init does (T2, CLI as subject).
- [ ] C4. `--json` prints one object with `root`, `version`, `interactive: false`, `steps`, `summary` and `next`, parseable by `JSON.parse`, with the narration on stderr (T2, CLI as subject, injected probe results).
- [ ] C5. A run where every step is `ok` exits 0, and its `--json` `next` is `cland` (T1).
- [ ] C6. The terminal helper returns a child's exit code, returns 128 plus the signal number for a signalled child, and removes its SIGINT and SIGQUIT handlers afterwards (T1 with an injected spawner).
