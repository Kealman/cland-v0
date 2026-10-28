---
id: T-1404
kind: task
title: "REST pacing: lanes per bucket and channel from the rate-limit headers, no repeat of 401, 403 or 404, and a timed-out send posts once"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1400
topic: null
branch: null
created: 2026-10-27T23:38:46.684Z
updated: 2026-10-28T08:10:56.599Z
---

## Summary

REST requests go through one lane per rate-limit bucket and channel. Each lane follows the `X-RateLimit-*` headers and `retry_after`, with no hard-coded limit, so a burst sees no 429. Invalid requests are never repeated, interaction callbacks bypass the lanes, and a send retried after a timeout posts once.

## What to build

**Lanes.** Each lane is keyed by method, route template and top-level id until Discord names the bucket, then by bucket and top-level id. One request is in flight per lane. Before the next request, a lane reads `X-RateLimit-Remaining` and `X-RateLimit-Reset-After`.

**429s.** A 429 waits the body's `retry_after` (seconds with decimals), capped at 5 minutes; a global 429 pauses every lane. A 5xx or 130000 retries with bounded back-off.

**Errors.** Each follows the assumption's policy. A 401 stops the remote through 06. A 403 or 404 on the paired channel stops it as `blocked`. A 404 on an edit or a reaction drops only that job. None is sent twice.

**Callbacks.** Interaction callbacks and `@original` edits go straight to the client, outside the lanes and the outbox.

**Proof.** A send that timed out is proven through 05's nonce rule before anything is re-sent.

**The fake.** It emits the headers. Its channel bucket allows 5 sends per 5 seconds and its reaction route one call per 250 ms, and it answers a 429 with `retry_after` when a limit is ignored. Its control can force a global 429 or hold a request past the client's timeout after storing it, and it counts 429s.

Spec §3.8 (REST), §3.9 (outbox); research rules 16 to 18 and 21.

## Acceptance criteria

- [ ] C1. A burst of twelve General messages on the fake's 5-per-5-seconds channel limit arrives in order with no 429, paced by the headers rather than a fixed rate (test).
- [ ] C2. A 429 waits the body's `retry_after`, a `retry_after` over 5 minutes waits 5 minutes, and a global 429 pauses every lane (test).
- [ ] C3. A send the fake stores and then holds past the client's timeout is proven by its nonce and posts exactly once (test).
- [ ] C4. A 401, 403 or 404 is never sent twice, a 403 on the paired channel stops the remote with its cause, and a 404 on an edit drops only that job (test).
- [ ] C5. An interaction callback goes out while the channel's lane waits on a rate limit (test).

## Notes

Shared files: discord-api.ts, discord-outbox.ts; hub/test/fakes/discord/ (rate limits)
