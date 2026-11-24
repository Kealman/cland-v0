---
id: T-1977
kind: task
title: opencode-launch-policy.test.ts is a T2 file whose default-adapter fixture runs the real ps through the native boundary
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: null
branch: null
created: 2026-11-18T12:45:47.120Z
updated: 2026-11-24T09:01:14.850Z
---

## Summary

Found by impl-1680 during T-1680 (2026-11-18). `hub/test/opencode-launch-policy.test.ts` is classified T2, but its default-adapter fixture passes the real `ps` through the native process boundary. So an ordinary T2 run reaches native code (rule 38), and running it locally under load needs the native slot despite its T2 routing.

## What to build

Inject the process-identity probe in the default-adapter fixture, with a positively controlled launch guard, so the file stays fake-only. If the case genuinely needs the real `ps`, move that one case to T3 with its reason recorded, rather than leaving it in T2.

## Acceptance criteria

- [ ] C1. The file runs with a positively controlled native launch guard and no real process probe, or the native case moves to T3 with its reason recorded in the tier manifest (test).
- [ ] C2. Every assertion in the file is unchanged, and its 11 cases pass (test).
