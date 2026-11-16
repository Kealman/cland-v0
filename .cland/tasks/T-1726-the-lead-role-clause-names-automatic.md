---
id: T-1726
kind: task
title: The Lead role clause names automatic host pushes, as E-1532's Contents promise
state: open
status: planned
size: XS
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: null
branch: null
created: 2026-11-06T16:26:33.070Z
updated: 2026-11-16T07:31:18.085Z
---

## Summary

E-1532's Contents say that both the Implementer and the Lead clause tell sessions that commits on a host are pushed automatically, so a session doesn't push by hand. qa-678's Definition-of-done run (E1532D-02 at 6f0cf6ae) found the Implementer clause says it, but the Lead clause in `hub/src/roles/default-roles.ts` has no line about it. It's low severity: C7 is met by the product behaviour and the tests.

## What to build

One line in the Lead role clause stating that commits on a host reach the territory without a manual push, and that `verify` and `ready` flush first. Role clauses are near their byte reserve, so tighten an existing line rather than adding one if needed. Update any clause snapshot or byte-budget test.

## Acceptance criteria

- [ ] C1. The Lead clause in default-roles.ts states that host commits are pushed automatically, and the clause byte-budget test passes (test).
