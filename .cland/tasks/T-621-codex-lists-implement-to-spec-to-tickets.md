---
id: T-621
kind: task
title: Codex lists implement, to-spec, to-tickets, triage and wayfinder
state: open
status: in progress
size: XS
criterion_seq: 4
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by: []
topic: topic-385
branch: t/T-621-codex-lists-implement-to-spec-to-tickets
created: 2026-10-16T15:57:48.700Z
updated: 2026-10-16T16:00:48.328Z
---

## Summary

Make each kept skill's Codex flag in `agents/openai.yaml` agree with its frontmatter, so the skills that Claude Code and OpenCode may already invoke on their own are listed by Codex too, and a project on Codex alone can run the Coordinator's skills.

## What to build

This repository's first commit removed `disable-model-invocation: true` from the frontmatter of several upstream skills but left `policy.allow_implicit_invocation: false` in their `agents/openai.yaml`. Codex therefore hides implement, to-spec, to-tickets, triage and wayfinder (and retro, the sixth kept skill in that state) while Claude Code lists them. Each kept skill's Codex flag now follows its frontmatter: a skill without `disable-model-invocation: true` carries no `allow_implicit_invocation: false`, and a skill that keeps the frontmatter flag (handover) keeps the Codex flag.

A test pins the rule for the whole set, so a later edit cannot let the two flags drift apart again.

## Acceptance criteria

- [ ] C1. The `agents/openai.yaml` of implement, to-spec, to-tickets, triage, wayfinder and retro no longer sets `allow_implicit_invocation: false`, and their `interface` block is unchanged.
- [ ] C2. handover keeps both `disable-model-invocation: true` and `allow_implicit_invocation: false`.
- [ ] C3. A new test reads every skill folder of the shipped set and fails when a skill's `allow_implicit_invocation: false` and its `disable-model-invocation: true` are not both present or both absent.

## Comments

### impl-621 · 2026-10-16T16:00:07.094Z

Implemented removal of policy overrides in six openai.yaml files, preserving interface text. New filesystem metadata regression reads every shipped skill (including skills with no optional Codex metadata); pre-fix it identified all six intended mismatches. After fix, only nine mismatches remain, all in T-620's dropped set. Waiting for that cut on origin/dev before green test/source review; no dropped skill files changed. New test is classified free in shards.json.

### coord · 2026-10-16T16:00:48.328Z

Coordinator, 2026-10-16: C4 (a real Codex session's skill list after a fresh cland init) was removed from this ticket. It's verified at E-615's epic demo, whose DoD has QA read Codex's list on this Mac (E-615 C3). This ticket's C3 test guards the flag-to-frontmatter parity.
