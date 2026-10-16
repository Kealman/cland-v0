---
id: E-613
kind: epic
title: "Setup: the guided step ending in the workbench"
state: open
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by:
  - E-612
  - E-611
topic: null
branch: null
created: 2026-10-16T15:34:18.570Z
updated: 2026-10-16T15:51:23.458Z
---

## Summary

`cland setup` is the guided step after `cland init`: it detects the three harnesses, installs and signs in the missing ones on the human's yes, registers accounts only when asked, records the favourite harness, grants trust for every installed harness, starts the hub and the Aide with the onboarding brief, and opens the workbench with the Aide in the centre. It is safe to rerun, prompts only in a terminal, and doctor's checks follow what the project's roles use.

## Goal

One command takes the human from an initialised project to the onboarding in the workbench. Today the human installs and signs in to each harness, trusts the folder for each one, starts the hub and launches the Aide by hand. Claude Code's trust dialog turns a background launch into a refusal (T-24, T-58, D36) and Codex asks for folder trust at its first attach (T-42); a bare machine fails nine doctor checks because every missing harness counts (Q-592). The setup prototype (Q-597) ran these steps end to end, and the human accepted it after a run in a fresh folder.

## Contents

- **Eight idempotent steps, in order** (Q-597, Q-599 resolutions 2 and 3 and decision 11). Each step detects, offers, confirms, runs the vendor's command as a terminal child with inherited stdio, and detects again; the re-check decides, never the exit code (Q-594). Each prints one line: `ok`, `done`, `skip`, `open` or `fail`.
  1. **Detect** the three harnesses (binary, version, login) with doctor's probes.
  2. **Install.** A missing harness gets its official installer shown and run on yes, then is detected again. A declined install is remembered in `.cland/config.toml` and not offered again until `cland setup --install`.
  3. **Logins.** Every harness a template role uses gets a login check; a signed-out one gets its own login command run in the terminal on yes, then a second check.
  4. **Accounts.** The logged-in accounts are shown and appended to `~/.config/cland/accounts.toml` on a yes, the default No, since every project's hub reads that file; setup says when Yes is worth it (several accounts per harness, limits).
  5. **The favourite harness** goes into `[aide.launch]` of `.cland/roles.toml`.
  6. **Trust** is granted for every installed harness, deterministically and without a question, and reported in one line ("trusted for …"): Claude Code's `hasTrustDialogAccepted` in the profile's `.claude.json` under its lock, Codex's `trust_level` through a short-lived app-server's `config/batchWrite`, nothing for OpenCode (Q-593).
  7. **The hub and the Aide.** Setup starts the hub and launches `aide-1` on the favourite harness with the onboarding brief: `Run the onboarding skill; project: empty | existing; harnesses: …; human's harness: …`.
  8. **The workbench.** Setup downloads the pinned Neovim and opens the workbench with the Aide's terminal in the centre, as the launcher does after `␣A`. `--attach` runs the harness's own attach command in the terminal instead, for a machine without the pinned Neovim. One closing line follows on exit.
- **Without a terminal** (Q-594). Setup never prompts, waits, installs or launches: it prints each open step with its exact command and exits 1 while any step is open.
- **Flags.** `--json` (doctor's shape: root, version, interactive, steps, summary, next), `--yes` (the harmless questions only; an install needs `--install`), `--install`, `--harness <h>`, `--no-accounts`, `--no-aide`, `--attach`.
- **The prompter** (Q-594). Confirm, choose and pause over `node:readline/promises`, one interface per question, no library.
- **Doctor's strictness** (map decision 5, Q-599 resolution 4 as amended, Q-593). A harness is required only when a role uses it, and `gh` only with a `github` remote. Each harness's version is shown for information, with no range verdict and no pin step. OpenCode's environment keys no longer count as credentials.

Not in this epic: `cland init` ("Init: roots, the first commit, managed settings, categories"); the onboarding itself ("The onboarding skill and the newcomer's first page"); the one-command install (deferred, Q-592); installing harnesses silently or holding their credentials (the map's Out of scope); the web workbench's onboarding (v0.2). Ctrl+Z inside `--attach` suspends setup together with the attach, accepted as it is (Q-599 resolution 8).

Left to the spec (§3.3) and the plan: what remains of doctor's tested ranges once versions carry no verdict (informational, or gone), and of the release-time OpenCode range check E-424 added (T-533).

## Tracer-bullet order

1. **Detection, the report and no terminal.** The prompter, the step lines, `--json`, the report without a terminal, doctor's strictness. Demo: with fake harnesses on the PATH, one missing, `cland setup < /dev/null` prints the open steps with their commands and exits 1, `--json` parses, and `cland doctor` in a project whose roles use one harness passes with the others missing.
2. **Installs and logins.** Demo: in a terminal, a missing fake harness is installed on yes and detected again, a signed-out one signs in and is checked again, and a declined install is not offered on the second run until `--install`.
3. **Accounts, the favourite and trust.** Demo: the accounts question defaults to No and leaves `accounts.toml` absent, the favourite lands in `[aide.launch]`, and the scratch HOME's Claude Code and Codex configurations trust the project.
4. **The hub, the Aide and the workbench.** Demo: setup starts the hub, `aide-1` runs with the onboarding brief, and the headless workbench shows its terminal in the centre; `--attach` runs the harness's attach command instead; a second `cland setup` reports `ok` for every step.

## Definition of done

QA runs the demo below on `dev` on this Mac, playing the human in a terminal of its own and in a headless workbench, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

With fake harnesses on the PATH, one missing and one signed out, under a scratch HOME, QA runs `cland setup` in an initialised scratch project and answers its questions: the install, the login, the accounts (left at No) and the favourite. It reads the step lines, the trust entries, `[aide.launch]`, the running hub, `aide-1` with its brief, and the workbench with the Aide in the centre. A second run reports `ok` throughout, a declined install stays declined until `--install`, and a run without a terminal reports the open steps and exits 1. QA then runs `cland setup` once with this Mac's real harnesses in a fresh scratch project, answering No to the accounts, and reads the trust and the Aide's launch. Finally `cland doctor` requires only the harnesses the roles use and `gh` only with a `github` remote, shows versions without a verdict, and does not count an OpenCode environment key as a login.

- [ ] C1. `cland setup` runs its eight steps in order, one line each, and a second run reports `ok` for every step already done.
- [ ] C2. A missing harness is installed on yes and detected again, a declined install is remembered until `--install`, and every harness a template role uses is checked for a login and signed in on yes.
- [ ] C3. The accounts step appends to `~/.config/cland/accounts.toml` only on a yes, the default No, and the favourite harness lands in `[aide.launch]`.
- [ ] C4. Trust is granted for every installed harness without a question and reported in one line, for the fake harnesses and for this Mac's real ones.
- [ ] C5. Setup starts the hub, launches `aide-1` with the onboarding brief and opens the workbench with the Aide in the centre, `--attach` runs the harness's attach instead, and one closing line follows.
- [ ] C6. Without a terminal setup prints each open step with its command and exits 1, and `--json`, `--yes`, `--install`, `--harness`, `--no-accounts`, `--no-aide` and `--attach` do what the spec says.
- [ ] C7. `cland doctor` requires a harness only when a role uses it and `gh` only with a `github` remote, shows versions without a verdict, and does not count OpenCode environment keys as credentials.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **Plan approval.** The human approves this epic's plan by hand (Q-601 resolution 2): the Coordinator drafts it with `plan-epic` and launches no stage until the human approves it in the plan view or with `cland task plan approve`, although the project's `[plan] approval` is `"none"`.
- **The prototypes.** prototype/setup (3b2eabfe, the steps from 3893c66e) is never merged; the implementation takes from it what fits (Q-601 resolution 5).
- **ADRs.** 0003 (The hub is a per-project daemon): setup starts this project's hub only. 0005 (Neovim is the host): setup ends in the workbench. 0001 (Roles are hub-held state): the Aide is a normal hub launch, never a harness started by hand (Q-593).
- **Tests.** A fake prompter drives the flow, fake harnesses on the PATH stand for the real ones with their install and login commands, and one stream-level test covers the real prompter (Q-594). Real installers, logins and trust writes never run in `npm test`.
- **Risks.**
  - A readline interface left open while a child runs steals its keystrokes (three of three runs, Q-594): one interface per question.
  - The trust step writes the human's real harness configuration for the project's path, and the accounts step the machine-wide registry: a line says so each time, and the accounts default to No.
  - Running Codex once leaves its app-server daemon running (Q-594).
  - The prototype exercised the installers, the logins, the attach and the hub start only with fakes; the real-harness case of the demo is their first real run.
- **Order.** Third in the hub lane: blocked by "Init: roots, the first commit, managed settings, categories" and "The Aide's reach and the settings commands".

## Links

- Spec: `docs/spec/v0.1.4.md`, §3.3 (Setup) and §4 (The cut).
- Items: map M-591, decisions 3, 5 and 6 (6 superseded by Q-599's decision 11); Q-599 (its ten questions, decision 11, the resolution and the amendment to decision 4); Q-597 (the prototype and its acceptance); Q-593 (harness facts); Q-594 (the step shape and the prompter); T-603 (the empty profile behind D36).
- Prototype: prototype/setup at 3b2eabfe with `docs/research/setup-how-to-try.md`, never merged.
- Research: `docs/research/harness-setup.md` on research/harness-setup (eb985104); `docs/research/setup-prior-art.md` on research/setup-prior-art (68dffed3), with the prompter sketch and its tests.
- Code: `hub/src/cli/doctor.ts`, `hub/src/doctor/toolchain.ts`, `hub/src/doctor/keys.ts`, `hub/src/doctor/ranges.ts`, `hub/src/accounts/registry.ts`, `hub/src/cli/open.ts`, `nvim/lua/cland/init.lua`; in the prototype, `hub/src/setup/` and `hub/src/cli/setup.ts`.
- GLOSSARY: Harness, Account, Aide, Hub; Setup arrives with "The onboarding skill and the newcomer's first page".

## Comments

### human · 2026-10-16T15:36:05.733Z

Open point resolved by the human's amendment on Q-599 (2026-10-16): harness versions are neither pinned nor judged. Doctor shows each harness's version for information only; its tested ranges and the release-time OpenCode range check from E-424 (T-533, Q-297) become informational notes with no refusal or warning rows; behavioural API checks in the adapters (follow with a check) stay where they test behaviour rather than version numbers. setup offers no pin step.

### human · 2026-10-16T15:51:23.458Z

From the human's setup run (2026-10-16 16:17): the accounts step wrote three entries into ~/.config/cland/accounts.toml: a path-less `claude` (claude-code, no config_dir), `claude-work` (~/.claude-work) and `codex`; the sessions panel then showed four accounts beside the two harness defaults and the human asked to return to the defaults only (done by hand). For the plan: the default profile of a harness is never registered as an account (it is the harness default already); only profiles with their own directory or identity become entries; a path-less claude-code entry on dev makes the hub poll a signed-out profile (the T-603 family), so setup must not create one.
