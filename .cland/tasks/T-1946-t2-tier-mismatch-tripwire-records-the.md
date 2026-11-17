---
id: T-1946
kind: task
title: T2 tier-mismatch tripwire records the fake-only fixture's positive launch-refusal controls as native exec/execFile use
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-17T12:40:29.242Z
updated: 2026-11-17T12:40:29.242Z
---

## Summary

Run e41ac1fb (A-20876, T-1528, 2026-11-17) reports tier-mismatch records for child_process.exec and execFile at hub/test/fake-only-fixture.ts:31, during a T2 test's positive guard controls. Those controls deliberately call the original promisify implementations through the installed launch refusal, and the refusal fires as intended. The advisory tripwire still counts them as native resource use, which adds noise to every report that uses the shared guard. Found by impl-1528, topic-1601.

## What to build

The tripwire tells a refused launch attempt through the fake-only guard apart from real native use, recording it as a refusal control rather than a tier mismatch.

## Acceptance criteria

- [ ] C1. A positive refusal control through fakeOnlyFixture produces no tier-mismatch record, while a real unguarded exec in a T2 test still does (test).
