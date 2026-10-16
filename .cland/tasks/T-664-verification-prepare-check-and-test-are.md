---
id: T-664
kind: task
title: "[verification] prepare, check and test are config keys that the template writes and cland config set sets"
state: open
status: planned
size: S
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-633
topic: null
branch: null
created: 2026-10-16T16:35:23.509Z
updated: 2026-10-16T16:36:04.629Z
---

## Summary

`.cland/config.toml` gains `[verification] prepare`, `check` and `test` as command strings, where empty means not set. The template that `cland init` writes describes them, and `cland config set verification.<key>` (T-633) writes them. Nothing reads them yet.

## What to build

- **The keys** (`hub/src/init/config.ts`). `ProjectConfig.verification` gains `prepare`, `check` and `test`, strings that default to `""`. `parseConfig` takes any string, and a non-string value is refused with `verification.<key> must be a command string`. Values are kept verbatim, including spaces, quotes, `&&` and pipes.
- **The template.** `renderConfig` writes the three keys under `[verification]`, before `executor`, each with one comment line:
  - `prepare`: installs what `check` and `test` need. It runs on a droplet, in the prepared image and before every run, never on a local run.
  - `check`: the fast gate. It runs first, and on the host before a droplet is made.
  - `test`: the suite. Its exit code decides the run.

  A header line says that `cland verify` runs nothing until `test` is set, and names `cland config set verification.test '<command>'`. `cland update` keeps the values, as it keeps the others.
- **Reload** (`hub/src/hub/configuration.ts`). A changed command never demands a restart, because each run reads the commands (ticket T-666). The commands join the `applied` list that `cland hub reload` reports.
- **`cland config set`.** T-633 takes its keys from the template and the parser, so no change should be needed there. Check two things against T-633 as merged. First, a command value is stored verbatim, not parsed as TOML: `python3 -m unittest discover -s tests` is not valid TOML, and the argument of a string key is the value itself. Second, the output says the value applies at once. Adjust T-633's value parsing for string keys if either fails.

**Keeping cland's own suite intact.** No code reads the keys yet, this repository's `.cland/config.toml` is untouched here (ticket T-666 writes its values), and the parser accepts every existing config.

## Acceptance criteria

- [ ] C1. `parseConfig` reads `prepare`, `check` and `test` verbatim, `renderConfig` writes them with their comment lines, and a parse–render round trip keeps a value holding spaces, quotes and `&&` (config unit test).
- [ ] C2. A non-string command (`test = 3`) is refused with `verification.test must be a command string`, and an absent key reads as `""` (parser test).
- [ ] C3. `cland config set verification.test 'python3 -m unittest discover -s tests'` and the same for `check` and `prepare` write the keys verbatim. The hub's parser reads them back and the output says they apply at once (CLI test against a temporary project's hub).
- [ ] C4. `cland hub reload` after a changed `test` succeeds without "restart required" and lists the key as applied (`config-reload.test.ts`).
- [ ] C5. `cland init` in an empty folder writes the three keys empty with their comment lines, and `cland update` keeps a set value (`init.test.ts`).
