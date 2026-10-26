---
id: T-1326
kind: task
title: A failing remote disables only itself; the hub, the web edge and other remotes serve on
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1321
topic: null
branch: null
created: 2026-10-26T02:28:47.457Z
updated: 2026-10-26T02:28:47.457Z
---

## Summary

A remote that throws at start or later disables only itself, with the reason in the log and in the remote's state. The hub, the web edge and the other remote serve on.

## What to build

Isolate each remote's start and run loop in the gateway. A failure marks that remote disabled with its reason in the hub log and in its state row. It never propagates to the hub, the web edge or another remote. Spec §3.1.

## Acceptance criteria

- [ ] C1. A test messenger that throws at start, and another that throws after serving, each disable only themselves with the reason logged and stored, while a second test messenger and the web edge keep serving (test).
