---
id: T-671
kind: task
title: hub/README.md, docs/agents/tests.md and the verify usage describe prepare, check and test
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-664
  - T-667
  - T-670
topic: null
branch: null
created: 2026-10-16T16:35:27.076Z
updated: 2026-10-16T16:35:47.689Z
---

## Summary

The docs say what the three commands are, where each runs, and how to set them with `cland config set`. They also say how this repository's own modes, shards and covers map onto its values (E-614 C5). The epic's QA demo follows `hub/README.md` alone to set the three commands in a scratch project in another stack.

## What to build

- **`hub/README.md`.** A new section "Verification commands" before "Remote executors: droplets", written for a newcomer setting up their own project:
  - the three keys and what each is for;
  - where each runs: a local run runs `check` then `test` and never `prepare`, the host gate runs `check`, and a droplet runs `prepare` in its image and before every run, then `check` and `test`;
  - the rules: `test` is required and verify refuses without it, `check` and `prepare` are optional, lines run under `/bin/sh -c`, and `prepare` is idempotent and writes only ignored files;
  - setting them: `cland config set verification.test '<command>'` with a worked example for a Python project, and the reminder that a droplet run needs the change committed, since only a clean tree is bundled;
  - which config is read: the candidate's committed or working `config.toml`, else the root's;
  - what another stack does not get: coverage selection, the `hub` and `nvim` modes, the load gate and shards, which stay cland's own; its `test` runs in full.

  Update the existing sections that name npm scripts as the verify commands: Tests, the `cland verify` paragraphs, "Remote executors: droplets" (the host gate, `npm ci` and the Neovim pin in delivery), and "Running the suite on Linux".
- **`docs/agents/tests.md`.** One section for cland's own values: `prepare = "node hub/bin/verify-prepare.ts"`, `check = "npm run typecheck"` and `test = "npm test"`. It says how `hub`, `nvim`, `all` and coverage-selected runs and shards all run `npm test`, with the selection in `CLAND_SUITE_SELECTION`, and that changing these values changes the release path, so they go through review like code.
- **The usage text** (`hub/src/cli/usage.ts`). The `verify`/`suite` line reads "run the project's check and test detached; post one artifact-backed result" instead of "run typecheck and the package suite".
- **The template comments** from ticket T-664 match the README's wording.
- **The onboarding hand-off.** This epic does not touch the onboarding skill, which ships with E-616, and the prototype's stack step still says verify runs `npm run typecheck` and `npm test`. Add one line to the README's section that E-616's stack step can cite: record the stack's commands with `cland config set verification.prepare|check|test`.

**Keeping cland's own suite intact.** Docs and usage text only.

## Acceptance criteria

- [ ] C1. `hub/README.md` has the "Verification commands" section with the keys, where each runs, the rules, the `cland config set` example and what stays cland's own, and no section still names `npm run typecheck` or `npm ci` as what verify runs for every project (grep).
- [ ] C2. `docs/agents/tests.md` names this repository's three values and the mapping of its modes and shards onto `npm test`.
- [ ] C3. The `verify` and `suite` usage lines describe running the project's check and test, and any test matching the old usage text is updated.
- [ ] C4. The README's worked example (`check = "python3 -m compileall -q ."`, `test = "python3 -m unittest"`), set with `cland config set` in a temporary project, is read back verbatim by the parser (ticket T-664's CLI test, extended with the README's lines).
