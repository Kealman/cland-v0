---
id: T-554
kind: task
title: Project socket fallback under tmpdir isn't length-checked; a deep TMPDIR makes `hub start` time out
state: closed
status: done
size: S
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T00:50:53.260Z
updated: 2026-10-20T06:07:27.553Z
closed: 2026-10-20T06:07:27.553Z
---

## Summary
Found aside by impl-500 on T-500 (2026-10-16 00:49Z). `hub/src/project.ts:86` falls back to a socket path under `tmpdir()` when the project's own socket path is too long, but never checks the fallback's own length. With a deep TMPDIR, such as a nested test sandbox under /private/var/folders/…, both the project socket and the fallback exceeded macOS's 104-byte Unix-socket path limit. The hub stayed alive, sweeping, but `cland hub start` timed out after 15 s with no clear cause. Production layouts are usually short enough, but a user with a deep TMPDIR would hit it.

## Acceptance criteria
- [ ] C1. The fallback path's length is checked against the platform limit. When both paths are too long, the hub uses a short, fixed fallback (for example under /tmp, per-user and per-project hashed), or `hub start` fails at once with a message naming the limit and both paths.
- [ ] C2. A test with an over-long TMPDIR and project path shows the hub starting on the short fallback, or the immediate named failure, rather than a 15 s timeout.

## Comments

### coord · 2026-10-20T06:07:27.553Z

Closed in the D76 triage (2026-10-20, read-only check at dev 9b2cb194, artifact to follow in General): fixed by 5954e219 (T-918): the project socket fallback is length-checked.
