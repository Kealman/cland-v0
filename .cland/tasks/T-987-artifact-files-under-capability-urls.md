---
id: T-987
kind: task
title: Artifact files under capability URLs
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-982
topic: null
branch: null
created: 2026-10-20T16:50:00.648Z
updated: 2026-10-20T20:57:50.596Z
---

## Summary

An artifact's files are served from the web edge under a random capability URL that a client frame mints per artifact. The URL is valid while its cookie session lives and confined to the artifact. HTML carries a sandbox policy, so a page artifact in a sandboxed iframe loads its own files without the cookie.

## What to build

A client frame on the web edge, for example `artifact.url`, mints a capability for one artifact. `/a/<capability>/<file>` serves that artifact's file, or files inside its folder. The content type comes from the extension. An HTML file answers with `Content-Security-Policy: sandbox allow-scripts`. A capability dies with its cookie session.

## Acceptance criteria

- [ ] C1. The minting frame on the web edge returns a capability URL, and the URL serves the artifact's file with the type of its extension (test).
- [ ] C2. A capability serves only its own artifact's file or folder: another artifact's file, a path outside the folder and a traversal are refused (test).
- [ ] C3. An HTML file answers with `Content-Security-Policy: sandbox allow-scripts`, and a folder artifact's page reaches its own stylesheet through a relative URL under the same capability (test).
- [ ] C4. A capability stops working when its cookie session is revoked or expires (test).
- [ ] C5. `hub/README.md` documents the capability URLs.
