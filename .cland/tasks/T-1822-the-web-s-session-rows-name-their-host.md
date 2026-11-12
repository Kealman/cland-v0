---
id: T-1822
kind: task
title: The web's session rows name their host
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by: []
topic: null
branch: null
created: 2026-11-12T10:07:19.924Z
updated: 2026-11-12T10:07:41.951Z
---

## Summary

The web's session rows name the host each session runs on, on the desktop row and on the phone's session page. The process row already carries the host; this ticket shows it.

## What to build

The session row's facts gain the host id for a session on a remote host, beside the harness, model and account. A local session shows no host. The phone's session page shows the same fact. The fact's tooltip says it is the host the session runs on. Colours come from tokens, with secondary text at 4.5:1 on ground and selection.

## Acceptance criteria

- [ ] C1. A session on a fake host names its host id on its Sessions row and on its phone session page, and a local session names none (test).
- [ ] C2. The host fact has a tooltip, and the typecheck's colour and contrast checks pass on the row in its selected state (test).

## Blocked by

None (can start immediately)

## Notes

- Hot files: `web/src/sessions/SessionRow.tsx`, `web/src/sessions/SessionPage.tsx`, `web/src/sessions/Sessions.module.css`.
- Tests: `web/test/sessions.test.ts` and `web/test/phone-sessions.test.ts` (Web, `projectHub` with a fake host, isolated Headless Shell).
- Serves epic C3.
