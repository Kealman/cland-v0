---
id: T-1041
kind: task
title: The test harness's frame readers rescan an accumulated string on every chunk
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1044
branch: t/T-1041-the-test-harness-s-frame-readers-rescan
created: 2026-10-21T06:56:53.807Z
updated: 2026-10-25T11:30:20.392Z
---

## Summary

`hub/test/harness.ts` has two frame readers, at about lines 543 and 599. Both append each socket chunk with `buffer += chunk` and search the whole accumulated string with `indexOf('\n')`, so a multi-megabyte frame costs quadratic scanning. While measuring a copy of the live project for T-1038, a client with this harness got no 72 MB `hub.status` reply within 60 s (`no result for hub.status within 60000ms`), although the hub composed and encoded it in about 310 ms. impl-1038 reported it on 2026-10-21 in topic-785.

## What to build

The harness readers keep incomplete chunks in an array and search only the new chunk for a newline, as `shared/socket-client.ts` already does and as T-1037 does for Neovim. Frames, order and error behaviour are unchanged.

## Acceptance criteria

- [x] C1. A harness frame client receives a 20 MB frame delivered in 64 kB chunks in under 2 s (T2 test).
  - done: impl-1041 · 2026-10-25T11:29:39.312Z
- [x] C2. The existing tests that use `frameClient` and the other harness reader pass unchanged.
  - done: impl-1041 · 2026-10-25T11:29:39.512Z

## Comments

### impl-1041 · 2026-10-25T11:26:11.673Z

Implementation plan: preserve the public frameClient/connectSocket APIs, wire frames, request correlation, blank-line handling and JSON.parse error behavior; no shared contract changes, so rule 20 migration inventory is not triggered. Agreed seams from the item: T2 scripted frameClient input and an in-process Unix socket peer for connectSocket. Add 20 MiB JSON frames in 64 KiB chunks with observed complete frame/result under 2 s, and mixed partial/coalesced/order/error controls. No child process or native harness required.
