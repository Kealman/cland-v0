---
id: T-521
kind: task
title: Concurrent artifact.create can fail with 'artifact reservation moved' (id allocated twice)
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
created: 2026-10-15T18:13:01.794Z
updated: 2026-10-15T18:13:01.794Z
---

## Summary

`artifact.create` can fail with "artifact reservation moved" when two creates overlap. hub/src/hub/artifacts.ts reserves an id, prepares the bytes, then calls `store.registerArtifact`. Registration allocates the next id afresh and throws when that differs from the prepared one (around lines 98–100). Under today's load an Implementer's evidence upload failed this way, on T-508 at 18:10Z on 2026-10-15, and succeeded on retry.

## Acceptance criteria

- [ ] C1. Registration uses the reserved id, or retries preparation under the new id, so two concurrent creates both succeed with distinct ids. No prepared bytes are orphaned.
- [ ] C2. A test runs two artifact.create calls whose preparation overlaps and sees both registered, with their bytes intact.
