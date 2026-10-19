---
id: T-837
kind: task
title: "`cland setup` reports the project, the harnesses and their logins, one line each; without a terminal it exits 1 while a step is open, and `--json` prints doctor's shape"
state: open
status: ready
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-835
topic: topic-575
branch: t/T-837-cland-setup-reports-the-project-the
created: 2026-10-19T06:34:12.801Z
updated: 2026-10-19T09:11:39.615Z
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

- [x] C1. With an in-memory machine where Codex is missing and Claude Code is signed out, the flow reports `project ok`, one line per harness, and one line per login in the spec's order, and exits 1 without a terminal (T1 with the fake prompter, asserting it is never asked).
  - done: impl-837 · 2026-10-19T08:41:04.589Z
  - verified: rev-30 [reviewer] · run rev-20261019-837-final · 2026-10-19T09:11:37.315Z · commit c96703e58bf8b19494b59946c7fc3adf65dd054f
- [x] C2. With no harness installed, each harness line is `open` and names its official installer, and with one installed the missing ones are `skip` with the installer as a hint (T1).
  - done: impl-837 · 2026-10-19T08:54:11.997Z
  - verified: rev-30 [reviewer] · run rev-20261019-837-source-policy · 2026-10-19T08:54:27.820Z · commit c96703e58bf8b19494b59946c7fc3adf65dd054f
  - verified: rev-30 [reviewer] · run rev-20261019-837-final · 2026-10-19T09:11:37.315Z · commit c96703e58bf8b19494b59946c7fc3adf65dd054f
- [x] C3. A folder without `.cland/` prints one `fail` line, "run cland init first", and exits 1 (T1), and `cland setup` in HOME refuses as init does (T2, CLI as subject).
  - done: impl-837 · 2026-10-19T08:41:05.459Z
  - verified: rev-30 [reviewer] · run rev-20261019-837-final · 2026-10-19T09:11:37.315Z · commit c96703e58bf8b19494b59946c7fc3adf65dd054f
- [x] C4. `--json` prints one object with `root`, `version`, `interactive: false`, `steps`, `summary` and `next`, parseable by `JSON.parse`, with the narration on stderr (T2, CLI as subject, injected probe results).
  - done: impl-837 · 2026-10-19T08:41:05.844Z
  - verified: rev-30 [reviewer] · run rev-20261019-837-final · 2026-10-19T09:11:37.315Z · commit c96703e58bf8b19494b59946c7fc3adf65dd054f
- [x] C5. A run where every step is `ok` exits 0, and its `--json` `next` is `cland` (T1).
  - done: impl-837 · 2026-10-19T08:41:06.317Z
  - verified: rev-30 [reviewer] · run rev-20261019-837-final · 2026-10-19T09:11:37.315Z · commit c96703e58bf8b19494b59946c7fc3adf65dd054f
- [x] C6. The terminal helper returns a child's exit code, returns 128 plus the signal number for a signalled child, and removes its SIGINT and SIGQUIT handlers afterwards (T1 with an injected spawner).
  - done: impl-837 · 2026-10-19T08:41:06.699Z
  - verified: rev-30 [reviewer] · run rev-20261019-837-source · 2026-10-19T08:43:23.819Z · commit d84ce977ed4006340f1c6ccd727b8db9dd4b1fe1
  - verified: rev-30 [reviewer] · run rev-20261019-837-source-corrected · 2026-10-19T08:46:54.123Z · commit 209431bfb81098ed476bc36206b71711ab437867
  - verified: rev-30 [reviewer] · run rev-20261019-837-source-policy · 2026-10-19T08:54:27.820Z · commit c96703e58bf8b19494b59946c7fc3adf65dd054f
  - verified: rev-30 [reviewer] · run rev-20261019-837-final · 2026-10-19T09:11:37.315Z · commit c96703e58bf8b19494b59946c7fc3adf65dd054f

## Comments

### coord · 2026-10-19T08:11:30.485Z

Coordinator note (2026-10-19): if T-852 (E-616) lands first, hub/test/skills-onboarding.test.ts keeps `setup` in a pending-command list keyed T-837. That test fails once usage lists `setup`, so remove the entry in this ticket.

### impl-837 · 2026-10-19T08:39:12.889Z

Implemented the detection-only runner and three step modules, CLI root/TTY/JSON policy and terminal child helper. Specified seams used: T1 in-memory machine + strict fake prompter; T1 injected spawner/signal emitter; T2 CLI boundary/dispatch. No new harness processes, sockets or waits. Source/targeted evidence and criterion mapping will be attached before review. Parent qaPolicy is none/after-stage; no per-item QA brief required.

### rev-30 · 2026-10-19T08:43:23.819Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-837-source
commit: d84ce977ed4006340f1c6ccd727b8db9dd4b1fe1
scope: full
findings: [{"severity":"low","text":"L1: Auth-probe execution errors already carry a 'run ... by hand' hint from probeHarness; unconditional 'run:' formatting yields 'run: run codex login status by hand', not an executable recovery command. Keep prose hints separate or normalize command hints. Ordinary signed-out login commands are correct.","file":"hub/src/setup/steps/logins.ts","line":12}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear, one low diagnostic finding L1; no high/medium findings. A-5911 records full detection/root/TTY/JSON/terminal-child and corrected CLI-seam audit. Only three implemented ordered steps appear; project failure stops probes, --yes grants no actions, JSON/non-TTY remains report-only. Existing probe facts are memoized, missing installers/open-skip policy and terminal close/signal cleanup match C2/C6, verified. C1/C3/C4/C5 await exact-head mode-free task receipt. Superseded daf18a49 was never verified. T-852 pending-command removal remains an integration obligation if its file arrives. No Reviewer edits/tests.

Criteria: C2 verified, C6 verified.

### rev-30 · 2026-10-19T08:46:54.123Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-837-source-corrected
commit: 209431bfb81098ed476bc36206b71711ab437867
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-5914. Reviewed the two-file delta against prior full source A-5911. L1 is resolved: auth-probe instruction prose starting `run ` remains intact; the new pure regression fails before correction and passes afterward (A-5912, flow 5/5). Standards and Spec: no remaining findings. C2/C6 refreshed; C1/C3/C4/C5 await exact-head verification. No runtime gate claimed.

Criteria: C2 verified, C6 verified.

### rev-30 · 2026-10-19T08:53:57.973Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-837-runtime
commit: 209431bfb81098ed476bc36206b71711ab437867
scope: evidence
findings: [{"severity":"medium","text":"M1: New passive OpenCode installer literal trips accounts-policy's exact source scanner. A-5916:37671 identifies this file/opencode.ai. Update only the exact-file/exact-literal passive allowance or reuse approved guidance; preserve actual provider-target refusal.","file":"hub/src/setup/steps/harnesses.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear: A-5916 exits 1, ordinary T1 388/389 passes; T2 did not complete. Task-owned passive installer-policy carrier regression, not classified as a shared flake. Zero tier-mismatch rows, all 164 completed load groups 5/5 do not rescue the incomplete gate. Proposed c96703e5 correction will receive separate source review before replacement verification.

Criteria: C2 failed (Task-owned installer guidance fails the account source policy in exact-head run 26db89ed; gate incomplete.).

### rev-30 · 2026-10-19T08:54:27.820Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-837-source-policy
commit: c96703e58bf8b19494b59946c7fc3adf65dd054f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-5921. Sole delta is the exact-file/exact-literal passive installer exception, following the existing doctor guidance policy. Production, scanner needles and all other sites unchanged. A-5918 preserves deterministic red/green policy evidence and flow/typecheck checks. M1 resolved, no findings remaining. C2/C6 refreshed; C1/C3/C4/C5 await the new exact-head mode-free gate. A-5916 remains failed historical evidence.

Criteria: C2 verified, C6 verified.

### rev-30 · 2026-10-19T09:11:37.315Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-837-final
commit: c96703e58bf8b19494b59946c7fc3adf65dd054f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-5930. Full A-5929/37c06b9e audited: 1488/1488 ordinary pass, zero fail/cancel/skip/TODO, zero tier-mismatch rows; all 411 load groups 5/5. All eleven setup flow/terminal/CLI cases pass ordinarily and 5/5; corrected account-policy case passes. Source A-5911/A-5914/A-5921 plus evidence establish C1–C6. Prior failed A-5916 retained; L1 and carrier M1 resolved. No findings. T3 remains landing evidence; report-only lint/budget diagnostics disclosed. Existing T-852 pending-setup removal remains an integration obligation if that guard arrives.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
