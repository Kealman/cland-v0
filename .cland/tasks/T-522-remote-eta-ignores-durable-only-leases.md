---
id: T-522
kind: task
title: Remote ETA ignores durable-only leases, so a blocked explicit droplet waiter shows ETA 0
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1216
blocked_by: []
topic: topic-965
branch: t/T-522-remote-eta-ignores-durable-only-leases
created: 2026-10-15T18:16:12.637Z
updated: 2026-10-24T12:47:13.172Z
closed: 2026-10-24T12:47:13.172Z
---

## Summary

The remote ETA estimate in hub/src/hub/suites.ts (around line 698) ignores durable-only leases, the ones held by preparation or by an unconfirmed cleanup. A correctly blocked explicit-droplet waiter (T-512) can therefore show ETA 0 while it is still waiting. Admission itself is correct. Found by T-512's reviewer (A-3243).

## Acceptance criteria

- [x] C1. Remote ETAs count every lease that holds a remote slot, durable-only ones included, and a waiter blocked by one shows an ETA of at least that lease's remaining expected time, or "unknown".
  - done: oc-522 · 2026-10-24T11:07:14.629Z
  - verified: rev-23 [reviewer] · run rev-20261024-522-final · 2026-10-24T12:41:22.500Z · commit a7d7e9e52aca602933c1380937ec63d1eb19b0b3
- [x] C2. A test holds a preparation-only lease with an explicit remote waiter queued, and the queue shows a non-zero or unknown ETA.
  - done: oc-522 · 2026-10-24T12:18:52.104Z
  - verified: rev-23 [reviewer] · run rev-20261024-522-final · 2026-10-24T12:41:22.500Z · commit a7d7e9e52aca602933c1380937ec63d1eb19b0b3

## Comments

### oc-522 · 2026-10-24T11:07:23.509Z

Implementation at c864fff3d81a73d8709fc6581b0f44f991d82148 (branch t/T-522-remote-eta-ignores-durable-only-leases, pushed to origin).

Root cause: `snapshot()` built remote slot ETAs from occupying suite jobs only, then filled `remoteBudget - remote.length` slots with zero, so a preparation or unconfirmed-cleanup lease that holds a slot without a job produced a false free slot and ETA 0.

Fix: `Suites` now caches the durable non-released lease set (`#liveLeases`) from the same read admission already used, seeded in the constructor, refreshed each scheduler tick and on every explicit `queue()` read. `snapshot()` counts every durable lease whose run is not an active remote row as an occupied slot with unknown remaining time (null), and a waiter's admission ETA uses the k-th earliest known release where k = releases needed to leave one free slot, so a waiter that must outlast a durable-only lease shows unknown instead of 0. Waiters still take the earliest slot as before when capacity is only job-held.

Targeted runs, local macOS arm64 (darwin, Node v24.21.0), not a suite run and no executor: `node --test hub/test/suite-remote-budget.test.ts` 16/16 pass including the two new cases; `node --test --test-concurrency=1` suite-queue, suite-queue-policy, suite-human-queue, suite-scheduling 16/16; suite.test.ts and suite-admission.test.ts 24/24. `npm run check` passes (typecheck, web build, static and test lint; test lint remains report-only, 133 findings in 60 files, none blocking). New tests: a durable preparation lease beside one running remote job makes the explicit waiter ETA the job's remaining 4000ms rather than 0, and a durable lease alone in a budget of 1 gives the waiter a null (unknown) ETA with no droplet acquired. Docs updated in hub/README.md and docs/agents/tests.md for the unknown-ETA rule.

### rev-23 · 2026-10-24T11:13:27.773Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-522-source
commit: c864fff3d81a73d8709fc6581b0f44f991d82148
scope: full
findings: [{"severity":"medium","text":"M1: Add the required path-derived per-test guide and index entry documenting the two new T1 durable-lease ETA regressions (docs/agents/tests.md:3).","file":"hub/test/suite-remote-budget.test.ts","line":75}]
finding_counts: {"high":0,"medium":1,"low":0}

T-522 full source review — not clear

Head c864fff3d81a73d8709fc6581b0f44f991d82148, tree 05732c85d4b6d12a630db7b26aa96c56ddcebc7e; fixed base ab77eae3. Comparison git diff ab77eae3...c864fff3; one commit, four files. Origin task ref matches. Scope full, run rev-20261024-522-source. Both axes reviewed in-session under .cland/crew.toml Reviewer subagents=false.

## Standards
M1 (medium): hub/test/suite-remote-budget.test.ts:75 adds two test-specific regression cases without a path-derived per-test guide or index entry. docs/agents/tests.md:3 directs test-specific paragraphs into that guide and keeps shared conventions in tests.md. Neither docs/agents/tests/hub-test-suite-remote-budget.test.ts.md nor its index entry exists at the reviewed head. Add the exact heading '# hub/test/suite-remote-budget.test.ts', document the T1 suiteUnit semantic executor/provider lease fixture and known-release/unknown-release cases, and register one index row. Keep the docs guard unchanged.

The tests otherwise use the existing T1 seam: real Suites rules, fake clock and semantic executor receipts, no new socket/process or wall-clock wait. Existing suiteUnit teardown owns scheduler/store/provider/directory in order; no new lifecycle resources are added. Production reads remain asynchronous; snapshot stays synchronous over cached ownership. No separate smell finding.

## Spec
Source logic is sound on the reviewed cases. #liveLeases caches every non-released durable lease, seeded at construction and refreshed by explicit queue/admission reads. snapshot combines active remote/shard rows and unmatched durable run ids without counting matching job leases twice; durable-only occupancy contributes unknown release time. Padding represents genuinely unused capacity; the kth-known-release selection accounts for occupancy above a reduced budget. Queued remote durations update the chosen slot, preserving prior slot estimates. Explicit remote waiters stay on the remote path; local admission logic is unchanged. The mixed two-slot regression proves a known 4s active-job release while preparation holds the other slot; the single-slot regression proves null ETA/no machine acquisition behind preparation-only ownership. Shared docs accurately describe that behavior. No functional Spec finding found.

C1 remains unverified pending corrected-head source review plus configured evidence; C2 regression exists but is not accepted complete until M1's required test guidance is present and same-head runtime evidence is reviewed. No configured verification has run. Request reports local macOS arm64 targets 16/16 remote-budget, 16/16 queue family, 24/24 suite/admission and npm check pass; original raw command receipts have not yet been supplied, so these are lead-reported counts, not independently audited exact-head receipts. Preserve original output/exits/timings with source/platform attribution, without rerunning for transcription.

QA policy none/no item brief. Verification remains held; fix and request a fresh pushed-head source review first. Reviewer performed static Git/source/tracker reads only; no tests, probes, installs, edits, Git mutation, browser or delegation. Standards: one medium finding M1. Spec: zero findings.
Durable source verdict A-10807.

Criteria: C2 failed (M1: New regression cases lack the required per-test guidance/index entry.).

### rev-23 · 2026-10-24T11:14:45.752Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-522-source2
commit: 3fb01872fc165e4f49473c8672c7d009570a440b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-522 corrected full source review — clear

Head 3fb01872fc165e4f49473c8672c7d009570a440b/tree 582ccb9d0aabb4505ba81f703c545b909da19f4b, fixed base ab77eae3. Prior full audit A-10807 at c864fff3 applies unchanged to production/tests; replacement is exactly one docs-only commit adding the required guide and index row. Scope full, run rev-20261024-522-source2, findings [].

Standards: M1 resolved. The guide has exact repository-path heading, documents the T1 suiteUnit semantic scheduler/provider/machine seam, FakeClock, explicit remote requests, preparation-only lease control and both known/unknown ETA assertions. One correct index row; guard unchanged. No new resource, wall-clock wait, process or tier change. No separate baseline smell finding.

Spec: the earlier complete functional audit stands. Cached non-released leases add unknown occupied slots only where no active remote/shard row owns the run; known release ordering accounts for capacity and queued durations. The two regressions retain the 4000ms mixed-capacity estimate and null single-slot preparation-only estimate, with no remote machine acquired for the blocked waiter. Admission policy remains unchanged. No remaining functional findings.

A-10808 retains partial original local macOS arm64/Node24.21 receipt excerpts: pre-fix assertions 0!=4000 and 0 vs null; corrected two-case pass then 16/16 affected file, 16/16 queue-family and 24/24 scheduler/admission, plus check tail with report-only lint133/60 and zero refusals. The whole-file new-case samples are 241.571166ms/70.493458ms; earlier focused mixed case1054.914667ms is preserved rather than hidden. Docs follow-up reports3/3, Node duration122.724417ms. These are retained stdout excerpts, not complete native call/result records: exit codes were not captured and are not independently established; no overall npm check wall time inferred. Earlier abbreviated A-10805/A-10806 are superseded. No rerun for transcription requested.

C1 and C2 remain pending configured same-head runtime settlement; source establishes implementation and regression shape only. Source clear permits mode-free configured cland verify at this exact unchanged head, reporting result to Reviewer and lead. Do not label it a full all-tier run; retain actual selection/platform/gates. No per-item QA brief/policy. Reviewer static source/Git/artifact reads only; no tests/probes/edits/install/Git mutation/browser/delegation. Standards zero remaining findings; Spec zero findings.
Durable verdict A-10813.

### rev-23 · 2026-10-24T11:32:39.503Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-522-evidence1
commit: 3fb01872fc165e4f49473c8672c7d009570a440b
scope: evidence
findings: [{"severity":"medium","text":"M2: Configured3ce5c77d/A-10835 failed four executor timeout/checkpoint assertions and six merge-batches diagnosis tests timed out; T2/Web did not run. Diagnose exact seams, preserve assertions/timeouts, and source-review corrections before retry.","file":"hub/test/executor-run-rules.test.ts","line":25}]
finding_counts: {"high":0,"medium":1,"low":0}

T-522 same-head evidence review — not clear

Head3fb01872fc165e4f49473c8672c7d009570a440b; source2 A-10813 remains historical source clearance. Configured mode-free3ce5c77d-cef3-4ea8-8571-a3904d59a20d / original log A-10835 finished exit1. Scope evidence, run rev-20261024-522-evidence1.

M2 medium: four executor-run-rules assertions fail: silent task/integrated runs do not publish the expected stall terminal receipt (line25), silence deadline does not expire between transport polls (line68), and failed checkpoint terminal receipt is false (line130). Six merge-batches identities finish cancelled with native 'test timed out after120000ms': unresolved red repeat, independent flaky batches, diagnostic file/job provenance, diagnosis reopen, skipped rerun and cancelled-repeat recovery. These are actual assertion/timeouts, not report-only budget regressions. Root cause and relation to the task's new asynchronous lease reads are not established by the log; do not classify as shared infrastructure or relax assertions/timeouts without diagnosis.

Native finish counts830 ordinary pass,4fail,6cancelled;135passing file finishes/twofailed;10additional load-gate test/file passes. The two new durable-lease ETA cases pass base0.096040595s/0.020531881s plus5/5 each (worst0.153450145s/0.055887114s). These targeted successes do not establish a green configured run. T0host check exits0/23.822s; T1exits1/envelope780s/actualsuite776.13s; T2/Web never execute. No T3/T4 or integrated cover. Host gate95856821... is reported reused, not repeated remotely; no separate candidate remote typecheck claimed.

Linuxx64 c-8lon1 cland-v0-12c5f752, Node24.21/Nvim0.12.5 workers2, lifetime871s/$0.0605. Diskfsync8.1ms/SQLite9.51ms and no steal/iowait do not support dismissing failures as host slowness. Lint133/60 and duration/ratchet reports are report-only; their large values reflect failures and are not the reason for clearance refusal.

C1/C2 remain unverified; C2 failed for incomplete passing regression coverage across configured verification. Preserve failed native receipt and diagnose exact seams. No unchanged retry requested; any correction needs fresh committed source review before another configured run. Current macOS stage cover prohibits local tests until released; ask the Coordinator for an authorized route if needed, never bypass cover-quiet. QA none. Reviewer static tracker/log/source reads only, no tests/probes/edits/install/Git mutation/browser/delegation. Standards one medium runtime-evidence finding M2; Spec not finally established.
Durable disposition A-10838.

Criteria: C2 failed (Configured run failed four assertions and six native120s timeouts; only partial T1 evidence, no T2/Web.).

### rev-23 · 2026-10-24T12:17:42.669Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-522-source3
commit: a7d7e9e52aca602933c1380937ec63d1eb19b0b3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-522 scheduler correction full source review — clear

Heada7d7e9e52aca602933c1380937ec63d1eb19b0b3/treec7a7006300337d62af363b54bbb0f6d50e7b7673, parent3fb01872, fixed baseab77eae3. Origin task ref independently matches; whitespace clean. Scope full, run rev-20261024-522-source3; both axes in-session, findings []. Prior full functional audit A-10807/A-10813 carried forward and complete scheduler correction3fb01872..a7d7e9e5 inspected. No dev merge.

Standards: M2 corrected in source. Constructor no longer adds a lease sweep to #reaping; #check publication no longer awaits queue()→fresh lease read. It returns to the base holder+cached-snapshot shape through #schedulerSnapshot. Tick starts a detached refresh, at most one refresh promise in flight; explicit queue/admission reads still inspect actual durable slots as before. settled/close await the admitted refresh, so writers do not outlive their owner. Monotonic sweep/applied counters prevent an earlier-started refresh completing after a newer explicit read from overwriting the newer cache. No timeout, polling assertion, test cap, workload or old final assertion changed.

Existing durable lease/active-row deduplication and capacity-aware release ordering remain unchanged and source-sound. The corrected T1 guide now documents all three cases, coalescing and completion semantics. New third case uses existing fake-clock/semantic suiteUnit seam with no process/socket/wall wait; after settled tick it checks cached snapshot ownership/unknown ETA/no acquisition without an explicit queue read. This asserts the scheduler metadata path, not an extra wire transport proof. Prior M1 guide/index remains resolved. No baseline smell finding.

Spec: C1/C2 source intent remains sound. Durable-only nonreleased leases count as occupied unknown-release slots; known job release can provide the next available slot estimate, while a waiter that must outlast preparation-only capacity stays unknown. Explicit remote admission remains blocked. Async cache refresh no longer lengthens the publish check that coalesces interval ticks. All source dispatch/deadline semantics outside this correction remain preserved. Shared docs explain the scheduler coalescing pitfall without claiming a new FakeClock completion contract.

A-10928 reports a causally specific local diagnosis: original executor-run-rules four assertion reds and merge-batch waits reproduced; base suites.ts control passed; removing only publish's fresh sweep restored the stall assertion. Debug advance trace shows one inspection at3s followed by due3–5s checks coalesced while publication awaited I/O. Correction reports82/82 three-file targets,55/55merge-batches,17/17remote-budget,122/122fifteen-file targets and check green. It also reports new cached-snapshot red against base. These are local macOSarm64/Node24.21 summary/excerpt claims; original complete call/result/exit receipts have not been independently audited. Requested retained originals with source attribution, no reruns for transcription, no inferred overall check wall. Current local policy is one file at a time unless Coordinator grants a window; no new multi-file/load reruns requested by this review.

Disclosed verification-workers local assertion0!=1 reportedly matches base and candidate and passed in prior droplet. That is not an independently accepted shared-defect classification or exemption: retain original evidence and let fresh configured verification determine status. A-10835 remains a failed prior-head receipt under A-10838, not erased by targeted green results.

Source clearance permits fresh mode-free configured verification at exact unchangeda7d7e9e5, results to Reviewer/lead; no unchanged retry was requested. C1/C2 remain runtime pending, with C2 done mark to be restored after the recorded failed verdict. No QA brief/policy, no whole-tier pass claim. Reviewer static Git/source/tracker/artifact reads only; no tests/probes/edits/install/Git mutation/browser/delegation. Standards0 remaining findings; Spec0 findings.
Durable audit A-10944.

### rev-23 · 2026-10-24T12:41:22.500Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-522-final
commit: a7d7e9e52aca602933c1380937ec63d1eb19b0b3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-522 final same-head evidence review — clear

Head a7d7e9e52aca602933c1380937ec63d1eb19b0b3/tree c7a7006300337d62af363b54bbb0f6d50e7b7673. Full source verdict rev-20261024-522-source3/A-10944 stands unchanged; fixed base ab77eae3, correction parent 3fb01872. Scope evidence, run rev-20261024-522-final; findings []; C1/C2 verified. Reviewer static Git/tracker/artifact/log reads only; no tests/probes/edits/Git mutation/browser/delegation.

Configured mode-free run 9fb039fe-754a-4897-bd42-d0df8eef5d86 / original A-11006 finishes exit0; task.view independently agrees on passed exact head. Native finish records contain 2932 ordinary passing tests/422 passing files plus15 load-gate passing test/file records, three new identities each5/5. No failure/cancellation/skip. Host T0 and all T1 (137 files/839 top-level identities), fallback all hub+Neovim T2 (241/1759) and full Web (44/224) completed. No T3/T4 command; remaining T3 deferred to configured periodic/integrated occasions. Not an all-tier/stage/QA clearance.

C1/C2: durable preparation lease + active running job in a two-slot budget produces the running job's remaining release ETA rather than zero; a lone preparation-only lease blocking an explicit remote waiter produces unknown/null rather than zero, and cannot acquire another provider slot. Published snapshot updates after the settled scheduler tick without an explicit queue read. Source deduplicates known active rows/durable leases and counts unmatched nonreleased leases as occupied unknown-release capacity. Ordinary durations respectively0.088307387/0.024191310/0.024288737s; corresponding5/5 repetition maxima0.177959341/0.072998817/0.056649213s, all below0.5s T1. These are semantic suiteUnit/fake provider/FakeClock/durable lease metadata assertions, not production provider ETA accuracy guarantees.

M2 regression settlement: executor-run-rules10/10 and merge-batches55/55 ordinary cases pass. Four original red stall/poll cases pass0.067295033/0.034771058/0.053785876/0.048930015s; checkpoint/replay cases also pass. Merge-batches entire file5.427483917s, six prior120000ms diagnostic cancellations no longer recur. Source correction removes fresh lease I/O from coalesced #check publication, refreshes detached with one owner, and preserves newer explicit-read cache precedence; existing assertions/timeouts remain intact. Earlier3ce5c77d/A-10835 remains failed prior-head evidence, not a passing retry or erased receipt.

Host T0 npm run check24.802s exits0. Marker c3652220380fb42b53eda2c255d682d4d672b601 is independently a Git tree; retained host check, not repeated remotely. T1/T2/Web envelopes67/363/159s differ from actual suite62.59/358.23/154.81s and shard62.57/263.91hub+94.27Neovim/154.70Web. Final Web projected150.266s at2workers is not measured wall at4workers. Linux x64 6.8.0-142-generic, c-8 lon1 cland-v0-00db4e01, Node24.21.0/Neovim0.12.5, configured2workers/Web4, lifetime690s/$0.0479. Disk fsync5.27ms/SQLite11.32ms; tmpfs0.09/0.54ms, iowait/steal0.01% each.

Report-only test lint133/60, budget warnings/missing5baselines and unchanged T3 ratchet2182.786s remain visible. Web actual wall154.81>40s; items49.397s/inbox41.874s and shell/connection/Mermaid/scale/render overages are retained. No enforcing-budget or clean-lint claim.

A-10946 honestly preserves filtered local macOS arm64/Node24.21 excerpts with no captured exit statuses or full logs. Base suites.ts substitution, diagnostic sweep-removal probe and debug prints were uncommitted controls; final a7d7e9e5 records include remote-budget17/17, combined82/82, batch55/55, targeted122/122 and check tailzero lintrefusals. No reruns for transcription or invented check wall. Local verification-workers0!=1 classification remains an implementer claim with incomplete surrounding output, not an accepted exemption. That T3 file has no native record in this configured selection, so no new passing assertion is assigned to it. Its absence does not widen this task's configured T0/T1/T2/Web evidence.

Done marks C1/C2 current at task.view before verdict. No item QA required (none/after-stage); no merge performed by reviewer. Final current-dev conflict check remains lead's next read-only report; no head change is authorized by this verdict. Standards0 findings; Spec0 findings.

A-11020 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11020-t-522-final-same-head-evidence-at-a7d7e9e5.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T12:47:13.172Z

Merged 785d0bbc04bd13989edfb2f33524854696819078 onto dev.
