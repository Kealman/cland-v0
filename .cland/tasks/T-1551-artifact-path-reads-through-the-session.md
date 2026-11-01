---
id: T-1551
kind: task
title: Artifact path reads through the session's Host
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: topic-1299
branch: t/T-1551-artifact-path-reads-through-the-session
created: 2026-10-31T23:47:42.500Z
updated: 2026-11-01T07:16:06.199Z
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

## Comments

### impl-1551 · 2026-11-01T07:11:51.409Z

Consumer inventory before edits: createArtifact production calls are Dispatcher.#artifact and #batchArtifact; previous positional read port remains supported for artifact-create-unit.test.ts unchanged. folderFiles also serves artifact.list and localHost.listFolder; leave its native local walker to avoid recursion. uploadArtifacts called only by Dispatcher upload; bytes remain frame-owned, only stored attachment checks route local. readArtifact injection also serves attached message reads and stays compatible. Searches cover hub/src, hub/test (all tiers), nvim/test, web/test, qa and .agents; no protocol or stored artifact creator shape changes. New regression seam: public createArtifact and Dispatcher frame conversation using recording Host, per epic's approved seams.

### impl-1551 · 2026-11-01T07:16:06.199Z

Additive Host.fileType approved by Coordinator answer e7724cde-1596-4cf0-bc15-f1da821dde08: no-follow file/directory/symlink/other/missing, ENOENT+ENOTDIR missing, other errors reject. Implementation is local.ts; Host literals inherit localHost so gain the member. Shared host-contract.ts exercises member and host-contract-coverage.test.ts discovers it dynamically. Sessions adds stable-session-id lookup delegating existing process placement; current placement remains local. Additional legacy readArtifact consumers identified: visibility-component, prompt-races, roles-snapshot and item-lead tests; their injected port remains honored in regular creation and message attachment reads. No frame or persisted shape changes. Host docs and skill edited in existing Host section with provenance change note.
