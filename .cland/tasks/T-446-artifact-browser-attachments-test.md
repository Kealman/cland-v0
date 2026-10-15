---
id: T-446
kind: task
title: artifact-browser attachments test connects before its Neovim socket is up (ECONNREFUSED under load)
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T00:52:28.303Z
updated: 2026-10-15T00:52:28.303Z
---

## Summary

`nvim/test/artifact-browser.test.ts:216` ('pending message attachments survive both a refused and an accepted ask answer') failed in integrated cover 55432184 at 131b7629 (A-2627) after 0.9 s, with `connect ECONNREFUSED` on the fixture's nvim.sock. The peak load was 18.6, with a census run and targeted runs beside it. Alone at the same head it passed 5/5 (2026-10-15 00:50Z). The test connects before Neovim's listen socket exists, so it should wait for the socket, or retry the connect with a bound, before its first RPC.

## Acceptance criteria

- [ ] C1. The test, or its harness, waits for the socket to accept before connecting, and the file passes 5/5 beside a local full run.
