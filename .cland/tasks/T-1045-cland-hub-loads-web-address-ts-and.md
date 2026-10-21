---
id: T-1045
kind: task
title: cland hub loads web-address.ts and exceeds its CLI import budget (19 > 18)
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
regression_of: T-988
topic: topic-797
branch: t/T-1045-cland-hub-loads-web-address-ts-and
created: 2026-10-21T11:33:00.376Z
updated: 2026-10-21T11:36:18.736Z
---

## Summary

The periodic dev T3 run c2965396 at b970270a (A-8338) failed `hub/test/cli-imports.test.ts` "CLI commands load only their own source closure within the import budgets": "loaded 19 modules (budget 18)". T-988 (ff0f6c7f) added `import { addressHost } from '../web-address.ts'` at the top of hub/src/cli/hub.ts, so every `cland hub` command now loads it.

## What to build

`cland hub` loads `web-address.ts` only on the path that needs it, using a lazy import in the web/status branch, or by moving `addressHost` behind the existing lazy boundary. The import budget stays at 18; do not raise it.

## Acceptance criteria

- [x] C1. `hub/test/cli-imports.test.ts` passes with the budget unchanged in a targeted T3 run at the task head (local evidence); the next periodic dev T3 confirms it after landing.
  - done: impl-1045 · 2026-10-21T11:34:26.452Z
- [x] C2. `cland hub status` still shows the web edge address as before (existing tests pass).
  - done: impl-1045 · 2026-10-21T11:34:26.467Z

## Comments

### impl-1045 · 2026-10-21T11:34:26.418Z

Reproduced the exact import-budget failure locally on macOS in a disposable cwd with fixtureEnvironment sealing HOME/XDG/Git/accounts: "loaded 19 modules (budget 18)". Changed describe() to await web-address.ts only when formatting web details; JSON/no-hub paths avoid it. Targeted cli-imports.test.ts + hub-status-component.test.ts: 11/11 pass, hub status loads 18 modules; hub typecheck passes. Budget/test files unchanged. Periodic dev T3 evidence remains deferred to the next integrated occasion.

### rev-23 · 2026-10-21T11:36:05.192Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1045-source
commit: 2843448aaa4397630e64252df10eee11cdac39c4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards0 / Spec0 findings. A-8342 audits single-file change from a880785f. addressHost now imports only inside async describe when web details exist; sole text-output caller awaits it. JSON/no-hub branches avoid helper; web formatting and fallback/error behavior unchanged. Existing import budget18 and tests unchanged. A-8340 targeted local macOS/Node24 reports original19>18 red, corrected18 and11/11 T3 import/T2 status plus typecheck; supporting, not queued evidence. C1/C2 remain unverified: C1 explicitly also requires next periodic dev T3, so its receipt or Coordinator disposition is pending; C2 awaits exact-head run. Normal mode-free configured verify may proceed at unchanged head. No Reviewer runtime.
