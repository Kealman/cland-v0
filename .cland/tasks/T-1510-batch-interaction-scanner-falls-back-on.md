---
id: T-1510
kind: task
title: Batch interaction scanner falls back on every web test through web-readiness createRequire
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: null
branch: null
created: 2026-10-31T10:40:20.317Z
updated: 2026-10-31T14:43:36.318Z
---

## Summary

The batch interaction scanner still falls back for every web test through `hub/src/web-readiness.ts`, reporting "incomplete import graph: unsupported createRequire base". That file calls `createRequire(pathToFileURL(join(root, 'web/package.json')))` (T-1458). T-1492 fixed the createRequire fallbacks it found then, but not this computed package.json base. While batch interaction runs in report mode this only widens the report. T-1488's switch to run mode would add every web test to each hub batch.

## Evidence

Batch f2031b15 (suite 5484e36d, A-14877, 2026-10-31 10:39Z, T-1508) lists all `web/test/*.test.ts` files with that fallback. Other fallbacks in the same batch: mod-bridge (non-literal specifier), plan-approval (vm loader), sqlite-contention (indirect loader), suite-accounting (indirect require), task-worktrees (createRequire base), and nvim plan-component (unresolved `yaml`).

## Acceptance criteria

- [ ] C1. The scanner resolves a `createRequire` whose base is a static `join(root, '<literal path>')` file URL, or web-readiness gets a literal-resolvable form, so the web tests no longer fall back because of `hub/src/web-readiness.ts`. A scanner unit test covers the shape.
- [ ] C2. The item lists each remaining fallback from A-14877 with its reason, and fixes it or records why it stays, so T-1488's evidence starts from a known baseline.
