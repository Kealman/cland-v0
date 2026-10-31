---
id: T-1563
kind: task
title: Artifacts a person created carry their user
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
  - T-1551
topic: null
branch: null
created: 2026-10-31T23:47:51.208Z
updated: 2026-10-31T23:48:11.671Z
---

## Summary

In users mode an artifact created or uploaded by a person, from the web, the CLI or a remote, records the user's id and shows the user's name as its creator. The journal's artifact record names the user's id. Agent artifacts are unchanged.

Hot files: `hub/src/hub/artifacts.ts` [Host: E-1531 moves path reads], `hub/src/hub/artifact-upload.ts` [Host: E-1531], `hub/src/protocol.ts` [Host] (`Artifact.creatorUserId`), `hub/src/hub/dispatch.ts` [Host].

## Acceptance criteria

- [ ] C1. An artifact a user creates or uploads in users mode records that user's id and has the user's name as `creator`.
- [ ] C2. An artifact created by an agent session carries no user id.
- [ ] C3. The audit and artifact journal records of a human artifact carry the user's id.
- [ ] C4. Single-mode human artifacts keep `creator` `human` and no user id.
- [ ] C5. The change touches only creator fields in the artifact code, leaving its path reading as it is.
