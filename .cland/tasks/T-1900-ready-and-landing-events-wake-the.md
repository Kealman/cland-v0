---
id: T-1900
kind: task
title: Ready and landing events wake the Coordinator
state: open
status: review
size: S
criterion_seq: 1
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1550
branch: t/T-1900-ready-and-landing-events-wake-the
created: 2026-11-16T07:29:46.895Z
updated: 2026-11-16T11:30:13.849Z
---

## Summary

T-1795 waited 3.6 h because ready events don't start a Coordinator turn (§3.8). Current delivery semantics are unverified. §7 #9.

Kind: product. Triage ticket H-12 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [x] C1. A lead's ready report and a landing reach an idle Coordinator as deliveries that start a turn (test with the fake Claude).
  - done: impl-1900 · 2026-11-16T11:28:15.417Z

## Dependencies

none

## Comments

### impl-1900 · 2026-11-16T11:27:53.811Z

Consumer sweep and current-behaviour evidence: A-19986 path inventory; A-19987 findings, mutations, exact test output and unaffected consumers. Searched production routing/store, all three adapters, shared wire, Neovim/web, CLI/spoke, skills, QA briefs, startup/recovery and all test tiers. No shared contract change: current ready digest-now and landing report policy already holds; all consumers retain prior wire shape. T2 ordinary queue case adds idle fake-Claude injection and held progress control; 38/38 full-file pass on macOS Node v24.21.0. Mutation report to progress failed the new exact-id injection wait and was reverted.
