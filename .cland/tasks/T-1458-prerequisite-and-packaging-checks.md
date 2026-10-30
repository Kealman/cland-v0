---
id: T-1458
kind: task
title: "Prerequisite and packaging checks: install-shaped CLI smoke, site/ import boundary, current web/dist"
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1476
topic: topic-1236
branch: t/T-1458-prerequisite-and-packaging-checks
created: 2026-10-30T05:44:57.647Z
updated: 2026-10-30T11:52:21.036Z
---

## Summary

Add an install-shaped smoke run of every CLI command's runtime imports, an import-boundary guard so site/ tests use only site/ dependencies, and a refusal to start Web probes or verifies without a current web/dist and a resolvable node_modules. Sources: T-1303 (T-1225 shipped `cland qa lint` broken for installs), T-1368, T-1423, T-1096, T-1031. Rule batch 4 C6 (A-14151).

## Acceptance criteria

- [ ] C1. Each of the three guards fails on a planted defect and passes on dev.

## Comments

### impl-1458 · 2026-10-30T11:52:21.036Z

Rule 20 inventory before edits: webPrerequisite consumers are web/test/harness.ts and readme.test.ts; hub/test/run-suite.ts (all verify modes), synthetic prerequisite producers suite-runner.test.ts and suite-coverage.test.ts; qa briefs E-414, E-415-stage-3, E-416-stage-1/stage-2/stage-3, E-417-stage-1, E-417/E-418/E-419/E-420/E-1314. webPhaseAvailable readers/tests: suite-cache.test.ts, web-phase.test.ts. Existing bundle state consumers: doctor/web.ts, release-web.ts, web-build.ts (runner and web-auth.test.ts). Wire/persisted unavailable receipts in web-phase.ts stay unchanged; no new refusal/skip in report rollout, no consumer migration required. New shared checker is called at both runner and standalone probe boundaries; synthetic producers remain compatible. CLI guard will derive all runtime CLI entry modules rather than maintain a command allowlist. Site graph check allows dependency-free repository declarations but refuses packages not declared by site/package.json.
