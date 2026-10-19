---
id: T-874
kind: task
title: Setup's favourite step switches the Aide to Codex via setRoleKey and skips T-872's sandbox default
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-326
blocked_by:
  - T-841
  - T-872
topic: topic-615
branch: t/T-874-setup-s-favourite-step-switches-the-aide
created: 2026-10-19T12:48:36.547Z
updated: 2026-10-19T16:12:59.112Z
---

## Summary

Setup's favourite step (T-841, `hub/src/setup/steps/favourite.ts`) writes the Aide's harness, model and effort with `setRoleKey`, so T-872's missing-sandbox fix in `setRoleLaunch` does not cover it. When a Claude-only template's Aide is switched to Codex as the favourite, it inherits the compatibility `danger-full-access` instead of the Codex template's value.

## Evidence

Found by T-841's source review on 2026-10-19 (A-6042, impl-841). T-841's C1 limits that task to three edited lines.

## Acceptance criteria

- [x] C1. The favourite step changes harness through the same path as `cland role launch` (or applies the same missing-sandbox rule), so a Claude-only template whose favourite becomes Codex gets the sandbox the Codex template gives the Aide. A T1 test reads it back, and an explicit sandbox value is kept.
  - done: impl-874 · 2026-10-19T16:12:33.359Z
  - verified: rev-30 [reviewer] · run rev-20261019-874-final · 2026-10-19T16:12:58.455Z · commit 9d5954ea1e6238efebe5e2fa83562387d7071d00

## Comments

### impl-874 · 2026-10-19T15:49:26.672Z

Implemented C1 at 9d5954ea: favourite reuses role-launch's extracted missing-Codex-sandbox policy. T1 read-back reproduces the bug then passes; all explicit sandbox values including empty remain preserved. Typecheck and setup-favourite (13/13, 0.165s), roles-editor (13/13, 0.306s) passed. Fetched/merged origin/dev before review and checked fresh merge-tree before push; no conflicts. Source review requested before mode-free verification.

### rev-30 · 2026-10-19T15:50:08.819Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-874-source
commit: 9d5954ea1e6238efebe5e2fa83562387d7071d00
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6173. Favourite and role launch share the source-key missing-sandbox rule; Codex inserts template workspace-write for Aide only when absent, preserving explicit modes including empty. Existing atomic publication, chosen marker and model/effort edits retained. T1 real-template saved/effective regression and four-value table preserve comments; existing whole-text CRLF expectation adds only default sandbox. A-6171 reports red-green, favourite13/13 .165 s, roles-editor13/13 .306 s and typecheck green. C1 final verification awaits same-head mode-free receipt. No Reviewer execution.

### rev-30 · 2026-10-19T16:12:58.455Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-874-final
commit: 9d5954ea1e6238efebe5e2fa83562387d7071d00
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6196 audits full A-6195 / 8a6c7dc9 at unchanged reviewed head. Ordinary 1577/1577 zero fail/cancel/skip/TODO; all 497 groups 5/5. Both new favourite missing-default/explicit-choice tests pass ordinarily and 5/5, shared role-launch file remains green. C1 verified with A-6173. Existing round-trip .5386s is known separately fixed T-875, not present on this frozen head; four inherited T-856 push trips retained under T-877. No owned regression trip, existing report-only debt retained. T3 landing deferred; no Reviewer execution.

Criteria: C1 verified.
