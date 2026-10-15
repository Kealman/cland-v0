---
id: T-465
kind: task
title: codex-adapter usage test compares the first usage event with a later snapshot whose rateLimitsAt differs
state: open
status: review
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
updated: 2026-10-15T12:34:00.124Z
---

## Summary

`hub/test/codex-adapter.test.ts:272` compares the first matching usage event with a later snapshot. Only `rateLimitsAt` differs (.741Z against .532Z), while all the usage, token and rate-limit values agree. It failed in T-454's gate cc871d75 (A-2787), 2026-10-15. When a second sparse rate-limit update arrives between the two reads, the timestamp moves. Compare the values without `rateLimitsAt`, or wait for the snapshot that matches the event.

## Acceptance criteria

- [ ] C1. The assertion is independent of a refreshed `rateLimitsAt` and keeps its meaning for the values, and the file passes 5/5 beside a local full run.

## Comments

### impl-465 · 2026-10-15T12:32:19.294Z

Implementation prepared: deep equality still covers every usage property except rateLimitsAt, which refreshes on rate-limit reads/updates. Existing model, raw token, normalized total/last and rate-limit assertions are retained; no timeouts change. Test-only bug already isolated by T-454 gate cc871d75/A-2787 and confirmed in adapter timestamp refresh + FrameClient.waitFor first-match behavior, so skipping broader hypothesis/instrumentation phases. Holding all local tests pending the Coordinator's serial window/load-evidence decision (asked in topic-293).

### impl-465 · 2026-10-15T12:33:11.381Z

Committed/pushed 6612ac3c791864e8e0ac442a9b585975c4cd631a after fetching/merging origin/dev. Source review requested under Coordinator b4900603 direction to proceed before local testing. Coordinator 1ba48602 replaces E-482 loaded-full-run evidence with five serial whole-file Mac passes, quiet or loaded and labelled, plus task droplet verify. T-465 holds third Mac slot after impl-486/impl-393 and will hand to impl-463.

### rev-30 · 2026-10-15T12:34:00.124Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-465-source
commit: 6612ac3c791864e8e0ac442a9b585975c4cd631a
scope: full

Source review clear at 6612ac3c791864e8e0ac442a9b585975c4cd631a; no high, medium or low findings.

Standards: no findings against repo test guidance or the code-review smell baseline. Minimal local comparison change; copies avoid mutating captured frames or the snapshot. No new wait, timeout, test identity or duration allowance.

Spec: hub/test/codex-adapter.test.ts:272–278 normalizes only rateLimitsAt on both comparison operands. Deep equality still checks every other enumerable usage property, and explicit model/raw-token/rate-limit/normalized total and last assertions at :266–270 remain intact. Adapter notification/read paths refresh rateLimitsAt independently of values (codex.ts:581,598,611), so ignoring this timestamp implements the task's stated alternative.

Reviewed git diff 2581000178f89873857b04d9f31e425ee03df0da...6612ac3c791864e8e0ac442a9b585975c4cd631a, one commit, only hub/test/codex-adapter.test.ts. Both Standards and Spec axes reviewed directly; role prohibits sub-agents.

C1 remains unverified because its five whole-file passes and same-head gate are pending. Coordinator b4900603 explicitly allows source review before the Mac slot; 1ba48602 accepts five labelled quiet or loaded serial Mac passes plus task droplet verification. Source part is satisfied; no run evidence claimed. No Reviewer tests or edits.
