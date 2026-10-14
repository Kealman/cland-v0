---
id: T-265
kind: task
title: "Safer Claude polling: claude agents --json at most once per 30 s per config directory on one shared schedule, and one notice for a signed-out directory (claude-code#95822)"
state: open
status: review
size: M
criterion_seq: 6
labels:
  - hub
  - v0.1.2
  - ready-for-agent
assignee: null
parent: E-272
blocked_by: []
topic: topic-224
branch: t/T-265-claude-adapter-polling-claude-agents
created: 2026-10-12T09:36:53.954Z
updated: 2026-10-13T23:58:57.269Z
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

- [x] C1. The adapter's `claude agents --json` calls are at most one per 30 seconds per config directory, counted by the fake's call log over a run with a launch, a resume and a watched session.
  - done: impl-265 · 2026-10-13T23:55:12.256Z
- [x] C2. Launch discovery and hub-start resume count against the same schedule; no 250 ms discovery loop remains, and a session whose pid arrives late is still stopped correctly.
  - done: impl-265 · 2026-10-13T23:55:13.374Z
- [x] C3. `agents --json` runs only while the directory has a watched session; with none, the call log stays empty.
  - done: impl-265 · 2026-10-13T23:55:14.274Z
- [x] C4. A logged-out directory produces one `claude-signed-out` journal record and one Agents notice naming the directory and the login command, and no further calls until it works again.
  - done: impl-265 · 2026-10-13T23:55:14.945Z
- [x] C5. The behaviour is covered by fake-harness tests through the hub's frame protocol.
  - done: impl-265 · 2026-10-13T23:55:16.142Z
- [x] C6. The README's Claude adapter table states the interval, the shared schedule and the signed-out notice.
  - done: impl-265 · 2026-10-13T23:55:17.021Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-265-1 · 2026-10-13T23:58:57.269Z · commit 36d343b1f6ef451b5850704036a5cef799fa6fa6

## Comments

### coord · 2026-10-13T23:45:11.540Z

Coordinator decision (2026-10-13 23:45Z, asked by impl-265) on recovering a signed-out directory:
- The latch lifts only on a pushed success (session start or turn end; StopFailure never counts) or on an explicit launch whose --bg succeeds. No timer retries.
- Explicit launches stay allowed as the recovery action, with a warning naming the latch. A failure re-latches without a second notice.
- The latch and each directory's last agents --json time live in hub.db meta, keyed by the effective directory, so the 30 s floor and the latch survive hub restarts.
- Resume makes no CLI call for a latched directory.
- Both rules go in the README's Claude adapter table.

### impl-265 · 2026-10-13T23:54:54.620Z

Implemented the shared 30-second Claude discovery schedule and directory latch in hub.db meta. Coordinator decisions in topic-224 define persistence, recovery, retained watched rows/stateReason, and one human notice plus deduplicated sender failures. Targeted fake-harness frame tests cover the default floor across launch/resume/watch, late-pid stop, idle directories, expiry failures, signed-out restart suppression, one human notice and sender delivery, and both explicit/pushed recovery. README adapter table updated. Source review is next; no full verification submitted before source clearance.

### rev-23 · 2026-10-13T23:58:57.269Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-265-1
commit: 36d343b1f6ef451b5850704036a5cef799fa6fa6
scope: full

No high or medium findings remain. Shared persisted discovery timing, single flight, late-pid stop, signed-out suppression/recovery, unknown stateReason and sender notice deduplication match C1–C6 and the Coordinator decision. Both new journal reads now use flushProjectLogs and retain their assertions. C6 source-verified from README; C1–C5 await exact-head cland verify. A-2129: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2129-t-265-full-source-review-at-36d343b1.md.

Criteria: C6 verified.
