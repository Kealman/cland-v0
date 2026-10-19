---
id: T-874
kind: task
title: Setup's favourite step switches the Aide to Codex via setRoleKey and skips T-872's sandbox default
state: open
status: in progress
size: XS
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-326
blocked_by:
  - T-841
  - T-872
topic: null
branch: t/T-874-setup-s-favourite-step-switches-the-aide
created: 2026-10-19T12:48:36.547Z
updated: 2026-10-19T15:48:00.933Z
---

## Summary

Setup's favourite step (T-841, `hub/src/setup/steps/favourite.ts`) writes the Aide's harness, model and effort with `setRoleKey`, so T-872's missing-sandbox fix in `setRoleLaunch` does not cover it. When a Claude-only template's Aide is switched to Codex as the favourite, it inherits the compatibility `danger-full-access` instead of the Codex template's value.

## Evidence

Found by T-841's source review on 2026-10-19 (A-6042, impl-841). T-841's C1 limits that task to three edited lines.

## Acceptance criteria

- [ ] C1. The favourite step changes harness through the same path as `cland role launch` (or applies the same missing-sandbox rule), so a Claude-only template whose favourite becomes Codex gets the sandbox the Codex template gives the Aide. A T1 test reads it back, and an explicit sandbox value is kept.
