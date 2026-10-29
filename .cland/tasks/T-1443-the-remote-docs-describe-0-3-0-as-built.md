---
id: T-1443
kind: task
title: The remote docs describe 0.3.0 as built
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1314
blocked_by: []
topic: null
branch: null
created: 2026-10-29T15:55:47.685Z
updated: 2026-10-29T15:55:47.685Z
---

## Summary

Before the release, the web-and-phone page's section on remotes, the page on `cland remote` and `cland secret`, and the remote sections of `hub/README.md` are checked against the built release and corrected where they differ, as T-1186 did for 0.2.0.

## What to build

Read each page against the build: commands and flags against `--help`, config keys and secret names against the code, setup's remote step and doctor's lines against their tests. Add Discord, voice and attachments wherever the pages still describe Telegram only. Fix only what differs, and claim nothing the build lacks.

## Acceptance criteria

- [ ] C1. Every command, flag, config key and secret name on the three pages exists in the build, shown by the remote-docs tests, extended where a page names something new.
- [ ] C2. The pages cover both remotes, attachments and voice, setup's remote step and doctor's remote lines as built.
