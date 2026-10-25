---
id: T-1265
kind: task
title: 'A long-lived Codex session cannot reattach after a hub restart: app-server thread read fails with "Max payload size exceeded"'
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: E-1280
blocked_by: []
topic: null
branch: t/T-1265-a-long-lived-codex-session-cannot
created: 2026-10-24T22:20:46.414Z
updated: 2026-10-25T09:54:34.214Z
---

## Summary

After hub restart #55 (2026-10-24 22:18:50Z), Reviewer rev-23 (codex, gpt-6.1-sol, running since 16:52Z with many reviews) stayed `[unknown]`; the hub posted inject-stalled after 60 s. `cland session resume rev-23` failed: `the app-server (pid 25379) does not answer for thread 01a12ffb-…: the app-server connection failed (Max payload size exceeded); a pending request may have been accepted`. The other four Codex sessions reattached. Coord stopped rev-23 and launched rev-33 in its place.

## Evidence

- inject-stalled notice 75a70650 at 22:19:58Z.
- The resume refusal text above; verifier holds were not restored.

## Acceptance criteria

- [ ] C1. The Codex adapter reattaches a session whose thread read exceeds the client's default frame limit (raised limit, paged read, or a reattach path that does not read the whole thread), with a test at the fake app-server boundary (test).
- [ ] C2. When reattach still fails, the session row says why (payload limit) instead of `[unknown]`, so the Coordinator knows to replace it (test).
