---
id: T-2022
kind: task
title: "Shared suiteCase cleanup is unfenced: it removes roots and restores the native guard after a resource close rejects"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: null
branch: null
created: 2026-11-20T00:49:28.024Z
updated: 2026-11-25T13:02:47.372Z
---

## Summary

The shared `suiteCase` helper in `hub/test/suite-case-fixture.ts` runs its cleanup unfenced. After a resource's close rejects, it can still remove the case's roots and restore the native launch guard in a `finally`, so a failed cleanup reads as a successful close. `fenceFixtureCleanup` already exists but isn't used there. Found by T-1873's reviewer on 2026-11-20 (static finding).

## What to build

Run `suiteCase` cleanup through `fenceFixtureCleanup`. A rejected resource close keeps the roots for diagnosis and leaves the guard engaged, so the case fails with the close's literal error. Check every `suiteCase` caller for reliance on the old behaviour.

## Acceptance criteria

- [ ] C1. A resource close that rejects inside `suiteCase` fails the case with the close's error, keeps its roots and doesn't restore the native guard (test, red on the current helper).
- [ ] C2. Existing `suiteCase` callers pass unchanged, or each change is listed with its reason (test).
