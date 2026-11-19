---
id: T-1990
kind: task
title: Switch the implement-skill subsystem-text lint from report mode to enforce after a clean week
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1887
blocked_by: []
topic: null
branch: null
created: 2026-11-19T01:24:39.206Z
updated: 2026-11-19T01:24:39.206Z
---

## Summary

T-1649 (landed b287403fd on 2026-11-19) added a lint that flags subsystem text added to `.agents/skills/implement/SKILL.md`, wired into test:static and T0 in report mode under rule 27. Its refusing behaviour sits behind an enforcement switch. This item switches it to enforce once a week of runs shows no unintended findings.

## What to build

Replay every authorized platform and occasion log since T-1649 landed through the production checker (rule 27). Keep the before-and-after findings and every bounded exception in one artifact, then turn on the enforcement switch in the wired default.

## Acceptance criteria

- [ ] C1. The replay artifact lists every finding the checker reports on logs since 2026-11-19, with each one classified as an intended refusal or an exception (artifact).
- [ ] C2. The wired default refuses a change that adds subsystem text to SKILL.md without the workflow-change marker, and still accepts a marked deliberate edit (test).
