---
id: T-758
kind: task
title: Local test runs fail in cover-quiet suite.slot admission when the busy hub answers after 3000 ms
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T22:04:51.687Z
updated: 2026-10-17T22:05:19.054Z
---

## Summary

On 2026-10-17 at 22:03Z, nine Implementer sessions were active. Two local serial test runs failed before any test body ran, because the cover-quiet `suite.slot` admission through hub/src/cli/socket-client.ts got no answer from the project hub socket within 3000 ms: impl-707 in a T-707 scenario, run 5, and impl-703 in tracker-ready, attempt 3. In the same minute, impl-752's `cland verify --dry-run` timed out after 15000 ms waiting for hub.sock. Hub pid 386 sampled 38–98 % CPU over 30 s, at 350–650 MB RSS. hub.db is 87 MB and journal.jsonl is 115 MB. The machine's load was about 10.

## What to build

A busy hub must not turn a local test into a failure. Admission either waits with a load-scaled bound and reports "admission timed out" as its own outcome, distinct from a test failure, or a cheap admission path that skips the busy main loop answers it. Find what kept the hub at that CPU level under nine sessions: a profile of hub serve during a burst (see the hub-startup-profiling notes).

## Acceptance criteria

- [ ] C1. A profile of the hub under a nine-session burst names the dominant CPU consumer, recorded here with the artifact id.
- [ ] C2. A T2 test with a hub that delays its suite.slot answer beyond 3000 ms shows the local run either admitted after the delay or ending with a distinct admission-timeout outcome, never as a test failure. The test fails before the fix.

## Comments

### coord · 2026-10-17T22:05:19.054Z

More cases from the same burst, 22:03–22:04Z:
- impl-702: session-archive-merge, pre-body, socket-client.ts:36.
- impl-703: tracker-ready, attempt 4.
- impl-751: remote-scripted, worker exit 1 with zero subtests.
impl-751's provenance finding is that hub/test/cover-quiet.ts awaits the real project hub at import time, so the socket-client 3 s timeout throws before any test registers. The fix should also move that await out of import time, or give it the same distinct admission-timeout outcome.
