---
id: T-1994
kind: task
title: The fake DigitalOcean API turns a rejected beforeCreate assertion into a 500, so the test times out at 120 s instead of failing
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-19T02:38:47.676Z
updated: 2026-11-19T02:38:47.676Z
---

## Summary

The fake DigitalOcean API catches a rejected `beforeCreate` callback and replaces the assertion with an HTTP 500 (`lease-missing`, "lease not armed before create"), around hub/test/fakes/digitalocean/fake-api.ts:181. The original error is discarded, and the caller's later wait for a running state can never succeed. A failed assertion therefore shows up as a 120 s test timeout instead of the precise failure, as impl-1958 found in T-1958 on 2026-11-19 (suite-accounting.test.ts around 412–415).

## What to build

When a test-supplied `beforeCreate` callback rejects, the fake API fails the test with that callback's original error, either surfaced to the waiting case or recorded as the case's failure, instead of disguising it as an unrelated provider 500. Real provider-error simulation stays available on purpose.

## Acceptance criteria

- [ ] C1. A `beforeCreate` callback that throws an assertion fails its case with that assertion's message within the case's normal budget, never by timeout (test with a positive control, red on the current fake).
- [ ] C2. Every caller that passes `beforeCreate` is listed with its disposition (rule 41) and still passes.
