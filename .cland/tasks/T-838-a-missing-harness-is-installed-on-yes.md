---
id: T-838
kind: task
title: A missing harness is installed on yes and detected again; a declined install stays declined until `--install`; an unedited roles template is rebuilt
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-837
topic: null
branch: null
created: 2026-10-19T06:34:12.894Z
updated: 2026-10-19T06:34:12.894Z
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

- [ ] C1. With Codex missing, a yes runs the Codex installer through the injected `run`, and the re-check finding it gives `codex done`, while a re-check still not finding it gives `codex fail` with the command (T1).
- [ ] C2. A no records `codex` in `[setup] declined_installs`, and a second run asks nothing about Codex and reports it `skip` with the `--install codex` hint (T1).
- [ ] C3. `--install codex` runs the installer without a question, also without a terminal, and clears the decline (T1).
- [ ] C4. Without a terminal and without `--install`, no installer runs and nothing is written to `config.toml` (T1, asserting `run` is never called).
- [ ] C5. An unedited template built for `["claude-code"]` is rebuilt for `["claude-code","codex"]` after Codex installs, while an edited `roles.toml` stays byte-identical (T1).
- [ ] C6. `cland update` keeps a `declined_installs` value, and `cland config set setup.declined_installs` accepts a list of harness ids and refuses an unknown id (T1/T2).
