---
id: T-834
kind: task
title: Doctor requires a harness only when a role uses it, and `gh` only with a `github` remote
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-832
topic: topic-578
branch: t/T-834-doctor-requires-a-harness-only-when-a
created: 2026-10-19T06:34:12.522Z
updated: 2026-10-19T13:27:12.865Z
---

## Summary

On a bare machine doctor fails nine checks, because every missing harness and `gh` counts (Q-592). Doctor now requires only the harnesses the project's roles launch on and `gh` only when the root has a `github` remote. Other missing tools show as information (map decision 5, Q-599 resolution 4).

## What to build

- **The harnesses in use.** One exported function lists the harnesses a project's roles use: every `[<role>.launch] harness` in `.cland/roles.toml`, with the built-in defaults for keys the file leaves out, plus the harness of every account a role names. Setup's login step (N8) uses the same function.
- **Doctor's rows.**
  - A harness in use that is missing or signed out fails, as today.
  - A harness no role uses gives an `ok` row: "not installed; no role uses it".
  - A signed-out harness that no role uses also gives an `ok` row, naming its login command.
- **Without a project or without `roles.toml`** (question 8): no single harness is required, but a machine with none installed fails one row, "cland needs at least one harness", naming the installers.
- **gh.** `gh` and `gh auth` are checked only when the root has a remote named `github`. Otherwise one `ok` row says "not needed: no github remote".
- `--json` keeps its shape. The hub README's doctor section names the rule.

## Acceptance criteria

- [x] C1. In a project whose roles all launch on claude-code, doctor with Codex and OpenCode missing has no `fail` row for them and exits 0 when the rest passes (T1/T2 with injected probes).
  - verified: rev-30 [reviewer] · run rev-20261019-834-final · 2026-10-19T12:11:09.833Z · commit 1b01ab4ac66e9f586981d4eb4f8b0ca106a12b6c
  - done: impl-834 · 2026-10-19T12:11:22.192Z
  - verified: rev-30 [reviewer] · run rev-20261019-834-installer-integration-final · 2026-10-19T13:27:10.495Z · commit 64fb7d81e41e624f5996d7814aed15cedb3f2cfb
- [x] C2. The same project with Claude Code signed out has a `fail` row for `claude-code auth` naming `claude auth login`.
  - verified: rev-30 [reviewer] · run rev-20261019-834-final · 2026-10-19T12:11:09.833Z · commit 1b01ab4ac66e9f586981d4eb4f8b0ca106a12b6c
  - done: impl-834 · 2026-10-19T12:11:22.755Z
  - verified: rev-30 [reviewer] · run rev-20261019-834-installer-integration-final · 2026-10-19T13:27:10.495Z · commit 64fb7d81e41e624f5996d7814aed15cedb3f2cfb
- [x] C3. A role naming an account adds that account's harness to the harnesses in use (T1 over the function).
  - verified: rev-30 [reviewer] · run rev-20261019-834-source · 2026-10-19T11:51:10.432Z · commit 1b01ab4ac66e9f586981d4eb4f8b0ca106a12b6c
  - verified: rev-30 [reviewer] · run rev-20261019-834-final · 2026-10-19T12:11:09.833Z · commit 1b01ab4ac66e9f586981d4eb4f8b0ca106a12b6c
  - done: impl-834 · 2026-10-19T12:11:23.233Z
  - verified: rev-30 [reviewer] · run rev-20261019-834-installer-integration-source · 2026-10-19T13:07:49.561Z · commit 64fb7d81e41e624f5996d7814aed15cedb3f2cfb
  - verified: rev-30 [reviewer] · run rev-20261019-834-installer-integration-final · 2026-10-19T13:27:10.495Z · commit 64fb7d81e41e624f5996d7814aed15cedb3f2cfb
- [x] C4. Without a `github` remote, doctor runs no `gh` probe and shows the "not needed" row. With one, a missing `gh` fails as today (T1 with injected remotes and probes).
  - verified: rev-30 [reviewer] · run rev-20261019-834-final · 2026-10-19T12:11:09.833Z · commit 1b01ab4ac66e9f586981d4eb4f8b0ca106a12b6c
  - done: impl-834 · 2026-10-19T12:11:23.790Z
  - verified: rev-30 [reviewer] · run rev-20261019-834-installer-integration-final · 2026-10-19T13:27:10.495Z · commit 64fb7d81e41e624f5996d7814aed15cedb3f2cfb
- [x] C5. Outside a project, doctor with no harness installed has exactly one harness `fail` row, "cland needs at least one harness", and with one harness installed it has none.
  - verified: rev-30 [reviewer] · run rev-20261019-834-final · 2026-10-19T12:11:09.833Z · commit 1b01ab4ac66e9f586981d4eb4f8b0ca106a12b6c
  - done: impl-834 · 2026-10-19T12:11:24.262Z
  - verified: rev-30 [reviewer] · run rev-20261019-834-installer-integration-final · 2026-10-19T13:27:10.495Z · commit 64fb7d81e41e624f5996d7814aed15cedb3f2cfb

## Comments

### impl-834 · 2026-10-19T11:29:26.516Z

Implemented the shared harnessesInUse resolver, project-conditioned doctor rows, github-only gh checks, and setup login/installer requirements. C1/C2 have injected runDoctor report/exit-code coverage; C3 and default/account selection have T1 resolver coverage; C4 and C5 have injected toolchain coverage plus doctor report checks. Typecheck passed; touched tests and static checks are being completed before source review. T-833 will be merged from origin/dev before review.

### rev-30 · 2026-10-19T11:51:10.432Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-834-source
commit: 1b01ab4ac66e9f586981d4eb4f8b0ca106a12b6c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, findings []. A-5997 records Standards/Spec review of the shared resolver, built-in defaults, doctor informational rows and github-only probes, plus setup requirements. C3 verified; C1/C2/C4/C5 await the exact-head mode-free task receipt. A-5965 host passes inspected; existing per-file timing captures requested, no rerun. No Reviewer tests run.

Criteria: C3 verified.

### rev-30 · 2026-10-19T12:11:09.833Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-834-final
commit: 1b01ab4ac66e9f586981d4eb4f8b0ca106a12b6c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6015 audits A-6014 / 4398f958 at the unchanged source-reviewed head. Ordinary 1526/1526, zero fail/cancel/skip/TODO, all 445 load-gate groups 5/5, zero tier-mismatch rows. Required/unused auth, named accounts/defaults, github-only probes and zero/one-harness fallback controls complete ordinarily and under load. C1–C5 verified; A-5998 host timings inspected. Existing report-only findings retained; T3 is merge-batch landing evidence. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-19T13:07:49.561Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-834-installer-integration-source
commit: 64fb7d81e41e624f5996d7814aed15cedb3f2cfb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration source clear; A-6050. Coordinator/conflict authority confirmed. Installer effects, declines and fresh probes compose with requiredHarnesses; generic missing rows use current requirements after template rebuild, preserving required open and unused skip. Doctor/resolver criteria source unchanged. A-6049 captured passes inspected. C3 refreshed; C1/C2/C4/C5 await exact-head mode-free evidence. No Reviewer execution.

Criteria: C3 verified.

### rev-30 · 2026-10-19T13:27:10.495Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-834-installer-integration-final
commit: 64fb7d81e41e624f5996d7814aed15cedb3f2cfb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration final clear; A-6052 audits exact-head A-6051 / 57686dfd. Ordinary 1550/1550, zero fail/cancel/skip/TODO, all 470 load groups 5/5, zero tier-mismatch rows. Doctor C1–C5 and twelve installer/requirements flow cases pass, including current requirements after exact-template rebuild. All criterion marks refreshed. Existing report-only findings retained; T3 remains landing evidence. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
