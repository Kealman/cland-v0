---
id: T-846
kind: task
title: "The setup scenario: a scratch machine runs `cland setup` end to end, and a second run reports `ok` throughout"
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-836
  - T-840
  - T-842
  - T-845
topic: null
branch: t/T-846-the-setup-scenario-a-scratch-machine
created: 2026-10-19T06:34:13.631Z
updated: 2026-10-19T20:44:23.364Z
---

## Summary

One named T3 scenario proves the flow across real processes once its rules are proven in T1/T2:
- the real CLI in a pseudo-terminal (question 10);
- fake harnesses on the PATH, one missing and one signed out, with the fake `curl`;
- a real hub with the Aide launched on a fake harness;
- the stand-in launcher.

It also finishes the hub README's setup section for QA's demo.

## What to build

- **The scenario.** On N5's scratch machine with Codex missing and Claude Code signed out, the scenario runs `cland setup` in a pseudo-terminal. It answers:
  - yes to the Codex install;
  - yes to the Claude Code login;
  - Enter to the accounts question (a signed-in `~/.claude-work` exists);
  - `1` to the favourite.

  It then reads:
  - the step lines;
  - `[aide.launch]`;
  - the trust entries in the scratch `.claude.json` and `~/.codex/config.toml`;
  - the running hub;
  - `aide-1` with its brief;
  - the stand-in launcher's recorded `CLAND_OPEN_SESSION`.
- **A second run** answers nothing and must report `ok` for every step.
- **A third run** without a terminal must exit 0 and ask nothing.
- **A declined-install run** on a second machine must not offer the install again until `--install`.
- The scenario's header names the lower-tier rule files and its expected hub starts (one), as `docs/agents/tests.md` asks. It carries a manifest entry and measured duration.
- The hub README's setup section is complete: the steps, the flags, what is written outside the project (the accounts registry on yes, the harness trust entries), and how to stop the Aide and the hub.

## Acceptance criteria

- [ ] C1. The scenario's first run ends with `codex done`, `claude-code login done`, `accounts skip` (accounts.toml absent), `favourite done`, `trust done`, `hub done` and `aide done`, in the spec's order, one line each.
- [ ] C2. After it, the scratch trust files hold the root as trusted for Claude Code and Codex, `aide-1` runs with the brief `Run the onboarding skill; project: empty; harnesses: claude-code, codex; human's harness: claude-code`, and the stand-in launcher recorded `CLAND_OPEN_SESSION=aide-1`.
- [ ] C3. The second run reports `ok` for every step and asks nothing.
- [ ] C4. No fake Codex process and no hub other than the project's remain when the scenario ends.
- [ ] C5. The scenario passes five serial runs on the Mac at a one-minute load below 15, with the receipts in the task's report.
