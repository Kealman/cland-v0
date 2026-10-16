---
id: E-614
kind: epic
title: Verification for any stack
state: open
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by:
  - E-611
topic: null
branch: null
created: 2026-10-16T15:34:18.662Z
updated: 2026-10-16T16:36:06.234Z
---

## Summary

`cland verify` runs the project's own commands, `prepare`, `check` and `test` from `[verification]` in `.cland/config.toml`, instead of this repository's npm scripts, locally and on a droplet, so a project in any stack has verification. Coverage selection stays with cland's own node commands.

## Goal

The stack is the human's or the crew's choice, and verification follows it. Today `cland verify` is hard-wired to cland's own repository: the suite worker runs `npm run typecheck`, then `npm test` (or `npm test --workspace hub`, or `npm run test:nvim`); the host gate runs the typecheck again; the droplet prepares with `npm ci` and the Neovim pin, and each run compares `package-lock.json` and `nvim/NVIM_VERSION` with its snapshot; coverage selection assumes `node --test` and V8 coverage. A project in another stack has no verification, and during the live try the onboarding Aide chose a stack to fit verify instead of the project (Q-600 question 11, Q-596).

## Contents

- **Three commands** (Q-600 resolution 5). `[verification] prepare`, `check` and `test` in `.cland/config.toml`: `prepare` installs what the checks need, `check` is the fast gate that today's typecheck is, and `test` is the suite.
- **The suite worker and the host gate** run `check` and `test` where they run the npm scripts today.
- **The droplet executor** runs the same `prepare` where it runs `npm ci` and the Neovim pin today.
- **Coverage selection** applies only to cland's own node commands; another project's run runs its `test` in full.
- **This project** names its own commands in its `config.toml`, so its verification, with its modes, shards and covers, works as before.
- **Recording the commands.** `cland config set verification.<key>` (from "The Aide's reach and the settings commands") writes them, and the onboarding records them with the stack, in the stack step of the `onboarding` skill that "The onboarding skill and the newcomer's first page" ships.
- **Docs.** `hub/README.md`, `docs/agents/tests.md` and the `config.toml` that `cland init` writes describe the three commands.

Not in this epic: coverage selection or sharding for other stacks.

Left to the spec (§3.7) and the plan:

- How cland's own modes (`hub`, `nvim`, full) and its shards map onto the three commands.
- What a project without the commands gets, and what tells the droplet that `prepare` must run again (today `package-lock.json` and `nvim/NVIM_VERSION`).
- Whether a local run runs `prepare`.

## Tracer-bullet order

1. **The keys and the local run.** The three keys, the suite worker and the host gate. Demo: a scratch project in another stack verifies green locally with its own commands, and red with the test's output when a test fails.
2. **The droplet.** `prepare` in the droplet executor. Demo: the same project verifies on a droplet after its `prepare` ran there.
3. **This project and coverage.** Demo: this repository's `cland verify` on `dev` selects by coverage and passes as before, from its own `[verification]` values.
4. **The docs.** Demo: QA follows `hub/README.md` to set the three commands with `cland config set` in a scratch project.

## Definition of done

QA runs the demo below on `dev`, locally on this Mac and on a droplet through the executor, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

In a scratch project in a stack other than Node, QA sets `prepare`, `check` and `test` with `cland config set`, as `hub/README.md` says, and runs `cland verify` locally and on a droplet: both pass, and a planted failing test turns each red with its output. In this repository, `cland verify` at the `dev` tip selects by coverage and passes as before.

- [ ] C1. `cland verify` runs `[verification] check` and `test` from `config.toml`, locally and on a droplet, where it ran this repository's npm scripts, and the host gate runs `check`.
- [ ] C2. The droplet executor runs `[verification] prepare` where it ran `npm ci` and the Neovim pin.
- [ ] C3. A project in another stack verifies with its own commands locally and on a droplet, and a failing test turns its run red with the test's output.
- [ ] C4. Coverage selection applies only to cland's own node commands, and this repository's verification, its modes, shards and covers, works as before from its own values.
- [ ] C5. `hub/README.md`, `docs/agents/tests.md` and the `config.toml` that `cland init` writes describe the three commands, and `cland config set verification.<key>` sets them.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **Tests.** The suite worker and the droplet executor are tested with another stack's commands in a temporary project, the droplet through E-271's fake DigitalOcean API and fake machine (`hub/test/fakes/digitalocean/`); a real droplet is QA's check, never part of `npm test`.
- **Risks.**
  - This epic changes the verification the build itself runs on: this project's commands land in the same merge that makes verify read them, so the build's own verification never stops.
  - The onboarding's stack step writes the keys this epic adds. If "The onboarding skill and the newcomer's first page" lands first, its step already names the keys, and its demo waits for this epic's merge.
- **Order.** In the hub lane, beside "Init: roots, the first commit, managed settings, categories" and "Setup: the guided step ending in the workbench": blocked by "The Aide's reach and the settings commands" only.

## Links

- Spec: `docs/spec/v0.1.4.md`, §3.7 (Verification for any stack) and §4 (The cut).
- Items: map M-591, Not yet specified (verification for any stack); Q-600 (question 11 and resolution 5); Q-596 (the Aide fitting the stack to verify).
- Code: `hub/src/hub/suite-worker.ts`, `hub/src/hub/suites.ts` (the host gate), `hub/src/executor/droplet/prepare.ts`, `hub/src/executor/droplet/run.ts`, `hub/src/executor/local.ts`, `hub/src/suite-coverage.ts`, `hub/src/suite-selection.ts`, `hub/src/init/config.ts`, `hub/src/hub/configuration.ts`.
- Docs: `docs/agents/tests.md`, `hub/README.md`.
- GLOSSARY: Executor, Lease.

## Plan

```yaml
stages:
  - name: commands, keys and the local run
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-663
        - T-666
        - T-667
        - T-668
      - - T-664
        - T-665
      - - T-669
  - name: the droplet's prepare and the docs
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-670
        - T-671
```

## Comments

### coord · 2026-10-16T16:36:06.234Z

Coordinator decisions on the ticket cut (D51), 2026-10-16, all as the drafter recommended: (1) the commands come from the candidate worktree's config.toml, else the hub root's; (2) test is required, and verify refuses without it, naming the cland config set line; check and prepare are optional; no implicit npm default; (3) a local run never runs prepare; (4) prepare runs at every droplet delivery, idempotently, with CLAND_PREPARE_KEY so it may skip work; (5) 'cland's own suite' means the candidate carries hub/test/run-suite.ts; (6) one test line for every mode, with mode and shard in CLAND_SUITE_SELECTION; (7) prepare runs as runner without root, other toolchains install at user level (root for apt: a later release); (8) T-664 stores a string key's argument verbatim, confirmed against T-633 at merge; (9) E-616's stack-step ticket gets a criterion to record prepare/check/test through cland config set, with no npm wording; (10) launch waits for D52's flake measures (T-657, T-658), not for E-611's close; (11) cland verify hub/nvim in another project is refused with the reason; (12) commands run under /bin/sh -c (POSIX sh); (13) QA's toy stack is python3 (compileall, unittest), with no test depending on prepare.
