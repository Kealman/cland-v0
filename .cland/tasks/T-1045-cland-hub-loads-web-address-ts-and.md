---
id: T-1045
kind: task
title: cland hub loads web-address.ts and exceeds its CLI import budget (19 > 18)
state: closed
status: done
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
updated: 2026-10-21T11:50:22.590Z
closed: 2026-10-21T11:50:22.590Z
---

## Summary

The periodic dev T3 run c2965396 at b970270a (A-8338) failed `hub/test/cli-imports.test.ts` "CLI commands load only their own source closure within the import budgets": "loaded 19 modules (budget 18)". T-988 (ff0f6c7f) added `import { addressHost } from '../web-address.ts'` at the top of hub/src/cli/hub.ts, so every `cland hub` command now loads it.

## What to build

`cland hub` loads `web-address.ts` only on the path that needs it, using a lazy import in the web/status branch, or by moving `addressHost` behind the existing lazy boundary. The import budget stays at 18; do not raise it.

## Acceptance criteria

- [x] C1. `hub/test/cli-imports.test.ts` passes with the budget unchanged in a targeted T3 run at the task head (local evidence); the next periodic dev T3 confirms it after landing.
  - done: impl-1045 · 2026-10-21T11:34:26.452Z
  - verified: rev-23 [reviewer] · run rev-20261021-1045-final · 2026-10-21T11:45:23.682Z · commit 2843448aaa4397630e64252df10eee11cdac39c4
- [x] C2. `cland hub status` still shows the web edge address as before (existing tests pass).
  - done: impl-1045 · 2026-10-21T11:34:26.467Z
  - verified: rev-23 [reviewer] · run rev-20261021-1045-final · 2026-10-21T11:45:23.682Z · commit 2843448aaa4397630e64252df10eee11cdac39c4

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

### rev-23 · 2026-10-21T11:45:23.682Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1045-final
commit: 2843448aaa4397630e64252df10eee11cdac39c4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; no findings. A-8359 audits A-8358/run13de30a4 at unchanged2843448a: configured Linux x64 c-8 lon1 T1/all-T2 both packages exit0,2272 ordinary test passes/348 files. C2 available/unavailable web details assertion line6018 and all8 status tests pass. No new load repetitions claimed. Revised C1/Coordinator5a858055 explicitly accepts A-8340 task-head local macOS/Node24 targeted T3 import evidence18<=18 (combined targeted11/11); next periodic dev T3 remains post-landing confirmation, not completed. Host30529178 not repeated remotely; lint132/59,durations/ratchet report-only,six missing baselines. Web NOT RUN/T-993 accepted by Coordinator bf3e2f9f for no web/ change; no browser/T3/T4/stage/QA/Reviewer execution claim. Lifetime442s, reportedcost$0.0307. All C1/C2 verified.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-21T11:50:22.590Z

Merged 5dac578865f88fa61f252939939fe8a80e9bfc2f onto dev.
