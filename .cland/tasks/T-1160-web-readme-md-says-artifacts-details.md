---
id: T-1160
kind: task
title: web/README.md says Artifacts details still come from AreaObjects stand-ins
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-418
blocked_by: []
topic: topic-887
branch: t/T-1160-web-readme-md-says-artifacts-details
created: 2026-10-23T01:33:51.432Z
updated: 2026-10-23T02:23:41.747Z
closed: 2026-10-23T02:23:41.747Z
---

## Summary

E-418 stage-2 QA (qa-676, E418S2-12 at d32c6a8f) found a stale statement at web/README.md lines ~220–221: "Its drawer and Artifacts page/drawer retain the ID/title details from AreaObjects.tsx." Since T-1139 and T-1140 the Artifacts area and its viewer are real (README section from ~297 describes them), so the stand-in sentence contradicts the implemented area.

## What to build

The README's area-slot section no longer describes Artifacts (or any other implemented area) as showing stand-in ID/title details, and points to each area's own section instead.

## Acceptance criteria

- [x] C1. web/README.md has no sentence saying the Artifacts page or drawer shows AreaObjects stand-in details, and each area the slot section names as implemented links or refers to its own section (docs).
  - done: impl-1160 · 2026-10-23T02:22:35.966Z
  - verified: rev-26 [reviewer] · run rev-20261023-1160-source-1 · 2026-10-23T02:23:29.468Z · commit 8de8d0a2b31a6ef65d6f21841564df8529428d68

## Comments

### impl-1160 · 2026-10-23T02:21:31.595Z

Read the full Area modules and live state section and checked AreaSlot's module registry plus the dedicated area sections. Limiting the edit to that section: remove the stale Artifacts/Session drawer ID/title statement and link all implemented areas to their own sections; Inbox/Events remain stand-ins.

### rev-26 · 2026-10-23T02:23:29.468Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1160-source-1
commit: 8de8d0a2b31a6ef65d6f21841564df8529428d68
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 8de8d0a2/tree faffda55. Standards and Spec: no findings. Only the requested README paragraph changes; stale Artifacts AreaObjects attribution removed. Every implemented area and VerifyLine links to an existing matching section; Inbox/Events stand-in wording agrees with the registry at this commit. C1 docs verified by source. Read-only diff check clean. Reported local check remains requester-attributed without original receipt; configured verification pending, no suite/QA claim. A-9770: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9770-t-1160-readme-source-review-at-8de8d0a2.md.

Criteria: C1 verified.

### coord · 2026-10-23T02:23:41.747Z

Merged 652470cbb8c10114e6a3add735d024bb32b93076 onto dev.
