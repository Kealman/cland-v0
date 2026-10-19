---
id: T-838
kind: task
title: A missing harness is installed on yes and detected again; a declined install stays declined until `--install`; an unedited roles template is rebuilt
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-837
topic: topic-581
branch: t/T-838-a-missing-harness-is-installed-on-yes
created: 2026-10-19T06:34:12.894Z
updated: 2026-10-19T12:43:32.294Z
closed: 2026-10-19T12:43:32.294Z
---

## Summary

Tracer bullet 2, the install half. For a missing harness, setup shows the official user-level installer and runs it on the human's yes, in this terminal with its stdio inherited, then detects the harness again. A declined install is recorded in `.cland/config.toml` and not offered again until `cland setup --install <harness>`. When `roles.toml` is still exactly the template init wrote, setup rebuilds it for the new set of harnesses (T-637, question 6).

## What to build

- **The offer.** The installer command is shown before the question `Install <Harness> now? [y/N]`. These are the prototype's three commands. Codex's has no pin choice (question 11):
  - `curl -fsSL https://claude.ai/install.sh | bash`
  - `curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh`
  - `curl -fsSL https://opencode.ai/v2/install | bash`
- **Running a child.** The installer runs through N6's terminal helper.
- **The re-check decides.**
  - Found afterwards: `done`, with the version, and "open a new shell" when the binary is only in the installer's folder.
  - Still missing: `fail`, naming the exit code and the command to run by hand.
  - Setup's own PATH includes the installers' folders, so later steps and the hub find a fresh install.
- **Declined installs.** `[setup] declined_installs = [...]` in `.cland/config.toml`, a managed key that `cland update` keeps and `cland config set` accepts (question 4).
  - A declined harness is `skip` "declined earlier; cland setup --install <h>", asked nothing.
  - `--install <h>` runs that installer without asking and removes the decline.
  - Without a terminal, `--install <h>` is the only way an installer runs (question 2).
- **The template rebuild.** After an install, if `isRolesTemplate` holds for `roles.toml`, it is rewritten as `rolesTemplate(<installed now>)`, and the harness line says "roles.toml rebuilt for <set>". An edited file, or one already marked by the favourite step, is never touched.

## Acceptance criteria

- [x] C1. With Codex missing, a yes runs the Codex installer through the injected `run`, and the re-check finding it gives `codex done`, while a re-check still not finding it gives `codex fail` with the command (T1).
  - done: impl-838 · 2026-10-19T11:34:38.914Z
  - verified: rev-30 [reviewer] · run rev-20261019-838-final · 2026-10-19T11:51:53.540Z · commit c7e36da58976598041c4980b602bc3ec168e07dd
- [x] C2. A no records `codex` in `[setup] declined_installs`, and a second run asks nothing about Codex and reports it `skip` with the `--install codex` hint (T1).
  - done: impl-838 · 2026-10-19T11:29:53.219Z
  - verified: rev-30 [reviewer] · run rev-20261019-838-final · 2026-10-19T11:51:53.540Z · commit c7e36da58976598041c4980b602bc3ec168e07dd
- [x] C3. `--install codex` runs the installer without a question, also without a terminal, and clears the decline (T1).
  - done: impl-838 · 2026-10-19T11:34:39.438Z
  - verified: rev-30 [reviewer] · run rev-20261019-838-final · 2026-10-19T11:51:53.540Z · commit c7e36da58976598041c4980b602bc3ec168e07dd
- [x] C4. Without a terminal and without `--install`, no installer runs and nothing is written to `config.toml` (T1, asserting `run` is never called).
  - done: impl-838 · 2026-10-19T11:29:54.253Z
  - verified: rev-30 [reviewer] · run rev-20261019-838-source-corrected · 2026-10-19T11:35:17.161Z · commit c7e36da58976598041c4980b602bc3ec168e07dd
  - verified: rev-30 [reviewer] · run rev-20261019-838-final · 2026-10-19T11:51:53.540Z · commit c7e36da58976598041c4980b602bc3ec168e07dd
- [x] C5. An unedited template built for `["claude-code"]` is rebuilt for `["claude-code","codex"]` after Codex installs, while an edited `roles.toml` stays byte-identical (T1).
  - done: impl-838 · 2026-10-19T11:29:54.688Z
  - verified: rev-30 [reviewer] · run rev-20261019-838-source-corrected · 2026-10-19T11:35:17.161Z · commit c7e36da58976598041c4980b602bc3ec168e07dd
  - verified: rev-30 [reviewer] · run rev-20261019-838-final · 2026-10-19T11:51:53.540Z · commit c7e36da58976598041c4980b602bc3ec168e07dd
- [x] C6. `cland update` keeps a `declined_installs` value, and `cland config set setup.declined_installs` accepts a list of harness ids and refuses an unknown id (T1/T2).
  - done: impl-838 · 2026-10-19T11:29:55.263Z
  - verified: rev-30 [reviewer] · run rev-20261019-838-final · 2026-10-19T11:51:53.540Z · commit c7e36da58976598041c4980b602bc3ec168e07dd

## Comments

### impl-838 · 2026-10-19T11:28:51.430Z

C1–C5 implemented and covered through T1 setup-flow's injected machine: official installer/recheck, decline persistence/explicit retry, no nonterminal effects, and conservative template rebuild. C6 covered by T1 config round-trip/update provisioning plus T2 config CLI with projectHub. Typecheck and targeted files green. Preparing source review; no real installer/login executed.

### rev-30 · 2026-10-19T11:32:17.645Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-838-source
commit: d740ee435235866317030f1db336aa45bca0f483
scope: full
findings: [{"severity":"medium","text":"M1: New chatgpt.com Codex installer literal is forbidden by accounts-policy.test.ts:9 and has no exact-file/exact-literal exception. Its source scanner will fail before runtime phases. Add a narrow authorized-installer allowance while preserving unrelated provider/credential checks.","file":"hub/src/setup/steps/harnesses.ts","line":13},{"severity":"medium","text":"M2: --json --install is accepted, but run uses terminalCommand's stdio:'inherit'; installer stdout precedes the report on stdout, breaking the one-JSON-object contract. Preserve installer terminal behavior in text mode and keep JSON stdout clean, with an output-boundary regression.","file":"hub/src/setup/machine.ts","line":28},{"severity":"medium","text":"M3: anyInstalled is captured before installation and never refreshed. Starting with none and explicitly installing one leaves the other missing alternatives open, so even a successful logged-in install exits 1 rather than treating alternatives as skip. Base final optionality on post-action installed facts, preserving all-missing open behavior.","file":"hub/src/setup/steps/harnesses.ts","line":33},{"severity":"low","text":"L1: Setup README still promises no nonterminal/JSON writes and says all actions are future work. Document this task's explicit --install nonterminal action; coordinate with T-841's concurrent favourite wording fix.","file":"hub/README.md","line":982}]
finding_counts: {"high":0,"medium":3,"low":1}

Source not clear; A-5967. M1 account-source policy lacks the authorized Codex installer exception; M2 inherited installer stdout breaks JSON explicit-install output; M3 stale pre-action anyInstalled leaves optional alternatives open after the first successful install. L1 README action/flag wording stale. Shared writer/template/config safeguards otherwise match the task; host A-5963 retained. Correct these boundaries and request fresh source review before verification; no Reviewer tests or real installers.

Criteria: C1 failed (New Codex literal trips account source policy; first install leaves missing alternatives incorrectly open from stale pre-action facts.), C3 failed (Accepted --json --install inherits installer stdout and corrupts the single JSON report.).

### rev-30 · 2026-10-19T11:35:17.161Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-838-source-corrected
commit: c7e36da58976598041c4980b602bc3ec168e07dd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-5973. M1/M2/M3/L1 resolved. Exact authorized installer exception preserves scanner restrictions; JSON fd routing [0,2,2] spans CLI/action/machine/helper while text inherits I/O; first successful install normalizes earlier/later open alternatives without downgrading failures; README updated. Original decline/config/template safeguards retained. A-5971 red/green controls and prior A-5963 host checks recorded. C4/C5 source verified; C1/C2/C3/C6 await exact-head mode-free task evidence. No findings, no dev merge, no Reviewer edits/tests.

Criteria: C4 verified, C5 verified.

### rev-30 · 2026-10-19T11:51:53.540Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-838-final
commit: c7e36da58976598041c4980b602bc3ec168e07dd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged corrected-source head. A-5999 audits A-5996 / f6b261c9: 1518/1518 ordinary passes, zero fail/cancel/skip/TODO, all 441 load-gate groups 5/5 and zero tier-mismatch rows. Installer/re-check, persistent decline/explicit retry, conservative template update, config validation, JSON fd routing and narrow source-policy controls all pass. C1–C6 verified; existing report-only budget/lint findings retained. T3 remains merge-batch landing evidence; no Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-19T12:43:32.294Z

Merged 2053ce483ab28fa19c744cd5ca031f1b28950abe onto dev.
