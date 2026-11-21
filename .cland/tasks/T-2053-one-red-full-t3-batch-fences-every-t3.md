---
id: T-2053
kind: task
title: One red full-T3 batch fences every T3 file from the next batch's load-gate baseline, so that batch repeats every identity and times out at 75 min
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1706
branch: t/T-2053-one-red-full-t3-batch-fences-every-t3
created: 2026-11-21T09:44:13.651Z
updated: 2026-11-21T23:08:34.947Z
closed: 2026-11-21T23:08:34.947Z
---

## Summary

On 2026-11-21, T-2046's batch 33dcd1f7 was red: 6 failures, a full T3 selection, dropped at 08:19Z. The next batch, d98b2a8d with T-1981 alone (run becd21cf), chose `load gate baselines T3=33dcd1f7`. It reported `repeated identities unknown (confirmed complete 819; completion unknown 5)`, where earlier batches repeated 1 or 2. Both shards hit `run timeout 75m` with no attributable failure, and the hub held the batch as inconclusive.

The cause is in `#readBatchIdentities` (`hub/src/hub/suites.ts`, about lines 1048–1082). A later red receipt "fences" every file it ran ("never resurrect its older proof") and contributes no identities. So a red full-T3 batch removes all T3 files from the baseline, and the next batch treats every T3 identity as unmeasured and repeats it five times. One red batch stalls the merge queue until a newer green integrated receipt exists.

## What to build

A red receipt fences only the files whose identities failed, or failed to complete. Its passing files still contribute their identities. A file with a failed identity keeps its older green proof fenced.

## Acceptance criteria

- [x] C1. After a red full-T3 batch with one failing file, the next batch's baseline treats that file as unmeasured and every other T3 file as measured from the red run's passing identities (test, red before).
  - done: impl-2053 · 2026-11-21T18:13:37.755Z
  - verified: rev-41 [reviewer] · run rev-41-20261121-2053-final · 2026-11-21T19:28:09.309Z · commit d2bfc00a281fbf4ab6dd223f52e0565d4167a58b
- [x] C2. A file whose identity failed or didn't complete in the red run is not resurrected from an older green receipt (test).
  - done: impl-2053 · 2026-11-21T18:13:38.181Z
  - verified: rev-41 [reviewer] · run rev-41-20261121-2053-final · 2026-11-21T19:28:09.309Z · commit d2bfc00a281fbf4ab6dd223f52e0565d4167a58b

Evidence: A-22454 and A-22457 (batch d98b2a8d / run becd21cf); 33dcd1f7 (A-22420). Workaround on 2026-11-21: a green Linux stage cover on dev (695cb540) gives the next batch a green baseline.

## Comments

### impl-2053 · 2026-11-21T18:08:45.784Z

Consumer census: baseline selection and provenance in hub/src/hub/suites.ts; compact persisted readers hub/src/hub/suite-history.ts and hub/src/hub/store.ts; runner baseline transport suite-selection.ts/loadGateBaseline and repetition consumer suite-load-gate-plan.ts unchanged. Tests searched across all tiers by batchBaseline, timingIdentities, loadGateBaseline, receiptIdentities and baseline wording (merge-batches, suite-stage-rules, suite-tiers, suite-load-gate-plan, suite-soak-component, suite-history and store tests). Docs consumers: hub/README.md, docs/hub/running.md, docs/agents/tests.md. No wire/help/permission shape changes. Additive internal checkpoint omitted from compact history; legacy red records without completion receipts remain unknown. Regression red on original source: hub/test/pass-0.test.ts, 5 !== 0; 1 test failed, macOS local Node 24.21.0, no browser.

### impl-2053 · 2026-11-21T18:16:37.697Z

Implementation d2bfc00a281fbf4ab6dd223f52e0565d4167a58b pushed to origin. C1/C2 done. A-22542 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22542-t-2053-red-to-green-baseline-evidence.md) holds red-before/green-after evidence and scope. 29 selected T1 files, 512 tests passed, macOS local Node24.21.0; full typecheck and test:lint passed, advisory reports only, zero refusals. No configured verification or T2/T3/T4/Web yet. Source review requested before Coordinator verify window. Additional consumer found and updated: merge skill, with provenance change note.

### rev-41 · 2026-11-21T18:18:11.337Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-2053-source1
commit: d2bfc00a281fbf4ab6dd223f52e0565d4167a58b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear atd2bfc00a281fbf4ab6dd223f52e0565d4167a58b, based ond1b803566 (origin/dev merged before first review). Standards0/Spec0 findings. Read item/C1/C2/consumer inventory, complete production/test/docs/merge-skill diff and shared progress/timing/log/history parsers. Reviewer made no edits or test/native/browser runs.

Per-file latest-receipt fencing remains unchanged: selected files leave remaining before evidence extraction, so failed/incomplete files cannot recover older green identities. Green receipts retain existing path; red batch/stage candidates use a separate additive batchPassingIdentities checkpoint. Streaming scan requires an observed passing file envelope, accepts only pass timing identities, blocks nonpass timing/progress and outstanding starts, then filters whole files. Missing file completion yields no proof. Shared progress parser keeps cancelled starts outstanding; skipped/todo/nonpass outcomes block rather than confer evidence. Existing tier/mask eligibility, cancellation/cache/notRun/diagnostic exclusions and bounded history scan remain. No overall red run is promoted green, and stage coverage policy is unchanged.

Scan shares the per-run in-flight promise, checkpoints its sorted result durably for restart reuse and stays off startup/liveness paths. Compact history uses its shared omission list for the additive field; expanded persistence fixture checks bounded startup projection without full record hydration. Existing reader/runner baseline transport unchanged; consumer census includes raw fields, tests across tiers, docs and merge skill, with provenance note. No command/help/config/role permission/wire shape change.

New guarded T1 cases exercise20passing files plus failed/incomplete files, independently selecting file-finish failure or identity failure, new/old-only identity exclusion and restart after evidence log replacement. Existing fixture owns setup/continuations and forbids native launch. A-22542 records prior-source actual red 'hub/test/pass-0.test.ts,5 !==0' and corrected fixture evidence; final reported selected29T1files/512pass,macOS Node24.21,full typecheck/lint exit0,advisories report-only. Those are selected/static receipts, not configured T2/T3/T4/Web evidence. C1/C2 remain unverified until exact-head configured run; no source criterion marks. Source clear permits verification in Coordinator-granted window.

### impl-2053 · 2026-11-21T19:27:54.495Z

Configured verify 62d3caed-e593-4ed5-9c58-b094f4dfc31e: auto exit 0 at d2bfc00a281fbf4ab6dd223f52e0565d4167a58b/tree 6f0fe308672d03bb4bb9981cbab95ed261ba719d. A-22563 records T0/T1/T2/selected T3/Web exit 0; T4 not selected, remaining integrated T3 belongs to merge batch. Both new generated red-baseline cases have passing finish receipts and 5/5 load-gate passes. Droplet Linux x64 6.8.0-149-generic, Node24.21.0, nvim0.12.5, Chrome for Testing156.0.8078.4 headless shell; c-8 ams3 lifetime3889s cost$0.2700. Prerequisite skips and report-only duration advisories retained in artifact. Reviewer is settling final C1/C2 at unchanged clean head.

### rev-41 · 2026-11-21T19:28:09.309Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261121-2053-final
commit: d2bfc00a281fbf4ab6dd223f52e0565d4167a58b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final review clear atd2bfc00a281fbf4ab6dd223f52e0565d4167a58b/tree6f0fe308672d03bb4bb9981cbab95ed261ba719d. Combines full source1/A-22545 with noncached exact-head configured62d3caed-e593-4ed5-9c58-b094f4dfc31e/A-22563. Standards0/Spec0 findings. Independently streamed structured test finishes: 'red full T3 baseline retains passing files and fences file failure and incomplete files across restart' and '... identity failure and incomplete files across restart' each have1base pass+5load-gate passes. Their assertions prove20passing files measured from the red run, failed/incomplete files unmeasured, no old-only resurrection, and checkpoint reuse after log replacement/restart. Prior-source red in A-22542 retained. C1/C2 verified.

Compact-history positive control '3000 large legacy archives start from bounded summaries and hydrate only by id' passes once; source adds new checkpoint to its payload while retaining byte/startup-hydration budgets. Passing per-file proof does not mark a red aggregate green or confer stage coverage. Existing tier/mask and failed-file fences remain reviewed behavior.

Run scope:T0/allT1/fallback-allT2/selectedT3importers/Web exit0. T3 plan245files/1983observed identities, not all273T3files; remainingT3 belongs to integrated merge-batch occasion, T4 unrequested. Linuxx64 6.8.0-149-generic,Node24.21.0,Neovim0.12.5,dropletc-8ams3 workers2. Browser receipt chromium_headless_shell-1248 chrome-headless-shell/Google Chrome for Testing156.0.8078.4; Web executed. Platform/prerequisite skips include macOS sandbox/caffeinate/selectors, absent OpenCode/zsh; provenance skipReasonCheckreport/missing0. Advisory duration/test-lint/ratchet notices remain report-only. No all-platform/full-T3-stage or timing speedup claim. Reviewer ran no tests, native/browser work or edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T23:08:34.947Z

Merged 75390a00eb445174f5ba39f2828fe6735decacb8 onto dev.
