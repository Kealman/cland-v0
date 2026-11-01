---
id: T-1551
kind: task
title: Artifact path reads through the session's Host
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: null
branch: null
created: 2026-10-31T23:47:42.500Z
updated: 2026-11-01T07:09:54.982Z
---

## Summary

`artifact.create` with a path resolves, types, lists and reads its source through the calling session's Host. The human's and the hub's own calls use the `local` host. `artifact.upload`'s checks of stored artifact files go through the `local` host.

Hot files: `hub/src/hub/dispatch.ts` (the `artifact.create` handler), `hub/src/hub/artifacts.ts`, `hub/src/hub/artifact-folder.ts`, `hub/src/hub/artifact-upload.ts`

## Acceptance criteria

- [ ] C1. `createArtifact` takes the caller's Host and reads a file source's bytes, a folder source's files and the source's type through it (test).
- [ ] C2. A session's relative path resolves against its cwd and is read on that session's Host, and the human's and the hub's calls use the `local` host (test).
- [ ] C3. `artifact.upload` checks attached artifacts' files through the `local` host (test).
- [ ] C4. With a recording Host, an `artifact.create` with a path from a session reads only through that session's Host (test).
- [ ] C5. The artifacts, artifact-create-unit, artifact-folders, artifact-upload and artifact-cli test files pass with no test edited.
