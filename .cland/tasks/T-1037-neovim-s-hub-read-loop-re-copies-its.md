---
id: T-1037
kind: task
title: Neovim's hub read loop re-copies its buffer on every chunk, so a multi-MB frame takes minutes and gigabytes
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
  - p1
assignee: null
parent: E-1006
blocked_by: []
topic: topic-786
branch: t/T-1037-neovim-s-hub-read-loop-re-copies-its
created: 2026-10-21T06:33:16.589Z
updated: 2026-10-21T06:40:15.349Z
---

## Summary

`Client:_data` in nvim/lua/cland/hub.lua appends every stdout chunk with `self.buffer = self.buffer .. chunk` and cuts each line with `self.buffer:sub(nl + 1)`. A frame of several megabytes arriving in 64 kB chunks is therefore copied once per chunk: quadratic time and memory. On the human's Mac at 06:26Z on 2026-10-21, the `nvim --embed` process grew from 290 MB to 8.4 GB RSS at 100 % CPU between 0:45 and 1:06 of startup (about 90 % of `sample` in `_platform_memmove`, the rest in lj_alloc/lj_str_new/gc). macOS then ran out of application memory and Neovim exited.

## What to build

The read loop keeps pending chunks in a table and joins them only when a chunk contains a newline: look for the newline in the new chunk alone, then concatenate the table once. A frame of N bytes in K chunks costs O(N) copying. Behaviour is otherwise unchanged: the same frames in the same order, blank lines skipped, malformed lines dropped.

## Acceptance criteria

- [x] C1. A 20 MB frame fed to the read loop in 64 kB chunks decodes as one frame in under 2 s, with Neovim's memory growth bounded to a small multiple of the frame size (T2 test against `Client:_data` in a headless Neovim).
  - done: impl-1037 · 2026-10-21T06:38:22.665Z
- [x] C2. Frames split at every byte position, several frames in one chunk and a trailing partial line all decode exactly as before (test).
  - done: impl-1037 · 2026-10-21T06:38:22.683Z
- [x] C3. The recorded Neovim frame fixtures and the existing Neovim T2 tests pass unchanged.
  - done: impl-1037 · 2026-10-21T06:38:22.698Z

## Comments

### impl-1037 · 2026-10-21T06:37:38.922Z

Test-first regression on macOS local working tree: original Client:_data failed with `fragmented frame allocation exceeded 8 times frame size` (early bounded abort). With chunk buffering, T2 hub-read component tests pass: 20 MiB / 64 KiB chunks decoded once in 19.8 ms, 37,887,696 allocated bytes, 46,301,184 RSS growth bytes. Every byte split (including UTF-8 / JSON escape), bytewise delivery, coalesced frames, trailing partial, blank/malformed/scalar lines covered. nvim typecheck and tier manifest pass; test lint report-only, zero refusals. Full task receipt still pending source review.

### rev-23 · 2026-10-21T06:40:15.349Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1037-source
commit: f0a2a0f6006503fa62f852e00282fc1169807021
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; audit A-8163 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8163-t-1037-source-review-at-f0a2a0f6.md). Pending fragments are retained without prefix copying, only new bytes scanned, completed lines concatenated once, constructor/reconnect representation consistent. Decode/dispatch semantics unchanged. New T2 tests check exact 20 MiB payload/count, <2 s, bounded retained Lua allocation/sampled RSS with early red abort and GC restoration, plus every split/UTF-8/escape/coalesced/partial/malformed input. Existing fixtures/tests unchanged. No findings; diff check clear. A-8161 local targeted 2/2 plus existing client 4/4/typecheck are scoped summaries, not full gate/Linux/quiet performance proof. C1–C3 remain runtime-unverified pending same-head configured mode-free receipt and affected Neovim T2. No Reviewer runtime; after-stage QA separate.
