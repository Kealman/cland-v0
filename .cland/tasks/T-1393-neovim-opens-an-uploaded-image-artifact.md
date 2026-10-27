---
id: T-1393
kind: task
title: Neovim opens an uploaded image artifact in the system viewer
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1382
topic: null
branch: null
created: 2026-10-27T23:37:29.021Z
updated: 2026-10-27T23:37:38.771Z
---

## Summary

An image artifact made by `artifact.upload`, a PNG and a JPEG whose upload name lacked an extension, opens through the system viewer's command from Neovim's artifact list. The test fakes that command.

## What to build

A headless-Neovim test uploads the two images through the hub's frame, opens each from the artifacts view, and checks the faked `CLAND_OPENER` received each artifact's path. If the test exposes a gap (for example an extension from the MIME rule that `browser_ext` lacks), fix it in `artifacts.lua`. Every other type keeps opening as today. Spec §3.6 and §3.11.

## Acceptance criteria

- [ ] C1. In headless Neovim, opening an uploaded PNG and an uploaded JPEG runs the faked system viewer once each with the artifact's `.png` and `.jpg` path, while a note artifact still opens in a buffer (test).

## Notes

Shared files: nvim/lua/cland/artifacts.lua, nvim/test/artifacts.test.ts
