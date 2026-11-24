---
id: T-1974
kind: task
title: Native no-replace rename for host agents (Linux renameat2 RENAME_NOREPLACE, macOS renamex_np RENAME_EXCL); needs the human's approval for a native runtime
state: open
status: backlog
size: M
labels:
  - needs-triage
  - needs-decision
  - deferred-0.4.2
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-18T12:34:43.682Z
updated: 2026-11-24T08:59:01.591Z
---

## Summary

From T-1672 (2026-11-18). Host-owned OpenCode renames ship with a checked fallback: a serialized per-directory owner, pathname rename, and an identity check after the move, where a mismatch is fenced as unknown. Node's `fs.rename` exposes no no-replace flag, so the window between the last identity check and the rename can't be closed against out-of-band same-user writers, and T-1672 scopes that out. An atomic no-replace rename would close it, but it needs a native binding or runtime, which needs the human's approval as a new dependency.

## What to build

Only once the human approves a runtime: a host-agent no-replace rename using renameat2(RENAME_NOREPLACE) on Linux and renamex_np(RENAME_EXCL) on macOS, with supported-filesystem detection and the T-1672 checked fallback where neither exists. Packaging covers each supported agent platform.

## Acceptance criteria

- [ ] C1. The human's decision on the native runtime or binding and its packaging is recorded before any code (decision).
- [ ] C2. On each supported platform, a rename onto an existing destination is refused atomically, and an unsupported filesystem falls back to the checked path, proven by an isolated platform contract test.

## Comments

### coord · 2026-11-24T08:59:01.591Z

Deferred out of 0.4.1 to 0.4.2 or later. The reason is in the deferral table of A-22763 (section 3; T-1974 in section 4). Re-triage A-22763, approved by the human on ask 0d31338f (2026-11-24 08:58Z).
