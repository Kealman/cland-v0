---
id: T-1614
kind: task
title: A task stays on its host; relaunch elsewhere from the pushed branch
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1609
  - T-1613
  - T-1696
topic: topic-1395
branch: t/T-1614-a-task-stays-on-its-host-relaunch
created: 2026-11-02T03:33:58.847Z
updated: 2026-11-05T23:08:07.330Z
---

## Summary

A relaunch of an item session goes to its own host while that host's tunnel is up, and a request naming another host is refused. When the original host is down, gone or rebooted, `session.resume` with `relaunch` and a `host` field (frame only, no CLI flag) relaunches elsewhere. The new host fetches the pushed task branch and adds the worktree, and the branch's lease moves to it under the territory lock; uncommitted edits are lost, as with a local worktree.

Hot files: `hub/src/adapters/requests.ts`, `hub/src/adapters/sessions.ts`, `hub/src/host/branch-leases.ts`, `hub/test/host-relaunch.test.ts` (new)

## Acceptance criteria

- [x] C1. A relaunch of a session whose host is up goes to that host and reuses its worktree, and a resume naming another host is refused with a reason saying the task stays on its host (test).
  - done: impl-1614 · 2026-11-05T22:14:26.767Z
- [x] C2. After `fake-host.ts gone f1`, a relaunch with `host: "f2"` adds the worktree on f2 at the territory's pushed tip, and the session runs there (test).
  - done: impl-1614 · 2026-11-05T23:08:07.057Z
- [x] C3. The lease moves from f1 to f2 under the territory lock: f1's pushes to the branch are refused, and f2's succeed (test).
  - done: impl-1614 · 2026-11-05T22:14:27.352Z
- [x] C4. A resume frame without `host` behaves as today, and the session-resume test file passes with no test edited.
  - done: impl-1614 · 2026-11-05T22:14:27.525Z

## Notes

Shared files: `hub/src/adapters/requests.ts` (`session.resume` gains `host`), `sessions.ts`, the lease API

## Comments

### impl-1614 · 2026-11-05T18:58:26.481Z

Rule 20 sweep recorded in docs/evidence/T-1614-consumers.md before production edits: resume frames, schema/dispatch, CLI/web/nvim/setup/spoke, permission consumers, lease and persisted worktree readers/writers, fixtures and all test tiers. Existing wire clients remain unchanged; new optional host only. C1 starts at public resume-frame seam; native C2/C3 at fake SSH/git socket seam per launch brief.

### impl-1614 · 2026-11-05T19:09:49.688Z

Progress evidence on uncommitted T-1614 tree (base e786b48fe), local macOS Node v24.21.0, no browser: host-relaunch-component.test.ts plus unedited session-resume.test.ts passed 3/3 generated cases (C1 live-host refusal/same-host placement; in-process Claude resume restores role/item claim/clause; refused in-process Codex resume offers fresh artifact brief). This is targeted T2 evidence only; no verify/full suite/load/container coverage yet. Native scripted-worker case has not passed: setup repaired, latest failure 'f1 carrier down receipt: not within 15000 ms' after gone-only trigger; now triggers authenticated kill-master then gone. T-1696 prerequisite blocks real adapter handoff and final verification per Coordinator.

### impl-1614 · 2026-11-05T19:29:32.508Z

Correction to my earlier progress comment and A-16912: I mislabeled the initial base as e786b48fe. Actual prepared worktree parent is 91202c2636aee931a3579c633b80158ec04d20db, verified from first core commit 68a16a03d63bf65b6bf1c3f879f7339c55aa30d6. Initial head is pushed and source review routed to rev-35. Evidence remains targeted local macOS only; final checks wait for T-1696.

### rev-35 · 2026-11-05T19:37:27.910Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1614-source-1
commit: 68a16a03d63bf65b6bf1c3f879f7339c55aa30d6
scope: full
findings: [{"severity":"high","text":"Spec: the old adapter is irreversibly released before move admission is durable, then the worktree admission callback rechecks whether f1 is down and can refuse after f1 returns. The current old row is left fenced without restored supervision or a durable completion owner. Persist exact-generation admission before detach; drain outside the territory lock and retain a resumable or explicitly fenced outcome.","file":"hub/src/adapters/sessions.ts","line":1738},{"severity":"high","text":"Spec / durable publication: #launchNew commits the f2 process before ready worktree state, old intent completion and the generation warning are saved separately. A crash/write failure leaves a positively launched generation with adding ownership and an old-key retry receipt that normal resume of the new row never finishes. Publish these facts under one durable completion owner/atomic checkpoint.","file":"hub/src/adapters/sessions.ts","line":1756},{"severity":"medium","text":"Spec / integration: the `in` membership test rejects T-1696's native facade, which exposes the hook with a proxy get trap and declare-only class field. Check the callable capability without requiring an own/prototype property; the current structural mocks hide this failure.","file":"hub/src/adapters/sessions.ts","line":1734},{"severity":"high","text":"Spec / retry ownership: the prepared retry compares only record strings and invokes reuseOnly, whose agent reservation path captures no checkout identity. It neither binds the directory/Git admin identity nor reconciles an advanced territory tip; an advanced tip permanently refuses, while a replacement checkout can reach reinstall. Coordinator 6fba53f3 moves this retry work to T-1698: remove retry execution/claims here and leave known failed admission fenced and reported.","file":"hub/src/host/task-worktrees.ts","line":71},{"severity":"medium","text":"Spec / onward ownership: after a known f2 native refusal, onward transfer overwrites the sole worktree/prepared record with f3 and leaves f2's confirmed checkout/ref-watch without a retained owner; no f2 native row exists in that refusal case. Coordinator 6fba53f3 moves onward transfer obligations to T-1698; this item must refuse such retry rather than discard f2 ownership.","file":"hub/src/host/task-worktrees.ts","line":75}]
finding_counts: {"high":3,"medium":2,"low":0}

Initial independent core not clear; A-16916 records standards/spec review and all five findings. Coordinator 6fba53f3 narrows the correction: T-1614 owns durable admission before detach, atomic native/ready/warning/completion, and known failed admission left fenced/reported. Advanced-tip/checkout identity and onward retry move to T-1698; remove unsafe retry execution/claims here rather than implementing them now. Unknown preparation recovery remains excluded. C3/C4 remain unverified pending native/compatibility evidence; no criteria verified. T-1696 integration, native/preservation/load/T0 and configured verification remain pending. Reviewer performed read-only source inspection only.

Criteria: C1 failed (A returning source host after irreversible detach leaves its current row fenced without durable move admission or restored supervision.), C2 failed (Move admission/publication are not one durable owner, and native facade capability detection rejects the actual dependency hook.).

### rev-36 · 2026-11-05T19:52:31.633Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1614-source-1
commit: 4fb421df4e66f168c9d5f1939fc80bba5e0cf6c7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Requested preliminary core source clear, Standards/Spec no findings. Independent review from prepared parent91202c263; Coordinator6fba53f3 scope split applied. Prior five findings resolved in core: durable exact-generation intent before irreversible release; drain outside serial/territory locks; atomic native/ready/warning/intent completion with rollback and post-commit accepted-owner handling; callable Reflect capability; unsafe prepared/onward retry removed and known failure left adding/fenced/reported. Shared state keys/types, old optional-wire compatibility, docs/skill and consumer inventory inspected. A-16920: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16920-t-1614-corrected-core-source-review-at-4fb421df4.md . NO C1–C4 runtime marks. T-1696 forward-drain integration/authorized dev merge and fresh integrated source review still required BEFORE configured verify; direct adapter call here is preliminary only. Native success cleanup failure is not coverage; native rerun, unedited preservation, loaded Mac/Linux checks, final T0/allowances and configured evidence pending. T-1698 owns retry reconciliation. Reviewer ran no tests.

### impl-1614 · 2026-11-05T19:58:13.567Z

Preliminary core source clear at4fb421df4 (rev-36-1614-source-1,A-16920). Exact-head local macOS arm64 Node24.21.0 native scripted-worker rerun now exit0,2/2: running7.459533208s/refused6.649596875s,file14.448625375s,no burners/browser/duration gate. Joined publisher flush fixes earlier agent cleanup incompleteness; lock owner-checked/released. Native record artifact posted; loaded runner prep A-16921 is syntax/secret-scan-only, not executed. T-1696 integration and final evidence remain pending, no runtime criterion verification claimed.

### rev-36 · 2026-11-05T22:16:49.109Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1614-delta-source-1
commit: 3f978a1dbaca17f3e59f8ca5819d75af94d4cac3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integrated source clear, Standards/Spec no findings. Reviewed authorized f68f696f0 merge (core4fb421df4 + upstream57d108144), both conflict resolutions, task integration delta and relevant local-carrier owner/removal contracts. Relaunch now awaits public Sessions.releaseUnreachableGeneration after durable admission/outside locks, then rechecks exact lifecycle owner before preparation; duplicate receipt validation removed. Fake forwardIds/get-only proxy contract updated. Production CodexAdapter native case uses fake executable/app-server/spoke with two carriers in one registry and durable input/PID/tip receipts; proves scoped-forward distinction/old endpoint absence after source restore, stable claim and lease refusal/success. Docs/index/T3 tier updated; unedited session-resume preserved. Earlier atomic publication/fenced failure and T-1698 scope remain. A-16950: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16950-t-1614-integrated-generation-handoff-source-delta.md . No C1–C4 runtime marks: full sealed localT2, Mac load>=12/Linux --init4burners4CPUs 5×three native cases, preservation and same-head configured receipts pending. Reported 3/3 unloaded native run is not loaded/configured proof. Changed head needs fresh review; reviewer ran no tests.

### impl-1614 · 2026-11-05T22:40:05.794Z

Local final-head runtime evidence complete at reviewed3f978a1dbaca17f3e59f8ca5819d75af94d4cac3: fullT2 A-16954; macOS load>=12 five repetitions/eight exact cases A-16955; Linux docker --init fixed4burners/4CPUs five repetitions A-16956; all15 unedited preservation files plus host-push-on-ref-move5/5 A-16958 (240 passing test-case executions, zero failures/skips/cancellations). A-16959 maps C1–C4 and retains the three measured duration-only candidates (29s/29s/24s, C-216 expiry2026-11-11). Every local writer/burner joined and preservation lock released. Source unchanged; mode-free configured run0e527047-50f4-428e-b0d1-1ecdbee63bd1 pending. Waiting for hub result before authorized durations-only commit/delta review; no remote pass or ready claim yet.

### impl-1614 · 2026-11-05T22:43:35.951Z

Configured run0e527047-50f4-428e-b0d1-1ecdbee63bd1 at3f978a1db exited1 only on three missing duration allowances: T3 raw51/51 pass, zero assertion failures/skips/cancellations; 'suite test failures []'. T0/T1/T2 exit0; later T4/Web phases were not completed and are not counted as passing. A-16960 retains the full red receipt: droplet c-8 sfo2 cland-v0-e58889fa, Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, workers2, lifetime1252s,cost$0.0869. Coordinator250a1216 directs29/29/24s durations-only commit, fresh delta review and a new mode-free verify. Runtime source/test assertions remain unchanged, so A-16954/A-16955/A-16956/A-16958 local evidence carries as source evidence only; no green configured receipt yet.

### rev-36 · 2026-11-05T22:44:04.786Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1614-evidence-1
commit: 3f978a1dbaca17f3e59f8ca5819d75af94d4cac3
scope: evidence
findings: [{"severity":"medium","text":"Three new relaunch identities lack measured allowances; configured duration admission rejects production11.272 s, scripted-running10.039 s and refused7.167 s against5 s despite all51 T3 assertions passing.","file":"hub/test/durations.json","line":10467}]
finding_counts: {"high":0,"medium":1,"low":0}

Actual A-16960 failure: three `duration budget: ... >5 s (add to hub/test/durations.json with a reason)` errors; suite test failures[]. T0/T1/T2 pass, all51 selectedT3 case outcomes pass, but T3 phase/overall exit1; T4/Web unexecuted. Interruption4961 completed/pass differs from earlier4901 aggregate; neither is full pass. A-16961 preserves exact errors/provenance: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16961-t-1614-configured-duration-admission-failure-at-3f978a1db.md . Uncached Linuxx64 c8sfo2 Node24.21/Nvim0.12.5, browsernull; report-only advisories separate from hard duration admission. C2 failed for configured evidence, no runtime assertion defect inferred. Coordinator250a1216 requires committed measured budget delta/source review then fresh mode-free run; red cannot carry by rule7. New8370003e2 request received and will be reviewed separately. Reviewer ran no tests.

Criteria: C2 failed (Configured0e527047 T3/overall exit1 on three missing reasoned duration allowances; T4/Web unexecuted.).

### rev-36 · 2026-11-05T22:45:06.249Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1614-delta-source-2
commit: 8370003e2b207d0c3523c56e49b76eee5766ebf0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards/Spec no findings. Sole21-line durations.json addition contains exact three identities and measured29/29/24 s caps, C-216/addedNov5/expiryNov11. Independently matched ten passing platform samples each: maxima19.03315725/19.015927042/15.721050333 s, ceil1.5× yields29/29/24. Previous allowances and manifest version/source/budget/files/tests unchanged; no executable/test/assertion/setup/behaviour/doc changes, report mode retained. A-16962: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16962-t-1614-measured-allowance-source-delta-at-8370003e2.md . No C1–C4 runtime marks: A-16960 red remains red; Coordinator250a1216 requires fresh mode-free verify at this head, no rule7 carry. Local source3f978a1db evidence retains its actual head. Reviewer ran no tests or production validators.

### impl-1614 · 2026-11-05T23:07:07.469Z

Fresh configured run c0f68bd2-96b4-4f14-88a4-a52281dad583 at source-clear8370003e2 exited1: preserved host-push-on-ref-move.test.ts:145 'killed producer without result stays named and fenced until a later successful leased head' reports 'producer result missing; native cleanup retained' from AgentClient watch (A-16963:27035–27042). T0/T1/T2 exit0; T3 50pass/1fail, no skips/cancels; T4/Web unexecuted. New relaunch native cases pass and three allowance errors are resolved. Reported to lead T-1614 as shared-defect candidate/Bugs,S, requesting Coordinator classification/shared fix. Holding diagnosis/rerun/merge; source remains unchanged and claim retained. Platform Linux x64 6.8.0-142-generic droplet c-8 sfo2 Node24.21.0/Neovim0.12.5 workers2; lifetime1183s,cost$0.0822. Existing A-16958 macOS preservation5/5 does not replace this missing configured pass.

### rev-36 · 2026-11-05T23:07:49.170Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1614-evidence-2
commit: 8370003e2b207d0c3523c56e49b76eee5766ebf0
scope: evidence
findings: [{"severity":"medium","text":"Required mapped case 'killed producer without result...' fails with 'producer result missing; native cleanup retained'; selectedT3 50/51, overall exit1, later T4/Web unexecuted. Coordinator classifies known dev defectT-1693; this failed run remains failed.","file":"hub/test/host-push-on-ref-move.test.ts","line":145}]
finding_counts: {"high":0,"medium":1,"low":0}

A-16963 actual error at agent-client.ts:25:166 is `watch <scratch worktree>: producer result missing; native cleanup retained`; native case failed3.803384976s. New relaunch cases and three allowances pass; T0/T1/T2 green, T3/overall exit1. Interruption4961/4960/1 versus earlier4901/4900/1 are reported partial aggregates, not full pass. A-16964: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16964-t-1614-retry-push-recovery-evidence-failure-at-8370003e2.md . After independent log assessment, Coordinator7842fde9/4a69fa67 explicitly classifies known dev T-1693 and authorizes exactly one unchanged-head mode-free rerun; diagnosis stays with its owner. Source A-16962 unchanged/clear. C2 failed for configured evidence; C1/C3/C4 final marks pending. If the one retry has same sole failure, report/hold for Coordinator; no automatic further run. Reviewer ran no tests.

Criteria: C2 failed (Configured c0f68bd2 fails sole mapped push-recovery identity (known dev defect T-1693); T4/Web unexecuted, no final green evidence.).

### impl-1614 · 2026-11-05T23:07:49.873Z

Coordinator classified c0f68bd2's only failure as known dev defectT-1693 (7842fde9 /4a69fa67), now stage6 with its own Implementer. T-1614 diagnosis remains held. Coordinator authorized exactly one mode-free flaky rerun at unchanged8370003e2b207d0c3523c56e49b76eee5766ebf0; submission is in flight. All C1–C4 implementation-done marks are present. On a repeated sole killed-producer failure, hold for Coordinator decision; no second automatic retry or merge.
