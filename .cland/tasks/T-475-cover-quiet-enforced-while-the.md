---
id: T-475
kind: task
title: "Cover-quiet enforced: while the Coordinator's integrated cover holds the slot, the test harness refuses to start a fixture hub"
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-579
blocked_by: []
topic: topic-401
branch: t/T-475-cover-quiet-enforced-while-the
created: 2026-10-15T09:13:18.684Z
updated: 2026-10-16T23:28:52.298Z
closed: 2026-10-16T21:49:17.030Z
---

## Summary

Retrospective A-2783, STOP 1: all 7 flaky red covers had other sessions' test runs beside them. The cover-quiet rule (2026-10-15) is an agreement. Make it a refusal: a test process outside the cover itself does not start while an integrated cover runs.

## What to build

`hub/test/harness.ts` and `nvim/test`'s runner ask the project's hub (`suite.slot` read-only) at start. When the local holder is an integrated run, the process exits with a `cover-quiet` message naming the run, unless it is that run's own worker (an inherited lease) or `CLAND_TEST_IGNORE_COVER=1` is set by the human. Without a hub, there is no refusal.

## Acceptance criteria

- [x] C1. A targeted test started while an integrated cover holds the local slot exits with `cover-quiet` before starting any fixture.
  - done: impl-475 · 2026-10-16T20:57:53.935Z
  - verified: rev-30 [reviewer] · run rev-20261016-475-final · 2026-10-16T20:58:34.879Z · commit a35e9d32e89eeef49e34d2ab7f0fe6536189c7d3
  - verified: rev-30 [reviewer] · run rev-20261016-475-dispatch-final · 2026-10-16T21:46:26.147Z · commit f9c6975ae32c4f22b003e2fbd59703d1433a176e
- [x] C2. The cover's own workers and runs without a project hub are unaffected.
  - done: impl-475 · 2026-10-16T20:57:54.155Z
  - verified: rev-30 [reviewer] · run rev-20261016-475-final · 2026-10-16T20:58:34.879Z · commit a35e9d32e89eeef49e34d2ab7f0fe6536189c7d3
  - verified: rev-30 [reviewer] · run rev-20261016-475-dispatch-final · 2026-10-16T21:46:26.147Z · commit f9c6975ae32c4f22b003e2fbd59703d1433a176e
- [x] C3. docs/agents/tests.md and the Implementer clause describe the refusal and the human's override.
  - verified: rev-30 [reviewer] · run rev-20261016-475-owned-correction · 2026-10-16T18:02:08.189Z · commit b1570e640ffd8b2f3da1564114962d248976c788
  - verified: rev-30 [reviewer] · run rev-20261016-475-shared-duration · 2026-10-16T18:12:49.135Z · commit de96a65002699613407c62d3237a8c7ee7f71fb1
  - verified: rev-30 [reviewer] · run rev-20261016-475-dev-integration · 2026-10-16T18:39:58.556Z · commit 6ba8ce3b3e1c183f866dbbeda403e9853c8a03ba
  - verified: rev-30 [reviewer] · run rev-20261016-475-shared-dev-merge · 2026-10-16T19:07:22.802Z · commit 75390e8348e11d330ebc9d1dda15a5d80c3eb42c
  - verified: rev-30 [reviewer] · run rev-20261016-475-watchdog-header-delta · 2026-10-16T20:08:52.284Z · commit a35e9d32e89eeef49e34d2ab7f0fe6536189c7d3
  - done: impl-475 · 2026-10-16T20:57:54.354Z
  - verified: rev-30 [reviewer] · run rev-20261016-475-final · 2026-10-16T20:58:34.879Z · commit a35e9d32e89eeef49e34d2ab7f0fe6536189c7d3
  - verified: rev-30 [reviewer] · run rev-20261016-475-dispatch-merge · 2026-10-16T21:01:14.294Z · commit f9c6975ae32c4f22b003e2fbd59703d1433a176e
  - verified: rev-30 [reviewer] · run rev-20261016-475-dispatch-final · 2026-10-16T21:46:26.147Z · commit f9c6975ae32c4f22b003e2fbd59703d1433a176e

## Comments

### impl-475 · 2026-10-16T17:13:16.426Z

Implementation seams follow C1/C2: real suite.slot read-only socket admission and fresh targeted hub/Neovim harness subprocess startup (before fixture creation). Inherited worker identity will be checked against the live compatibility lease. Holding local test execution while Coordinator confirms census-575 quiet-window status.

### impl-475 · 2026-10-16T17:19:41.782Z

Source review requested from Reviewer at pushed 8b8505c3ecd518f3ddc037df78779ab9c771fec8 (supersedes 14aa7a6b; fixture receipts now under ignored .cland/). npm run typecheck exit 0 and diff check exit 0. Local targeted execution remains held by Coordinator census quiet decision; review allowed during that window. Evidence artifact A-4051 describes scope and hold.

### rev-30 · 2026-10-16T17:20:02.362Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-475-source
commit: 8b8505c3ecd518f3ddc037df78779ab9c771fec8
scope: full
findings: [{"severity":"medium","text":"M1: New ./cover-quiet.ts harness dependency is absent from suite-coverage.test.ts's copied helper list, so its copied real harness cannot import before daemon/CLI/spoke coverage proof. Update the source closure and validate the whole affected file, preserving assertions.","file":"hub/test/harness.ts","line":6},{"severity":"medium","text":"M2: Request timeout or socket close before answer silently admits targeted tests. A busy live hub can hold an integrated cover while taking over 3 s, allowing fixture startup during that cover. Keep no-hub behavior but refuse unknown connected-hub admission and add a delayed-response regression, or obtain explicit Coordinator policy disposition.","file":"hub/src/test-admission.ts","line":21}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-475 source review — not clear

Head 8b8505c3ecd518f3ddc037df78779ab9c771fec8; fixed point 5bd54127e8d2f2b4b938a9c1fa16d63c93f9d58f. Replacement request 16e8289f was inspected before posting a verdict. The delta from 14aa7a6b only tightens the check flag, moves worker receipts under ignored .cland/ and relocates a comment; neither finding is changed. A-4054 is the preliminary review note at the superseded head, not a recorded verdict. Both Standards and Spec axes reviewed in-session because this Reviewer role prohibits delegation.

## Standards
Medium M1 — hub/test/harness.ts:6 and hub/test/account-fixture-env.ts:3 introduce a required runtime import of ./cover-quiet.ts, but hub/test/suite-coverage.test.ts:45 copies a closed helper list containing harness.ts and account-fixture-env.ts without cover-quiet.ts. Its real fixture imports the copied harness and therefore fails module resolution before its daemon/CLI/spoke coverage assertions can run. hub/src is already copied, so add the new test helper to that fixture's source closure (or remove the missing dependency another way), retain all existing coverage assertions, and include the affected whole file in validation. This is established by the pinned source graph, not a Reviewer-executed reproduction.

No other Standards findings. The read-only check uses the existing authenticated frame path and compatibility-holder seam, adds no slot reservation, and normal actor-owned human slot refusal remains. Inherited pid/start/token are compared with the live holder; integrated metadata survives package borrowing. Protocol/config duration changes are narrow. The new tests retain completion receipt before downstream report wait. The original diff whitespace check passes; the replacement delta has no whitespace concern.

## Spec
Medium M2 — hub/src/test-admission.ts:21 treats a three-second request timeout or socket close before an answer as successful admission. A live project hub can be busy while an integrated cover owns the machine slot; in that case these catches let the targeted process continue into fixture setup without checking the cover. This defeats C1 under the load the task is intended to protect. The specified no-hub exception supports absent/refused connections, not positive admission on an unanswered live hub. Keep standalone/no-hub behavior, but make unknown admission after a connected hub times out/ends fail visibly rather than silently pass; add a delayed/non-answering live-socket regression that verifies fixture setup stays unstarted. If fail-open on a live hub is deliberate policy, obtain the Coordinator's explicit spec disposition before clearance.

Otherwise the design covers the requested behavior: read-only suite.slot check is available to session CLI callers, scheduler consults integrated local holder metadata rather than remote slots, exact inherited worker lease exempts the cover's own workers, and ordinary local holders do not refuse targeted tests. Hub/account fixture initialization shares a top-level awaited guard; Neovim imports that harness. The package runSuite entry checks before runner-root creation. The human-only override is an explicit environment convention documented in tests.md and the shipped Implementer clause (C3 source text reviewed).

## Validation / criteria
The request reports exact-head root typecheck exit 0. Targeted tests have deliberately not run during the Coordinator's census quiet window, per decision 0d34b6b6; no missing-test failure or request to break that hold is inferred. C1 fails for M2 and C2 fails for M1's copied-harness integration break. C3 has the requested source text but is not separately marked on this not-clear pass. New corrected-head source review and the held whole-file proof are required before task verification. No per-item QA criteria.

Standards: 1 medium. Spec: 1 medium.
Review artifact A-4055.

Criteria: C1 failed (Connected-hub timeout/close is treated as admission, so a busy integrated cover can be bypassed. A-4055 M2.), C2 failed (Copied-source coverage fixture lacks the newly imported cover-quiet.ts helper, breaking harness startup. A-4055 M1.).

### rev-30 · 2026-10-16T17:22:51.722Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-correction
commit: 8d39a241e8c7c144eafa211b52d71c09e0650c15
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-475 corrected source review

Clear at 8d39a241e8c7c144eafa211b52d71c09e0650c15, delta from reviewed 8b8505c3; first review fixed point remains 5bd54127e8d2f2b4b938a9c1fa16d63c93f9d58f. Origin task tip matches. Both axes reviewed in-session under the role's no-delegation constraint.

## Standards
No findings. M1 resolved: suite-coverage.test.ts now copies cover-quiet.ts with its existing helper closure; hub/src is already copied, covering test-admission.ts and its runtime imports. The fixture still runs actual production CLI/daemon/spoke source and preserves every coverage/malformed-receipt assertion. No unrelated production changes or shared picks.

The new socket regressions use private scratch roots and a real listening socket; the child must fail before its target statement or account fixture creation. Client timeout closes its socket, and server closure is registered for test cleanup. Missing-discovery and stale-discovery/absent-socket remain accepted. Read-only git diff --check passes. No Reviewer test execution.

## Spec
No findings. M2 resolved: only absent/refused connections and explicitly unsupported/no-project responses bypass standalone admission; connected timeout and premature socket close now propagate, preserving the cover fence when admission is unknown. Two fresh-harness subprocess cases cover an unanswered connected socket and a socket closed after suite.slot, requiring nonzero exit, the specific error, no target statement and an empty fixture temp root. Documentation and the shipped Implementer clause distinguish absent hub from an unanswered connected hub.

The earlier review's pid/start/token comparison, integrated-holder metadata borrowing, independent remote/local behavior, pre-fixture import ordering and human override convention remain applicable. C3 established by source: tests.md and Implementer clause describe cover-quiet, waiting, own-worker inheritance, no-hub behavior and human-only CLAND_TEST_IGNORE_COVER=1.

## Validation and outstanding boundary
The request reports exact-head root typecheck exit 0 and diff check exit 0. Targeted runtime proof is not claimed: after census all-clear, the existing pre-feature live hub explicitly refused suite.slot as human-only to impl-475 before fixtures. The Implementer stopped and escalated under rule 5. This source verdict does not override that refusal or authorize another identity, override, route or equivalent run. Await the Coordinator's authorized capability disposition before dependent runtime work.

C1/C2 remain unverified pending whole-file cover-quiet and suite-coverage proof plus normal exact-head verification. Their earlier failed marks need claimant done restoration when supported by accepted evidence. No task-suite submission is directed while the explicit refusal remains unresolved. No per-item QA criteria.

Standards 0 findings; Spec 0 findings.
Review artifact A-4061.

Criteria: C3 verified.

### rev-30 · 2026-10-16T17:24:34.251Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-capability-delta
commit: de7d1927ee8ed91fc648b857d585628cb81f1fcb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-475 capability-message delta source clear at de7d1927ee8ed91fc648b857d585628cb81f1fcb, compared with source-clear 8d39a241. Standards and Spec axes: no findings.

Inspected primary Coordinator decision 54b041c5-4d00-43ee-a896-5b1a1f1771d1 in topic-401: no live-hub permission change, no local retry; corrected source review then exact-head droplet verification in its normal no-live-hub environment. Actual local proof waits for merge/restart and a Coordinator-owned targeted run, with those marks unverified until its receipt.

The new source recognizes the exact forbidden: suite.slot prefix independently observed in A-4057, plus the explicitly unsupported request response. It throws immediately on receiving either with the exact required prefix:
"test admission unavailable: the project hub lacks the read-only suite.slot/check capability; restart the hub with T-475 before running tests."
The original refusal follows; it is not swallowed or converted into standalone success. Absence/refused connection still supports no-hub operation; connected silence/close still fails.

Two real-socket/fresh-harness subprocess variants now return legacy refusal and unsupported check responses, require nonzero startup with capability/restart text, no target execution and empty fixture roots. Their runtime proof is pending; no local retry is claimed. Docs include the missing capability and authorized-restart action. Previous copied-helper closure and timeout corrections remain intact. Exact-head root typecheck exit 0 is claimant-reported; independent diff whitespace check passes.

C3 source proof refreshed. C1/C2 stay unverified, including the deferred local-live-hub portion explicitly retained by the Coordinator. Source clearance allows only the specified normal exact-head droplet verification now; it does not authorize a local workaround or final local marks. No per-item QA criteria.
Review artifact A-4066.

Criteria: C3 verified.

### impl-475 · 2026-10-16T17:24:56.427Z

Source review clear at de7d1927 (A-4066 / rev-20261016-475-capability-delta). Submitted exact-head normal droplet verify f676f713-8d0f-4868-b789-1e7102f62d08 with no mode, topic-401, Reviewer + claimant recipients; worker pending, queue position 1. Following Coordinator disposition 54b041c5: no local retry after pre-feature hub refusal A-4057. Coordinator owns post-merge/restart local targeted receipt; C1/C2 local-live-hub evidence stays unverified until that receipt. Claim retained; waiting for hub result.

### rev-30 · 2026-10-16T17:58:37.003Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-475-droplet-red
commit: de7d1927ee8ed91fc648b857d585628cb81f1fcb
scope: evidence
findings: [{"severity":"medium","text":"M1: Owned integrated-worker regression times out waiting for its report and fails ordinary +0/5 repetitions. Inspect nested worker result/log; separate actual durable worker completion from bounded downstream report delivery while retaining cover assertions.","file":"hub/test/cover-quiet.test.ts","line":153},{"severity":"medium","text":"M2: Added default Implementer clause produces a 7800-byte reply, exceeding the existing 7680-byte reply budget/headroom assertion. Shorten wording without weakening C3 or the budget test.","file":"hub/src/roles/default-roles.ts","line":151}]
finding_counts: {"high":0,"medium":2,"low":0}

T-475 final evidence not clear at reviewed de7d1927ee8ed91fc648b857d585628cb81f1fcb. Independently inspected complete A-4092 / f676f713-8d0f-4868-b789-1e7102f62d08: Linux c-8, 1986 tests, 1977 pass, four failures, five prerequisite skips, exit 1. Full-mode Neovim was not reached. Suite 1804.22 s, peak load 19.77, lifetime 1885 s, $0.1309.

Medium M1 — hub/test/cover-quiet.test.ts:153: owned integrated-worker regression fails ordinarily at "integrated cover report: not within 15000 ms" and fails 0/5 load repetitions. Earlier assertions reach the post-program marker, but that marker is written inside cover.mjs before npm/suite-worker cleanup and durable result publication. Inspect the nested worker's suite log/result state to determine why completion is not reported; retain the cover/own-worker assertions and use an exact durable worker-completion observation before a separately bounded downstream report wait. Do not merely label this unknown owned failure as a load flake or spend an unchanged retry.

Medium M2 — hub/src/roles/default-roles.ts:151: the added Implementer clause makes the shipped-default reply 7800 bytes, exceeding the existing 8192 minus 512 headroom assertion (7680). roles.test.ts:88 fails on the default Implementer clause (A-4092:4594–4606). Shorten the added wording while preserving C3 and the existing role meaning/headroom; do not increase the cap or weaken its assertion. This is a consequence of the owned clause edit, despite the test file being outside the diff.

Positive evidence: other eleven cover-quiet identities pass ordinarily and all 5/5 repetitions (55/55). This includes targeted hub/Neovim refusal, package pre-root refusal, inherited/override admission, standalone/ordinary-holder admission, silent/closed/legacy/unsupported connection checks and borrowed integrated metadata. The copied-source coverage fixture passes, so the original missing-helper finding is resolved.

Remaining outside-diff failures for lead/Coordinator classification:
- Claude schedule actual 2 versus 1, claude-code-adapter.test.ts:353, matching the T-585 signature now under separate correction.
- request-guard.test.ts:279, item-launch 200+200ms case gets two resumed slow-request rows (403 ms and 849 ms), expected one. Report as S Bugs candidate unless already tracked; no causal diagnosis from this receipt.
- Two new external hard-budget lines at full tail: T-603 pinned-profile 7.603 s and inherited-profile 5.916 s without allowances on this held head. No other hard budget lines.

C1/C2 remain failed/unverified because owned integration proof is red, and C3 source verification is invalidated pending clause-budget correction. Coordinator 54b041c5 still owns local proof after merge/restart; no bypass of the explicit live-hub refusal is authorized. Corrected-head source review is required before another droplet task run. No per-item QA criteria.
Review artifact A-4093.

Criteria: C1 failed (Owned integrated worker report times out ordinarily and 0/5 repetitions; final gate incomplete. A-4093 M1.), C2 failed (Owned integrated worker end-to-end admission/completion proof red; inspect nested durable result. A-4093 M1.), C3 failed (Default Implementer clause reply grows to 7800 bytes, violating existing 7680-byte reply/headroom limit. A-4093 M2.).

### rev-30 · 2026-10-16T18:02:08.189Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-owned-correction
commit: b1570e640ffd8b2f3da1564114962d248976c788
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-475 owned-correction source clear at b1570e640ffd8b2f3da1564114962d248976c788, delta from de7d1927. Standards and Spec axes: no findings.

M1 source correction established: the tiny fixture no longer copies real run-suite.ts. suites.ts:320 enables integrated V8 map publication only when that file advertises reduceCoverage; the tiny cover.mjs does not emit a map. Removing the false capability leaves the existing suite-worker no-runner borrowability path enabled, so the integrated lease and own-targeted-harness proof remain. All original refusal, inheritance, post-cover admission and report assertions stay. After body completion, the regression now observes durable suite result.json and asserts code 0 before starting a separate bounded report wait. This removes the fictitious map dependency and makes worker failure diagnostic rather than an unexplained downstream timeout. Corrected execution is still pending; no reproduced post-fix pass is claimed.

M2 source correction established: the new Implementer instruction is reduced to waiting on cover-quiet, the human-only override and docs/agents/tests.md#cover-quiet. Only obsolete targeted-tests-are-free wording is removed from the neighboring instruction. The complete admission, inheritance, missing/old-hub behavior and restart action move unchanged under the named docs section. C3 meaning is retained and budget assertions are untouched. A-4096 reports pure full-clause measurement including staffing at 7454 bytes against 7680 (226 margin), meeting the Coordinator's 150-byte-margin direction; not a claimed whole roles test pass.

Primary Coordinator b5117ec1 was read in topic history and approves the owned correction, with item-launch timing left as its single-receipt load flake. Primary 0787662f requires a later dev merge and budget recheck after T-536 lands. The request also holds new verification for the Coordinator-posted T-585 shared fix; no pick, future merge or gate exception is inferred beyond those explicit directions.

Request/A-4096 report root typecheck exit 0; independent diff whitespace check passes. No local runtime retry occurred after the live hub's refusal. Coordinator's 54b041c5 staged local-live-hub proof after merge/restart remains outstanding.

C3 source refreshed; C1/C2 runtime marks remain unverified. Source correction clear does not clear A-4092's red gate. Do not spend a verify at this intermediate head: after posted shared integration/final budget check, request review of the resulting exact head before the authorized droplet run. No per-item QA criteria.
Review artifact A-4097.

Criteria: C3 verified.

### impl-475 · 2026-10-16T18:02:21.495Z

First droplet f676f713 red analyzed in A-4096. Owned corrections committed/pushed b1570e64, source-clear A-4097 / rev-20261016-475-owned-correction. Typecheck exit0. Full clause reply including staffing =7454 bytes,226 below7680. Tiny fixture no longer falsely opts into coverage; durable result/code0 precedes report wait. Holding next verify for Coordinator-posted T-585 shared fix and requested T-536/dev integration+budget recheck; resulting head gets source review before remote verify. No local refusal bypass; local-live-hub proof remains Coordinator-owned post-restart.

### rev-30 · 2026-10-16T18:12:49.135Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-shared-duration
commit: de96a65002699613407c62d3237a8c7ee7f71fb1
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-475 shared-duration delta source clear at de96a65002699613407c62d3237a8c7ee7f71fb1, direct child of reviewed b1570e640ffd8b2f3da1564114962d248976c788. Standards and Spec axes: no findings.

Independently read primary Coordinator cc249229-f019-40fb-be83-e680fa90f2eb in Agents: ad5e2c861fed137db7808f9ff70278e60e9549db is posted on dev, with explicit cherry-pick/typecheck/review/resubmit direction for T-569/T-585 and alongside owned corrections for T-475.

Only hub/test/durations.json changes. Parsed before/after manifests independently: exactly two new allow identities, byte-equivalent values to the posted shared additions, and every other manifest value unchanged. The pinned-account/inherited-directory T-603 cases gain narrow reasons for native launch/stop/resume/guidance process costs, with observed A-4092/A-4094 timings stated. Baselines match their siblings; no assertions, deadlines, source/tests, other allowances or parent integration changed. Direct parent matches the prior head; diff whitespace check passes. No local rerun needed for this authorized manifest-only shared pick. Request reports root typecheck exit 0 at this head.

Owned fixture/role corrections from A-4097 are unchanged. C3 source proof refreshed; C1/C2 and the prior owned regression's corrected execution remain pending. The measured clause margin remains claimant evidence at this intermediate head, not proof after future integration. Coordinator-required T-585 shared fix and T-536/dev integration/budget recheck are still outstanding. Local-live-hub proof remains staged after merge/restart; no live-hub refusal bypass.

Keep the current verification hold. After the posted shared fix and authorized integration, request exact-head source review before the droplet run. No per-item QA criteria.
Review artifact A-4103.

Criteria: C3 verified.

### impl-475 · 2026-10-16T18:37:48.115Z

Coordinator-authorized origin/dev merge after T-536 is pushed at 6ba8ce3b (dev b6aaeb6f); merge clean. Root typecheck exit0, full Implementer reply including default staffing =7513 bytes /7680,167 margin. Delta source review requested. Coordinator dd9446e8 explicitly releases earlier T-585 wait: submit exact-head droplet verify once this delta clears; if sole red is shared T-585 discovery/watch, report and wait for directed dev integration. No local retry; local-live-hub proof remains Coordinator-owned after restart.

### rev-30 · 2026-10-16T18:39:58.556Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-dev-integration
commit: 6ba8ce3b3e1c183f866dbbeda403e9853c8a03ba
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-475 clean integration source review: clear at 6ba8ce3b3e1c183f866dbbeda403e9853c8a03ba, merge of reviewed de96a65002699613407c62d3237a8c7ee7f71fb1 with origin/dev b6aaeb6f. Standards and Spec axes: no findings.

Read primary Coordinator 1e955645 authorizing this integration after T-536 and primary dd9446e8 expressly lifting the earlier T-585 verification wait. The merge has no combined conflict diff. Relative to incoming dev, changes remain the owned cover-quiet admission scope; the reviewed test-admission, cover-quiet regression/helper, suite-lock and suite-worker bytes are unchanged from de96a650. Incoming suite/config/protocol work auto-merges; no manual resolution or removal of inherited-worker identity checks, capability refusal, copied-source closure or durable-result-before-report correction is present. Independent diff whitespace check passes.

C3 source proof remains: shipped Implementer clause tells agents to wait on cover-quiet, restricts CLAND_TEST_IGNORE_COVER=1 to the human, and links the complete tests.md section. Incoming T-536 OpenCode warning and other role updates are retained. Claimant's full default Implementer reply measurement including staffing is 7513/7680 bytes, 167 margin, meeting the Coordinator's required 150-byte margin; this is reported pure measurement, not a Reviewer-executed roles test. Request reports exact-head root typecheck exit 0 and a clean pushed tree.

C3 refreshed only. C1/C2 and corrected integration execution remain unverified; prior A-4092 red is not cleared by source review. Proceed with normal mode-free cland verify --executor droplet at this exact head per dd9446e8, without waiting for T-585. A T-585-only red returns to the Coordinator for its stated next instruction; no future merge is authorized by this review. Local live-hub proof remains Coordinator-owned after merge/restart under 54b041c5, with local marks pending its receipt. No local refusal bypass and no per-item QA criteria.
Review artifact A-4116.

Criteria: C3 verified.

### impl-475 · 2026-10-16T18:40:10.586Z

Clean dev integration source clear at exact head 6ba8ce3b (A-4116 / rev-20261016-475-dev-integration). Submitted normal mode-free droplet verify 1ecb8069-d1c7-44b0-932e-7871a93641de per Coordinator dd9446e8; queue position2, no worker yet, result reports to topic-401 and Reviewer/claimant. No local retry. Waiting for hub result; local-live-hub proof remains Coordinator-owned after merge/restart.

### impl-475 · 2026-10-16T19:06:14.791Z

Coordinator 050f5161 authorized dev integration with T-585 + shared T-603 allowances. Prior run 1ecb8069 was still running/no result before mutation. Merged a446efc5 at pushed 75390e83; two additive conflicts retain both runner imports and all shard entries. Typecheck exit0; test:shards exit0; full clause reply including staffing7513/7680 (167 margin). Requested dev-merge-only delta review at exact head; next droplet submit after source clear and prior run no longer active. No local admission refusal bypass.

### rev-30 · 2026-10-16T19:07:22.802Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-shared-dev-merge
commit: 75390e8348e11d330ebc9d1dda15a5d80c3eb42c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-475 dev-merge delta source clear at 75390e8348e11d330ebc9d1dda15a5d80c3eb42c, parents reviewed 6ba8ce3b and dev a446efc5. Standards and Spec axes: no findings.

Read primary Coordinator 050f5161-ae9c-4d3d-973b-8187dd4f7a3d in Agents: merge dev containing T-585 and T-603 shared fixes, typecheck/shard lint, delta review then explicit droplet verification. Combined merge diff shows only the two reported additive resolutions. run-suite.ts retains both assertTestAdmission and readQuarantineManifest/type imports; relative to dev the runner adds only the admission import and awaited call at function entry, before runner-root initialization. Parsed shard maps confirm only owned cover-quiet machine entry is added to incoming dev, no removals or changed incoming values; both quarantine entries remain. The resulting 16-file delta versus dev remains the previously reviewed cover-quiet implementation. No owned assertions, refusal rules, lease identity checks, durable completion/report boundaries or incoming quarantine behavior are discarded.

C3 remains supported by unchanged docs and shipped Implementer instruction. Full reply including staffing is claimant-measured 7513/7680 bytes, 167 margin; no budget assertion weakened. Request reports exact-head typecheck and shard lint exit 0; independent whitespace check passes. No local retry or Reviewer test execution.

C3 refreshed only. C1/C2 corrected runtime and Coordinator-owned post-merge/restart local-live-hub proof remain pending; no final green inferred from source review. A prior-head running request supplies no receipt yet and does not itself verify this merged tree. Proceed with normal mode-free cland verify --executor droplet at this exact head under primary 050f5161, subject to existing queue/admission policies. No local refusal bypass or per-item QA criteria.
Review artifact A-4132.

Criteria: C3 verified.

### impl-475 · 2026-10-16T19:09:12.211Z

Per Coordinator 0aa4426e, cancelled superseded-head run1ecb8069; cancellation completion A-4136 exit143 arrived. Only after completion, successfully submitted normal exact-head droplet verify cdfa1fd5-3486-4f49-a3e5-74e8535127e2 at source-clear75390e83 (A-4132); queue position1. Both shared fixes included. Typecheck/shard checks green; clause margin167. Waiting hub result; claim retained, no local retry.

### impl-475 · 2026-10-16T20:07:13.564Z

A-4168 at75390e83:1998pass/1external T-569fail/5skip; all12 own cases pass+60/60load; worker7.071s,coverage/default clause pass. Per Coordinator f5b56419 merged origin/dev25edc246 with T-569fix4715d307 at pushed fb42911c (clean/no own edits). Typecheck+test:shards exit0; clause incl staffing7513/7680,167margin. Dev-merge-only review requested; wait explicit hold lifted before normal exact-head droplet verify. No local retry; local-live-hub proof remains Coordinator-owned post-merge/restart.

### rev-30 · 2026-10-16T20:08:52.284Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-watchdog-header-delta
commit: a35e9d32e89eeef49e34d2ab7f0fe6536189c7d3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-475 pending dev-merge plus header delta source clear at a35e9d32e89eeef49e34d2ab7f0fe6536189c7d3. Standards and Spec axes: no findings.

Reviewed merge fb42911cb97c0e4d6447e1cedb014719978b03b0 from preceding reviewed 75390e83 and dev 25edc246, then its sole child/header change at this exact head. Primary Coordinator f5b56419 authorizes the dev integration bringing T-569 shared fix 4715d307, with typecheck/shards/clause recheck. Merge is clean with no combined conflict diff. All owned admission implementation, harness and regression bytes are unchanged across the merge; changes in previously owned paths are incoming Test levels documentation and T-569 duration-reason updates. Against dev the 16-file cover-quiet scope remains unchanged. Incoming watchdog fix addresses A-4168's sole external red; this review does not turn that old receipt into a green new-head run.

Read newly merged docs/agents/tests.md Test levels (D53). Primary Coordinator 83d5a0fd expressly applies the lifecycle-header requirement to this unmerged new file, directs exactly the added header, and assigns its unchanged 25 ms barrier poll to T-684's lint baseline. Actual child diff is exactly four comment lines: T3 integration, real integrated worker/CLI lifecycle from pre-fixture startup through completion/slot release, existing poll unchanged and T-684 ownership. No executable source, timing, assertions or allowances change in that child. No finding for the unchanged baseline poll per this primary disposition. Counted startDaemon/spawnSpoke/cland/sleep calls in the new test file: zero; its execFile/real-worker use is named by the lifecycle header. No broader retrospective tier migration is inferred from this merge-only pass.

C3 docs and Implementer clause remain intact. Full clause including staffing is claimant-measured 7513/7680 bytes, 167 margin. Merge-head typecheck/shard lint and child-head typecheck are reported exit 0; independent whitespace check passes, origin task tip matches requested head. No Reviewer runtime execution or local refusal bypass.

C3 refreshed only. A-4168 already proves all twelve owned identities ordinarily and 60/60 load repetitions, corrected worker 7.071 s, but final exact-head gate and Coordinator-owned post-merge/restart local-live-hub evidence remain pending. Keep explicit verification hold until Coordinator posts hold lifted, then submit normal mode-free exact-head droplet verification. No further source changes or local retry directed; no per-item QA criteria.
Review artifact A-4173.

Criteria: C3 verified.

### impl-475 · 2026-10-16T20:14:56.400Z

Hold lifted by Coordinator0df00409 after hub restart/D53 config. Unchanged source-clear head a35e9d32 (A-4173), tree clean. Submitted normal mode-free droplet verify fd0d2ca7-eb15-45a1-823a-a583e2123a2e with same topic-401/Reviewer+claimant routing; queue position1. Both shared watchdog and duration fixes present. Waiting for hub result; no head changes/local retry.

### coord · 2026-10-16T20:58:19.876Z

Coordinator, scope decision: C1–C3 are verified on the exact-head droplet evidence A-4194. The local check that cover-quiet.test.ts passes against a live hub carrying T-475's permission (promised in 54b041c5) is a post-merge obligation of the Coordinator, not a criterion. It runs after the next hub restart that includes T-475, and its receipt goes in topic-401. A failure there gets filed with --regression-of T-475.

### rev-30 · 2026-10-16T20:58:34.879Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-final
commit: a35e9d32e89eeef49e34d2ab7f0fe6536189c7d3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-475 final evidence clear at unchanged source-reviewed a35e9d32e89eeef49e34d2ab7f0fe6536189c7d3. Standards and Spec axes: no findings.

Independently audited complete A-4194 / fd0d2ca7-eb15-45a1-823a-a583e2123a2e: branch/head match A-4173 source clearance; full mode, exit 0, 2397 tests, 2389 pass, zero fail, eight platform/prerequisite skips. Hub free 40/40, machine 1959 pass/zero fail/five skips, full Neovim 390 pass/zero fail/three skips. Every one of the twelve cover-quiet identities passes ordinary execution and 5/5 load repetitions (60/60); corrected real integrated worker admission/completion/report regression passes in 5.236143141 s. Coverage closure and default-role clause invariant pass. No hard duration-budget or load-gate failure in the full log; unrelated quarantined case reports a pass. Prior A-4092 owned failures and A-4168 external watchdog red remain preserved, not relabelled as green.

C1 established: hub and Neovim targeted startup and Neovim package entry refuse cover-quiet before fixtures/runner-root/target execution; read-only admission leaves queue untouched; all connected silence/close/legacy/unsupported variants fail before fixture creation. C2 established: exact inherited-worker admission, standalone/no-hub and ordinary-holder admission, borrowed integrated identity preservation, and real integrated worker own-targeted-harness execution through durable result, report and slot release all pass. C3 docs/Implementer clause proof remains A-4173; clause headroom assertion now also executes green. Latest claimant report restores all three done marks with this receipt.

Read primary Coordinator a2c472aa-4743-48df-b6ce-df3c5bf5ff6d: verify C1/C2 from this exact-head droplet evidence and give final clear. The live-project/local-hub rollout receipt promised in 54b041c5 is explicitly not a T-475 criterion. It remains the Coordinator's post-merge obligation after the next hub restart carrying this code; Coordinator will post it here and file a regression if it fails. No local receipt or bypass is claimed, and merge does not wait for it.

Linux x64 c-8 lon1, Node 24.21.0/Neovim 0.12.5, two workers; suite wall 2467.20 s, peak load 10.60, machine lifetime 2536 s, $0.1761. C1/C2/C3 verified at the exact reviewed head. No per-item QA or further task run required.
Review artifact A-4196.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-30 · 2026-10-16T21:01:14.294Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-dispatch-merge
commit: f9c6975ae32c4f22b003e2fbd59703d1433a176e
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-475 dispatch/shard merge delta source clear at f9c6975ae32c4f22b003e2fbd59703d1433a176e, parents prior final-clear a35e9d32 and dev 45bb16a4463d780131d4f0797ede684057ef203b. Standards and Spec axes: no findings. Origin task tip matches.

Read primary Coordinator 04ef5374 authorizing merge/conflict resolution and fresh verification, and f33640ca explicitly replacing local matching-file execution with inventory plus fresh droplet verification because the live hub's refusal still governs. No local matching-file run or permission workaround is requested.

Combined merge diff shows only additive conflicts. SESSION_CLI_FRAMES is the union: incoming config.set plus owned suite.slot, all prior entries retained. Config frame handler still refuses roles other than Coordinator/Aide/human and rechecks session identity/role on resumed authorization before applying changes. Read-only suite.slot check retains its dedicated checkSlot branch; actual human slot/forced-slot paths still refuse session callers. Thus broad session-frame routing does not remove either handler's specific authorization. Relative to incoming dev, dispatch adds only reviewed suite.slot routing/check behavior, preserving incoming config editing.

Parsed shard maps independently: only owned cover-quiet machine entry differs from incoming dev; no removals or changed incoming values, config-set and roles-editor entries retained. No cover-quiet test body changes. The resulting 16-file diff versus dev remains owned admission scope with the already accepted T3 header. Independent whitespace check passes. Request reports exact-head typecheck and shard lint exit 0, clean pushed tree.

Independently confirmed matching whole-test inventory for SESSION_CLI_FRAMES|suite[.]slot|config[.]set across hub/test and nvim/test: config-set.test.ts, cover-quiet.test.ts, suite-human.test.ts, suite-remote-budget.test.ts; no Neovim test hit. Supporting run-suite is not a test. These files, plus preserved roles-editor coverage, must be included by the normal new-head selection as directed; previous A-4194 remains prior-head green evidence only.

C3 source refreshed. C1/C2 exact-head merged runtime gate remains pending; submit fresh normal mode-free droplet verification under Coordinator direction. Primary a2c472aa's local live-hub rollout remains a separate post-merge Coordinator obligation, not an item criterion or merge blocker. No per-item QA criteria.
Review artifact A-4201.

Criteria: C3 verified.

### impl-475 · 2026-10-16T21:01:30.557Z

Authorized dispatch conflict resolved at f9c6975a; source clear A-4201 / rev-20261016-475-dispatch-merge. Resolution/test inventory A-4200. Typecheck+test:shards exit0; matching-file local runs explicitly prohibited by Coordinatorf33640ca, replaced by fresh normal droplet run. Submitted 2ef8e9ab-4747-4bc5-b03e-1d51206db3f3 at exact reviewed unchanged head, queue1, topic-401 Reviewer+claimant. Prior green A-4194 is prior-head proof only. Waiting hub result.

### impl-475 · 2026-10-16T21:46:18.454Z

Fresh exact reviewed conflict-head f9c6975a is full hub+Neovim green in2ef8e9ab / A-4211:2406pass/0fail/8skip. Matching-file receipts confirmed: cover-quiet12,config-set8,suite-human9,suite-remote-budget18,roles-editor8; all12 own load gates5/5(60/60). Linuxc-8,2workers,suite2584.25s,peak10.38,cost$0.1848. No head/source change; Reviewer asked to refresh final evidence/C1-C2 at current head. No local matching-file execution per f33640ca; remote gate supplies inventory proof. Local-live-hub rollout remains Coordinator post-merge obligation per a2c472aa, not merge blocker.

### rev-30 · 2026-10-16T21:46:26.147Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-475-dispatch-final
commit: f9c6975ae32c4f22b003e2fbd59703d1433a176e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-475 dispatch-conflict merged-head final evidence clear at f9c6975ae32c4f22b003e2fbd59703d1433a176e. Standards and Spec axes: no findings.

Independently audited complete A-4211 / 2ef8e9ab-4747-4bc5-b03e-1d51206db3f3. Branch/head match A-4201 source review; full mode exits 0: 2414 tests, 2406 pass, zero fail, eight prerequisite/platform skips. Hub free 41/41, machine 1975 pass/zero fail/five skips, full Neovim 390 pass/zero fail/three skips. No hard duration-budget or load-gate failure; unrelated quarantined case reports a pass.

All matching files from the Coordinator-authorized dispatch-resolution inventory execute fully: cover-quiet 12, suite-human nine, suite-remote-budget eighteen, config-set eight, plus preserved roles-editor eight cases. Every cover-quiet identity passes ordinarily and 5/5 load repetitions (60/60), including actual integrated worker completion/admission/report at 5.272683732 s. Thus the resolved session CLI routing is now covered together with inherited worker/no-hub admission, human slot restrictions and incoming config/settings authorization. Coverage fixture and clause invariants have no failure. Prior A-4194 remains prior-head evidence, not the basis for this new-head runtime gate.

C1/C2 exact-head runtime proof refreshed; C3 docs/Implementer source proof remains A-4201 and whole-suite role checks pass. All claimant done marks are present. Primary Coordinator a2c472aa still governs: local live-hub rollout receipt is a separate post-merge/restart Coordinator obligation, not an item criterion or merge blocker. No local receipt or refusal bypass is claimed.

Linux c-8 lon1, Node 24.21.0/Neovim 0.12.5, two workers; suite 2584.25 s, peak 10.38, lifetime 2661 s, $0.1848. C1–C3 verified at this exact head. No per-item QA or further task run required.
Review artifact A-4213.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-16T21:49:17.030Z

Merged fdadc69d534672fd5b60737352b7f3c93fce1511 onto dev.

### coord · 2026-10-16T23:28:52.298Z

Coordinator, post-merge obligation from 54b041c5, done. cover-quiet.test.ts passed 12/12 locally (exit 0, 18.2 s, load 2.7) against the live hub pid 78936, restarted at 23:26Z onto T-475 (fdadc69d). It ran from a clean detached worktree at dev e119422d. Local test admission works on current dev. The receipt is in topic-406.
