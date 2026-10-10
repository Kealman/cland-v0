---
id: T-173
kind: task
title: "The Neovim suite takes its own lock: test:nvim never waits behind a hub suite"
state: closed
status: done
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-83
branch: t/T-173-the-neovim-suite-takes-its-own-lock-test
created: 2026-10-10T12:06:34.443Z
updated: 2026-10-10T12:28:46.160Z
---

## Parent

T-19 (follow-ups). From the stand-in's suite-queue analysis on 2026-10-10. Lock waits that morning reached 1800, 1388, 1045, 624 and 556 s, while the Neovim suite takes 2–3 min at a peak load of 5–8.

## What to build

`npm run test:nvim` takes its own lock, `/tmp/cland-suite-nvim.lock`, instead of the machine-wide suite lock. It already runs under its own TMPDIR root. Hub suites (`npm test`'s hub phase, `run-suite.ts all` and `hub`) keep the machine lock.

When `npm test` runs both phases, the hub phase takes the machine lock and the Neovim phase takes the Neovim lock. So two Neovim-only runs never overlap, and a Neovim run never waits for a hub run.

## Acceptance criteria

- [ ] `run-suite.ts nvim` acquires only the Neovim lock; `hub` and `all` acquire the machine lock for the hub phase and the Neovim lock for the Neovim phase.
- [ ] Two concurrent `test:nvim` runs serialize on the Neovim lock; a `test:nvim` run starts while a hub run holds the machine lock.
- [ ] Stale-lock recovery, the wait message and interruption behave the same for both locks; a test covers each lock.
- [ ] The Implementer and QA clauses and docs/agents notes name both locks.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. tech-debt; high payoff for the v0.1 run.

## Comments

### impl-173 · 2026-10-10T12:07:12.272Z

Implementation started. Runner currently holds one machine lock across hub and Neovim; will acquire/release per phase, keep shared ownership/recovery cleanup, cover routing and both locks, and update Implementer/QA guidance.

### impl-173 · 2026-10-10T12:13:31.627Z

Implementation complete. Typecheck passed and targeted suite-runner.test.ts passed all 26 tests, including both locks’ serialization/recovery/wait/interruption and hub/Neovim concurrency/all transition. Neovim package suite is running as one background command with an artifact and completion report. Instance roles.toml remains unchanged as requested; handover includes exact replacements for Coordinator. Full npm test deferred to later gate per Coordinator’s brief.

### rev-9 · 2026-10-10T12:17:40.451Z

verdict: review
result: not clear
by: rev-9 [reviewer]
run: rev-2026-10-10-173-1
commit: 3afab19fb609863b83bc0cb3681510cfab25c551

Medium — hub/test/run-suite.ts:220: SIGINT/SIGTERM during hub final sweep/release can be lost, allowing all to start Neovim and finish zero despite interruption. runSuite's return zero is evaluated at line 196 before awaited finally cleanup at lines 203–204; the local handler changes interrupted during cleanup, but the next runSuite receives a fresh flag. Preserve interruption across the package invocation or recheck after cleanup before advancing, with a regression for that window. Reviewer read-only memory probe of production function bodies with mocked boundaries emits SIGTERM during the first final sweep and returns phaseSpawns=2, exitCode=0, confirming the failure.

Standards: 0 findings; Spec: 1 medium. Normal phase lock routing and release-before-next-acquire are sound, so no unlocked default phase or cross-phase deadlock found. Shared stale recovery and wait behavior, clause/instance wording otherwise clear. A-596's 26 passing tests omit this window; full suite deferred separately. No edits or real suite run. Evidence A-598: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-598-t-173-review-interruption-lost-between-phases.md.

### impl-173 · 2026-10-10T12:19:34.075Z

Review found a medium cleanup-to-next-phase interruption race at 3afab19. New regressions sent real SIGINT and SIGTERM during hub final root removal and both reproduced two phase spawns. Fixed with a package-wide first-signal latch shared with each phase; phase entry, pre-lock checks and post-cleanup return checks now preserve interruption. Validating regressions and typecheck before new head.

### impl-173 · 2026-10-10T12:22:51.371Z

Fixed review finding at e0be71ad23a642241014cb8dce1061e0403103b6, pushed to origin. One first-signal latch spans package phases, is shared with runSuite’s pre-lock/active checks, and is rechecked after final cleanup so all never starts Neovim after hub cleanup interruption. All 28 runner tests and typecheck pass; evidence A-600. New SIGINT/SIGTERM regression failed before the fix with two spawns and passes with one spawn plus exit 130/143. Neovim validation is running on this source through the detached notifier; full npm test deferred per Coordinator. Instance clause replacement remains in A-597.

### rev-9 · 2026-10-10T12:24:17.714Z

verdict: review
result: clear
by: rev-9 [reviewer]
run: rev-2026-10-10-173-2
commit: e0be71ad23a642241014cb8dce1061e0403103b6

Clear: no high, medium or low findings. Standards and Spec independently clear across the full item. A-598 is resolved by the package-owned first-signal latch and post-cleanup check, shared with each phase's pre-lock/active checks. Reviewer memory probes delivering SIGINT/SIGTERM during either final sweep or lease release now produce one child, one lock acquisition, exit 130/143 for the first signal, and no remaining handlers. Normal phase acquisition, serialization, shared stale recovery and release-before-next-acquire remain sound; no unlocked default phase or cross-phase deadlock found. Clause/instance wording in A-597 remains correct. A-599/A-600 report cleanup regressions and all28 runner tests passing; typecheck reported passing. Full suite remains deferred separately. No edits or real suite run. Evidence A-601: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-601-t-173-full-item-rereview-cleanup-interruption-fixed.md.

### coord · 2026-10-10T12:24:45.064Z

Merged 0820d9727d65ad355bdec139890bc165f16decfe onto dev.
