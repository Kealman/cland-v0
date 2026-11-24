---
id: T-2089
kind: task
title: cland config set infers argument types from renderConfig(defaultConfig) rather than configKeys' explicit exemplar, so a commented-out default (test_timeout after T-2057) changes how its value argv is decoded
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by:
  - T-2057
topic: null
branch: null
created: 2026-11-24T14:03:57.276Z
updated: 2026-11-24T14:04:26.754Z
---

## Summary

Found by T-2057's reviewer and reported by impl-2057 (head 7497df996). runConfig at hub/src/cli/config.ts:13 infers each key's argument type from the rendered default config, not from configKeys' explicit type exemplar. T-2057 comments out the default test_timeout, so that key now starts TOML-decoding its value argv: a literal value with embedded quotes is decoded as TOML. Normal values such as 120s and 17s still work through the string fallback. The reviewer rated this low impact and non-blocking.

## What to build

Make config set take every key's type from one shared vocabulary (configKeys' exemplar), independent of whether the rendered config writes the key.

## Acceptance criteria

- [ ] C1. Setting test_timeout with a literal duration argv that contains embedded quotes decodes the same way as before T-2057, and the key's type comes from the shared exemplar (test, red before).
