---
id: T-1581
kind: task
title: init-config test pins this repository's merge batch tiers to T1 after the T1–T3 change
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: t/T-1581-init-config-test-pins-this-repository-s
created: 2026-11-01T09:12:24.790Z
updated: 2026-11-01T09:12:30.915Z
---

## Summary

Coordinator's config commit e818d2dc (human decision 2026-11-01 09:01Z, ask 31d43750) set this repository's `merge.batch_tiers` to `["T1", "T2", "T3"]`, but `hub/test/init-config.test.ts` still pins the repository value to `['T1']` at line 177. Dev has been red on that T1 test since e818d2dc, and it dropped T-1549's batch fc38a65a (A-15268: actual `['T1','T2','T3']`, expected `['T1']`). Fix forward within the rule-6 hour.

## Acceptance criteria

- [ ] C1. `hub/test/init-config.test.ts` › "this repository enables the merge batch queue while new projects keep it off" expects the repository's `merge.batchTiers` to be `['T1', 'T2', 'T3']`, and the new-project default assertions stay unchanged (test).
- [ ] C2. The file passes alone at the head, and a search of hub/test and nvim/test for other assertions on this repository's `batch_tiers` / `batchTiers` finds no other stale pin, or updates it.
