---
id: T-1331
kind: task
title: The remote and speech configuration keys, rendered by init, added by update and applied by reload
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1328
topic: null
branch: null
created: 2026-10-26T07:54:42.573Z
updated: 2026-10-26T07:54:58.104Z
---

## Summary

The `[remote]`, `[remote.telegram]`, `[remote.discord]` and `[speech]` keys exist with their defaults. `cland init` renders them, `cland update` adds them to older projects, and `cland hub reload` applies them, connecting or disconnecting a messenger.

## What to build

Add the keys `[remote] mute_default`, `[remote.telegram] enabled` and `format`, `[remote.discord] enabled`, and `[speech] provider`, `model`, `language`, `max_seconds` and `command` to the rendered configuration (`hub/src/init/config.ts`), to `cland update`'s migration and to `cland config set`. A messenger is active when it is enabled and a token is present. Reload starts or stops that remote in the gateway. Until the real clients exist, a test messenger factory stands in through the existing fake seam. Spec §3.3.

## Acceptance criteria

- [ ] C1. `cland init` renders the four sections with their defaults, and `cland update` adds them to a project that lacks them without touching other keys (test).
- [ ] C2. `cland config set remote.telegram.enabled true` with a token present and `cland hub reload` starts a test messenger, and `false` with a reload stops it (test).
