---
id: T-1924
kind: task
title: "Delivered but unconfirmed deliveries never drain: 195 pending rows for coord after restart, each replayed at startup"
state: closed
status: done
size: M
criterion_seq: 3
labels: []
assignee: null
parent: E-1885
blocked_by: []
regression_of: T-1919
topic: topic-1569
branch: t/T-1924-delivered-but-unconfirmed-deliveries
created: 2026-11-16T22:14:22.757Z
updated: 2026-11-17T00:32:04.957Z
closed: 2026-11-17T00:32:04.957Z
---

## Summary

A session's delivered-but-unconfirmed deliveries are never drained: after hub restart #79 (2026-11-16 22:12Z, T-1919 live) coord still has 195 pending rows in state 'delivered' with no digest, and the hub logs one inject-unconfirmed event per row for coord between 22:12Z and 22:14Z, a startup pass over the whole set. T-1919 made the per-completion rebuild cheap, but the set keeps growing (143 rows when T-1919 was filed), so its cost and the startup pass grow with session age.

## Evidence

- Hub operator report after restart #79 (pid 1948, dev e824406ae): pending set 195 rows for coord, 195 inject-unconfirmed log events 22:12Z–22:14Z; hub CPU 115% in the first minute, then 32 / 22 / 2 / 10%.
- T-1919 (2bdf1ff0f) diagnosis: 143 unconfirmed coord deliveries rebuilt through the deliveryIds OR query on every injection completion.

## Acceptance criteria

- [x] C1. Exact native or digest receipts settle only their captured delivery; a submitted Claude input whose turn receipt times out becomes durably reported, is never claimed received, and leaves the automatic pending work; hundreds of such rows stay bounded across a hub restart (test).
  - done: impl-1924 · 2026-11-16T22:44:26.769Z
  - verified: rev-38 [reviewer] · run rev-38-1924-final-1 · 2026-11-16T23:15:21.152Z · commit f2dfae3c030477d19ff0cae4764887a24c0ee0ff
- [x] C2. Hub startup does no per-row inject-unconfirmed pass over already-received rows; a regression measures the startup work for a session with 200 such rows.
  - done: impl-1924 · 2026-11-16T22:25:07.688Z
  - verified: rev-38 [reviewer] · run rev-38-1924-final-1 · 2026-11-16T23:15:21.152Z · commit f2dfae3c030477d19ff0cae4764887a24c0ee0ff
- [x] C3. A row that was truly never received is still retried or reported, as today.
  - done: impl-1924 · 2026-11-16T22:25:07.799Z
  - verified: rev-38 [reviewer] · run rev-38-1924-source-2 · 2026-11-16T22:33:43.973Z · commit da8954a3bf4aa0733564c29255340a57eb2423d4
  - verified: rev-38 [reviewer] · run rev-38-1924-source-3 · 2026-11-16T22:45:14.474Z · commit f2dfae3c030477d19ff0cae4764887a24c0ee0ff
  - verified: rev-38 [reviewer] · run rev-38-1924-final-1 · 2026-11-16T23:15:21.152Z · commit f2dfae3c030477d19ff0cae4764887a24c0ee0ff

## Comments

### impl-1924 · 2026-11-16T22:16:53.008Z

Rule 20 consumer inventory before implementation: Store record/appendNoticeRecipients/#bindProgress/claimRoleQueue, deliveryRoot/deliveryIds/deliveryMessage, markDelivered/startInjection/markInjected/markUncertain/retryUncertain, uninjected/isUninjected, hasPendingWork/unacknowledgedCount/retryCandidate/deafCandidate, launch brief activation/cancellation and digest release; HubCore ack/markInjected/startInjection/flushQueued, verifier reservations and rename; Sessions #recoverHeld/#retry on startup/discovery/reconnect/idle, #inject completion and #confirm native hooks, #unconfirmed backoff/deaf supervision and heartbeat admission. Adapter consumers: Claude exact turn-start IDs, Codex RPC confirmations/native turn reconciliation, OpenCode prompt receipt; spoke/client ack remains transport acceptance. Wire/UI history and stages consume injected state through core stage publication. Full field/function search across hub/src, hub/test, shared, nvim, web, shipped skills, QA briefs and docs: specific affected tests and unaffected reasons will be attached with final implementation. Sequence-only deaf-confirmed watermark is warning suppression, not exact delivery evidence.

### impl-1924 · 2026-11-16T22:23:11.870Z

Outcome-consumer migration audit: reuse existing uncertain, no new state/wire value. Production changes: ClaudeCodeAdapter inject deadline emits InjectUncertain(batchReport=true), Sessions forwards presentation hint, HubCore existing markUncertain persists every exact root/digest before reports, Inbox batches only opted-in reports. Unchanged consumers: Store uninjected/isUninjected/hasPendingWork/startup restore already exclude uncertain; digests retain fixed membership; heartbeat/deafCandidate retains delivered-only policy; retryCandidate/retryUncertain explicitly handle uncertain; markInjected accepts late exact receipt; stages intentionally render uncertain as delivered; identity/mention/rename retention includes uncertain. Codex, OpenCode, fakes default batchReport=false; no receipt semantics changed. Journal, workbench and Web consume existing delivery-uncertain notification and delivered stage unchanged. Previous wire shape remains unchanged (no protocol fields). Tests searched every tier via state/function/frame names: store.test.ts, journal-async, human-hold, verifier-resolver/routing, fake-harness-capabilities, codex-adapter/delivery/native, claude-code-adapter and inject-stalled. Only Claude timeout expectations change; retained T-1919 pending and generic rejection/backoff regressions remain unchanged. Shipped skill/QA/startup searches found no direct timeout-specific outcome assertion to migrate; related docs updated.

### rev-38 · 2026-11-16T22:28:09.003Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1924-source-1
commit: ffd9e9a71d42826293bc241b723bf296f80036da
scope: full
findings: [{"severity":"medium","text":"Existing real Claude adapter timeout assertion still requires inject-unconfirmed, now replaced by inject-uncertain. Migrate this prior-wire-shape regression and its test guide, preserving negative/late-receipt assertions; complete rule20 consumer audit.","file":"hub/test/claude-code-schedule.test.ts","line":408},{"severity":"medium","text":"New 200-row test lacks whole-case ownership before acquisition. Registered per-generation cleanup does not fence/join async body continuations, including second-generation storage reopen after first.close. Use shared admitted-work ownership with held-work cancellation proof before roots can be removed.","file":"hub/test/inject-stalled.test.ts","line":24}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source review T-1924 at pushed ffd9e9a71d42826293bc241b723bf296f80036da; diff e824406ae...ffd9e9a71, one task commit, 13 files. No Reviewer runtime or browser; source-only review.

Standards:
- Medium — hub/test/claude-code-schedule.test.ts:408 still requires inject-unconfirmed after advancing the real Claude adapter's exact receipt timeout. New ClaudeCodeAdapter timeout emits InjectUncertain and Sessions logs inject-uncertain instead. This existing previous-wire-shape re-exec regression will fail at this head. Migrate its outcome oracle while preserving the legacy injected acknowledgement negative and late exact envelope positive; update docs/agents/tests/hub-test-claude-code-schedule.test.ts.md:7 too. Rule20 inventory missed this direct timeout consumer; rerun the consumer search rather than relying only on listed changed files.
- Medium — hub/test/inject-stalled.test.ts:24 new 200-row callback has no pre-acquisition whole-case owner. tempProject, fake spawn, clock advances, adapter.close and first.close cross awaits; after cancellation its continuation can reopen second-generation Store/ProcessTable after registered resource/directory cleanup. retainedDeliveryFixture's onCleanup owns acquired generations, but does not fence/join this body or capture late continuation work. Enroll the shared whole-work normal/signal owner before first acquisition, adopt roots and resources, and retain a deterministic held-work cancellation control proving root retention, fenced continuation and joined cleanup (rules9/12).

Spec:
The main production change follows the approved design: accepted Claude timeout becomes existing uncertain before report, exact receipt and manual retry remain available, no cumulative watermark. Immediate pre-submit bridge failures retain plain Error retry policy. Batch reporting keeps O(sessions) pending summary state and flushes on Inbox close; existing wire shape/state stays unchanged. The missed consumer and unsafe regression lifetime prevent clearing C1's tested guarantee.

Rule15: new adapter fixture uses shared fixtureEnvironment and disposable root, no new child launcher or inherited credentials overlay. Rule17: claimant reports direct local macOS Node24.21 T2 inject-stalled24/24 and T3 claude-code-adapter6/6 using sealed fake Claude, no browser; these are partial claims, not configured verification or coverage of the missed schedule case. No configured verify run at review time. No full-suite pass, Linux pass or timing claim made here.
Rule20: item and A-20414 list broad consumers and unchanged uncertain wire semantics, but the concrete timeout assertion above disproves the claimed complete migration. Keep the old-wire regression in the correction.

No source criterion verified on this not-clear pass. C1 failed for incomplete timeout consumer migration and regression ownership; C2/C3 remain run-dependent/unverified. Fix both together, obtain a fresh exact-head source review before configured verification.
Artifact A-20419: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20419-t-1924-source-review-not-clear-at-ffd9e9a71.md

Criteria: C1 failed (Existing Claude re-exec timeout consumer still requires the old outcome; new retained-storage test lacks whole-case cancellation ownership.).

### impl-1924 · 2026-11-16T22:30:36.331Z

Source-review corrections: broad timeout/log/class search found and migrated claude-code-schedule.test.ts:408 and its guide. This is the previous-wire-shape re-exec consumer: submission ack still cannot confirm; unrelated turn cannot confirm; late exact envelope still injects. All 46 schedule tests pass locally (macOS, Node24.21.0, T2 scripted native edge, no process/browser). 200-row scenario now uses whole-case caseDeadlines run/step with shared normal/signal cleanup enrolled before root acquisition; root adopted inside acquisition; phase waits bounded. Added deterministic cancellation of the actual scenario between first storage drain and second acquisition; verifies retained root on release, joined continuation, fenced reopen, eventual root removal. Entire inject-stalled file passes 25/25 locally. Production source unchanged since ffd9e9a71; prior T3 6/6 is ancestor evidence, not a fresh current-head configured receipt.

### rev-38 · 2026-11-16T22:33:43.973Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1924-source-2
commit: da8954a3bf4aa0733564c29255340a57eb2423d4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source correction review at da8954a3bf4aa0733564c29255340a57eb2423d4; origin task tip confirmed. Reviewed e824406ae...da8954a3b with correction ffd9e9a71...da8954a3b; production source unchanged since first review.

Standards: no findings. Both A-20419 mediums resolved. claude-code-schedule:408 now asserts exact inject-uncertain and preserves legacy submission-ack/unrelated-turn negatives plus exact-envelope late receipt positive; guide matches. The 200-row scenario enrolls shared normal/signal cleanup before root acquisition, adopts root inside acquisition, uses whole-sequence run with step admission around awaited phases and owned bounded waits. Retained generations register with the proxied cleanup context. Shared join fences admission before release, waits the body/pending operations before hooks remove directories. Cancellation control executes that same scenario, holds after first storage closes, observes root retained on release, joins rejection/cleanup, asserts reopen refused and root ENOENT. No new native process in correction. Renamed duration manifest key retains historical value; not treated as a new measurement.

Spec: no findings. Production uses existing uncertain state for accepted Claude receipt timeout; persists exact root/digest before operational report, excludes automatic replay and allows late exact receipt/manual retry. Pre-submit bridge failures remain ordinary Error and retain retry/report path (C3 established by source). Aggregate notification path and per-ID log receipts remain as reviewed. 200 uncertain plus 200 exact-confirmed regression retains one summary/zero restart injection assertions.

Rule15 scratch root/shared final environment builder preserved. Rule20 correction migrates missed previous-wire timeout consumer and guide; item/A-20414/A-20422 contain inventory. Targeted source searches at this head found timeout references in corrected native/schedule tests, guide, duration key and historical tracker snapshot content (historical content unaffected); generic inject-unconfirmed consumers retain other failure classes. No new wire/state value requires old-hub fallback; prior-wire legacy acknowledgement negative remains tested.

C3 verified from source preservation. C1/C2 runtime outcomes remain unverified pending configured same-head evidence. Source clear permits authorized mode-free verify, not final suite clearance.

No Reviewer tests or browser. A-20422 reports claimant local macOS Node24.21 corrected-source T2 inject-stalled25/25 and schedule46/46, typecheck/static/test-lint/wording checks; no current-head configured run. Native6/6 at ancestor ffd9e9a71 is ancestor-only evidence. Existing advisory lint findings are report-only; no full suite/Linux/timing or coverage claim inferred.
A-20423: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20423-t-1924-source-correction-clear-at-da8954a3b.md

Criteria: C3 verified.

### impl-1924 · 2026-11-16T22:43:56.499Z

Verify ede2c17d at da8954a3b failed only cli-usage-compatibility::all command usage exports retain their pre-refactor bytes: actual SESSION_USAGE includes '(includes Claude mod turn-receipt timeouts)', frozen expected row omitted it. T0 exit0, T1exit1, completed1763/1762pass/1fail; T2/T3/T4/Web not executed. Linux droplet c-8sfo2, lifetime295s cost$0.0205, A-20432. Correction df436bc3f updates only owning commands.json row, local T1 compatibility1/1 + T2 cli-help9/9 pass. Coordinator authorized separate shared-fix cherry-pick15757e4d4 (decision e2ec9c48); applied unchanged as f2dfae3c0, identical stable patch-id ca1055f0f1fa1bcd7cd2b9c0c935301d9d365422. Local hub-priority1/1 and wording lint0 findings pass on macOS Node24.21.0. Pushed head f2dfae3c030477d19ff0cae4764887a24c0ee0ff; fresh delta source review requested before any verify resubmission.

### rev-38 · 2026-11-16T22:44:17.230Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1924-evidence-1
commit: da8954a3bf4aa0733564c29255340a57eb2423d4
scope: evidence
findings: [{"severity":"medium","text":"Configured T1 fails the frozen SESSION_USAGE byte comparison: the intentional Claude timeout note was not migrated into fixtures/cli-usage/commands.json. T2 and later phases never executed; fix the narrow frozen row and obtain fresh source review before verification.","file":"hub/test/cli-usage-compatibility.test.ts","line":9}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence review of run ede2c17d-c1a6-4df6-b633-60de8509f749 at da8954a3bf4aa0733564c29255340a57eb2423d4: NOT CLEAR.

Actual A-20432 output, lines9720–9735:
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal
+ uncertain means the turn may have started; never retried on its own (includes Claude mod turn-receipt timeouts)
- uncertain means the turn may have started; never retried on its own
at hub/test/cli-usage-compatibility.test.ts:9:10.

Medium: hub/test/fixtures/cli-usage/commands.json retains the previous SESSION_USAGE text while production hub/src/cli/usage/session.ts:2 intentionally adds Claude timeout guidance. The independent frozenUsage() consumer compares every export byte, so this is a deterministic task-introduced compatibility-oracle mismatch, not a priority baseline or infrastructure failure. My source audit missed this consumer. Correct only the intended command row while preserving the other frozen bytes.

Run provenance: fresh, cached:null Linux x64 6.8.0-147-generic droplet c-8 sfo2, Node24.21.0, Neovim0.12.5; tree bb19603eb87f76eae7a350305adac48f20f2f42c. T0 exit0; T1 exit1; completed aggregate1763/1762pass/1fail, no cancelled/skipped/todo. Reported T1 case count1719 is a tier count, not the aggregate. T2, changed T3, T4, Web and new-test load repetitions did not execute. Browser provenance binary/version null: Chrome Headless Shell1248/156.0.8078.4 was downloaded, not run. Budget, lint and ratchet diagnostics are report-only; missing durations and projections do not establish runtime coverage or performance passes.

C1's configured regression proof remains incomplete due to the failed suite; C2 unverified, C3 source verification unchanged. This does not establish a delivery-semantic failure in the unexecuted cases. No Reviewer runtime/browser; review only inspected source and durable log. A-20432 is the failure receipt.
A newer correction request f2dfae3c030477d19ff0cae4764887a24c0ee0ff has now arrived and will receive a separate source verdict before any new verify.
Artifact A-20435: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20435-t-1924-configured-evidence-not-clear-at-da8954a3b.md

Criteria: C1 failed (Configured proof is incomplete: intentional help change breaks frozen SESSION_USAGE compatibility in T1, preventing C1 runtime regressions from executing.).

### rev-38 · 2026-11-16T22:45:14.474Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1924-source-3
commit: f2dfae3c030477d19ff0cae4764887a24c0ee0ff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source correction review at pushed f2dfae3c030477d19ff0cae4764887a24c0ee0ff: CLEAR, no findings. Full source verdict carries forward the reviewed delivery design from A-20423, with all four changed files/two new commits examined against da8954a3b. No dev merge and no production delivery or regression-body change.

Standards: no findings. df436bc3f changes only the frozen SESSION_USAGE row in hub/test/fixtures/cli-usage/commands.json: adds the exact intended Claude timeout note to match production session.ts. Other frozen command bytes, export composition and independent deepEqual oracle remain intact. This resolves A-20435's deterministic T1 mismatch without weakening the guard. The inventory now includes frozenUsage(), cli-usage-compatibility.test.ts and commands.json as help-output consumers.

Coordinator decision e2ec9c48-560c-44f7-a515-f0689cea573a in this item topic explicitly authorized a separate unmodified cherry-pick of shared T-1923 fix15757e4d4 after the fixture fix. f2dfae3c0 is that separate commit. Entire git diff of each commit (all three files, including guide/index), not just patch-id, has identical SHA256:
645f8be39a5c6fee0145fe0af6f2c5982c94b4ff37c83fa6bc34511a9764bec3.
Priority test now shares captured native lock identity across CLI/doctor fixture readers and asserts the doctor recognizes the holder. Shared helper remains the identity parser; scratch environment/probe setup preserved. Guide accurately describes the native/synthetic distinction and platform coverage limits.

Spec: no findings. Delivery production source and C1/C2 regression bodies are byte-unchanged since A-20423; C3's preserved pre-submit retry/report source path remains established at this exact head. Rule11 shared fix authorized, no opportunistic dev merge. Rule15 no new launcher/dependency/wire contract; existing shared sealed fixture environment retained. Rule20 explicit frozen output consumer migration now present; previous-wire acknowledgement negatives remain unchanged.

C3 verified from source. C1/C2 remain runtime-unverified: source clearance permits an authorized new mode-free configured verify only, not final clearance. A-20432 at ancestor da8954a3b remains failed/incomplete; T0 passed, T1 failed, T2/T3/T4/Web/load unexecuted. No result carries forward as a pass at f2dfae3c0. Claimant reports local macOS Node24.21 compatibility1/1, CLI help9/9, priority1/1, wording lint0findings; these are partial local claims. Earlier component71 cases and native6 at ancestors remain ancestor evidence, not fresh head coverage. No Reviewer tests or browser; no new runtime measurement or performance claim. Rule27 diagnostics remain report-only.
Artifact A-20436: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20436-t-1924-source-clear-at-f2dfae3c0-with-exact-shared-patch.md

Criteria: C3 verified.

### rev-38 · 2026-11-16T23:15:21.152Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1924-final-1
commit: f2dfae3c030477d19ff0cae4764887a24c0ee0ff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-1924: CLEAR at f2dfae3c030477d19ff0cae4764887a24c0ee0ff, no findings. Origin task tip and task.view confirm unchanged source-reviewed head. Source verdict rev-38-1924-source-3/A-20436 plus configured run7097d41b-fd19-4980-8bbd-4eb4e24b8757/A-20452 establish all criteria. Reviewed durable positive finish records separately from exit status, and reread the exact scenario assertions.

C1: verified. Generated case "200 submitted Claude inputs without turn receipts stay reported across restart" has six pass finish records: one base plus five load repetitions, no other outcomes. Its actual body asserts 200 bridge-accepted exact IDs become durable uncertain, 200 per-ID inject-uncertain logs, one notification naming count/oldest/newest, zero automatic pending rows, 200 additional exact-confirmed rows, then storage reopen and startup/idle/reconnect with zero injections and no new notification. Late exact receipt settles only ids[0], leaving ids[1] uncertain; explicit retry settles ids[1] with its own receipt. Existing exact-root/digest persistence and receipt membership semantics were source-reviewed unchanged. "Claude re-exec bridge acknowledgement without a model turn remains unconfirmed" passes once, preserving prior-wire submission acknowledgement and unrelated-turn negatives plus late exact envelope positive. Native "Claude Code mod confirmation timeout requires explicit retry" passes once through the sealed fake Claude binary, including unrelated successful-turn negative and manual-retry positive.

C2: verified by the same 200 uncertain +200 confirmed restart regression's work-count assertions, not elapsed-time inference: no per-row re-injection, no duplicate notification. Cancellation case "cancelling the Claude receipt restart case joins held work before root removal and fences storage reopen" also has one base plus five load passes, no other outcomes. Body holds actual scenario after first storage drainage, confirms retained root, joins shared owner, refuses second-generation reopen and observes final root removal.

C3: verified. Source-preserved definite bridge/submission failure path remains ordinary Error; restart regression's "never submitted" rejection remains uninjected/eligible for retry. Existing "an hour of failed idle retries backs off with one log per pending message", reconnect failure/backoff cases and "explicit retry of an uncertain delivery clears its earlier failure backoff" each have positive base finish records. Full inject-stalled base has25 cases;35 pass records include10 extra repetitions of its2 new cases. Claude schedule has46 pass records, native adapter6, frozen usage compatibility1, each with no non-pass finish.

Run scope/provenance: cached:null fresh Linux x64 6.8.0-147-generic droplet c-8 sfo2, Node24.21.0, Neovim0.12.5. Exact tree aa0798f8e2078e2014aeaace6fe6befaebc905a9. Local T0 host gate exit0; T1 all224files, fallback-all T2 428files, selected changed native T3 claude-code-adapter6/6, mapped T4 inbox-verifier-load1/1, Web55files all complete exit0. Typed T4 case "100-frame verifier delivery bursts never scan retained message history" passes once; no T4 load repetitions. T3 native cases also execute once for duration checking, not a whole T3 cover. Remaining T3 and other T4/integrated occasions unexecuted here. Aggregate6528pass,0fail/cancel/skip/todo; per-tier identity counts and aggregate have different accounting, not added into an invented total.

Web uses isolated Chrome Headless Shell1248, Google Chrome for Testing156.0.8078.4 at /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell. No human browser. Lint122 findings/59files, duration budgets/ratchet and skip-reason diagnostics remain report-only; timing regressions and incomplete/unavailable baselines do not become performance passes. No new performance claim. Prior ede2c17d at ancestor da8954a3b remains failed/incomplete, superseded for final correctness by this fresh same-head run; it is not relabelled passed. A-20453 corroborates claimant receipt accounting.

Standards: no remaining finding in this evidence pass. Spec: allC1/C2/C3 checked across exact-head source and configured receipts. No Reviewer test/browser executed; only read-only source/log audit.
Artifact A-20454: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20454-t-1924-final-evidence-clear-at-f2dfae3c0.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-17T00:32:04.957Z

Merged f25977d1d59f33611ffaf060f5a895fa9fd56739 onto dev.
