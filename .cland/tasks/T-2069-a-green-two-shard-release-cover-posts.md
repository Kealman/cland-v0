---
id: T-2069
kind: task
title: "Finished release-occasion covers are never reported: #reportSuite throws on every retry, so `cland release` finds no green T3 and the hub spins rewriting suite logs"
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
  - release-blocker
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1720
branch: t/T-2069-a-green-two-shard-release-cover-posts
created: 2026-11-24T05:43:40.612Z
updated: 2026-11-24T10:04:38.188Z
closed: 2026-11-24T10:02:08.721Z
---

## Summary

Two green release covers at dev 4cbdba6a7, tree bbc13c73, finished on 2026-11-24 but were never reported. c4e171e7 (Linux, 2 droplet shards) finished at 05:34:31Z; 68c47db0 (macOS local) at about 05:48:41Z. Both show `result.json` code 0, every tier exit 0, and their artifacts were created: A-22746 to A-22749 and A-22750/A-22751. `#reportSuite` throws after the artifacts are made. `#inspectJob` stores the error only in `job.error`, logs nothing, and retries on every tick. So `releaseT3Cover`, which needs `job.reported`, finds no cover, and `cland release --item R-1880 --dry-run` refuses with `release-t3`. Each retry rewrites the full suite.log (11 to 12 MB) via appendSuiteProvenance and re-parses the 34 MB coverage map, which holds hub #100 at 100 to 140% CPU. This blocks the 0.4.1 release.

## Findings so far (cland-impl, from hub.log and source; hub.db not read)

- hub.log shows the collection and artifact creation for both runs: c4e171e7 at 05:34:34.8 to 05:34:37.7Z (registerCoverageMap ran, coverage-pointer-expired) and 68c47db0 at 05:48:41 to 05:48:43Z. After that it shows nothing for either id: no suite-result, audit, slow-request, rate-limit, loop-breaker or hygiene line.
- Every other run that completed on hub #100 was reported. That includes coord's stage cover 28f66e86 (droplet, 02:31Z), its epic cover df2f5ff1 (local, 02:39Z) and batch 384ee466 (03:51Z). No other run completed between 03:51Z and these two.
- The only hub code change since #99 is T-2061 (6b54424ad), and it isn't release-specific. Suspect data these runs carry: occasion `release`, submitted by the Coordinator through MCP `verify` with `fresh: true`, a session caller, so the result goes out through `sendFromSession(..., requireAllRecipients=true)`.
- Candidate throws after the coverage step in `#reportSuite` (dispatch.ts about 1180 to 1270): "suite log artifact unavailable", "result recipients unavailable; delivery remains pending" (core.ts about 3602), a HygieneError (mute or size), "suite result had no deliverable recipient". reportSharedDefects and reportSoakQuarantine also run first.

## What to build

1. Reproduce: a finished integrated `release`-occasion job submitted by a session caller, the same way as above, through the hub's report path with the fake executor. Find the throw, and fix its cause so the result posts once and `job.reported` is set.
2. Make the failure visible: log a `suite-report-failed` event with the id and error in `#inspectJob`'s catch, and show "report failed: <error>" in the heartbeat row instead of only "ended without a posted result".
3. Make the retry cheap: back off retries, and don't rewrite the full log or re-parse the coverage map on every retry (finalize provenance once).
4. After the fix is live (hub restart, rule 19), the two existing finished-unreported jobs must report, or be safely abandoned with a recorded reason, so that release covers count.

## Acceptance criteria

- [x] C1. A finished green `release`-occasion run submitted by a session caller posts one suite-result message, sets `reported`, and is found by `releaseT3Cover` for its tree (test).
  - done: impl-2069 · 2026-11-24T07:34:01.764Z
  - verified: rev-35 [reviewer] · run rev-35-2069-evidence-1 · 2026-11-24T09:07:17.644Z · commit 277437db32c30253cc1a02fb98c797c3f65ec9e7
- [x] C2. When `#reportSuite` throws, the hub logs one `suite-report-failed` event with the run id and error, and the heartbeat row shows the error text (test).
  - done: impl-2069 · 2026-11-24T07:34:01.930Z
  - verified: rev-35 [reviewer] · run rev-35-2069-evidence-1 · 2026-11-24T09:07:17.645Z · commit 277437db32c30253cc1a02fb98c797c3f65ec9e7
- [x] C3. Repeated report failures back off, and do not rewrite suite.log or re-read the coverage map on every inspection tick (test counting rewrites).
  - done: impl-2069 · 2026-11-24T07:34:02.092Z
  - verified: rev-35 [reviewer] · run rev-35-2069-evidence-1 · 2026-11-24T09:07:17.645Z · commit 277437db32c30253cc1a02fb98c797c3f65ec9e7

## Comments

### coord · 2026-11-24T06:43:00.316Z

Second case, same morning. Coord's macOS release cover 68c47db0-0c71-4418-a4aa-d8b09a239134 (occasion release, executor local, darwin arm64, head 4cbdba6a7, tree bbc13c73) finished green. `result.json` shows code 0, every tier T0–Web exited 0, there are no failures, and the artifacts exist (A-22750 log, A-22751 coverage map). No suite-result message was posted; the 06:42Z heartbeat shows it as "ended without a posted result". Both missing posts are occasion `release`, one droplet and one local, while that day's stage, epic, batch, dev-t3 and soak runs all posted. So the likely cause is the release occasion's result path, not sharding.

### impl-2069 · 2026-11-24T07:06:19.800Z

Consumer inventory: role resolution is called by noticeTo (hub sender), sendFromHuman (human sender), and sendFromSession (preflight plus delivery). sendFromSession production callers are dispatch suite report (only requireAllRecipients=true), artifact/report path, shell send, spoke send, and ask forwarding/answers via core callbacks. Ordinary callers retain false. Contracts searched across hub/src, hub/test including all tiers, nvim/test, web, shared, docs, QA and shipped skills for resolveAddressees/sendFromSession/requireAllRecipients, suite reported/error, appendSuiteProvenance and parseCoverageMap. No wire shape changes. Optional persisted SuiteJob provenanceFinalized/reportAttempts/reportRetryAt are backward compatible; old jobs finalize on next retry. Readers: Suites recovery/status/receipt/retention/cache/cover, dispatch hub.status and result, heartbeat, releaseT3Cover, verification/merge selection, CLI/web/nvim suite projections, test fixtures. Existing fields unchanged. Red reproduction: release T2 asserted 0 !== 1 result messages; same fixture green after required-recipient sole-role self delivery. Diagnostic red: no suite-report-failed events and heartbeat omitted 'report failed: recipient unavailable'. Subsequent T1/T2 tests pass on darwin arm64 Node v24.21.0; full verify/T3 not yet run.

### rev-35 · 2026-11-24T07:19:10.540Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2069-source-1
commit: 575cbe3741863e3006da4e6b8b3d760b9c74b562
scope: full
findings: [{"severity":"medium","text":"M1: the two new component callbacks directly acquire fixtures/guards and Store handles without encompassing pre-acquisition callback ownership or separate setup bounds; the direct Store constructors lack captured-handle failure ownership. The new suiteCase coordinator callback also lacks caller-level positive-close-gated guard restoration. Enroll these exact test paths with constructor-rejection and cleanup-failure controls; normal greens do not establish their teardown contract.","file":"hub/test/suite-human-component.test.ts","line":22},{"severity":"medium","text":"M2: provenanceFinalized retries call publish outside appendSuiteProvenance's shared-path serialization. The boolean proves an earlier finalization, not current ownership of legacy shared pathname bytes; another job can finalize the same path before/during retry, and evidence/publication may then use that other run's bytes. Preserve run-bound finalized evidence and shared-path serialization, with a concurrent/restart regression beyond the current unique-path test.","file":"hub/src/hub/suites.ts","line":2194},{"severity":"medium","text":"M3: any finished unreported job.error is presented as 'report failed', although generic error also records collection, accounting and provenance failures. provenanceFinalized persists across retries and cannot identify the producing failure phase. Record actual report-attempt failure metadata at the report boundary; keep generic/legacy errors unclassified and cover a pre-report failure.","file":"hub/src/hub/heartbeat.ts","line":57}]
finding_counts: {"high":0,"medium":3,"low":0}

A-22754 consolidates three medium findings. M1 new T2 callbacks and extra Store handles lack complete acquisition/constructor ownership; new T1 suiteCase callback lacks positive-close-gated restoration. M2 provenanceFinalized retry publishes outside shared-path serialization; prior boolean is not current ownership of legacy pathname/evidence. M3 heartbeat/log phase inference from generic error/finalized flag misclassifies pre-report failures; use actual report-attempt outcome metadata and controls. Lead0f43c728/9fc206ae confirm gaps. Required-result sole-role self delivery, ordinary-send exclusion and bounded retry/checkpoint design are retained positives. C1/C2/C3 failed/unverified. A-22753 local checks/earlier partial run retain their scope; no mode-free or live recovery proof. Read-only source/tracker/history/artifact inspection, no tests/edits or live runtime database/files/restart. Hold releases for consolidated correction/fresh review; no verify at this head, dev merge/full task suite requested.

Criteria: C1 failed (New release/restart regressions lack complete callback/setup ownership, captured Store-constructor rejection and success-only cleanup/guard fencing.), C2 failed (Generic job.error is misclassified as report failure without an actual report-attempt receipt; pre-report and earlier-retry failures are not distinguished.), C3 failed (Finalized retries bypass legacy shared-path publication serialization and lack current run-bound byte ownership; the unique-path control does not cover it.).

### impl-2069 · 2026-11-24T07:28:20.406Z

Consolidated source1 correction inventory: optional finalizedLog receipt now binds run/head/tree/source plus deterministic run-owned path; immutable snapshot is checkpointed under the existing shared-source publication lock and report retries enter that same lock. Evidence-path readers prefer artifact, then validated snapshot, then legacy log. Optional reportFailure {error,attemptedAt,secondary} originates only in the actual #report catch; generic inspection errors remain unclassified, later failures retain the primary as a secondary diagnostic, successful report clears it before ancillary cleanup. Existing suiteHistoryProjection keeps these additive fields, while legacy jobs without receipts follow original finalization. New fixture patch option is opt-in; ordinary suiteUnit callers retain current mocks, new report cases use manual patches gated on positive closure. Search consumers unchanged from earlier item inventory; new reportCase wraps the shared retention owner with whole-callback and per-operation bounds. M2 red control: after another run replaced a shared legacy log, first retry observed 'second evidence' and cccc head instead of first evidence. New snapshot path makes that restart case green with exactly two total source rewrites/two snapshots for two runs, none on retry. Focused T1/T2/ownership/log cases: 31 passed on darwin arm64 local Node v24.21.0. Final affected T1 rerun in progress; no configured verify/T3/Web or live recovery performed.

### rev-35 · 2026-11-24T07:39:22.319Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2069-source-2
commit: 277437db32c30253cc1a02fb98c797c3f65ec9e7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22756 records consolidated source clear; M1–M3 resolved. reportCase retains complete setup/body/resource/root/seam ownership with pre-constructor DB capture and actual removal/refused-release/repair controls; optional fixture patch seams preserve other callers. Finalized logs now have run/head/tree/source/path-bound immutable copies and shared-source publication serialization on creation/retry; two-job legacy/restart control asserts correct separate bytes and two replacements/two snapshots only. First inspection per hub normalizes before shortcut. Actual #report rejection owns reportFailure/event/backoff; generic history/pre-report errors remain unclassified or secondary, successful report clears old failure before cleanup. Sole-role required-result fix/ordinary exclusion and docs retained. Coordinator maps constructor+close masking to existingT1995; not claimed fixed here. A-22755 local842T1/17controls/218separatefile passes/typecheck+lint0 are producer reports, not configured/live recovery proof. C1–C3 remain unverified pending same-head result. Read-only review/no execution; hold releases for mode-free verify after Coordinator grant. Coordinator retains live restart/recovery/fullT3; no source/dev merge/full task suite requested.

### rev-35 · 2026-11-24T09:07:17.645Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2069-evidence-1
commit: 277437db32c30253cc1a02fb98c797c3f65ec9e7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-22778 consolidates source2/A-22756 and completed27f04e26/A-22762. All8 new exact release/once-only cover, retry/backoff, shared legacy/restart snapshot, producer-phase and constructor/cancelled-close controls pass base+5 distinct loaded executions; heartbeat generic/structured failure case also passes. C1/C2/C3 verified. All243T1/fallback445T2/55Web plus243selectedT3 and mappedT4inbox guard pass;30T3 deferred,17T4 unexecuted. Matched producer progress:9428basepasses/12prerequisite skips,40loadedpasses/5loadedskips; all starts paired, no failure/cancel/todo;3knownF2finish-only entries separate. Linuxc8nyc1 Node24.21/Nvim0.12.5 Headless1248/CfT156.0.8078.4; timing/ratchet/lint report-only. Gitcfd6560a differs from verification6c5d1488;cache null unknown. No findings or reviewer execution. This proves test-hub paths, not production restart or recovery ofc4e171e7/68c47db0; Coordinator retains those post-landing outcomes/fullT3. No extra run/source change/manual relay requested.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-24T10:02:08.721Z

Merged 2514c3d9ae4e13e765a0365dbb561f4147ab7e56 onto dev.

### coord · 2026-11-24T10:04:38.188Z

Live proof after landing, on hub #101 (pid 64841, started on 2514c3d9a at about 10:04Z). The stuck release cover 68c47db0, finished on 2026-11-24 at 05:48Z and unreported for over 4 h on hub #100, posted its suite-result to coord at 10:04:29Z: all exit 0, 9,675 tests, 0 fail, log A-22750. That's the self-addressed role send delivering after the fix. The other stuck run, c4e171e7, is being watched for its post.
