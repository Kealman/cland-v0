---
id: T-470
kind: task
title: "Queue wait as a visible metric: p50 and p90 in verify queue and hub status, with a v0.1.3 target of p90 under 20 minutes"
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by:
  - T-469
topic: topic-361
branch: t/T-470-queue-wait-as-a-visible-metric-p50-and
created: 2026-10-15T09:13:16.188Z
updated: 2026-10-16T08:24:03.576Z
---

## Summary

Retrospective A-2783, START 4: the run spent 6,618 queue-minutes against 3,411 machine-minutes, with a p90 wait of 56 minutes. The wait is shown today only as a summary line. Make it a first-class metric over a rolling window, with the target visible.

## What to build

`cland verify queue` and `hub status` show the wait p50 and p90 over the last 24 hours and the last 50 runs, split local and droplet, against the configured target (`[verification] wait_p90_target = "20m"`). The journal records the window values once an hour as `verification-wait` records, so a retrospective can plot them.

## Acceptance criteria

- [x] C1. `cland verify queue` and `hub status --json` report wait p50 and p90 for 24 h and the last 50 runs, by executor, with the target.
  - done: impl-470 · 2026-10-16T06:27:03.192Z
  - verified: rev-30 [reviewer] · run rev-20261016-470-source · 2026-10-16T06:30:17.108Z · commit 311933f19e64bc56a00f21ee14407f2b4ca6533a
  - verified: rev-30 [reviewer] · run rev-20261016-470-final · 2026-10-16T07:56:27.045Z · commit 311933f19e64bc56a00f21ee14407f2b4ca6533a
  - verified: rev-30 [reviewer] · run rev-20261016-470-merge-final · 2026-10-16T08:13:15.063Z · commit 8b70ec3ebd6781fe4da5c8a80aaed85d99862d30
  - verified: rev-30 [reviewer] · run rev-20261016-470-cover-merge-final · 2026-10-16T08:24:02.631Z · commit 41bf67b23a5dd33358edff92f99b2c41bf90de64
- [x] C2. An hourly `verification-wait` journal record carries the same values, proven by a test with a fake clock.
  - done: impl-470 · 2026-10-16T06:27:03.496Z
  - verified: rev-30 [reviewer] · run rev-20261016-470-final · 2026-10-16T07:56:27.045Z · commit 311933f19e64bc56a00f21ee14407f2b4ca6533a
  - verified: rev-30 [reviewer] · run rev-20261016-470-merge-final · 2026-10-16T08:13:15.063Z · commit 8b70ec3ebd6781fe4da5c8a80aaed85d99862d30
  - verified: rev-30 [reviewer] · run rev-20261016-470-cover-merge-final · 2026-10-16T08:24:02.631Z · commit 41bf67b23a5dd33358edff92f99b2c41bf90de64
- [x] C3. hub/README.md describes the metric and the setting.
  - done: impl-470 · 2026-10-16T06:27:03.854Z
  - verified: rev-30 [reviewer] · run rev-20261016-470-source · 2026-10-16T06:30:17.108Z · commit 311933f19e64bc56a00f21ee14407f2b4ca6533a
  - verified: rev-30 [reviewer] · run rev-20261016-470-final · 2026-10-16T07:56:27.045Z · commit 311933f19e64bc56a00f21ee14407f2b4ca6533a
  - verified: rev-30 [reviewer] · run rev-20261016-470-merge-final · 2026-10-16T08:13:15.063Z · commit 8b70ec3ebd6781fe4da5c8a80aaed85d99862d30
  - verified: rev-30 [reviewer] · run rev-20261016-470-cover-merge-final · 2026-10-16T08:24:02.631Z · commit 41bf67b23a5dd33358edff92f99b2c41bf90de64

## Comments

### impl-470 · 2026-10-16T06:16:29.569Z

Plan: keep dispatch unchanged; add a dedicated metrics module with thin Suites snapshot/hourly hooks, config/CLI/docs wiring. Awaiting seam confirmation through the item lead and T-488 slot-done before any targeted local run. Durable queued/admitted/finished timestamps will prevent recovery time from shifting wait windows.

### rev-30 · 2026-10-16T06:30:17.108Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-470-source
commit: 311933f19e64bc56a00f21ee14407f2b4ca6533a
scope: full

# T-470 source review clear

Reviewed pushed head `311933f19e64bc56a00f21ee14407f2b4ca6533a` on `t/T-470-queue-wait-as-a-visible-metric-p50-and`. Fixed point/pre-review dev `4dc49979ee387541a360ca4e8661be7170c86b8e`; captured `git diff 4dc49979...HEAD` and commits dd7d6216 implementation /311933f1 pre-review merge. Origin and local head agree. task.view confirms claimant and C1–C3. Direct read-only Standards/Spec review; no Reviewer tests, compiler execution or subagents.

## Standards

0 high, 0 medium, 0 low findings. Eleven-file scope is cohesive: a dedicated 55-line metrics/checkpoint module, thin Suites constructor/tick/snapshot hooks, additive protocol field, config/daemon plumbing, existing queue CLI/journal seams, two test files/shard registration and README. dispatch.ts is unchanged; hub status already exposes the Suites snapshot. Existing last-20 wait/run metrics and ETA calculation are retained.

The helper reads durable job facts without mutating jobs or reusing recovery-derived runMs. Journal emission is registered in JOURNALLED and follows the existing tapped-log queue. Protocol queueWait remains optional for older producers/consumers. Existing suite-queue assertion retains its complete legacy-metrics expectation while separately asserting the additive field. No documented-standard breach or Fowler-baseline finding. Whitespace check clean.

## Spec

C1 and C3 source verified. The aggregation produces separate local/droplet 24-hour and last-50-completed-request windows with target, sample count, cache count, median p50 and nearest-rank p90; empty percentiles are null. Config defaults to 20m, validates positive duration strings through the existing duration parser, renders the setting, and passes it through daemon verification options. CLI text/JSON and hub status JSON use the same queue snapshot. README documents shape, windows, percentile convention, exclusions, target and journal cadence.

Primary Coordinator f8b97362 requires queued-to-admitted wait, effective-executor fallback attribution and durable recovery timestamps. Primary ee9caa53 requires cache exclusion from percentiles with separate cache counts. Claimant's explicit per-executor latest-50-completed-request policy (cf97aa1e) keeps cache requests inside the 50-request limit. The code matches these decisions. Never-admitted/invalid timing records yield no wait samples; parent shard jobs are excluded. Wait is derived directly from queued/admitted timestamps, rejecting non-finite, negative or admission-after-finish intervals. Failed executed runs can contribute legitimate waits. Completion windows prefer durable finished; cache requests instead use their own completedAt so borrowed source finish does not age a new hit incorrectly. Future completions are excluded.

C2 implementation follows the actual scheduler interval: VerificationWait records at the first tick in each UTC hour, snapshots the same metric object, and stores the last hour in Store metadata. It does not invent samples for downtime. Same-hour restart suppresses duplicate log calls. This uses the journal's existing asynchronous best-effort log contract; no crash-atomic exactly-once delivery guarantee beyond that existing contract is claimed.

## Evidence

A-3788 is the durable claimant evidence note, not a separate raw-log bundle. It reports suite-wait-metrics5/5, existing suite-queue5/5, root typecheck and shard lint green on the final merged head, with serial guarded local work after T-488 slot release. I reviewed all committed test assertions:
- Aggregation cases cover executor split, effective local fallback, old durable finish versus late recovery, cache exclusion/counting, invalid/unadmitted/future records and child shards.
- 60 local requests establish independent last50 and 24h percentiles, plus remote/empty/cache-source-age cases.
- The fake-clock case drives a real Suites interval and real Store/Journal: first-hour output, no within-hour duplicates, next-hour expiration, reopening Store for same-hour restart deduplication, and flushed JSONL equality with snapshots. It tests ordinary restart, not abrupt-crash atomicity.
- Config round-trip/invalid target checks and real CLI queue + hub status JSON/text exercise output/config wiring.
- Existing queue lifecycle/cache regression preserves legacy metrics and separately observes two executed samples and21 hits.

Source clear verifies C1/C3. C2's final runtime verification and the overall final verdict remain pending a fresh exact-head diff-selected droplet gate, including new-test repetitions. No full local suite requested. No per-item QA (none/after-stage). Any changed head needs delta review before another verification run.

Findings: Standards0; Spec0.

Artifact A-3789 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3789-t-470-source-clear-durable-queue-wait-windows-and-hourly-journal-wiring.md

Criteria: C1 verified, C3 verified.

### rev-30 · 2026-10-16T07:00:36.450Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-470-linux-first
commit: 311933f19e64bc56a00f21ee14407f2b4ca6533a
scope: evidence

# T-470 first Linux evidence not clear

Run **0b939cc1-03d3-4577-b069-23dcd72e18f3 / A-3815** at unchanged source-reviewed `311933f19e64bc56a00f21ee14407f2b4ca6533a`. Actual c-8 lon1 Linuxx64, four workers, Node24.21.0/Neovim0.12.5. Full selection due config import/README coverage path; exits1 before Neovim.1914pass/2fail/5skip,1921tests. Suite1666.32s, peak15.37, load-gate extra37.72s. Lifetime/cost unknown. No Reviewer execution.

## Standards

No new source finding. A-3789 source clearance C1/C3 stands at this head.

## Spec and owned evidence

All five suite-wait-metrics cases have positive ordinary timings and **5/5 load repetitions each (25/25)**. In particular, the real Suites/Store/Journal fake-clock C2 case passes ordinarily (0.1282s) and5/5. Config/CLI/status case passes ordinarily1.0788s and5/5. Owned evidence is retained; this receipt does not demonstrate a T-470 assertion failure.

## Gate blockers requiring lead classification

1. `hub/test/roles.test.ts:181`: role launch after editing roles.toml returns `claude-fable-5-1`, expected `claude-fake-edited`.
2. `hub/test/task-worktrees.test.ts:379`: resumed snapshot observation count3, expected2 (`both the initial snapshot and the post-I/O snapshot must run`).
3. Hard new-test duration budgets: `demo stop refuses a persistent tags mismatch and clears attention after a later404` **5.372s>5s**, and `the detached demo watchdog confirms an active droplet losing tags during its delete` **5.562s>5s**, both in demo-release.test.ts (T-572-owned cases).

These files are outside the task diff, but that fact alone is not a known-defect classification or waiver. Report ordinary signatures as Bugs/S candidates to lead T-470 for deduplication/Coordinator disposition; route duration allowance classification through the shared-fix owner. Do not create branch-local fixes, raise unrelated allowances, retry unchanged, or accept an exception without that disposition. Claimed existing T-470 implementation remains unchanged; claimant9f04fb30 confirms escalation and no retry/head change.

Final evidence verdict **not clear**. No criterion is failed solely for outside-diff reds: C1/C3 remain source verified, C2 and final settlement pending an admissible overall gate. Neovim was not reached and is not claimed green. No new high/medium/low source findings; unresolved evidence blockers are listed explicitly.

Findings: Standards0; Spec0 source findings; four outside-diff gate failures pending classification.

Artifact A-3816 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3816-t-470-linux-gate-not-clear-own-five-cases-green-other-failures-need-classificati.md

### impl-470 · 2026-10-16T07:01:30.316Z

Coordinator classified first receipt's outside-diff reds as known flakes T-580/T-581; Mac dev file checks passed roles8/8 and task-worktrees9/9. Demo-release hard budgets covered by shared allowance ac20175b. Exactly one fresh resubmit authorized at unchanged 311933f1, with no cherry-pick, after Coordinator announces the hub restart. Holding until that event.

### rev-30 · 2026-10-16T07:52:41.758Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-470-linux-second
commit: 311933f19e64bc56a00f21ee14407f2b4ca6533a
scope: evidence

# T-470 second Linux receipt not clear pending classification

Authorized unchanged-head retry **0d25c7a0-3480-487f-abbd-71d57648d7cf / A-3842** at `311933f19e64bc56a00f21ee14407f2b4ca6533a`, actual Linuxx64 c-8 lon1/four workers/Node24.21.0/Neovim0.12.5. Exit1:1921tests,1915pass,1fail,5skip; full selection stops after hub and **does not reach Neovim**.1590.95s, peak17.39, extra load-gate35.04s; lifetime/cost unknown.

## Standards

No new source finding; A-3789 C1/C3 source verification stands.

## Spec / owned evidence

Independent raw audit again finds all five suite-wait-metrics cases passing ordinary and **5/5 each (25/25)**, including the real Journal fake-clock C2 case. Two exact-head receipts now provide50/50 owned load repetitions. No owned failure, hard duration-budget failure, roles red or task-worktrees red in this second receipt. These facts retain task evidence; they do not independently waive an unknown outside-diff failure.

Sole ordinary red: **hub/test/tracker-levels.test.ts:87**, `close rechecks a child reopened during the parent temporary write before rename`: actual **true**, expected **false**. The case is outside this diff. Claimant has reported it as a Bugs/S shared-defect candidate, correctly leaving classification to the lead/Coordinator. No precise defect classification is established in the evidence currently supplied.

Primary b2595997 explicitly classified the first run's T-580/T-581 signatures and known demo-release budgets and authorized exactly this retry after restart. It did not yet classify the new tracker-levels signature or authorize a third run/final exception. The retry was submitted after the reported hold-lifted event at the same head, with no picks or dev merge.

Evidence verdict **not clear** pending lead classification and admissible gate disposition. No criterion is failed solely for this outside-diff assertion; C2/final verification remains pending, and no Neovim success is claimed. Do not diagnose/edit the unrelated tracker code on this branch, pick an unposted fix or submit another unchanged retry absent Coordinator direction.

Findings: Standards0; Spec0 source findings; one unclassified outside-diff gate blocker. No Reviewer execution.

Artifact A-3843 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3843-t-470-second-linux-receipt-not-clear-owned-proof-green-tracker-close-red-unclass.md

### rev-30 · 2026-10-16T07:56:27.045Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-470-final
commit: 311933f19e64bc56a00f21ee14407f2b4ca6533a
scope: evidence

# T-470 final evidence review clear under Coordinator gate disposition

Reviewed unchanged pushed head `311933f19e64bc56a00f21ee14407f2b4ca6533a`, branch `t/T-470-queue-wait-as-a-visible-metric-p50-and`; local/origin agree, no source/pick/dev-merge changes. task.view confirms claimant, C1/C3 current source clearance and C2 done. Final evidence settlement follows A-3789 source and A-3816/A-3843 receipt audits.

## Standards

No high, medium or low source findings (0/0/0). Dedicated durable-fact aggregation, thin scheduler hooks, additive config/protocol/CLI/status/journal wiring and README remain as source-reviewed. No failed task criterion is concealed by an unrelated test edit or invented successful suite.

## Spec / owned runtime evidence

All C1–C3 verified. Both exact-head actual Linux droplet receipts independently run all five owned suite-wait-metrics cases successfully ordinarily and **5/5 load repetitions each**, yielding **50/50 owned repetitions** across the pair. The real Suites/Store/Journal fake-clock C2 test passes ordinarily and five repeats in each receipt; its journal values equal queue snapshots, hourly boundaries age the sample correctly, and ordinary same-hour restart suppresses duplicate emission. CLI/status/config cases likewise pass. Existing asynchronous journal contract limitations remain as described in A-3789; no new crash-atomic guarantee is claimed.

First **0b939cc1 / A-3815**:1914pass/2fail/5skip, exit1, roles model refresh and task-worktrees snapshot count reds plus two demo-release duration budgets. Primary **b2595997-e2ce-44e5-b6f9-b8aa85cce2a1** classifies T-580/T-581 and the shared allowance ac20175b, authorizing one unchanged retry after restart.

Second **0d25c7a0 / A-3842**:1915pass/1fail/5skip, exit1, sole tracker-levels:87 close-recheck true-versus-false red; no first-run reds or hard budgets. Primary **d5f7f82d-2969-4b78-bf04-f5abeefcf342** explicitly classifies this as another outside-diff load flake after3/3 isolated dev Mac passes and a filed follow-up of T-466. That same decision accepts the pair as the **E-482 hub-phase gate**, with different all-known outside reds and owned cases green. The earlier not-clear evidence dispositions are superseded by this primary classification/acceptance; they are not relabeled green runs.

## Neovim limitation and final disposition

Both requested mode-full runs stop before Neovim. **No Neovim task receipt exists or is claimed.** Primary d5f7f82d expressly accepts the same T-546/T-488 exception: the **next integrated dev cover must supply Neovim before any restart on T-470 code**; no further task run is authorized. Carry that Coordinator-owned condition forward with this final verdict.

Both receipts are actual Linuxx64 c-8 lon1/four workers/Node24.21.0/Neovim pin0.12.5. First suite1666.32s peak15.37; second1590.95s peak17.39. Lifetime/cost unknown. Raw artifacts preserve every red and missing phase. No real provider activity by Reviewer.

Final evidence review **clear under the explicit gate disposition**; refresh **C1/C2/C3** at311933f1. No additional run or branch-local unrelated fix. Any changed head needs delta review; no per-item QA (none/after-stage). The integrated-Neovim-before-restart condition remains required.

Findings: Standards0; Spec0 source findings. Accepted outside-diff gate failures and missing Neovim phase are disclosed above.

Artifact A-3844 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3844-t-470-final-clear-accepted-hub-receipt-pair-integrated-neovim-required-before-re.md

Criteria: C1 verified, C2 verified, C3 verified.

### rev-30 · 2026-10-16T08:13:15.063Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-470-merge-final
commit: 8b70ec3ebd6781fe4da5c8a80aaed85d99862d30
scope: delta

# T-470 merge delta review clear

Reviewed pushed head `8b70ec3ebd6781fe4da5c8a80aaed85d99862d30` on `t/T-470-queue-wait-as-a-visible-metric-p50-and`; both local and origin refs agree. Parents are previously reviewed/final-cleared `311933f19e64bc56a00f21ee14407f2b4ca6533a` and freshly fetched dev `8f145c82`. Took hold and read current claimant/criteria once. Read-only review; no Reviewer tests, compiler, edits or provider calls.

Primary Coordinator **23bcb758-ee55-45ad-8a88-d94da8ecd945**, independently read in topic history, requires this actual conflict merge, preservation of T-488 loaded-config/capture and T-491 retries, identifier-selected whole-file serial Mac proof below load10, and explicitly waives a new droplet run if proof/review clear. The prior integrated-Neovim-before-restart condition remains.

## Standards

Zero high, medium or low findings. Read combined merge diff, first-parent changes and resulting task delta against the dev parent. Daemon retains `projectConfig: roles.config` plus wait target fallback wiring. Suites retains dev's project-config capture, queued-following publication, worker policy and admission behavior; the only additions against that version are the wait-metrics hooks/type/field. Executor and hub lock source are byte-identical to dev, preserving T-491. No task-local unrelated fix or allowance change is hidden in resolution. Whitespace diff check passes.

The mutable target stays inside the existing VerificationWait owner with a narrow configure setter. ProjectConfiguration adds the applied-field name and keeps validation/stamps/last-good pair publication unchanged. No disk-config read is introduced into metrics.

## Spec

Refresh C1–C3 at this head under the explicit preserved-receipt/no-new-droplet disposition. Constructor reads the loaded ProjectConfiguration snapshot; successful reload's synchronous publication reaches Dispatcher.configure → Suites.configure → VerificationWait.configure. Config-only disk edits leave the target unchanged, and invalid reload fails before apply, retaining the last good target. Both snapshot reporting and hourly journal recording read the same updated target. Hour checkpoint, percentiles/windows, executor attribution and existing metrics are unchanged from accepted A-3789/A-3844.

The existing real CLI/status regression gains assertions for 15m initially, unchanged before reload, 5m after successful reload and retained 5m after invalid 0m reload. Existing assertions remain. Claimant reports the pre-fix 900000-versus300000 red; corrected committed assertions and raw green whole-file receipt independently establish the after behavior. README now explains loaded snapshot/reload/invalid retention.

## Evidence audit

**A-3850** durable directory contains results.json, search-map.json and all23 copied raw whole-file logs. Independently parsed every raw log: **247 tests/pass, 0 fail/cancel/skip**, each results summary matches the raw suffix, every reported exit0. Mandatory metrics/queue/config-reload/daemon/remote-budget files are present (5/5,5/5,4/4,18/18,16/16). The real fake-clock hourly test remains green in the metrics whole file.

Independently searched committed hub/test and nvim/test contents with the recorded semantic pattern:27 matching paths, whose test-file subset plus five mandatory files exactly equals the23 executed files; no missing matching test or Nvim match. Helpers/manifests/runners are not misrepresented as standalone tests. Files are suite-wait-metrics, suite-queue, config-reload, daemon, suite-remote-budget, account-fixture-isolation, config-reload-remote, demo, events-quiet, events, executor-droplet, executor-prepare, executor-safety, inbox-workload, journal-async, orphan-servers, planned-stage, rule-cli, session-async-processes, task-card, territory-lock, tracker-ready and verification-workers.

Results record per-file admission loads **1.8276–5.4893 (<10)**. Lead reports whole-file serial execution and no matching test PIDs before each; the bundle preserves loads and outputs, not a separate PID transcript. Root typecheck/shard lint reported green; Reviewer does not execute them. No new full local suite or droplet receipt is claimed.

Prior exact-head Linux A-3815/A-3842 and explicit final gate acceptance A-3844 remain historical evidence, carried across this authorized merge only by Coordinator23bcb758. They are not relabeled as fresh Linux evidence at8b70ec3e. **Neovim still requires the next integrated dev cover before restart on T-470 code**, per primary d5f7f82d and23bcb758. No new task droplet run required. Current E-468 freeze/merge ordering stays with Coordinator; this verdict does not authorize a restart.

Final merge delta **clear**, C1/C2/C3 refreshed. No per-item QA. Standards findings0; Spec findings0; no high/medium/low findings.

Artifact A-3852 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3852-t-470-merge-delta-clear-loaded-config-publication-and-247-whole-file-passes.md

Criteria: C1 verified, C2 verified, C3 verified.

### rev-30 · 2026-10-16T08:24:02.631Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-470-cover-merge-final
commit: 41bf67b23a5dd33358edff92f99b2c41bf90de64
scope: delta

# T-470 second merge delta final clear

Reviewed pushed `41bf67b23a5dd33358edff92f99b2c41bf90de64`, branch `t/T-470-queue-wait-as-a-visible-metric-p50-and`; local/origin refs agree. Parents previous clear8b70ec3ebd6781fe4da5c8a80aaed85d99862d30 and dev544527784826e12803b6b0111b53025faa7c211a. Hold/current claimant/C1–C3 checked once. Prior final A-3844 and first merge A-3852 apply.

Primary Coordinator **dc9ae9af-24ae-4dd7-acf7-1e3593e4f28f**, independently read, requires this additional real-conflict merge with T-479 cover records, preservation of both hook sets, newly resolved identifier selection plus suite-cover/earlier mandatory five files. Primary **ab650496-c29d-4485-910b-9438c28a59bf** authorizes slot B, serial files with load<10/local suite slot free and exclusion only of T-584 cwd. Earlier23bcb758 preserved-receipt/no-new-droplet direction remains in force; no further task run requested.

## Standards

Zero high/medium/low findings. Combined merge hunks are actual unions:
- suites.ts retains VerificationWait and classifyCover/deriveCover/recentCovers imports;
- journal whitelist retains both verification-wait and verification-cover-classified;
- README retains both complete wait-metrics/loaded-config and cover-record/classification sections.
Read resulting diff against dev: all auto-merged cover fields/classification/persistence/recent-cover hooks remain as dev, with only the previously reviewed wait additions. Cover source/test and dispatch source are byte-identical to dev. No dropped behavior or invented manual rewrite.

VerificationWait module, metric tests, loaded-config configuration/daemon/init code are byte-identical to previous clear8b70ec3e, retaining initial snapshot selection and configure publication/invalid-reload retention. Prior T-491 executor/lock behavior is inherited; no task-local change. Whitespace diff check clean.

## Spec / exact merge-head receipts

Refresh **all C1–C3**. **A-3869** contains semantic search map, results with per-admission guard observations and nine copied whole-file raw Mac logs. Independent committed-content search across hub/test+nvim/test exactly reproduces five identifier-match files; their union with six mandatory files equals the nine executed files, no omitted match/Nvim file.

Independently parsed raw logs: **83tests/83pass/0fail/0cancel/0skip**, all summaries match raw suffix, every exit0:
suite-wait-metrics5,suite-queue5,config-reload4,daemon18,suite-remote-budget16,suite-cover9,planned-stage11,stage-qa12,suite-stage-cover3. Fake-clock hourly Journal and loaded-config CLI target regression remain green; cover tests exercise persisted/classified records, permissions and restart alongside them. No new-test repetition run is claimed for these unchanged tests.

Results record admission load2.3403–3.9893<10, local holder null, processes[] at every file start; claimant reports serial slot-B execution with unchanged tree. Typecheck/shard lint reported green; Reviewer only reads/parses, runs no tests/compiler/process probes.

## Carried gate and rollout limit

Old actual Linux A-3815/A-3842 and explicit acceptance A-3844 remain historical evidence carried by Coordinator's merge/no-new-droplet directions, not fresh execution at41bf67b2. Both prior task runs stopped before Neovim. **Next integrated dev cover must supply Neovim before any hub restart on T-470 code.** This condition is neither removed nor satisfied by the Mac selection.

Final merge delta **clear**, C1/C2/C3 refreshed, no new droplet run. Current Coordinator hub-code merge/restart hold and release ordering remain Coordinator-owned; verdict is not merge/restart authorization. No per-item QA. Findings: Standards0; Spec0.

Artifact A-3870 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3870-t-470-cover-merge-delta-clear-both-hook-sets-preserved-83-whole-file-passes.md

Criteria: C1 verified, C2 verified, C3 verified.
