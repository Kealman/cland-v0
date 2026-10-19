---
id: T-855
kind: task
title: The crew round records staffing with `cland crew set`, launch fields with `cland role launch` and models from `cland models`, with auto mode as the default and skip as an explicit offer
state: open
status: planned
size: S
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-854
topic: null
branch: null
created: 2026-10-19T08:10:02.852Z
updated: 2026-10-19T08:10:09.195Z
---

## Summary

The crew round keeps the accepted flow: the roles one line each, then one table to accept or edit. It records the answers through the commands E-611 added and stops editing `roles.toml` by hand. Its permissions offer follows Q-600: Claude Code roles run in auto mode by default, turning the prompts off (`skip`) is offered explicitly with its trade-off, and the welcome note's prompts line follows the answer.

## What to build

- **SKILL.md §5.**
  - **Models.** A model is named only when `cland models <harness>` lists it, else `""`.
  - **The Prompts bullet.**
    - Claude Code roles run with `permissions = "auto"`: a classifier lets routine commands through and stops risky ones.
    - The Aide offers `skip` (no prompts and no classifier, any command runs) only as the human's explicit choice, with that trade-off said.
    - Codex roles keep `approval = "never"` with their sandbox: Reviewer read-only, Implementer `workspace-write`, QA `danger-full-access`, an Aide on Codex `workspace-write`.
    - OpenCode keeps its own settings.
  - **On yes.**
    - Staffing: `cland crew set <key> <value>` for each change, then `cland crew show`.
    - Launch fields: `cland role launch <role> --harness … --model … --effort … --permissions …` for each role that changes, then `cland role list`.
    - The Aide's own role comes last. The Aide says that it takes effect at its next launch, and that Claude Code's classifier may flag the change. If the classifier flags it, the Aide says so in one line and leaves the setting for the human's next relaunch.
  - The sentence "edit those keys under `[<role>.launch]` … nothing else in that file" goes, and so does "`cland crew` … have no tool for you" in "The brief".
- **WELCOME.md.** The prompts line becomes "<Claude Code sessions run in auto mode: routine commands run, risky ones are stopped | Claude Code sessions run commands without asking (permissions skip)>".
- **T2 cases.** An Aide in an in-process hub with fake harnesses:
  - runs `crew set reviewer.size 1`, `crew set leads []` and `crew set aide.subagents true`, and `crew show` reflects them;
  - runs `role launch implementer --harness codex --model "" --effort high` and `role launch coordinator --permissions skip`, and `role list` shows them;
  - runs `role launch aide --permissions skip`, and the result says its own session keeps its settings until its next launch.

## Acceptance criteria

- [ ] C1. SKILL.md §5 records staffing with `cland crew set` and launch fields with `cland role launch`, and no file of the skill tells the Aide to edit `roles.toml` or `crew.toml` by hand (source review and a T1 assertion).
- [ ] C2. SKILL.md §5 recommends auto mode for Claude Code roles, offers `skip` only as an explicit choice with its trade-off, names each Codex role's sandbox, and applies the Aide's own change last with its next-launch note (source review).
- [ ] C3. SKILL.md §5 names a model only from `cland models <harness>` (source review).
- [ ] C4. WELCOME.md's prompts line offers the auto-mode and skip variants and no other (source review).
- [ ] C5. Run as an Aide against an in-process hub with fake harnesses, the step's `crew set` and `role launch` lines are accepted and read back by `crew show` and `role list`, and the Aide's own `role launch` returns the next-launch note (T2).
