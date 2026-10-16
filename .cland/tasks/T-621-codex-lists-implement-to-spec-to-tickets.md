---
id: T-621
kind: task
title: Codex lists implement, to-spec, to-tickets, triage and wayfinder
state: open
status: in progress
size: XS
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by: []
topic: null
branch: t/T-621-codex-lists-implement-to-spec-to-tickets
created: 2026-10-16T15:57:48.700Z
updated: 2026-10-16T15:58:41.851Z
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
- [ ] C4. Demo on this Mac: in a fresh scratch project after `cland init`, a Codex session's list of skills shows implement, to-spec, to-tickets, triage and wayfinder.
