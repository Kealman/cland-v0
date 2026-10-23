---
id: T-1160
kind: task
title: web/README.md says Artifacts details still come from AreaObjects stand-ins
state: open
status: planned
size: XS
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-418
blocked_by: []
topic: null
branch: null
created: 2026-10-23T01:33:51.432Z
updated: 2026-10-23T02:19:51.630Z
---

## Summary

E-418 stage-2 QA (qa-676, E418S2-12 at d32c6a8f) found a stale statement at web/README.md lines ~220–221: "Its drawer and Artifacts page/drawer retain the ID/title details from AreaObjects.tsx." Since T-1139 and T-1140 the Artifacts area and its viewer are real (README section from ~297 describes them), so the stand-in sentence contradicts the implemented area.

## What to build

The README's area-slot section no longer describes Artifacts (or any other implemented area) as showing stand-in ID/title details, and points to each area's own section instead.

## Acceptance criteria

- [ ] C1. web/README.md has no sentence saying the Artifacts page or drawer shows AreaObjects stand-in details, and each area the slot section names as implemented links or refers to its own section (docs).
