---
id: T-738
kind: task
title: "executor-run real-worker proof: the 'host gate … (not repeated)' reuse marker is intermittently absent from a passing run's log"
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-445
branch: t/T-738-executor-run-real-worker-proof-the-host
created: 2026-10-17T14:48:29.088Z
updated: 2026-10-17T15:49:54.124Z
---

## Summary

impl-700 saw it once on the Mac while migrating executor-run (T-700, 2026-10-17): the real-worker host-receipt scenario passed remotely, but its log lacked the expected `typecheck: host gate at <tree> (not repeated)` line. It passed 5/5 alone, 8/8 with the preceding delivery cases, and 5/5 as consecutive whole files. The original failed receipt is retained on T-700. The proof comes from T-680. The root cause is unknown: either the marker is written after the log is read, or the host-gate reuse is sometimes skipped.

## What to build

Find out which. If the reuse is sometimes skipped, that's a product bug in the host gate, so fix it there. If the log is read before the marker is flushed, wait for the run's completion receipt before reading. Use T-700's new hash/marker diagnostics.

## Acceptance criteria

- [x] C1. The cause is named with evidence, and the case passes 20/20 whole-file runs on the Mac plus the task's droplet verify.
  - done: impl-738 · 2026-10-17T15:49:36.203Z
  - verified: rev-31 [reviewer] · run rev-20261017-738-final · 2026-10-17T15:49:53.521Z · commit f0834ccde45d63772edd24583358499d46d72641

## Comments

### coord · 2026-10-17T14:57:08.927Z

Cause found by impl-700 (A-4556), independent of T-700's diff: when the first RemoteRun.start receipt is pending and the start succeeds on retry, Suites.#launch appends another local "Workers … admitted" header without moving remoteLogStart, so #collectLog counts those local bytes as already-collected remote output and skips a remote prefix (the host-gate marker in this case; potentially any early remote lines). Deterministic T1 replay fails in ~68 ms on dev. Product bug in remote log collection, not only a test flake.

### impl-738 · 2026-10-17T14:58:14.925Z

Red reproduced before product fix: node --test hub/test/suite-remote-log.test.ts fails in 68 ms on the current dev product (26f6ad11), missing the host-gate receipt prefix. A-4556 replay landed at the authorized T1 Suites/RemoteRun seam. Guarding the admission header with remoteLogStart === undefined makes the same replay green; it now asserts the full remote suffix and a single admission header. Auditing remaining #launch retry paths and running required repetitions next.

### impl-738 · 2026-10-17T15:17:22.322Z

Source review requested at pushed f0834ccde45d63772edd24583358499d46d72641 after pre-review origin/dev merge (includes shared durations refresh b16ad496). Reviewer routing resolved to rev-31. Evidence A-4560 (cause/red-green/audit) and A-4574 (raw checks + first 10 Mac whole files). executor-run whole-file 10/10 green, 101.458–118.584s/file, no skips, prelaunch load 3.50–5.56. Post-merge typecheck/tiers and touched T1 file 5/5 (0.401–0.441s) pass. Runs 11–20 are continuing; C1 remains pending exact-head droplet verify and 20/20 Mac evidence. No QA policy scope or QA criteria.

### rev-31 · 2026-10-17T15:18:07.270Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-738-source
commit: f0834ccde45d63772edd24583358499d46d72641
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 / Spec 0 findings, A-4577. Cause reproduced: repeated local admission header after remoteLogStart inflates local-size-minus-boundary remote cursor, dropping prefix including host-gate marker. Guard suppresses only that launch retry writer after boundary creation; pre-boundary header/defaults retained. Audited host-gate/cache writers before boundary, delivery/start retained boundary, per-child shard logs, pre-boundary fallback and post-collection summaries. T1 regression scripts first start pending then second accepted, observes completion and asserts full remote suffix plus one header; no process/socket/wall wait. A-4574 red/green independently checked; post-merge T1 5/5 green and ten executor-run whole files each 21/21, zero skips/failures/late diagnostics. Origin/whitespace exact. C1 remains pending all twenty Mac files plus exact-head diff-selected droplet; ten files are partial evidence only. No Reviewer edits/tests/delegation.

### impl-738 · 2026-10-17T15:35:34.748Z

Mac validation complete: executor-run.test.ts whole file 20/20 serial green, 21 passing tests per file, no failures or skips. Durations 101.458–119.586s (median 109.882s), prelaunch load 2.99–7.03 <15. Complete raw receipts and summary: A-4592, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4592-t-738-complete-mac-proof-20-20-executor-run-whole-files/. T1 initial and post-merge 5/5 green; typecheck/tiers green. Source clear at unchanged f0834ccde45d63772edd24583358499d46d72641 (rev-20261017-738-source, A-4577). Exact-head droplet 0cc313d8-5883-421b-855f-74e269e2c158 is running; C1 remains pending its green result and will be marked done before final verdict. Going idle for the hub result, retaining claim.

### rev-31 · 2026-10-17T15:49:53.521Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-738-final
commit: f0834ccde45d63772edd24583358499d46d72641
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards 0 / Spec 0 findings, A-4597. Independently audited A-4592 all twenty Mac executor-run whole-file logs, each 21/21, zero failures/skips/late diagnostics. Exact-head A-4595 / 0cc313d8 final exit 0: 2102 tests / 2097 passes / 0 failures / 5 prerequisite skips, including 12/12 Neovim smoke. Regression ordinary 0.105153053 s and 5/5 load; all twelve top-level executor-run identities execute, real delivered-worker host-gate receipt case passes at 16.036273702 s with preserved assertions. Source A-4577 and red/green cause evidence remain current; unchanged origin tip. C1 verified. Hub-only plus smoke, not full Neovim; unknown lifetime/cost not invented. No exception/additional run/per-item QA needed. No Reviewer edits/tests.

Criteria: C1 verified.
