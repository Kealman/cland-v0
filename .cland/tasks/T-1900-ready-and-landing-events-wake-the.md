---
id: T-1900
kind: task
title: Ready and landing events wake the Coordinator
state: open
status: backlog
size: S
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:29:46.895Z
updated: 2026-11-16T07:29:46.895Z
---

## Summary

T-1795 waited 3.6 h because ready events don't start a Coordinator turn (§3.8). Current delivery semantics are unverified. §7 #9.

Kind: product. Triage ticket H-12 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [ ] C1. A lead's ready report and a landing reach an idle Coordinator as deliveries that start a turn (test with the fake Claude).

## Dependencies

none
