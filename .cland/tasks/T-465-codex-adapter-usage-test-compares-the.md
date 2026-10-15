---
id: T-465
kind: task
title: codex-adapter usage test compares the first usage event with a later snapshot whose rateLimitsAt differs
state: open
status: in progress
size: XS
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-293
branch: t/T-465-codex-adapter-usage-test-compares-the
created: 2026-10-15T08:47:22.013Z
updated: 2026-10-15T12:32:19.294Z
---

## Summary

`hub/test/codex-adapter.test.ts:272` compares the first matching usage event with a later snapshot. Only `rateLimitsAt` differs (.741Z against .532Z), while all the usage, token and rate-limit values agree. It failed in T-454's gate cc871d75 (A-2787), 2026-10-15. When a second sparse rate-limit update arrives between the two reads, the timestamp moves. Compare the values without `rateLimitsAt`, or wait for the snapshot that matches the event.

## Acceptance criteria

- [ ] C1. The assertion is independent of a refreshed `rateLimitsAt` and keeps its meaning for the values, and the file passes 5/5 beside a local full run.

## Comments

### impl-465 · 2026-10-15T12:32:19.294Z

Implementation prepared: deep equality still covers every usage property except rateLimitsAt, which refreshes on rate-limit reads/updates. Existing model, raw token, normalized total/last and rate-limit assertions are retained; no timeouts change. Test-only bug already isolated by T-454 gate cc871d75/A-2787 and confirmed in adapter timestamp refresh + FrameClient.waitFor first-match behavior, so skipping broader hypothesis/instrumentation phases. Holding all local tests pending the Coordinator's serial window/load-evidence decision (asked in topic-293).
