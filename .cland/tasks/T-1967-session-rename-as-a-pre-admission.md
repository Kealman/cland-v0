---
id: T-1967
kind: task
title: "Session rename as a pre-admission transaction: reserve the new identity, move on the host, then commit, and return a refusal over the rename reply"
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-18T11:26:06.636Z
updated: 2026-11-18T11:26:06.636Z
---

## Summary

Found by impl-1672 while fixing T-1672 (2026-11-18). `Core.rename` is synchronous: it commits the hub and socket identity first, then calls the Sessions `onRenamed` observer, so a host-side failure (such as T-1672's remote OpenCode directory move) can only be reported after the hub name has already changed. T-1672 keeps that contract: a failed or unknown host move leaves the session fenced, with `rename incomplete on host: <cause>` shown in its state.

## What to build

Make rename a pre-admission transaction. It reserves the destination identity before any Host I/O, commits the core and socket identity only after a positive move receipt, and returns a refusal in the rename wire reply, leaving the old name intact. Migrate the dispatch and Core rename consumers, keeping frame ordering, and handle unknown moves explicitly.

## Acceptance criteria

- [ ] C1. A refused or failed host move returns a structured refusal in the rename reply, and the session keeps its old name and remains usable (test with fakes).
- [ ] C2. An unknown move outcome is fenced and never replayed, and the destination name stays reserved until the outcome is settled (test).
- [ ] C3. Every rename consumer (dispatch, Core, CLI, web, Neovim, the session socket) is listed with its disposition, and a client at the previous reply shape still parses the reply (rule 20).
