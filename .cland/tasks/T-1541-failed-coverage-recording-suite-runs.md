---
id: T-1541
kind: task
title: Failed coverage-recording suite runs leak their raw V8 coverage directories (130 GB filled the disk)
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: topic-1348
branch: t/T-1541-failed-coverage-recording-suite-runs
created: 2026-10-31T23:04:19.659Z
updated: 2026-11-03T00:47:32.116Z
closed: 2026-11-03T00:47:32.116Z
---

## Summary

`hub/test/run-suite.ts` removes a run's raw V8 coverage directory (`<output>.raw`, set as `NODE_V8_COVERAGE`) only after a successful reduction. A failed, red or interrupted coverage-recording run returns early and leaves the directory behind. Over three weeks 59 such directories under `.cland/run/suites/<id>/coverage-map.json.raw` (2–5.7 GB each, 130 GB in all, oldest 2026-10-16) filled the Mac's disk.

Found 2026-10-31 23:00Z: the macOS release cover 69067e3d for R-1523 (A-15095) went red in T3 with `tee: … No space left on device` (642 MB free). Its 39 test failures in suite-selection and suite-runner were the disk, not the code; the Linux cover 342615fa at the same head was green. The Coordinator removed the 59 leaked directories by literal path (no suite running, none open), which freed 130 GB, and resubmitted the macOS cover as 7bb74c39.

## Acceptance criteria

- [x] C1. A coverage-recording run that fails, goes red or is interrupted removes its raw coverage directory before it exits, proven by a test that drives each of the three exits and checks the directory is gone.
  - done: impl-1541 · 2026-11-02T22:44:58.505Z
  - verified: rev-35 [reviewer] · run rev-35-1541-final-1 · 2026-11-02T23:14:12.372Z · commit 78584cc55913eca2d6b351919988c9f7a51bfaff
- [x] C2. A sweep removes raw coverage directories left by earlier runs whose suite is no longer active, at hub start or at the next suite admission, and never touches an active run's directory; a test plants both.
  - done: impl-1541 · 2026-11-02T22:45:01.046Z
  - verified: rev-35 [reviewer] · run rev-35-1541-final-1 · 2026-11-02T23:14:12.372Z · commit 78584cc55913eca2d6b351919988c9f7a51bfaff
- [x] C3. The suite log names the bytes removed when a sweep removes a leftover raw coverage directory.
  - done: impl-1541 · 2026-11-02T22:34:55.671Z
  - verified: rev-35 [reviewer] · run rev-35-1541-final-1 · 2026-11-02T23:14:12.372Z · commit 78584cc55913eca2d6b351919988c9f7a51bfaff

## Comments

### coord · 2026-11-02T22:29:33.389Z

Still live as of 2026-11-02, reported by cland-impl at 22:13Z. Four red local macOS stage covers today each left a `coverage-map.json.raw`: 67721929 (3.2 GB), 71abddc6 (867 MB), 2d036b1d (863 MB) and e253111e (863 MB), about 5.8 GB in total. Disk free went from 117 to 112 GB over 3 h, and `.cland/run/suites` holds 52 GB across 4,082 run directories. Every macOS cover of a QA stage is a coverage-recording run, so each red cover leaks 0.8–3.2 GB. The cause is unchanged: `hub/test/run-suite.ts:419–427` removes `coverageRaw` only after a successful reduction. Raising this item's priority for the next free Bugs slot. Nothing has been deleted.

### impl-1541 · 2026-11-02T22:34:01.460Z

Implementation inventory: searched CLAND_COVERAGE_OUTPUT, recordCoverage, raw coverage and suite lifecycle callers across hub/src, hub/test, nvim, docs, skills and test-support. Producers: hub/suite-worker.ts (project .cland/run/suites/<id>), executor/droplet/run.ts (executor HOME/runs/<id>); both layouts retained. Consumers: run-suite.ts cleanup/reducer, suite-close.test.ts synthetic map writer (unchanged), suite-coverage.test.ts generated outputs (migrated to suite-owned roots), new suite-runner lifecycle cases. suite-history.ts retains compact shard cleanup facts used by the sweep. No wire/selection/sharding/receipt shape changes. Next-admission sweep uses existing finished+cleaned+reported records only, never file ages; unknown/uncertain directories remain fenced. Tests are written but not run while the explicit local cover-quiet hold lasts; no live suite files touched.

### rev-35 · 2026-11-02T22:39:11.522Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1541-source-1
commit: ad0443af01fe4a24da37e229880069d2e01d18de
scope: full
findings: [{"severity":"medium","text":"Borrowed interruption skips sweep(holder) and hands detached-writer reaping to the hub, but immediately removes raw coverage anyway. cleanupOwnedProcesses(activeIdentity) and child close cover the captured runner/group, not detached writers retained by the hub. A surviving coverage writer can race removal or recreate the leaked directory. Defer deletion to the confirmed cleanup owner, or join its positive descendant-exit receipt before deleting; add a held borrowed-run detached-writer regression (rule12/C1).","file":"hub/test/run-suite.ts","line":444},{"severity":"medium","text":"A count/lstat/rm refusal from removeRawCoverage throws before machine and suite lease release at lines445–446. Even after writers/root are drained, a permission or refused-symlink cleanup error can leave leases held and replace the original run outcome. Separate raw cleanup reporting from guaranteed lease settlement once writer cleanup has succeeded, retaining ownership where writer cleanup remains unresolved; cover an injected removal failure (rule12).","file":"hub/test/run-suite.ts","line":444},{"severity":"medium","text":"Every admission rebuilds finished IDs from all retained jobs/shards, enumerates all retained suite directories and revisits already-cleaned runs; #rawSweep only deduplicates concurrent calls. No progress checkpoint or work-count/byte-budget regression exists. This adds unbounded historical I/O directly before launch in a project already holding 4,082 run directories. Make sweep work incremental/checkpointed and prove bounded repeated-admission work on copied history (rule23).","file":"hub/src/suite-raw-coverage.ts","line":47},{"severity":"low","text":"The new removal assertion turns every stat error into null, so EACCES/EIO also count as the directory being gone. Assert ENOENT specifically and propagate other errors, preserving an exact filesystem receipt (rule9).","file":"hub/test/suite-runner.test.ts","line":1286}]
finding_counts: {"high":0,"medium":3,"low":1}

T-1541 source review at ad0443af01fe4a24da37e229880069d2e01d18de. Full scope. Replaces f60050f2 request; independently confirmed only replacement delta restores unrelated crash-test line323. Branch tip matches pinned replacement. Live claimant impl-1541; C1–C3 read with body/comments. No tests, typecheck, lint or browser executed by Reviewer; local runtime files remain unexecuted under stage-cover hold. Implementer reports typecheck/lint pass at this tree; that is reported targeted/static evidence, not verified runtime coverage.

## Standards

Two medium findings and one low:
- hub/test/run-suite.ts:444: A count/lstat/rm refusal from removeRawCoverage throws before machine and suite lease release at lines445–446. Even after writers/root are drained, a permission or refused-symlink cleanup error can leave leases held and replace the original run outcome. Separate raw cleanup reporting from guaranteed lease settlement once writer cleanup has succeeded, retaining ownership where writer cleanup remains unresolved; cover an injected removal failure (rule12).
- hub/src/suite-raw-coverage.ts:47: Every admission rebuilds finished IDs from all retained jobs/shards, enumerates all retained suite directories and revisits already-cleaned runs; #rawSweep only deduplicates concurrent calls. No progress checkpoint or work-count/byte-budget regression exists. This adds unbounded historical I/O directly before launch in a project already holding 4,082 run directories. Make sweep work incremental/checkpointed and prove bounded repeated-admission work on copied history (rule23).
- hub/test/suite-runner.test.ts:1286: The new removal assertion turns every stat error into null, so EACCES/EIO also count as the directory being gone. Assert ENOENT specifically and propagate other errors, preserving an exact filesystem receipt (rule9).

Rules12/23/9 and docs/agents/tests.md lifecycle/observable receipt requirements apply. New real-child cases belong in existing T3 lifecycle file, scratch environment goes through shared fixtureEnvironment; helper tests remain T1 and use scratch files. No dependency introduced. Ordinary disposal must not skip required settlement because raw cleanup itself fails.

## Spec

One medium finding:
- hub/test/run-suite.ts:444: Borrowed interruption skips sweep(holder) and hands detached-writer reaping to the hub, but immediately removes raw coverage anyway. cleanupOwnedProcesses(activeIdentity) and child close cover the captured runner/group, not detached writers retained by the hub. A surviving coverage writer can race removal or recreate the leaked directory. Defer deletion to the confirmed cleanup owner, or join its positive descendant-exit receipt before deleting; add a held borrowed-run detached-writer regression (rule12/C1).

C1's standalone red/native failure/handled SIGTERM/reduction-failure cases exist but omit the production borrowed interruption boundary. run-suite.ts401–403 and443 deliberately preserve borrowed root ownership; suite-worker.ts109–114 likewise delegates interrupted cleanup to hub. process-cleanup.ts405–406/437–438 only seeds current runner/groups, so its close is not the delegated owner's full detached-writer receipt.

C2 helper fences deletion on finished+cleaned+reported records, retaining active/unclean/unknown cases and traversing shards; literal project/droplet layouts and symlink/traversal checks exist. Its retained-history sweep violates required bounded incremental work, with no checkpoint or budget test. C3 exact7-byte log assertion exists. These source observations do not establish runtime passes. New docs describe intended behavior, but borrowed interruption currently contradicts writer-drain wording.

Consumer inventory independently searched CLAND_COVERAGE_OUTPUT/coverageRaw/raw layout: hub/src/hub/suite-worker.ts and executor/droplet/run.ts producers; run-suite reducer; migrated suite-coverage fixtures; suite-close synthetic map producer unchanged; compact suite-history projection retains cleanup/shard facts. No wire/schema changes found.

Verdict not clear, findings ranked medium then low. Fail C1 for deletion before delegated detached cleanup, C2 for non-incremental retained-history scan (rule23); C3 runtime evidence remains unverified. Fix and fresh source review before verification; no full-suite request from Reviewer.

Totals: Standards3 (worst medium); Spec1 (worst medium).

A-15988: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15988-t-1541-source-review-writer-receipt-lease-settlement-and-sweep-bounds.md

Criteria: C1 failed (Borrowed interrupted runner removes raw coverage before the delegated hub owner confirms detached writers are gone.), C2 failed (Admission sweep rescans all retained jobs and suite directories without an incremental checkpoint or required history-work budget regression (rule23).).

### impl-1541 · 2026-11-02T22:44:06.810Z

Coordinator decision (topic-1348, dc775545-9070-49c2-b7fb-7ee8666484e9, 2026-11-02): rule 23 is satisfied here by production-scale synthetic history, because copying live hub.db is forbidden (session credentials and remote pairings). Live shape supplied by Coordinator: 4,082 run directories, five with raw directories, mostly finished and a few active. The control models that shape, bounds each admission to <=32 pending identities and checkpoint writes across restart, and asserts no retained-history reads during admission. Production no longer enumerates suite directories at admission; existing index walk populates a pending-ID queue with durable per-ID checkpoints.

### rev-35 · 2026-11-02T22:47:30.632Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1541-source-2
commit: 78584cc55913eca2d6b351919988c9f7a51bfaff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1541 corrected full source review at 78584cc55913eca2d6b351919988c9f7a51bfaff. Branch tip pinned; no dev merge since previous request. Source clear; findings[].

## Standards

No findings. All four A-15988 findings addressed:
- run-suite.ts443–451 now preserves raw coverage on a borrowed interruption; Suites removes local raw bytes only after LocalExecutor.cancel/release's existing complete-tree cleanup/recovery receipt, before marking cleaned/reporting. Root ownership and native birth fences stay with existing owners.
- Once runner writers/root are drained, raw removal refusal is explicitly logged and does not skip machine/suite lease release. If writer cleanup itself fails, the earlier ownership fence remains intact. New EACCES injection retains bytes and requires the drained lease to be absent.
- RawCoverageSweep is seeded by the existing scheduler index walk; admissions share one in-flight operation and visit at most32 pending terminal identities. Successful/absent roots receive per-ID durable checkpoints; restart skips them. No admission directory census or rebuild from all jobs remains. Refused roots rotate behind later candidates.
- All new removal assertions require ENOENT rather than swallowing arbitrary stat errors.

Read actual Coordinator decision dc775545-9070-49c2-b7fb-7ee8666484e9: production-scale synthetic history explicitly satisfies rule23 here and copying live hub.db is forbidden. The new control models4082 records/five raw directories/three active, checks32 checkpoint writes per batch, concurrent sharing, repeated admission, restart uniqueness and unchanged active bytes. This is a work-count control, not a timing measurement.

Test levels: low-level filesystem/queue decisions remain T1; actual runner/failure/cancellation/native cleanup remains in existing T3 lifecycle files. Shared sealed fixtureEnvironment used after overlays, disposable roots only. Existing test assertions retained. Matching subsystem and per-test documentation updated, no dependency or public command/wire contract change.

## Spec

No findings. C1 source covers unconditional finally cleanup for ordinary red/native failure/reduction failure/handled standalone interruption, plus delegated hub cleanup for borrowed interruption. Four runner lifecycle controls plant raw bytes and a durable readiness marker, wait runner close then assert exact ENOENT; two existing detached cancellation cases now keep a live raw writer and observe early runner deletion, final descendant death, raw ENOENT, and next-run admission. The removal-refusal test checks log, retained bytes and released lease after close.

C2 uses only finished+cleaned+reported identities/shards as authority. Active/unclean/unknown records remain fenced; literal project and droplet account layouts retained; traversal/symlink roots refused. Incremental queue/checkpoint and restart control replace the earlier retained-history scan. C3 preserves exact removed-byte log emitted into admitting job.log; nested7-byte assertion checks the full line.

Consumer search: local suite-worker and remote droplet producers, reducer, suite-coverage fixture outputs, suite-close synthetic map writer, compact suite-history cleanup/shard facts. New durable raw-coverage-swept:<id> metadata has one owner; no existing reader schema altered. Read LocalExecutor release/cancel and suite-worker delegation to check the positive cleanup boundary rather than trusting comments alone.

C1–C3 runtime-dependent criteria remain unverified until fresh exact-head queued evidence. No runtime files have executed in this review; no run/platform/browser receipt claimed. Implementer reports macOS Node24.21 typecheck pass and earlier-tree lint exit0/report-only122findings59files before final fairness edit; these are reported static checks, not a queued suite pass. Reviewer ran no tests/typecheck/lint/browser, made no edits, and respected cover-quiet. Source clear permits mode-free verification at this exact head; final review must include named cleanup/sweep/refusal/borrowed cancellation outcomes and deferred phase disclosure.

Totals: Standards0; Spec0.

A-15990: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15990-t-1541-corrected-source-review-at-78584cc55.md

### rev-35 · 2026-11-02T23:14:12.372Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1541-final-1
commit: 78584cc55913eca2d6b351919988c9f7a51bfaff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1541 final evidence review at 78584cc55913eca2d6b351919988c9f7a51bfaff. Scope evidence. Branch tip and hub receipt match unchanged source-clear rev-35-1541-source-2 / A-15990. Standards: no findings. Spec: no findings. C1–C3 verified.

Independently streamed A-15992 suite timing outcomes, separately from exit status:
C1 / hub/test/suite-runner.test.ts:
- coverage red exit removes raw bytes before runner close — pass, line25999.
- coverage failed exit removes raw bytes before runner close — pass, line26004.
- coverage interrupted exit removes raw bytes before runner close — pass, line26009.
- coverage reduction-failed exit removes raw bytes before runner close — pass, line26014.
- raw coverage removal refusal still releases drained execution leases — pass, line26019.
Both hub/test/suite-cancel.test.ts controls pass: verify cancel reaps a detached fake child that recreates the root after runner death, then admits the next run (line25680); verify cancel reaps a detached fake child before removing the phase root, then admits the next run (line25706). Source-inspected assertions retain the raw writer's positive readiness, early-removal observer, final descendant death/raw ENOENT and next-run admission; borrowed ownership stays with hub until release.

C2/C3 / hub/test/suite-coverage-selection.test.ts:
- raw coverage admission sweep removes only finished cleaned records and logs bytes — pass, line6388; source assertion keeps active/unclean/unknown raw bytes and exact7-byte log.
- raw coverage removal refuses traversal, foreign output and symlinked roots — pass, line6393.
- raw coverage removal retains the droplet account run layout — pass, line6399.
- raw sweep checkpoints a 4082-run history and bounds repeated admission work — pass, line6412; concurrent batch,32-ID checkpoint budget,restart uniqueness and active bytes retained. Coordinator dc775545 authorizes this production-scale synthetic control; no live database copied.

Actual file outcomes: coverage-selection13, suite-runner57, suite-cancel8, suite-coverage4 all pass. Preservation includes both Web-only append=0/1 map/exit-code cases, reused-PID owner timing and real-process/truncated-JSON package capture. Source contract/directory confinement/lease and checkpoint findings all resolved at this head.

Queued acb974bc-c8f7-4df7-81ef-a1677bc06810 / A-15992: exit0,4907 pass,zero fail/cancel/skip/todo. T0/T1/fallback allT2/Web plus selected changed T3 three files69 identities once complete; remaining T3 deferred to merge batch,T4 unexecuted. Selected T3 added119.268s excludes machine wait; this is not full-suite wall time. Budget/lint/ratchet and skip-reason checks report-only; suggested allowance stanzas are diagnostics, not committed/enforced allowances or additional execution.

Provenance: head above, runner tree bfc0ec468ea4f29a4cd1f98f2464a1bb8bda5680; uncached c-8 sfo2 Linux x64 6.8.0-142-generic droplet, Node v24.21.0, Neovim v0.12.5. Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Cache/occasion null,skips[],skipReasonCheck report/missing0. T0 host check, no separate remote typecheck claim. Executor1392s/$0.0966 are billing, not suite wall time. Local macOS runtime files remain unrun/held; Linux evidence is not a macOS run. No per-item QA required. Reviewer ran no tests/browser, made no edits.

A-15994: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15994-t-1541-final-cleanup-and-bounded-sweep-evidence-at-78584cc55.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-03T00:47:32.116Z

Merged 5a0ce0799989e556f967ef72fbdad090c1c8d42b onto dev.
