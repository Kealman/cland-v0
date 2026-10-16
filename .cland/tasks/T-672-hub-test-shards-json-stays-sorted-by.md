---
id: T-672
kind: task
title: hub/test/shards.json stays sorted by path, so new test files stop conflicting at merge
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-16T17:38:06.779Z
updated: 2026-10-16T17:38:06.779Z
---

## Summary

Every new test file adds its line at the top of `"tests"` in hub/test/shards.json, so any two branches that add a file conflict at merge. That cost T-628 and T-633 a re-merge, a delta review and a second droplet verify each on 2026-10-16. Keeping the map sorted by path, and enforcing that in the shard lint, puts most new lines in different places so they merge cleanly.

## What to build

hub/test/shards.json is rewritten once with its `"tests"` entries sorted by path. `npm run test:shards` fails when the entries aren't sorted and names the first out-of-order path. Any tool that writes the file, such as a shard or durations refresh, writes it sorted. docs/agents/tests.md tells authors to add a new file's line in its sorted position.

## Acceptance criteria

- [ ] C1. hub/test/shards.json is sorted by path, and the shard lint fails on an unsorted map, naming the first out-of-order path, proved by a lint test.
- [ ] C2. Every tool that writes shards.json keeps it sorted, proved by a test that writes a new entry, and docs/agents/tests.md says where a new line goes.
