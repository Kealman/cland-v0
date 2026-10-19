---
id: T-872
kind: task
title: role launch switching a Claude-only role to Codex leaves it on danger-full-access instead of its sandbox default
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: topic-588
branch: t/T-872-role-launch-switching-a-claude-only-role
created: 2026-10-19T12:23:31.321Z
updated: 2026-10-19T13:04:58.322Z
closed: 2026-10-19T13:04:58.322Z
---

## Summary

A project initialised with only Claude Code gets a roles template without per-role `sandbox` keys. When `cland role launch` later switches its Implementer or Aide to Codex, the role falls back to `DEFAULT_ROLES_TOML`'s `danger-full-access` instead of `workspace-write`. The onboarding crew round (E-616, T-855) can make exactly this switch.

## Evidence

Found by impl-855 on 2026-10-19 through `setRoleLaunch` against `rolesTemplate([\"claude-code\"])`. Explicit sandbox keys from the Codex template survive every role's claude-code → codex round trip; only the missing-key case falls through. E-611 (closed) built `cland role launch`; T-637 set danger-full-access only for the Coordinator and Lead.

## Acceptance criteria

- [x] C1. When `cland role launch` sets a role's harness to Codex and the role has no `sandbox` key, it writes the sandbox the Codex roles template gives that role (the same value `rolesTemplate` writes for a Codex project), never the parser's compatibility default; a T1 test switches each role of a Claude-only template to Codex and reads back the template's value.
  - done: impl-872 · 2026-10-19T12:25:56.031Z
  - verified: rev-30 [reviewer] · run rev-20261019-872-final · 2026-10-19T12:38:08.523Z · commit 60a5c0d1ea456b1f1a1bf3e6a7f87648faafccfe
- [x] C2. Existing explicit sandbox values are never overwritten (existing round-trip tests stay green).
  - done: impl-872 · 2026-10-19T12:25:56.598Z
  - verified: rev-30 [reviewer] · run rev-20261019-872-source · 2026-10-19T12:26:44.543Z · commit 60a5c0d1ea456b1f1a1bf3e6a7f87648faafccfe
  - verified: rev-30 [reviewer] · run rev-20261019-872-final · 2026-10-19T12:38:08.523Z · commit 60a5c0d1ea456b1f1a1bf3e6a7f87648faafccfe

## Comments

### impl-872 · 2026-10-19T12:24:12.123Z

Implementation seam: setRoleLaunch against rolesTemplate(['claude-code']), persisted TOML parsed back with parseRoles. Regression will cover all six roles at T1 before source changes; explicit sandbox values, including an empty value, remain authoritative. No required per-item QA scope.

### impl-872 · 2026-10-19T12:25:37.098Z

Corrected C1 regression observed red before source edits: all six persisted sandbox keys were undefined (43.6 ms). Implementation now shares the Codex template policy map and checks raw TOML presence, preserving explicit empty/quoted keys. T1 regression and all-mode/all-role round trips pass; full typecheck passes. Updated two T2 expectations for the newly materialized Implementer sandbox.

### rev-30 · 2026-10-19T12:26:44.543Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-872-source
commit: 60a5c0d1ea456b1f1a1bf3e6a7f87648faafccfe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6031. Shared Codex template map is used only when supplied harness is Codex and raw TOML has no sandbox key. Explicit values, including empty and quoted keys/comments, remain authoritative. All-role default and explicit round-trip controls inspect persisted/effective values. C2 verified; C1 awaits exact-head mode-free receipt. A-6030 red/green and targeted evidence inspected; no Reviewer tests.

Criteria: C2 verified.

### rev-30 · 2026-10-19T12:38:08.523Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-872-final
commit: 60a5c0d1ea456b1f1a1bf3e6a7f87648faafccfe
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6034 audits exact-head A-6032 / e84bcce9. Ordinary 1066/1066, zero fail/cancel/skip/TODO, all 281 load-gate groups 5/5, zero tier-mismatch rows. Both all-role regressions and adjusted CLI controls pass ordinarily and 5/5. C1/C2 verified. The explicit-policy table has a disclosed report-only T1 observation of 0.528 s > 0.5 s; no failed test. T3 remains merge-batch landing evidence; no Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T13:04:58.322Z

Merged fe10023bd89510412121c26f41352a4d0910432f onto dev.
