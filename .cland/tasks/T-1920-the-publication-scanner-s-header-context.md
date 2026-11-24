---
id: T-1920
kind: task
title: The publication scanner's header-context rule misses short Authorization values in header entry-pair lists and in object property keys
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: topic-1729
branch: t/T-1920-the-publication-scanner-s-header-context
created: 2026-11-16T16:36:57.494Z
updated: 2026-11-24T09:03:22.319Z
---

## Summary

The third source review of T-1665 (2026-11-16 16:36Z, at 3c550eb37) found two complete representations where `assertPublishable`'s header-context rule accepts a short Authorization value. One is headers as entry-pair lists (the name and a short scheme value as separate array entries); the other is a short credential used as an Authorization object's property key. Both were reproduced in parsed and serialized form. The context-free token-shaped rule (Bearer followed by at least 16 token characters) still refuses token-shaped values in these forms, so only short values are affected.

## Acceptance criteria

- [ ] C1. `assertPublishable` refuses a short synthetic Authorization value in a header entry-pair list and as an Authorization object's property key, in both parsed and complete serialized forms, while T-1665's prose and title negative controls still pass (test, red before the fix).
