---
id: T-1045
kind: task
title: cland hub loads web-address.ts and exceeds its CLI import budget (19 > 18)
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
regression_of: T-988
topic: null
branch: t/T-1045-cland-hub-loads-web-address-ts-and
created: 2026-10-21T11:33:00.376Z
updated: 2026-10-21T11:33:06.541Z
---

## Summary

The periodic dev T3 run c2965396 at b970270a (A-8338) failed `hub/test/cli-imports.test.ts` "CLI commands load only their own source closure within the import budgets": "loaded 19 modules (budget 18)". T-988 (ff0f6c7f) added `import { addressHost } from '../web-address.ts'` at the top of hub/src/cli/hub.ts, so every `cland hub` command now loads it.

## What to build

`cland hub` loads `web-address.ts` only on the path that needs it, using a lazy import in the web/status branch, or by moving `addressHost` behind the existing lazy boundary. The import budget stays at 18; do not raise it.

## Acceptance criteria

- [ ] C1. `hub/test/cli-imports.test.ts` passes at dev with the budget unchanged (T3, targeted run plus the next periodic dev T3).
- [ ] C2. `cland hub status` still shows the web edge address as before (existing tests pass).
