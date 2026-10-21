---
id: T-1037
kind: task
title: Neovim's hub read loop re-copies its buffer on every chunk, so a multi-MB frame takes minutes and gigabytes
state: open
status: in progress
size: S
labels:
  - ready-for-agent
  - bug
  - p1
assignee: null
parent: E-1006
blocked_by: []
topic: null
branch: t/T-1037-neovim-s-hub-read-loop-re-copies-its
created: 2026-10-21T06:33:16.589Z
updated: 2026-10-21T06:33:32.234Z
---

## Summary

`Client:_data` in nvim/lua/cland/hub.lua appends every stdout chunk with `self.buffer = self.buffer .. chunk` and cuts each line with `self.buffer:sub(nl + 1)`. A frame of several megabytes arriving in 64 kB chunks is therefore copied once per chunk: quadratic time and memory. On the human's Mac at 06:26Z on 2026-10-21, the `nvim --embed` process grew from 290 MB to 8.4 GB RSS at 100 % CPU between 0:45 and 1:06 of startup (about 90 % of `sample` in `_platform_memmove`, the rest in lj_alloc/lj_str_new/gc). macOS then ran out of application memory and Neovim exited.

## What to build

The read loop keeps pending chunks in a table and joins them only when a chunk contains a newline: look for the newline in the new chunk alone, then concatenate the table once. A frame of N bytes in K chunks costs O(N) copying. Behaviour is otherwise unchanged: the same frames in the same order, blank lines skipped, malformed lines dropped.

## Acceptance criteria

- [ ] C1. A 20 MB frame fed to the read loop in 64 kB chunks decodes as one frame in under 2 s, with Neovim's memory growth bounded to a small multiple of the frame size (T2 test against `Client:_data` in a headless Neovim).
- [ ] C2. Frames split at every byte position, several frames in one chunk and a trailing partial line all decode exactly as before (test).
- [ ] C3. The recorded Neovim frame fixtures and the existing Neovim T2 tests pass unchanged.
