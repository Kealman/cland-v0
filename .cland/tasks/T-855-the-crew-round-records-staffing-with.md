---
id: T-855
kind: task
title: The crew round records staffing with `cland crew set`, launch fields with `cland role launch` and models from `cland models`, with auto mode as the default and skip as an explicit offer
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-854
topic: topic-587
branch: t/T-855-the-crew-round-records-staffing-with
created: 2026-10-19T08:10:02.852Z
updated: 2026-10-19T13:28:26.079Z
closed: 2026-10-19T13:28:26.079Z
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

- [x] C1. SKILL.md §5 records staffing with `cland crew set` and launch fields with `cland role launch`, and no file of the skill tells the Aide to edit `roles.toml` or `crew.toml` by hand (source review and a T1 assertion).
  - verified: rev-30 [reviewer] · run rev-20261019-855-final · 2026-10-19T12:42:49.134Z · commit 3556fcab3a7efc8f4888392365d5cfcfbf68d757
  - done: impl-855 · 2026-10-19T12:42:58.080Z
- [x] C2. SKILL.md §5 recommends auto mode for Claude Code roles, offers `skip` only as an explicit choice with its trade-off, names each Codex role's sandbox, and applies the Aide's own change last with its next-launch note (source review).
  - verified: rev-30 [reviewer] · run rev-20261019-855-source · 2026-10-19T12:24:27.817Z · commit 3556fcab3a7efc8f4888392365d5cfcfbf68d757
  - verified: rev-30 [reviewer] · run rev-20261019-855-final · 2026-10-19T12:42:49.134Z · commit 3556fcab3a7efc8f4888392365d5cfcfbf68d757
  - done: impl-855 · 2026-10-19T12:42:58.647Z
- [x] C3. SKILL.md §5 names a model only from `cland models <harness>` (source review).
  - verified: rev-30 [reviewer] · run rev-20261019-855-source · 2026-10-19T12:24:27.817Z · commit 3556fcab3a7efc8f4888392365d5cfcfbf68d757
  - verified: rev-30 [reviewer] · run rev-20261019-855-final · 2026-10-19T12:42:49.134Z · commit 3556fcab3a7efc8f4888392365d5cfcfbf68d757
  - done: impl-855 · 2026-10-19T12:42:59.207Z
- [x] C4. WELCOME.md's prompts line offers the auto-mode and skip variants and no other (source review).
  - verified: rev-30 [reviewer] · run rev-20261019-855-source · 2026-10-19T12:24:27.817Z · commit 3556fcab3a7efc8f4888392365d5cfcfbf68d757
  - verified: rev-30 [reviewer] · run rev-20261019-855-final · 2026-10-19T12:42:49.134Z · commit 3556fcab3a7efc8f4888392365d5cfcfbf68d757
  - done: impl-855 · 2026-10-19T12:42:59.674Z
- [x] C5. Run as an Aide against an in-process hub with fake harnesses, the step's `crew set` and `role launch` lines are accepted and read back by `crew show` and `role list`, and the Aide's own `role launch` returns the next-launch note (T2).
  - verified: rev-30 [reviewer] · run rev-20261019-855-final · 2026-10-19T12:42:49.134Z · commit 3556fcab3a7efc8f4888392365d5cfcfbf68d757
  - done: impl-855 · 2026-10-19T12:43:00.231Z

## Comments

### impl-855 · 2026-10-19T12:20:58.573Z

Implementing the scoped crew-round and welcome-note changes. Planned evidence: T1 skill guard, T2 in-process Aide CLI readback, and confirmation that role launch preserves per-role sandbox values when changing harnesses (E-616 decision 8).

### impl-855 · 2026-10-19T12:23:45.709Z

Source review requested from Reviewer at pushed head 3556fcab3a7efc8f4888392365d5cfcfbf68d757. Checks: targeted test 9/9 (2.009 s), typecheck and test lint passed. Merge-tree preflight against freshly fetched origin/dev passed. Evidence A-6028. Coordinator filed the separate sparse-template sandbox transition as T-872 and confirmed decision 8's explicit-key preservation passes.

### rev-30 · 2026-10-19T12:24:27.817Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-855-source
commit: 3556fcab3a7efc8f4888392365d5cfcfbf68d757
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6029. Command-based crew/launch settings, auto/explicit-skip trade-off, models lookup and exact welcome variants match scope. C2–C4 verified; C1/C5 await exact-head mode-free evidence. Decision 8 explicit sandbox-key preservation confirmed by source; Coordinator d6dc902a filed the separate missing-key transition as T-872 and retained scope. A-6028 targeted evidence inspected; no Reviewer tests.

Criteria: C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-19T12:42:49.134Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-855-final
commit: 3556fcab3a7efc8f4888392365d5cfcfbf68d757
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6037 audits same-head A-6036 / d36a9e28. Ordinary 1528/1528, zero fail/cancel/skip/TODO, all 447 load-gate groups 5/5 and zero tier-mismatch rows. Source guard and all three Aide settings cases pass ordinarily plus 5/5; all nine onboarding cases remain green. C1–C5 verified. T-872 remains separate; existing report-only findings retained and T3 is merge-batch landing evidence. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-19T13:28:26.079Z

Merged 5afdda60b775736eed8196f08f47ec98a15afff5 onto dev.
