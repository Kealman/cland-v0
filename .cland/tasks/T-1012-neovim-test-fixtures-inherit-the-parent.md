---
id: T-1012
kind: task
title: Neovim test fixtures inherit the parent environment unless sealed explicitly
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-20T17:10:34.274Z
updated: 2026-10-24T06:46:21.246Z
---

## Summary

Neovim test fixtures created with `createClient` inherit most of the parent's HOME, account and provider variables unless a sealed environment is supplied. A Neovim test can therefore read the human's real state or credentials. impl-1008 found this while working on T-1008 (2026-10-20); its new cases already pass the shared `fixtureEnvironment`.

## What to build

`createClient`, and every other Neovim fixture launcher, uses the sealed fixture environment by default: scratch HOME and XDG, a synthetic Git identity, credentials filtered. A test that needs a variable passes it explicitly. Existing Neovim tests move to the default.

## Acceptance criteria

- [ ] C1. A Neovim fixture created without an explicit environment receives the sealed fixture environment, with no parent HOME, account or provider variable (test with a poisoned parent environment).
- [ ] C2. A test can pass an explicit variable through, and only that variable reaches the fixture (test).
- [ ] C3. The existing Neovim T2 tests pass on the sealed default without per-test environment edits, or each edit is listed in the item topic.
