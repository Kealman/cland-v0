---
id: T-664
kind: task
title: "[verification] prepare, check and test are config keys that the template writes and cland config set sets"
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-633
topic: topic-558
branch: t/T-664-verification-prepare-check-and-test-are
created: 2026-10-16T16:35:23.509Z
updated: 2026-10-19T07:53:36.982Z
closed: 2026-10-19T07:53:36.982Z
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

- [x] C1. `parseConfig` reads `prepare`, `check` and `test` verbatim, `renderConfig` writes them with their comment lines, and a parse–render round trip keeps a value holding spaces, quotes and `&&` (config unit test).
  - done: impl-664 · 2026-10-19T06:15:19.447Z
  - verified: rev-30 [reviewer] · run rev-20261019-664-final · 2026-10-19T06:27:19.905Z · commit 178e5103b1ce738526d531897c362d3cc4387e12
- [x] C2. A non-string command (`test = 3`) is refused with `verification.test must be a command string`, and an absent key reads as `""` (parser test).
  - done: impl-664 · 2026-10-19T06:15:20.024Z
  - verified: rev-30 [reviewer] · run rev-20261019-664-final · 2026-10-19T06:27:19.905Z · commit 178e5103b1ce738526d531897c362d3cc4387e12
- [x] C3. `cland config set verification.test 'python3 -m unittest discover -s tests'` and the same for `check` and `prepare` write the keys verbatim. The hub's parser reads them back and the output says they apply at once (CLI test against a temporary project's hub).
  - done: impl-664 · 2026-10-19T06:15:20.595Z
  - verified: rev-30 [reviewer] · run rev-20261019-664-final · 2026-10-19T06:27:19.905Z · commit 178e5103b1ce738526d531897c362d3cc4387e12
- [x] C4. `cland hub reload` after a changed `test` succeeds without "restart required" and lists the key as applied (`config-reload.test.ts`).
  - done: impl-664 · 2026-10-19T06:15:21.207Z
  - verified: rev-30 [reviewer] · run rev-20261019-664-final · 2026-10-19T06:27:19.905Z · commit 178e5103b1ce738526d531897c362d3cc4387e12
- [x] C5. `cland init` in an empty folder writes the three keys empty with their comment lines, and `cland update` keeps a set value (`init.test.ts`).
  - done: impl-664 · 2026-10-19T06:15:21.910Z
  - verified: rev-30 [reviewer] · run rev-20261019-664-final · 2026-10-19T06:27:19.905Z · commit 178e5103b1ce738526d531897c362d3cc4387e12

## Comments

### impl-664 · 2026-10-19T06:14:22.357Z

Implemented test-first slices for command parse/render, non-string refusal, literal CLI string arguments, and reload reporting. Extended the existing init/update contract to check empty commands with comments and preservation of a configured shell command. Lowest-tier coverage uses T1 parser tests and T2 projectHub config/reload tests; no new lifecycle fixture or real token. Beginning host checks.

### rev-30 · 2026-10-19T06:16:35.937Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-664-source
commit: 178e5103b1ce738526d531897c362d3cc4387e12
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-5812 Standards/Spec audit has no findings. Parser/template preserve literal command strings with empty defaults/exact non-string refusals and requested comments. CLI derives string types from template and preserves argv while retaining numeric/list/table parsing and existing managed-writer validation. Reload names all three as applied without startup restriction. Existing init/update contract asserts empty template and set-value preservation; no resolver/repository config/execution edits. T1/T2 added at appropriate seams; existing assertions retained. C1–C5 final marks await unchanged-head mode-free task gate and host evidence; no criteria verified here. T3 init execution remains landing-batch evidence. QA scope none.

### impl-664 · 2026-10-19T06:26:54.028Z

Same-head mode-free droplet verification 3a6c15a8-f1ed-4cf0-84be-f4447c20f3fd passed at 178e5103b1ce738526d531897c362d3cc4387e12: 1038 tests passed, zero failures/cancelled/skipped. Linux x64 c-8 lon1, lifetime 551s, cost $0.0383. Log A-5825: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5825-suite-3a6c15a8-f1ed-4cf0-84be-f4447c20f3fd-auto-at-178e510.log. T3 remains in the merge batch; existing host init/update receipt is A-5814. Reviewer received the suite result directly; awaiting final verdict without changing the head.

### rev-30 · 2026-10-19T06:27:19.905Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-664-final
commit: 178e5103b1ce738526d531897c362d3cc4387e12
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-5826 combines source A-5812, exact-head selected task gate 3a6c15a8/A-5825 (1038/1038, zero fail/cancel/skip) and retained host init 13/13 A-5814. Parser 5/5, CLI 9/9, reload 4/4 execute; four new identities each pass five repetitions. All 239 global groups pass 5/5. Literal shell strings/comments, defaults/refusals, argv/readback/applies-now, restart-free applied keys and init/update preservation established. Five inherited report-only T-803 Git rows disclosed, none from task tests. C1–C5 verified; no findings, QA none. No Neovim/T3 task execution claimed; native init Linux coverage remains landing-batch evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-19T07:53:36.982Z

Merged 3834b5a144594cabbc0b50955af632ccbd911786 onto dev.
