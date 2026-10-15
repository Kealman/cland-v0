---
id: T-531
kind: task
title: "suite-close test: integrated remote close counts 24 coverage-map scp calls, not 2 (Linux)"
state: open
status: in progress
size: S
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
regression_of: T-394
topic: topic-326
branch: t/T-531-suite-close-test-integrated-remote-close
created: 2026-10-15T20:54:23.323Z
updated: 2026-10-15T20:55:36.080Z
---

## Summary
In E-387 stage-close run 7d5ac27f (shard 1, droplet cland-v0-2df7755a, c-8 lon1, peak 1m load 10.8; log A-3341), `hub/test/suite-close.test.ts:12`, 'integrated remote close collects each map before release and publishes their function union', failed at :33. Its assertions on the result, the artifact and the union passed. It found 24 `scp` lines naming `coverage-map.json` in `machine-calls.jsonl` where it expects 2. Either the collection retries or polls scp under load (each try is logged), or the fake machine's call log is shared with a concurrent case. The count assertion is T-394's; T-517 is a different suite-close flake (:82, active lease).

## Acceptance criteria
- [ ] C1. Find which it is and record it in a comment. If collection retries by design, the test counts successful collections per shard, or distinct shard paths, rather than raw scp lines. If the retries are unintended, the hub copies each map once, as a product fix. Every other assertion stays.
- [ ] C2. The file passes 5/5 targeted runs, on Linux (droplet verify) or under Mac load.
