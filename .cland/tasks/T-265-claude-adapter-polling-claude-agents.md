---
id: T-265
kind: task
title: "Safer Claude polling: claude agents --json at most once per 30 s per config directory on one shared schedule, and one notice for a signed-out directory (claude-code#95822)"
state: open
status: planned
size: M
labels:
  - hub
  - v0.1.2
  - ready-for-agent
assignee: null
parent: E-272
blocked_by: []
topic: null
branch: null
created: 2026-10-12T09:36:53.954Z
updated: 2026-10-13T23:43:18.004Z
---

## Summary

The Claude adapter calls `claude agents --json` at most once per 30 seconds per config directory, on one schedule that the watch poll, launch discovery and resume share. A logged-out directory produces one event and one message naming it, with no retry storm (claude-code#95822).

## Parent

E-272: Accounts and limits, tracer bullet 1. Research: `docs/research/account-limits.md` on `research/account-limits`. Upstream: anthropics/claude-code#95822 (still open on 2026-10-14).

## What happened

Found by the T-240 research. Claude Code issue #95822 reports that short-lived `claude` commands run near the OAuth token's expiry can spend the refresh token and log a config directory out. The commands named are `auth status`, `--bg` and `agents --json`. One report involves several `CLAUDE_CONFIG_DIR`s; another involves `agents --json` on a timer. cland's Claude adapter (`hub/src/adapters/claude-code.ts`) polls `agents --json` every 5 seconds (`CLAND_ADAPTER_POLL_MS`). Its launch loop also calls it every 250 ms for up to 20 s to find the pid, and `resume()` calls it once per session at hub start.

## What to build

1. **Interval.** The default interval for `agents --json` becomes 30 s. The pid liveness tick stays short, because it runs no CLI.
2. **One schedule per effective config directory,** with at most one call in flight. The watch poll, launch pid discovery and hub-start resume all share it. The 250 ms discovery loop goes: a new session's pid may arrive up to one interval later, and stop falls back to `claude stop <id>` until then.
3. **Polling only while needed.** `agents --json` runs for a directory only while it has a watched session.
4. **Signed-out detection.** A directory counts as signed out on `StopFailure` with `authentication_failed`, or on a `--bg` that fails with expiry text. That gives one `claude-signed-out` journal record and one notice in Agents. The notice names the directory and `CLAUDE_CONFIG_DIR=<dir> claude auth login`. Then the adapter stays quiet until the directory works again: no retry and no faster polling.
5. **No auth probes.** The adapter never runs `auth status` or `doctor`.
6. **The fake** (`hub/test/fakes/claude-code`) gains a log of every CLI call with its config directory, and a logged-out marker.

Out of scope: config directories per account, and the two-directory demo (E-272's next Claude ticket, after the registry).

## Acceptance criteria

- [ ] C1. The adapter's `claude agents --json` calls are at most one per 30 seconds per config directory, counted by the fake's call log over a run with a launch, a resume and a watched session.
- [ ] C2. Launch discovery and hub-start resume count against the same schedule; no 250 ms discovery loop remains, and a session whose pid arrives late is still stopped correctly.
- [ ] C3. `agents --json` runs only while the directory has a watched session; with none, the call log stays empty.
- [ ] C4. A logged-out directory produces one `claude-signed-out` journal record and one Agents notice naming the directory and the login command, and no further calls until it works again.
- [ ] C5. The behaviour is covered by fake-harness tests through the hub's frame protocol.
- [ ] C6. The README's Claude adapter table states the interval, the shared schedule and the signed-out notice.
