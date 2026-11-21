---
id: T-2035
kind: task
title: Durable exact-head Linux timing receipts, and the enqueue refusal of unallowed new identities of 4 s or more (split from T-1901 C2)
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1689
branch: t/T-2035-durable-exact-head-linux-timing-receipts
created: 2026-11-20T17:39:51.105Z
updated: 2026-11-21T13:27:01.174Z
closed: 2026-11-21T13:27:01.174Z
---

## Summary

T-1901's allowance check (its former C2) needs the passing per-identity timings of an exact-head Linux run as a durable structured receipt. Today they exist only as `suite timing` log lines or temporary duration-reporter side files that run-suite deletes. RunStatus and worker /done carry platform and tier receipts but no timing samples. Split from T-1901 on 2026-11-20, because it needs a runner to worker to RunStatus to Suites contract and a prepared-executor capability (rule 19) before enforcement.

Kind: product. Part of E-1888 (approved in triage A-19813, ask 8e3dd5ab); carries T-1901's original C2.

## Acceptance criteria

- [x] C1. A local and a droplet run each record a durable structured timing receipt (identity, seconds, outcome, platform, head, tree) that Suites exposes after the run and after a hub restart, with no log parsing (test).
  - done: impl-2035 · 2026-11-21T09:53:27.992Z
  - verified: rev-35 [reviewer] · run rev-35-2035-evidence-2 · 2026-11-21T12:41:01.326Z · commit a965727f2ef73d095649e5131de262edb702a2b3
- [x] C2. A new identity measured at 4 s or more on Linux with no allowance is refused before enqueue, with the allowance stanza (test).
  - done: impl-2035 · 2026-11-21T06:05:22.024Z
  - verified: rev-35 [reviewer] · run rev-35-2035-evidence-2 · 2026-11-21T12:41:01.326Z · commit a965727f2ef73d095649e5131de262edb702a2b3

## Comments

### impl-2035 · 2026-11-21T01:06:04.580Z

Consumer audit (rules20/41): duration-reporter/run-suite produce samples; local suite-worker result and LocalExecutor.status, droplet env/runStatusProgram/status, Suites #readResult/#poll completion/recovery persistence and list/card projections, executor test fakes, suite-importer-ready and verification-tier-receipts controls, worker admission and droplet run/status tests, protocol/wire conformance, CLI/Web/nvim summaries, duration budgets/load-gate consumers and docs/skills/QA briefs were searched by TestTiming, suite timing, timingReceipts, tierReceipts, RunStatus, /done, result.json. New timingReceipts is optional; old worker/status/job shapes remain valid and unknown. Existing log timing consumers remain reporting only. T-1901 seam will consume exact task-head receipt, not merged synthetic candidate head. First red: suite-timing-receipts.test.ts exits1 ERR_MODULE_NOT_FOUND for new contract module (macOS arm64 Node24.21); no native/configured run.

### impl-2035 · 2026-11-21T01:20:35.620Z

Checkpoint: stacked source-clear T-1901 895ad0152 with Coordinator authorization (9897b0a7), preserving current dev sharding/importer changes in conflicts. C1 local/droplet semantic completion and real fixture SQLite/Suites restart controls green; uploaded droplet status VM covers previous shape and damaged metadata. C2 pure policy red-first, then public merge-queue file 49/49 green (macOS Node24.21, no provider/native launch). Full lint second run exit0/refusals0, 764 report-only advisories retained; first lint attempt failed because my tiers additions were unsorted, now corrected. Full typecheck integration draft exit0. All242 T1 files running serially; no current configured/Linux/Web/native verification claimed. Contract follow-up census: SuiteStatus timingSummary is mirrored shared/wire, conformance typechecks; Store summary SQL and read/list paths omit timing samples; older status/result shapes remain supported. Pending before review: finish current draft checks, T-1901 squash landing + merge origin/dev, publish evidence, fresh full lint/typecheck and review.

### impl-2035 · 2026-11-21T05:41:22.180Z

First full source review requested and delivered to Reviewer at pushed head a4d5ac1288de0d3e2b4126bc696df7ac382544c7 / tree46ecc25d5aa8984a2d51656e8c3fb3a1510f07ca. A-22348 preserves exact-head local evidence: full typecheck0; full npm run test:lint/static0,764 report-only/0refusals; all243T1=2094pass and nine affectedT2=116pass, no failures/skips. Platform macOS Darwin27arm64 Node24.21; no configured/Linux/T3/T4/Web receipt claimed. Five CLI-subject T2 files ran under granted native slot with enforcing os.loadavg()[0]<12; released. T-1901 squash reconciliation completed, duplicate importer/helper documentation removed, tracker delta against origin/dev empty; both reconciliation files match dev. Added producer/native OS agreement controls red-first, and WorkerCompletion timing metadata type/control (TS2339 red first) through signal/cleanup. C1/C2 done, task review. Coordinator owns full verify all after source clear; no verify submitted before review. Keep claim until merge.

### rev-35 · 2026-11-21T05:49:31.240Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2035-source-1
commit: a4d5ac1288de0d3e2b4126bc696df7ac382544c7
scope: full
findings: [{"severity":"medium","text":"M1: Timing admission seed constructs Store and Tracker before native database capture; constructor rejection can leave an unreturned DB open without a positive close fence before fixture disposal/guard restoration. Capture both before construction and retain constructor-rejection/cleanup controls on this path.","file":"hub/test/merge-queue.test.ts","line":186}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review is not clear: M1 in A-22350. The new timing admission seed constructs Store and Tracker before a native DB handle is owned, allowing constructor rejection to escape the fixture's positive-close fence. Implementer confirms the gap (af50f676). Capture both acquisitions through the shared seam and retain rejection/cleanup controls while keeping the real admission/queue assertions. No additional functional finding established. T-1901 reconciliation verified: helper and merge-batches guide exactly match dev 792d643d8; tracker diff empty. A-22348 selected macOS local/fake evidence remains distinct from real Linux/configured phases. C2 failed; C1 unverified pending run evidence. No Reviewer execution or edits. Verdict releases this hold for the consolidated fix; fresh source review at the corrected head before Coordinator verify all.

Criteria: C2 failed (New timing-admission seed has no pre-constructor capture/positive DB-close fence for Store and Tracker construction failures; repair this control before verification.).

### impl-2035 · 2026-11-21T06:05:37.313Z

Source2 correction pushed at5ab9cb2bc5204a662bcc9241076f9455b8db3c0c/tree2df555bed04592398ac05478d79b68a688922da2; fresh review delivered to Reviewer. M1 consolidated fix uses shared ownedTracker/ownedDatabases before wrapper construction, stageCase positive-close fencing and actual seed constructor/close rejection controls. Six original admission scenarios preserved. A-22354 retains red/setup rounds separately and qualified green draft controls (targeted3/3, whole fake file51/51, tightened rescue targeted3/3). At committed head, full typecheck0 and test:lint/static0,764advisory/0refusals; no committed-head runtime test receipt yet because quiet window opened after final formatting/unused-local cleanup. Prior a4d5ac128 tests remain prior-head A-22348 evidence. Only test+guide changed, production/tier/tracker unchanged; no dev merge after source1. No tests active or configured verification submitted. Reviewer source clearance precedes Coordinator-owned full verify all.

### rev-35 · 2026-11-21T06:06:58.369Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2035-source-2
commit: 5ab9cb2bc5204a662bcc9241076f9455b8db3c0c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear, findings=[]; A-22355. M1 resolved: both actual seed acquisitions capture native databases before wrapper construction through ownedTracker/ownedDatabases and stageCase positive-close ownership. Controls retain the constructor primary, reject close/restoration/real guarded removal while isOpen, then close that same handle before restoration/removal. Exact observer-only rescue cannot authorize the body's assertions. Original six admission scenarios and queue assertions are byte-retained. Only test and guide changed from source1; unchanged production/consumer/reconciliation assessment carries from A-22350. A-22354's 3/3 and 51/51 runtime receipts are explicitly correction-draft, not final-head; final-head typecheck/lint are reported green, zero refusals. Prior checks stay prior-head. No Reviewer execution. C1/C2 remain run-dependent and unverified pending actual same-head configured evidence. Hold releases; Coordinator's full verify all may proceed after applicable quiet-window/slot constraints. Keep head fixed.

### impl-2035 · 2026-11-21T07:33:54.509Z

Same-head local receipts complete at clear source2 head5ab9cb2bc/tree2df555bed04592398ac05478d79b68a688922da2. A-22363 retains all243T1/2094pass plus four fake T2/88pass; A-22365 retains five CLI-subject T2/30pass. Total2094T1+118T2=2212pass,0fail/cancel/skip, macOS Darwin27arm64 Node24.21. All launches enforced os.loadavg()[0]<12 (T1 2.4638671875; fakeT2 2.80224609375; nativeCLI 1.9130859375). Native slot granted e01e28eb and released immediately after batch. Same-head full lint/static/typecheck0 remains A-22354; original reds/draft receipts stay distinct. No actual configured/Linux/T3/T4/Web receipt yet; Coordinator-owned full verify all and Reviewer final evidence verdict pending. Head fixed and worktree clean; claim retained.

### rev-35 · 2026-11-21T09:37:55.251Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2035-evidence-1
commit: 5ab9cb2bc5204a662bcc9241076f9455b8db3c0c
scope: evidence
findings: [{"severity":"medium","text":"M1: New timing exports break an unchanged T3 generated-script adjacency assertion; A-22452 fails actual false/expected true. Migrate the raw-script consumer while preserving positive lock-release/trap-before-test and timing-receipt proof, audit the release inventory, then fresh source review and configured rerun.","file":"hub/test/executor-run.test.ts","line":50}]
finding_counts: {"high":0,"medium":1,"low":0}

Failed same-head run not clear; A-22453. A-22452/8e26acec failed executor-run remote-delivery identity at6.115710807s: assert.ok(script.includes(release/trap immediately followed by npm-test echo)) actualfalse/expectedtrue. Timing exports inserted between these markers; actual execution still releases before test, but T3 raw-script consumer was not migrated. Implementer confirms (7481735f); inventory raw release-string consumer also audited. Preserve positive release/trap/test/receipt semantics under Coordinator d9da24b9's authorized correction. Actual completed files:243T1+444T2 pass;246hubT3 finish245pass/1fail;27nvimT3 unstarted,55Web/18T4 unexecuted. Required timing/restart/admission/constructor controls base+5 load pass remain partial, not final proof. Linuxc8ams3 Node24.21 Nvim0.12.5; browser unknown. C1 failed; C2 unverified, no partial marks on red. No Reviewer execution/edit. Hold releases; authorized whole executor-run native check, fresh source review, then Coordinator full rerun; no duplicate configured submission.

Criteria: C1 failed (Configured full run fails the unchanged T3 generated-script consumer at executor-run.test.ts:50 after timing exports break release/trap/echo adjacency; migrate preserving lock/receipt proof.).

### impl-2035 · 2026-11-21T09:51:18.728Z

Evidence1 M1 correction/consumer audit at a965727f2: preserved executor-run's exact release/trap/test-echo assertion and /bin/sh execution assertion; moved timing exports immediately before native /bin/sh execution. New assertions require both command markers and sidecar export, then bind owner run/head/tree/command/step to admitted durable status. Direct audit: executor-run is sole trap/echo pin; state-paths-inventory release literal/context unchanged; run-suite child-env filters unchanged; suite-summary and suite-log-backfill see identical command frames. Other run.sh readers: demo tier-plan markers, executor-prepare-component health/finish order, scenarios/droplet-verify deadline/host-gate markers and fake-machine generic /tmp rewriting are unaffected; matching QA/docs reference finish/typecheck/provenance or unrelated QA scripts. Native final whole file22/22pass with enforcing launchload1.86865234375<12; slot released. Exact-head full typecheck0, full test:lint/static0 (764report-only/0refusals), all243T1=2094pass. Original configured red8e26acec/A-22452 remains red, with partial coverage in A-22453; Web/T4 and remaining NvimT3 were unexecuted there. No configured resubmission before fresh source review.

### impl-2035 · 2026-11-21T09:54:12.106Z

Fresh narrow source3 review requested/delivered at a965727f2; A-22460 is durable scan-cleared evidence. Exact-head full typecheck0, full lint/static0 (764report-only/0refusals), all243T1=2094pass and authorized whole native executor-run22/22pass. Last native launchload1.86865234375<12; slot released. Current change preserves the original lock-release/trap/echo pin and moves metadata just before actual execution, with positive same-command run/head/tree/path/step assertions. Scope only generator, native consumer and guide. No current configured/Linux/fullT2/fullT3/Web/T4 pass claimed; failed run8e26acec/A-22452 and partial coverage A-22453 remain unchanged. Waiting for source clear before Coordinator full rerun.

### rev-35 · 2026-11-21T09:54:59.421Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2035-source-3
commit: a965727f2ef73d095649e5131de262edb702a2b3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear, findings=[]; A-22461. Evidence1 M1 resolved: original exact lock-release/trap/test-echo and native command assertions remain; timing exports now occur after logging/exit reset immediately before execution. Added positive same-command marker presence/order, per-run sidecar and parsed owner JSON equality to durable admitted run/head/tree/command/step. Inventory release literal/context unchanged, direct script/frame/env/fake/QA consumers audited. Only three correction files changed across two commits, no dev merge. A-22460 final native file22/22 (original failing identity pass), allT1 2094/2094 and final lint/typecheck green; prior TS18048/intermediate native round retained. These are local macOS targeted receipts, not configured/Linux/fulltiers proof. Original8e26acec stays red at prior head. C1/C2 checked, run-dependent verification pending. No Reviewer execution/edit. Hold releases; Coordinator's authorized full rerun at unchanged corrected head follows clearance; no duplicate submission.

### rev-35 · 2026-11-21T12:41:01.326Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2035-evidence-2
commit: a965727f2ef73d095649e5131de262edb702a2b3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final corrected-head evidence clear; A-22495, findings=[]. Fullc3f2d6c5/A-22494 finished/passed at source3-reviewed a965727f2, refs unchanged. Typed starts/pass finishes confirm 13 timing/parser/admission/persistence/constructor identities each base+5 distinct load passes; worker publication and prior failed executor-run script consumer base pass. File finishes match all243T1/444T2/273T3/55Web; T0 exit0. Producer9450pass/13prerequisite skips/0fail/cancel; no18T4 proof. Linux x64 c-8ams3 Node24.21 Nvim0.12.5, isolated HeadlessShell1248/Chrome for Testing156.0.8078.4. Canonicalcbd5f487 differs by definition from Gitfdd0aade. Report-only budgets/lint not enforced timing proof. Verify C1/C2 current. Earlier8e26acec/A-22452 remains failed/partial at priorhead, preserved A-22453; no relabelling. Semantic local/droplet restart controls are not a live deployment/restart claim. No Reviewer execution/edit/live rollout. Hold releases; no duplicate run/manual Coordinator relay.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T13:27:01.174Z

Merged d20f53b65e80e5a5a27f3f3f3e05bc0c4ac64193 onto dev.
