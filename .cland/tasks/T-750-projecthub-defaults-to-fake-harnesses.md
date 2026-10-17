---
id: T-750
kind: task
title: projectHub defaults to fake harnesses and fake probes; native probes become opt-in
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: null
created: 2026-10-17T18:44:08.555Z
updated: 2026-10-17T18:44:08.555Z
---

## Summary

T-748's first runtime trip list (A-4702, A-4703; run f6262d9d) found 424 report-only resource uses in 52 T1/T2 hub files. Most of route R1 (34 files) come from one root: projectHub's default native probes (git, ps, doctor bootstrap) run unless a test passes `probes: 'fake'`. Flipping the default removes the bulk at once.

## What to build

projectHub (and the fixtures built on it) default to `harnesses: 'fake'` and `probes: 'fake'`, with injected Git/readBase facts where a test needs branch state. Tests that really prove native behaviour opt in with an explicit `native` option and carry a T3 header. Every assertion keeps its meaning. The T3 native contract files stay native.

## Acceptance criteria

- [ ] C1. The runtime tripwire (T-748) reports no child_process trip in the R1 projectHub files listed in A-4703 (session-*, lead-*, heartbeat, handover, item-lead, permissions, rule-cli, project-clock, in-process-spoke, fake-harness, adapter-composition, codex-*/opencode-native, skills-tracker, suite-protocol, suite-close-component), proved by a full droplet run's trip report.
- [ ] C2. Every test that relied on native defaults either opts in explicitly in a T3 file or is rewritten with injected facts; the review request maps each, with Mac 5/5 medians before and after.
