---
id: T-1267
kind: task
title: hook-bridge's real-hub stop case still leaks a Timeout on Linux after T-1261
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1261
found_by: droplet
topic: topic-1012
branch: t/T-1267-hook-bridge-s-real-hub-stop-case-still
created: 2026-10-25T00:40:42.289Z
updated: 2026-10-25T00:43:18.513Z
---

## Summary

Periodic dev T3 fd9b6fdd at ed77f253 (Linux droplet c-8 lon1, A-11554), which contains T-1261's fix (90da1923), failed `hub/test/scenarios/hook-bridge.test.ts:16` "a bridge exits after its real hub stops even while its parent and stdout remain alive" again: `projectHub leaked resources; active before=CloseReq,PipeWrap×5,ProcessWrap after=PipeWrap×5,ProcessWrap` with `resources: ['Timeout']`. T-1261 found and drained one source (the Claude CLI execFile delayedKill timer); a second Timeout survives stop on Linux. It passed in the first stage cover's Linux shards at the same SHA (e70d2393, A-11549).

## Acceptance criteria

- [ ] C1. The surviving Timeout's creation site is named from a creation stack (the async_hooks method T-1261 used), cleared or awaited on stop, with a deterministic red control (test).
- [ ] C2. The item's mode-free droplet verify at 2 workers passes the hook-bridge case, and its new red-control identity passes its load-gate repetitions (test).

## Comments

### coord · 2026-10-25T00:43:12.217Z

The periodic dev T3 failing-file rerun f17f426b at the same SHA ed77f253 (Linux droplet, A-11555) passed hook-bridge.test.ts 1/1. The leak is intermittent; the red control needs to force the timing window.

### impl-1267 · 2026-10-25T00:43:18.513Z

Static phase under cover-quiet: read T-1261, landing 90da1923, A-11502 and failing A-11554; inspected all hub/src timer creation sites and hub/adapters stop ownership. Diagnostic async_hooks creation-stack capture is prepared in the existing restarted-hub resource census, with no production fix or weakened assertion. No local test/probe/typecheck has run. Candidate timer owners remain unconfirmed until the Coordinator's slot-free notice permits the first targeted capture. Static inventory and next slice are in the item topic artifact.
