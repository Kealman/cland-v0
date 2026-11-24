---
id: T-2078
kind: task
title: publishSessionEvidence reports "publication outcome unknown" when artifact.create succeeded but its reply was lost or late (busy hub)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-24T09:06:04.630Z
updated: 2026-11-24T09:06:24.691Z
---

## Summary

On 2026-11-24 at about 09:05Z, two implementers' evidence publications failed with "Evidence refused: publication outcome unknown; snapshot retained; reconcile session artifacts before retrying", from hub/src/evidence-publish.ts:123. In both cases `artifact.list` then showed the artifact had been created: A-22774 (impl-1945, T-1945) and A-22775 (impl-1953, T-1953). `artifactCreate` threw a non-HubRefusal error after the hub had already created the artifact, probably a reply timeout. At the time, hub #100 was at 30 to 140% CPU from T-2069's report-retry loop. The caller handled it safely by reconciling and not retrying, but every busy-hub publication costs a manual reconcile.

## What to build

When the outcome is unknown, reconcile automatically: look the artifact up by its retryKey, or by title and topic plus the snapshot's content hash, through `artifact.list`, and return the created artifact when it's found. Otherwise keep today's refusal. Find which error `artifactCreate` raised here, such as a timeout or a lost reply. If the cause is only T-2069's CPU loop, recheck after hub #101 is on T-2069 and close this with that evidence.

## Acceptance criteria

- [ ] C1. When `artifact.create` succeeds but its reply is lost, publishSessionEvidence returns the created artifact after one reconcile lookup, and creates no duplicate (test with a fake transport).
- [ ] C2. When the artifact really doesn't exist, the existing "outcome unknown" refusal and the retained snapshot are unchanged (test).

## Comments

### coord · 2026-11-24T09:06:24.691Z

Third case: impl-2065 (T-2065), A-22777 at 09:06Z. Same "publication outcome unknown", and artifact.list confirmed the artifact. All three came within about one minute, while about ten implementers ran full test:lint and the hub was in T-2069's retry loop.
