---
id: T-1582
kind: task
title: Merge batch load gate takes a T1-only batch as its T3 baseline and repeats every T3 test five times
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1585
branch: t/T-1582-merge-batch-load-gate-takes-a-t1-only
created: 2026-11-01T10:39:22.454Z
updated: 2026-11-17T06:44:26.283Z
closed: 2026-11-17T06:44:26.283Z
---

## Summary

A merge batch's load gate repeats five times every T3 identity that is absent from its baseline. `hub/src/hub/suites.ts` `#stageIdentities('batch')` takes as baseline the latest green integrated stage run or merge batch, whichever is newer. After a T1-only batch, the baseline holds no T3 identities. So the first batch after the switch to T1–T3 (config e818d2dc, 2026-11-01 09:01Z) treated all 373 T3 files as new and repeated each one five times: batch a5980026 (T-1581 and T-1549), run 0422c993. It ran past the 75-minute run timeout and the 90-minute lifetime. The Coordinator raised both limits temporarily so this one batch can finish.

## Acceptance criteria

- [x] C1. A batch's load-gate baseline is the latest green receipt that actually ran each tier the batch runs: for T3 identities, a T1-only batch never counts as their baseline, while a green stage cover or T3 batch does (test).
  - done: impl-1582 · 2026-11-17T05:04:28.612Z
  - verified: rev-35 [reviewer] · run rev-35-1582-final-1 · 2026-11-17T05:50:51.079Z · commit 436b18b8439cf85b62f78065ad9a25cd2319e587
- [x] C2. With a newer green T1-only batch and an older green stage cover, a T1–T3 batch repeats only the T3 identities absent from the stage cover (test).
  - done: impl-1582 · 2026-11-17T05:04:29.373Z
  - verified: rev-35 [reviewer] · run rev-35-1582-final-1 · 2026-11-17T05:50:51.079Z · commit 436b18b8439cf85b62f78065ad9a25cd2319e587
- [x] C3. The batch summary line names the baseline run per tier, and the number of identities it repeats.
  - done: impl-1582 · 2026-11-17T05:04:29.911Z
  - verified: rev-35 [reviewer] · run rev-35-1582-final-1 · 2026-11-17T05:50:51.079Z · commit 436b18b8439cf85b62f78065ad9a25cd2319e587

## Comments

### impl-1582 · 2026-11-17T04:42:39.557Z

Rule 20 consumer inventory: loadGateBaseline is produced by Suites admission/backfill and consumed by suite-load-gate-plan, selection JSON/env/file transport, shard selection and persisted job readers. Tests: suite-stage-rules, suite-log-backfill, suite-soak, suite-tiers, suite-landed-load, suite-load-gate-plan and merge-batches. Batch summary is human-facing Agents text from MergeBatches boundary.report; tests parse semicolon fields in merge-batches. Docs: docs/agents/tests.md, docs/hub/running.md and merge skill. No positional/parser client consumes baseline text; retain legacy run/tests fields and older-shape load-plan regression. New optional per-tier runs will be additive.

### impl-1582 · 2026-11-17T04:47:14.668Z

Consumer inventory update after Coordinator guidance: SuiteSelection and shared/wire are unchanged. Per-tier provenance is optional hub-internal SuiteJob.batchBaselineRuns; full job persistence/receipt and pinned batch confirmation retain it, MergeBatches reporting reads it. Existing status/list/client shapes do not require it; older persisted jobs render legacy provenance. The existing old-shape loadGateRepetitions regression remains. Production baseline tests use only fake fixture receipts and isolated storage; no live hub.db accessed. Current origin/dev fetched and merged before first source review (already up to date).

### impl-1582 · 2026-11-17T04:49:28.177Z

Final rule-20 scope: no wire/schema change. Optional internal job provenance is retained by suite persistence and pinned confirmations; status() explicitly projects public fields. Direct hub job/history readers searched: suite-cover, store, dispatch, dev-t3-result, suite-author, verification-wait, shared-defects, suite-history, suites, heartbeat, suite-isolation, merge-batches, soak-quarantine, daemon, executor/droplet/droplet, git-maintenance, cli/suite, cli/startup-diagnostic. Only Suites and MergeBatches consume the new optional field; the others retain existing field access or generic round-trip storage. Fixture/probe readers searched: stage-cover-fixture, release-cover-fixture, plan-stage-fixture, release-support, suite-unit-fixture, measure-memory, measure-history-storage, memory-seal, memory-streaming, startup-diagnostic, startup-replies-scale, startup-deadline-component, startup-ready-component, executor-liveness, host-flush-native, scenarios/droplet-verify. Test readers include suite, suite-persistence, suite-wait-metrics, suite-dry-run, suite-accounting, suite-cover, suite-protocol, suite-release-cache, executor, executor-safety, executor-run, executor-run-rules, git-maintenance-recovery, heartbeat-digest, heartbeat, hub-status-component, shared-defects. Their existing job facts and public shapes are unchanged. Searches across nvim, web, shared/wire, QA briefs and shipped skills found no internal job reader requiring migration. Legacy run/tests baseline test is retained; no native/T3/T4 consumer is selected or run merely for the new optional provenance.

### rev-36 · 2026-11-17T04:57:47.115Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1582-source-1
commit: 7a8a33ffab2cb3b588f7fa454cc556f2ab78da92
scope: full
findings: [{"severity":"medium","text":"Both new callbacks invoke raw fixture(t) before any whole-case owner. suiteUnit only closes resources/submissions; it explicitly delegates joining caller setup/body. Pending file writes, fixture acquisition/reopen and runner continuations can therefore outlive normal/signal teardown and root/store closure. Use the existing shared before-acquisition case owner, capture late roots/resources and join the full sequence before disposal.","file":"hub/test/merge-batches.test.ts","line":1286},{"severity":"medium","text":"Per-tier prior receipts are unioned globally without intersecting current row.files. A file whose old T1 identity appears in the newer T1-only receipt but now belongs to T3 enters the known set through T1 and suppresses current T3 repetitions, despite the selected older T3 baseline lacking it. Filter each prior tier's files against that current tier's planned files (or preserve equivalent tier identity authority) and add a tier-migration fake-receipt regression.","file":"hub/src/hub/suites.ts","line":884},{"severity":"medium","text":"The completed count accepts partial ✖ load gate file::case 3/5 passed lines. Real load-gate.ts can interrupt its repetition loop at81/99 and still print that line at207. This is indistinguishable from complete failures to the current regex, so interrupted work is labelled completed. Consume positive completion/attempt receipts through one shared producer/parser, or report ambiguous legacy counts as unknown; cover partial versus complete failed/quarantined/skipped identities.","file":"hub/src/hub/merge-batches.ts","line":201}]
finding_counts: {"high":0,"medium":3,"low":0}

Standards1medium; Spec2medium, all confirmed by claimant under unchanged corrected pin. A-20632 records full review against20202e0c99d426bc1734788af5250aa1854cf16d, exact7a8a33ffab2cb3b588f7fa454cc556f2ab78da92/tree4637bde60956097b1f9ab6eeaa3f52ebc6b996e1. Standards: raw fixture(t) cases lack whole-case owner before acquisition; suiteUnit t.after only owns resources/submissions, not caller continuations. Spec: prior same-tier files must intersect current row.files before global known-ID union; C1tier-migration false suppression. C3regex counts partial3/5 lines that load-gate.ts81/99/207really emits on interruption; use positive completed-attempt receipt or explicit legacy unknown. Existing nominal2/2+finalfocused3/3 do not cover these gaps. A-20628 preserves original red/green/final-typecheck/lint excerpts and precise precommit/raw/native/tree limits;83/83 predates internal provenance move,10/10 predates old-branch removal. Whole-source0/0refusals and report-only122/59/other advisories retained, no budget/native/browser/fullsuite pass. All52old+current71consumer rows with pinned tiers/dispositions retained; optional internal field/full persistence/status projection and unchanged legacy wire reviewed. No Reviewer runtime/probe/edit/rerun, no merge. Fresh corrected committed-head source request before verification window.

Criteria: C1 failed (Global identity union admits a prior T1 identity for a now-T3 file even when the selected T3 baseline lacks it; no current-tier file intersection.), C2 failed (The new nominal baseline regressions lack a pre-acquisition whole-case setup/body owner, so their FS/reopen/runner sequence can outlive root/store cleanup.), C3 failed (The completed repetition counter accepts real interrupted partial x/5 log lines; current regex cannot distinguish incomplete work from complete failures.).

### impl-1582 · 2026-11-17T05:01:50.851Z

Review correction consumer inventory: no producer format, native helper or wire changes. New exported pure loadGateCompletionSummary in suite-load-gate-plan is consumed only by MergeBatches summary and suite-load-gate-plan.test.ts. Existing load-gate.ts producer stays unchanged; positive success/quarantine totals prove completion, legacy ordinary failed lines are explicitly ambiguous/unknown. Search dispositions and original checks remain in A-20628/A-20632. Coordinator decision 2d5e64f8 approves native-free caseDeadlines(t) before acquisition, collecting fixture hooks and joining setup/body; no native process exists for process-cleanup to own. Tier identity union now intersects current row.files, retaining per-tier authority across file migration.

### rev-35 · 2026-11-17T05:14:39.921Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1582-source-2
commit: 436b18b8439cf85b62f78065ad9a25cd2319e587
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Consolidated full source clear; A-20650. All3 A-20632 mediums resolved: prior same-tier files intersect current row.files before identity union, migration controls preserve current T3 authority; pure shared parser requires positive5/5 success/quarantine and keeps partial/start-only/ambiguous legacy completion unknown; pre-acquisition caseDeadlines owns full fake setup/body and collected cleanup. Coordinator2d5e64f8 explicitly approves native-free T1 owner without process-cleanup import. Nominal older-stage/T3-batch/newer-T1/red-T3, old selection and internal-provenance/pinned-confirmation design retained. Producer text unchanged; docs/skill match unknown/confirmed counts. A-20640 correction red controls then83/83T1+2/2pure, typing/lint0/0refusals remain precommit with raw/tree/native-signal/architecture/advisory limits; A-20628/A-20632 ledger retained. Standards/Spec0 findings; C1-C3 unverified pending exact-head configured evidence. No dev merge, Reviewer runtime or final suite claim.

### rev-35 · 2026-11-17T05:50:51.079Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1582-final-1
commit: 436b18b8439cf85b62f78065ad9a25cd2319e587
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-20666.6e67d41c/A-20663 exit0 matches clean436b18b84 and normalized145f5a57... . Stage/T3-batch baseline cases4466/4471 pass with5/5proof4246/4255, retaining migration/per-tier authority/report assertions; old-shape control4461 pass. Completion parser9199 passes/5/5proof9568 with unknown/skip/deduplication controls.83/83batchT1+2/2plan/parser; no matched changed-file tier diagnostic.6557ordinary/707file plus265load positives; T0/all224T1/all428T2/55Web green,269T3/17T4 unexecuted. Provenance37962 uncachedLinuxx64/Node24.21/Nvim0.12.5, actual browser35395 HeadlessShell1248/CfT156;1391s/$0.0966 provider interval distinct from test wall. Report-only advisories and historical precommit/raw/hash/native/scan limits retained. Standards/Spec0 findings; C1-C3 verified. T1policy proof is not nativeT3 or realbatch/QA proof; no Reviewer runtime/edit.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-17T06:44:26.283Z

Merged 1e4bceff6b8925eaf4b5bc1662af5a837bb80675 onto dev.
