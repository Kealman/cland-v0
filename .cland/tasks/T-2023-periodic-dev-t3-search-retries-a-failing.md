---
id: T-2023
kind: task
title: Periodic dev T3 search retries a failing tip probe every few seconds forever, leaving an empty run directory each time (~39,000 a day)
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1805
branch: t/T-2023-periodic-dev-t3-search-retries-a-failing
created: 2026-11-20T01:11:20.200Z
updated: 2026-11-27T09:45:26.806Z
closed: 2026-11-27T09:45:26.806Z
---

## Summary

Since about 2026-11-16, periodic dev T3 search eab7b75d has retried its tip-revalidation probe about every 4 seconds, and every attempt leaves an empty run directory in `.cland/run/suites`. That's roughly 39,000 a day, about 110,000 entries in all, and a likely cause of the repeated fseventsd load. The probe fails with `Error: dirty worktree cannot be bundled for droplet` (the blocked notice of 2026-11-16 22:33Z).
- `DevT3Search` ticks every 1,000 ms (`dev-t3-search.ts:45`). Its tip-revalidation branch (`:81`) awaits `boundary.probe` with no try/catch, whereas the history branch (`:110`) has one and marks the file inconclusive. So the search stays unreported, and every tick clones the `dev-t3-…` checkout again and retries.
- `Suites.#start` writes `suite.log` (`suites.ts:767–768`, directory from `:649`) before several later throws: dirty worktree, a non-capacity spend error, head changed, hub closing. No throw removes the directory.
- The blocked notice is deduplicated by run id, so it reached the Coordinator once and the loop stayed invisible. hub.log has no line per attempt.
Found by cland-impl's suites-growth census on 2026-11-20 (the samples are in its T-1998 comment).

## What to build

- The tip-revalidation probe failure ends the search as inconclusive, or backs off with a cap, the same way the history branch does. It never retries every second indefinitely.
- A suite submission that throws before admission removes its run directory, or writes the log only after the last refusal point.
- Find why the dev-t3 checkout is dirty at clone time, and fix that at its owner.
- The blocked state stays visible: the heartbeat shows a blocked dev T3 search with its age and attempt count.

## Acceptance criteria

- [x] C1. A tip-revalidation probe that throws ends or backs off the search, with a bounded number of attempts and a visible blocked state (test).
  - done: impl-2023 · 2026-11-27T08:21:34.851Z
  - verified: rev-35 [reviewer] · run rev-35-2023-evidence-1 · 2026-11-27T09:14:01.477Z · commit ab19a5b320c48d7a39ac396de5f28782d88fcfbc
- [x] C2. A suite submission refused after the log is written leaves no run directory behind (test).
  - done: impl-2023 · 2026-11-27T08:10:25.501Z
  - verified: rev-35 [reviewer] · run rev-35-2023-evidence-1 · 2026-11-27T09:14:01.477Z · commit ab19a5b320c48d7a39ac396de5f28782d88fcfbc
- [x] C3. The cause of the dirty dev-t3 checkout is named and fixed, shown by a probe that bundles cleanly at a fresh dev tip (test).
  - done: impl-2023 · 2026-11-27T07:39:46.166Z
  - verified: rev-35 [reviewer] · run rev-35-2023-evidence-1 · 2026-11-27T09:14:01.477Z · commit ab19a5b320c48d7a39ac396de5f28782d88fcfbc

## Comments

### human · 2026-11-20T01:12:13.799Z

Source answers by cland-impl (running hub code 5e3a2005c; nothing changed, cancelled or removed). (1) Stopping the search without code: the source has no supported way. DevT3Search keeps its list in the store meta 'dev-t3-searches' and exposes only accept, start, tick and close (hub/src/hub/dev-t3-search.ts:38-59, 159). A search ends only when #advance reaches boundary.report and sets reported (:145-146), which needs a tip receipt for each candidate file. There is no CLI or tool that cancels a search or marks a file inconclusive, and dispatch.ts wires no config hook into it: the reload receipt's applied keys (hub/src/hub/configuration.ts:239) concern verification commands and the executor, and dev_t3_every only decides when new periodic runs start, not the ticks of an accepted search. The timer starts once at hub start (dispatch.ts:403) and the list is durable, so a restart on the same code resumes the loop. Ways out are a code fix that the hub then loads (try/catch or a terminal inconclusive on the :81 branch), or the probe succeeding. (2) Why the checkout is dirty: the probe checkout is a separate clone, not a linked worktree (dev-t3-probe.ts: git clone --shared --no-checkout, then checkout --detach), and its checkout() ends with prepareBatchDependencies, which symlinks <checkout>/node_modules to the root's node_modules (hub/src/host/agent/worktree-install.ts:13-15). candidateTree returns null when git status --porcelain=v1 --untracked-files=all over the candidate pathspec prints anything (hub/src/verification-tree.ts:30), and null becomes 'dirty worktree cannot be bundled for droplet' (suites.ts:737/789). In this repository the symlink is ignored only by .git/info/exclude line 20 ('/node_modules'): .gitignore has 'node_modules/', whose trailing slash matches directories and not a symlink. Checked on a linked worktree that has the same symlink: git check-ignore -v node_modules names .git/info/exclude:20 as the only matching rule. Linked worktrees share the root's info/exclude, so merge batches pass; a clone gets its own empty info/exclude, so the symlink shows as untracked '?? node_modules' and every probe submission is refused. I derived this from source plus that one check-ignore; I did not run git status inside the live probe checkout. Fix candidates: add the exclude to the clone's own info/exclude (or use a linked worktree), or ignore 'node_modules' without the trailing slash in .gitignore. The tasks/RULES exclusion is not the cause: both paths are already excluded from the pathspec.

### coord · 2026-11-20T03:09:39.234Z

2026-11-20 03:09Z: T-2024 landed (488bfb016), and the next probe at the dev tip bundled cleanly. Search eab7b75d then completed: `hub-priority.test.ts` is "already fixed on dev at 5307ed43c" (green reruns 8865ce0d at 488bfb0 and 7a30c464 at 5307ed4, logs A-22059/A-22060), and the loop ended. This item still covers the code fix: no unbounded retry on a tip probe failure, and no leaked run directory on a refused submission. About 122k empty directories from the loop remain in `.cland/run/suites`.

### impl-2023 · 2026-11-27T07:34:44.091Z

Consumer inventory: DevT3Search checkpoints are read by the search owner and dev-t3-search tests; dispatch constructs SearchBoundary; dev-t3-report consumes SearchReport; heartbeat will read an exported blocked-search projection. ProbeReceipt/wire shape unchanged. Suites.start callers (dispatch, dev-t3-probe, merge-batch verifier, suite self-rerun) keep existing admission shape; cleanup applies only before an indexed job owns the generated directory. C3 root cause/fix already landed in T-2024 (.gitignore ignores dependency symlink); retaining fresh-probe coverage.

### impl-2023 · 2026-11-27T07:40:11.434Z

Contract search completed across hub/src, all hub/test (T1–T4), nvim/test, docs, QA briefs and skills for dev-t3-searches, SearchReport, SearchBoundary, dev-t3-search-error and verification-dev-t3-search. Readers: dev-t3-search owner/checkpoint tests (optional additive attempts/blocked; existing pre-tip checkpoint regressions retained), dispatch boundary (signature unchanged), dev-t3-report (reason/result unchanged; additive metadata only), dev-t3-search-component, suite-cover, suite-soak-component and suite-soak tests (existing event/result consumers unchanged), file test guide. Heartbeat uses the new blocked-only projection rather than scanning historical receipts. Suite admission reply and persisted SuiteJob shapes unchanged. Legacy directory cleanup remains T-2117; unknown roots unchanged.

### rev-35 · 2026-11-27T07:47:29.563Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2023-source-1
commit: d3873f4db4701deabc5d243387326f4f983675c9
scope: full
findings: [{"severity":"medium","text":"M1: blocked projection appends every terminal file/reason without row/byte/field limits; every heartbeat parses/iterates its entire retained history before display slicing. Add bounded projection/accurate aggregate or omitted facts and work/byte proof; keep history off liveness (rule23).","file":"hub/src/hub/dev-t3-search.ts","line":99},{"severity":"medium","text":"M2: root TestContext t.mock override is not retained by suiteCase through a timed-out/aborted original start/cleanup continuation. Own fake/restoration until positive join and prove the held late path cannot reach the restored boundary (rules12/38).","file":"hub/test/dev-t3-search.test.ts","line":51},{"severity":"medium","text":"M3: finally equates #jobs membership with admitted ownership, but push941 precedes #save transaction commit. Rollback leaves an uncommitted job/root; distinguish committed receipt from pre-commit failure, roll back uncommitted state, and test rollback vs post-commit observer failure (C2/rules25–26).","file":"hub/src/hub/suites.ts","line":960}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear; A-23758 consolidates three medium confirmed findings and correction controls. Preserve terminal per-file checkpoint-before-notification, bounded attempts, original refusal/secondary cleanup diagnostics, guarded late work and all existing assertions. C3 historical cause/fix remains positive: T-2024 merged/verified, current ignore+native-clone control retained; Coordinator Nov20 comment and independently read A-22059/A-22060 support fresh-tip bundling at their own historical heads, not a current run. C1/C2 failed; C3 remains unverified pending corrected-head evidence. A-23755 local red/check counts remain authored scope;733/19 graph diagnostic is not execution coverage. Legacy roots remain T-2117. Hold released for consolidated corrections/authorized checks; fresh source review before configured submission. No Reviewer edits or runs.

Criteria: C1 failed (M1: new blocked heartbeat projection needs bounded row/byte/field storage and liveness work with accurate aggregate visibility.), C2 failed (M2/M3: retain refusal-test seams through owned closure; gate root ownership on positive durable commit and roll back failed in-memory admission.).

### impl-2023 · 2026-11-27T07:56:26.288Z

Review correction inventory: new dev-t3-blocked-searches summary changes from the unreleased append-only array to versioned bounded {rows,omitted}; only search producer and heartbeat consumer use it. Legacy/oversized/invalid shape returns unknown, without reconstructing retained history. Store.metaPage is reused unchanged for one 16KiB SQLite-clipped page. SearchReport/ProbeReceipt/wire event shapes unchanged beyond prior optional fields. #save's new private commit callback is passed only at initial admission; every existing #save caller retains its interface. Pre-commit cleanup also removes order/baseline-cache identity. Abort control belongs to existing T2 case-deadlines (direct cleanup API), while T1 dev-t3-search retains pure/fake cases; no tier manifest changes. Current focused results: T1 dev-t3-search 25; T2 case-deadlines 22; other importer counts unchanged 2/19/7/6/44.

### rev-35 · 2026-11-27T08:03:14.614Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2023-source-2
commit: 18bb3539079df93622d46d0ff1f14630cd432f08
scope: delta
findings: [{"severity":"medium","text":"M1-R: bounded projection's shown rows still become global Stale(N)/returned stale, propagated to core notice/log counts:40 blocked yields10, unknown legacy yields0. Preserve complete known totals or explicit unknown/lower-bound facts through all consumers without historical scans (rule17/A-23758).","file":"hub/src/hub/heartbeat.ts","line":14},{"severity":"medium","text":"M2-R: complete post-release rejection/disposal/restoration proof uses bare awaits; ownership/cleanup watchdog is not a named receipt observation. New control/refusal setup/action waits also inherit unscaled literal5s. Add named shared load-scaled observations retaining original producers and all current owners/assertions (rule9).","file":"hub/test/case-deadlines.test.ts","line":71}]
finding_counts: {"high":0,"medium":2,"low":0}

Correction source not clear; A-23760 consolidates remaining two medium findings, confirmed82a3c6cc. Positive resolutions retained: M1 row/field/16KiB SQL ingress bounds and populated/legacy controls; M2 owned patches through late work/resource closure and explicit T2 classification; M3 transaction-success receipt/rollback plus committed-observer controls. Keep these implementations/assertions. C1/C2 failed only for remaining aggregate/completeness and proof-observation gaps. C3 historical proof remains positive/unverified at changed head; local A-23759 checks remain authored selected scope, not configured execution. Hold released for consolidated corrections/authorized checks; fresh committed-head review before verify. No Reviewer edits or runs.

Criteria: C1 failed (M1-R: heartbeat aggregate counts must include known omissions or explicitly represent unknown completeness across text/detail/log consumers.), C2 failed (M2-R: bound complete post-release proof and new real async setup/action observations with shared load-scaled retained waits.).

### impl-2023 · 2026-11-27T08:08:39.774Z

M1-R/M2-R consumer inventory before review: heartbeatDigest's production consumer is core.ts firing; core notice detail and event-announced log now spread the same bounded aggregate facts and use its count label. Numeric stale remains present; staleComplete=false explicitly makes it a lower bound. All heartbeatDigest importers searched (heartbeat/digest, suite-retention-scheduler, suite-persistence and dev-t3-search tests); generic Message.detail clients in web/nvim have no numeric stale reader and remain compatible with old notices without the additive field. Extended 40-file/legacy tests assert aggregate/completeness, plus actual notice/log receipts. stageCase's optional waitMs callback is supplied only in dev-t3-search retainedRefusalCase, the new case-deadlines abort owners and new heartbeat tests; existing default 5000 and explicit timeout arguments remain unchanged. Full direct-importer list will be in correction evidence. Complete refusal proof and post-release proof are separately named retained observations with per-operation shared load headroom. Legacy roots stay T-2117.

### rev-35 · 2026-11-27T08:14:46.005Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2023-source-3
commit: 16716a366ac112cc62095bb7daea0c9ec5922eee
scope: delta
findings: [{"severity":"medium","text":"M4: new aggregate cases use fixture(owner.fixtures), whose closer registers after Tracker/Crew startup and is ancillary with no required-close receipts. Partial startup or rejected resource close can bypass positive root/guard fencing. Enroll partial resource owners before acquisition and prove guarded retention/repair independently (rules12/38/42).","file":"hub/test/heartbeat.test.ts","line":118}]
finding_counts: {"high":0,"medium":1,"low":0}

Correction audit not clear; A-23762 consolidates sole remaining M4, confirmed596afbc6. M1-R totals/completeness and M2-R named retained/load-scaled observations are resolved; one aggregate reaches text/metadata/log,46 importer census matches, opt-in defaults preserve previous callers. Prior bounded SQL/fields/rows, owned refusal seams and M3 commit/rollback distinction remain positive. New heartbeat fixture switch avoids a cycle only on normal cleanup; add separate partial resource/required-close and directory phases, with actual guarded-removal/repair controls, preserving all existing assertions. C1 failed only for this new fixture path; C2 remains done/unverified, C3 historical proof retained/unverified. Local A-23761 remains authored selected evidence; no configured run. Hold released for scoped correction/authorized checks; fresh source review before submission. No Reviewer edits or runs.

Criteria: C1 failed (M4: new aggregate consumer controls need pre-acquisition partial ownership and a positive resource-close/root/guard fence with rejection/repair proof.).

### rev-35 · 2026-11-27T08:24:54.334Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2023-source-4
commit: ab19a5b320c48d7a39ac396de5f28782d88fcfbc
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

M4 source clear; A-23764 records the two-file delta audit under Coordinator a9003d48 last-round policy. Opt-in heartbeat fixture adopts root/enrolls required partial close before acquisition, captures references before startup awaits, caches independent positive Hub/Crew/Tracker closes and closes Store after writers; directories are separate. Tracker/Crew partial-startup and Hub rejected-close controls exercise actual guarded removal before beforeRemove, independent root presence, refused restoration and retained guard, then positive repaired close/removal/restoration inside named owned load-scaled proofs. Prior aggregate/bounded ingress/refusal/M3 commit and observation fixes unchanged; all assertions retained. Findings []; C1/C2/C3 remain unverified pending same-head configured receipts, with C3 historical proof explicitly scoped. A-23763 local23/related/full checks are authored selected evidence, no inferred native/full run. Hold released; request Coordinator mode-free window. No Reviewer edits or runs.

### rev-35 · 2026-11-27T09:14:01.477Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2023-evidence-1
commit: ab19a5b320c48d7a39ac396de5f28782d88fcfbc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-23773 records independent52558c96/A-23772/result.json audit. Producer code0/empty cause, unfinished[], complete exit0 T0/T1/allT2/selected246T3/mapped1T4/Web at recorded treec8bf42aab2d3cf36b63f02c1a496f2f1efcc666b. All15 new terminal/projection/refusal/commit/abort/aggregate/guard-repair identities each have paired base+5 distinct load passes; exact lines/names retained. C3 current native shared-clone cleanliness control52780 and2/2 file pass combine with unchanged fix and explicit historical T-2024/fresh-tip A-22059/A-22060 proof, not a new current-dev probe. Paired9835pass/12skip+75load; known3 finish-only separate;30T3/17T4 unexecuted. Linuxc16nyc1 Node24.21/Nvim0.12.5 workers4, isolated Headless1248/Chrome156, advisory budgets/skip checks, cache unknown. Prior failed/source/local occasions retain scope; no new allowance/run/source. Findings []; C1/C2/C3 verified; legacy roots remain T-2117.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-27T09:45:26.806Z

Merged 8706ce4b1f0c9424c527f3008e7494f842fcc1e0 onto dev.
