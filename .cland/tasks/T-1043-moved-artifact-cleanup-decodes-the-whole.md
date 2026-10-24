---
id: T-1043
kind: task
title: Moved-artifact cleanup decodes the whole artifact index once per folder
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: null
branch: null
created: 2026-10-21T10:08:37.378Z
updated: 2026-10-24T06:46:27.643Z
---

## Summary

impl-1039's CPU profile of a hub on a copy of the live project (8,163 artifacts) on 2026-10-21 put 2.544 s into artifact JSON decoding and 1.612 s into the artifact index lookup. The time comes from the moved-artifact cleanup, which re-reads and decodes the complete artifact index for every folder it visits. It is mostly post-serving work, so it does not delay the first reply, but it burns CPU after every hub start. Reported in topic-788 (T-1039).

## What to build

The cleanup takes one snapshot of the artifact index per pass, or queries moved artifacts through an indexed lookup, instead of decoding the whole index for each folder. Durable deletion receipts and the cleanup's existing behaviour stay unchanged.

## Acceptance criteria

- [ ] C1. On a generated store of 8,000 artifacts in 200 folders, one cleanup pass decodes the artifact index at most once (a test counts decodes).
- [ ] C2. The existing moved-artifact cleanup tests pass unchanged, including durable deletion receipts.
