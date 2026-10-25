---
id: T-1250
kind: task
title: The changed-T3 duration check says 'no stanza' and then prints allowance stanzas
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - bug
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1064
branch: t/T-1250-the-changed-t3-duration-check-says-no
created: 2026-10-24T14:13:21.952Z
updated: 2026-10-25T18:41:52.298Z
closed: 2026-10-25T18:41:52.298Z
---

## Summary

In T-1204's verify a3d82680 (A-11169, lines 14992–14993), the changed-T3 duration check line ends with "no stanza", and the next line prints a duration allowance stanza for `item-summary-lua.test.ts`. That suite printed three stanzas in all. The summary contradicts the output right after it. impl-1204 found this aside. The run's exit is not affected.

## Acceptance criteria

- [x] C1. The duration-check summary states the number of allowance stanzas it prints (or none only when it prints none), consistently with the stanza lines that follow (test).
  - done: impl-1250 · 2026-10-25T18:19:31.950Z
  - verified: rev-31 [reviewer] · run rev-20261025-1250-final · 2026-10-25T18:36:10.910Z · commit 8beb2cff7ceebaf289c64e2bd908de2b07c58ac5

## Comments

### impl-1250 · 2026-10-25T18:17:08.350Z

Clean inherited worktree. C1 seam: pure task duration report over planted TestTiming receipts (T1), plus existing runner contract regression. Consumer inventory before the diagnostic text change (rule 20): hub/test/run-suite.ts producer; hub/src/hub/suites.ts suiteSummary retains duration check/stanza prefix lines; hub/src/suite-log.ts evidence retention uses those prefixes; hub/test/durations-runner.test.ts asserts the old 'no stanza' phrase and retained JSON; hub/test/suite-duration-budget.test.ts and hub/test/durations-refresh.test.ts consume allowance generation; hub/test/durations.ts tooling shares generation, unchanged; docs/agents/tests.md and hub/README.md describe reporting, implement skill links that procedure. Repository-wide search including nvim/web/shared, shipped skills, QA, startup/persisted readers and all test tiers found no other text parsers. Preserve both existing prefixes and JSON allowance map shape so old consumers remain compatible. Only human-readable summary wording changes; no wire/schema/admission change.

### impl-1250 · 2026-10-25T18:19:14.962Z

C1 implementation complete. TDD red: new T1 task duration summary assertion failed against extracted original report with actual ending 'T4 has no tier budget; no stanza' (expected '; 1 allowance stanza$'). Green: hub/test/suite-duration-budget.test.ts 12/12; mixed T3/T4 and empty/multiple-entry/ownerless cases cover printed JSON object count. Existing hub/test/durations-runner.test.ts 16/16, including public runner output and suiteSummary retention. Both targeted files ran serially on local macOS, Node v24.21.0; no browser. npm run typecheck passed across hub, nvim, shared/wire and web after fixing exact optional owner typing. No full verification yet. Updated matching hub README, agent docs, file-specific guidance and implement skill/CHANGES; no command/help, role permission or policy change. Fetched origin/dev and merged before first source review: already up to date at 2bb29ff8. No new process test or >=3-second new test introduced.

### rev-31 · 2026-10-25T18:21:05.068Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1250-source1
commit: 8beb2cff7ceebaf289c64e2bd908de2b07c58ac5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source CLEAR; Standards0/Spec0. A-12092 covers all10 files against fixed base2bb29ff8/treec1d09802cb6fb559ffcad8ca83a274dedc76db36. Report derives count from built JSON output lines, preserving generator/map shape, prefixes, ownerless/non-Linux diagnostics, timing/phase semantics and report-only policy. Multi-entry JSON counts one line; zero-output and mixed T3/T4 cases covered at pure T1. Existing native T3 once-only/retained-JSON/unchanged-manifest assertions retained; no new process/wait/allowance. Consumer inventory independently checked across clients/all tiers/QA/skills; suiteSummary and suite-log regex remain compatible. Shared/per-file docs, README and skill CHANGES match. C1 done but runtime unverified: A-12091 is local macOS implementation-tree summary (12/12+16/16/typecheck), no configured/Linux evidence or standalone raw capture claimed. Preserve original outputs/native timings/source/capture limits without reruns for transcription. Submit one ordinary mode-free configured verify at unchanged8beb2cff, then final evidence with named cases/phases/provenance/load receipts. No all/forced mode, extra local repeats or dev merge requested. Reviewer read-only.

### rev-31 · 2026-10-25T18:36:10.910Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1250-final
commit: 8beb2cff7ceebaf289c64e2bd908de2b07c58ac5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence CLEAR; C1 verified. A-12097 carries source A-12092 and independent original A-12095 typed-record/output audit at unchanged treec1d09802cb6fb559ffcad8ca83a274dedc76db36. Same-head mode-free e1316b5a exit0:3258ordinary passes plus10additional load finishes(two new T1 identities5/5 each), nofail/cancel/skip/TODO. New base cases .011638994/.000844260s; public T3 runner case .948684105s. Actual lines16458–16459 say1allowance stanza then exactlyone JSON map; recommendation not manifest mutation. T0/allT1/fallbackallhub+NeovimT2/changedT3onefile16casesonce/Web completed; remainingT3deferred/noT4/all claim. Selected addedwall38.399s excludesmachinewait. Linuxc-8lon1 Node24.21/Nvim0.12.5/HeadlessShell156v1248 forWeb, lifetime739s/$0.0513 separatefromwall. HostgateTREE8fdb40dc reused remotely. Lint133/60/sixbudgetwarnings/Web149.47>40s/ratchet2232.554same report-only, no enforcement claim. Local A-12091 summary/capture limits retained; no further local rerun needed. QA none; Coordinator owns enqueue/separate pre-merge checks. Reviewer read-only.

Criteria: C1 verified.

### coord · 2026-10-25T18:41:52.298Z

Merged c14a7eba44674914ebd0eb21b49bcc5613f5524b onto dev.
