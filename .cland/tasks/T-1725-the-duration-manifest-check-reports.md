---
id: T-1725
kind: task
title: The duration manifest check reports duplicate allowance and baseline keys
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-06T12:32:46.395Z
updated: 2026-11-06T12:32:46.395Z
---

## Summary

On 2026-11-06, T-1721 added a 48 s allowance under a key in `hub/test/durations.json` that already held 24 s. `JSON.parse` silently kept one value, so the effective allowance stayed 24 s, while `npm run check` reported zero lint refusals and a diff-only review passed it. rev-36 found it in review. The shared manifest reader should make duplicate keys visible.

## What to build

A duplicate-key detector in the shared durations manifest reader and lint path, covering the `files`, `tests` and `allow` maps: a token-level scan or a reviver-based check, because `JSON.parse` loses the duplicates. Per rule 27 it ships in report mode, reporting the duplicate key and both values; switching it to enforce is its own item.

## Acceptance criteria

- [ ] C1. A manifest with a duplicated `allow` key is reported, naming the key and both values, by the check that `npm run check` runs (test).
- [ ] C2. The current dev manifest reports no duplicates, and the check stays report-only with exit status unchanged (test).
