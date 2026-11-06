---
id: T-1708
kind: task
title: DigitalOcean API pacing and typed 429s
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: null
branch: t/T-1708-digitalocean-api-pacing-and-typed-429s
created: 2026-11-06T10:47:52.181Z
updated: 2026-11-06T10:50:08.831Z
---

## Summary

The shared DigitalOcean client paces its calls within 250 requests a minute on the hub's clock, and turns a 429 into a typed refusal carrying the retry time from the response, with no immediate re-send. The executor and the host provider share one budget per token. The fake DigitalOcean API learns to answer 429 with rate-limit headers.

Hot files: `hub/src/executor/droplet/api.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, `hub/test/digitalocean-pacing.test.ts` (new)

## What to build

A token bucket in the client over the injected clock, the parse of `Retry-After` and `ratelimit-reset` into a `RateLimited` error, and fault injection for 429 in the fake API.

Notes: `api.ts` and `fake-api.ts` are shared and serialized in one lane with the DigitalOcean machines, declarations, volumes and pool-image tickets.

## Acceptance criteria

- [ ] C1. With an injected clock, 300 queued calls never send more than 250 within any 60 s window (test).
- [ ] C2. A 429 surfaces as a typed refusal carrying the response's retry time, and the client sends nothing for that call before then (test).
- [ ] C3. The executor test files (`executor-droplet`, `executor-prepare`, `executor-safety`) pass with no test edited.
