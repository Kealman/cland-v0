---
id: T-751
kind: task
title: Remote, executor and doctor component fixtures inject machine and Git facts instead of bootstrapping native Git and doctor probes
state: open
status: review
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: topic-460
branch: t/T-751-remote-executor-and-doctor-component
created: 2026-10-17T18:44:08.662Z
updated: 2026-10-17T23:48:41.234Z
---

## Summary

Route R1 in T-748's trip list (A-4703) also covers the scripted remote and executor component fixtures and doctor: demo-cap, demo-release-component, executor-admission(-lock), executor-droplet-component, executor-prepare-retry, executor-safety-component, remote-scripted and doctor (52 rows). They still bootstrap native Git and doctor probes inside T2 fixtures.

## What to build

Inject the Git, snapshot and doctor facts these fixtures need at their seams (T-699's in-process executor fixture, T-719's injected readers), keeping one real-process proof per behaviour in existing T3 files. Every assertion keeps its meaning.

## Acceptance criteria

- [ ] C1. The runtime tripwire reports no child_process trip in these files, proved by a full droplet run's trip report.
- [x] C2. The review request maps every changed fixture call with Mac 5/5 medians before and after.
  - verified: rev-31 [reviewer] · run rev-20261017-751-source · 2026-10-17T22:07:59.308Z · commit 9dc81db646d4f027a3b400e3840674f716e2ee69
  - done: impl-751 · 2026-10-17T23:46:48.155Z
  - verified: rev-31 [reviewer] · run rev-20261017-751-merge-delta · 2026-10-17T23:47:41.070Z · commit 8a2b593bc66d491fea5ec0731149b9a28cb89447

## Comments

### impl-751 · 2026-10-17T21:53:33.805Z

Merged origin/dev (9bd3425c). Baseline 5/5 serial Mac runs underway for nine named files. Coordinated T-750 projectHub options/native defaults and T-752 durationContext; T-751 owns remote/close-run fixtures and lock process identity injection. Coordinator corrected scope to 92 recorded rows in nine files and authorized full droplet all for C1.

### coord · 2026-10-17T21:58:29.472Z

Scope note (coord, 21:58Z): T-751 owns close-run-fixture and remote-fixture, so its C1 also covers the trips those fixtures cause in suite-close-component and any other R1 file using them. T-750 lists those rows as "T-751-owned residual".

### coord · 2026-10-17T22:02:38.743Z

Scope note 2 (coord, 22:02Z): in suite-close-component, the legacy duration-key Git path (shard planning → lintDurations → legacyDurationKeys) belongs to T-745. It is listed as "T-745-owned residual" and proved clean by T-745's final full run. C1 evidence is the mode-free droplet verify, provided its dry-run selection includes every C1 file. Otherwise coord submits the full run, because `verify all` is reserved to the Coordinator.

### impl-751 · 2026-10-17T22:06:36.296Z

Committed/pushed 9dc81db646d4f027a3b400e3840674f716e2ee69; source review requested from reviewer, resolved to rev-31, against T-752 base 9096e2b4 per Coordinator order. A-4772 has complete fixture map and ten-file Mac 5/5 medians; A-4771 has raw metrics/check receipts and disclosed interrupted attempts. Typecheck, tiers and lint exit0. Nine assigned files zero local enforced process trips; suite-accounting and suite-stage-rules supplemental enforcement zero; native doctor-cli green. C2 marked done. C1 waits for T-752 landing, dev merge + delta source review, then mode-free droplet dry-run and verification. suite-close legacy duration history rows remain T-745-owned residual per cf3ae51e.

### rev-31 · 2026-10-17T22:07:59.308Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-751-source
commit: 9dc81db646d4f027a3b400e3840674f716e2ee69
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-751 source review

Reviewed commit: 9dc81db646d4f027a3b400e3840674f716e2ee69.
Fixed review base: 9096e2b4c7fe67025877f6364f9bc198ba4235f0 (T-752).
Scope: full source review of the 20-file T-751 diff. Read-only review; no Reviewer test execution, edits or delegation.

## Standards

No findings. Reviewed against AGENTS.md, docs/agents/tests.md and the applicable fixture/lifecycle notes in hub/README.md. The optional fact readers preserve native defaults. Async lock injection reaches owner creation, main-lock inspection and recovery-guard inspection without contaminating native start-time caches; real file locking, holder tokens, conservative null identity handling and release ownership remain intact. Native bundle creation was extracted without changing its commands, timeouts or delivery sequence. No new test declarations, tier changes, allowances or literal sleeps were introduced.

The changed same-name observation drives only admitted product waits through both existing remoteWaits owners. It still observes both held creates before releasing either provider barrier; all original identity, concurrency, completion and cleanup assertions remain.

## Spec

No findings. Doctor receives process/territory/orphan facts separately from actual project-file parsing and hub socket checks. Scripted remote fixtures inject candidate, Git, snapshot and duration facts; process-mode fixtures retain real Git, transport and lifecycle paths. Droplet/spend reservation, settlement, registration and shard paths forward the injected process table. Demo ancestry still passes through the production authorization and lease policy, with native territory Git as the default.

Inspected unchanged native supporting contracts: doctor-cli, executor-prepare, demo and executor transport/lifecycle files retain the real process boundaries. Scripted fixture Git and territory entry points explicitly refuse accidental native setup.

C2 established by A-4772's call-site map and A-4771's measurement records. Independently regrouped the records: nine assigned files each have five before and five after code-0 measurements, all admitted below load 15. Rounded before → after median seconds:
- demo-cap: 1.467 → 1.388
- demo-release-component: 6.724 → 4.700
- executor-admission: 0.454 → 0.603
- executor-admission-lock: 5.538 → 3.211
- executor-droplet-component: 0.544 → 0.734
- executor-prepare-retry: 2.563 → 1.619
- executor-safety-component: 8.424 → 2.492
- remote-scripted: 2.627 → 1.390
- doctor: 14.078 → 2.355

Supplemental suite-close-component: five after measurements, median 3.246 s; its five before measurements and 8.923 s median are separately recorded in A-4752, with source-equivalence provenance disclosed. These artifacts contain measurement/check records, not complete raw TAP transcripts; this review does not claim a raw transcript audit. The interrupted remote-scripted bootstrap attempt is retained separately and excluded from the accepted replacement set.

C1 remains unverified. Local enforced results in A-4771 are supporting evidence only: the nine assigned files and supplemental accounting/stage cases report zero child-process trips. suite-close-component's three legacyDurationKeys trips remain explicitly T-745-owned under Coordinator cf3ae51e; suite-protocol compatibility readers are T-750-owned under d90d40c3. Neither residual is silently treated as clean.

## Next gate

Source clear at this exact head; verify C2 only. Follow the requested T-752-first landing order, then obtain a new source delta verdict for the required dev merge before verification. At that reviewed merged head, use the mode-free dry-run to check inclusion of every C1 file, including affected shared-fixture callers; missing selection goes to the lead/Coordinator. Then submit the authorized mode-free droplet verification. No final execution clearance or per-item QA is claimed.

Standards: 0 findings. Spec: 0 findings.

Durable review: A-4777, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4777-t-751-source-review-injected-machine-facts-at-9dc81db6.md.

Criteria: C2 verified.

### impl-751 · 2026-10-17T23:46:48.528Z

Required T-752-first integration complete: merged dev a8ece990 then b51907e6, pushed 8a2b593bc66d491fea5ec0731149b9a28cb89447. Clean auto-merges audited; no post-review implementation edits. Delta review requested from reviewer; A-4858/A-4857 refresh ten-file5/5 and final-head typecheck/tiers/lint plus eleven enforced zero-trip files. A-4772 assertion/call map remains current. C1 still pending delta verdict, mode-free dry-run inclusion and same-head droplet run. Coordinator d8972c4d lifted restart hold; no verify submitted before release.

### rev-31 · 2026-10-17T23:47:41.070Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-751-merge-delta
commit: 8a2b593bc66d491fea5ec0731149b9a28cb89447
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-751 integration delta source review — clear

Exact commit: 8a2b593bc66d491fea5ec0731149b9a28cb89447.
Prior source: 9dc81db646d4f027a3b400e3840674f716e2ee69, rev-20261017-751-source / A-4777.
Integrated dev: b51907e6ff78fda34f55925cc351775275f5367b.
Scope: delta. Read-only review; no Reviewer edits or execution.

Coordinator d8972c4d explicitly required the dev merge after T-752 landed. The first-parent delta consists of two dev merge commits, 1f53e40d and 8a2b593b, with no new task implementation commit. The net diff against integrated dev still has exactly the same 20 task paths as the original review.

## Standards

No findings. Native defaults, fixture lifecycle ownership, file lock semantics and original assertions reviewed in A-4777 remain intact. No new test declaration, wait, retag or task allowance was added by the integration. The task adds no allowance relative to dev; inherited scenario allowances are now E-677-owned following the Coordinator's ownership correction.

## Spec and integration

No findings. Among the 20 task files, only dispatch.ts and remote-fixture.ts differ from the prior reviewed source. Those changes are inherited dev:
- Dispatch adds T-755 health receipt formatting/journal fields beside the retained project Git injection into Demos.
- remote-fixture adds the rejecting mount shim only within the existing non-scripted branch; all scripted candidate/snapshot/Git/process injection remains.
The second merge changes none of the 20 task files.

Inspected Suites integration: T-752 durationContext remains alongside the inherited health/cache/result receipt paths. Health parsing reads existing logs and leaves a missing scripted health receipt optional; it does not replace duration facts or admission provenance. Native transport/worker health code is inherited from reviewed dev, rather than task-side scope expansion. T-754 Neovim boundary and T-702 migration are inherited dev work; no unmerged T-750 implementation was imported.

## C2 evidence

A-4772's before/after call-site and assertion map remains applicable. A-4857/A-4858 refresh after measurements: ten files, five code-0 samples each, every admission load below 15. Independently regrouped all 50 records and recalculated medians:
demo-cap .975; demo-release-component 2.682; executor-admission .375; executor-admission-lock 1.593; executor-droplet-component .332; executor-prepare-retry 1.221; executor-safety-component 1.981; remote-scripted .875; doctor 1.329; suite-close-component 1.580 seconds.

Measurements were taken at 1f53e40d; independent diff confirms all 20 task files are byte-identical at final head. The original pre-change baseline remains A-4771/A-4752. Evidence records are structured measurement/check results, not raw TAP transcripts; this review does not claim a raw-log audit. Final-head typecheck/tiers/report-only lint records all exit 0. Eleven local enforced file records report code 0 and zero child-process trips.

C2 verified at the new head. C1 remains unverified pending actual droplet execution and positive trip/identity evidence for all twelve C1 files. The suite-close-component legacyDurationKeys path remains the explicitly T-745-owned residual under cf3ae51e; compatibility readers remain T-750-owned under d90d40c3. No residual is silently marked clean.

## Verdict and next gate

Source delta clear; verify C2 only. Next inspect a mode-free droplet dry-run for inclusion of the nine assigned files plus suite-close-component, suite-accounting and suite-stage-rules. Then submit the authorized mode-free droplet verification at this exact head; missing coverage goes to the lead/Coordinator. Submission hold was explicitly lifted in d8972c4d. No final execution clearance or per-item QA is claimed.

Standards: 0 findings. Spec: 0 findings.

Durable review: A-4860.

Criteria: C2 verified.

### impl-751 · 2026-10-17T23:48:41.234Z

Delta source clear rev-20261017-751-merge-delta at 8a2b593b / A-4860; C2 reverified. Mode-free droplet dry-run A-4863 and all12-file proof A-4864 establish complete C1 selection (hub-only,2 workers). Accepted mode-free droplet run 0ade3bc3-efdc-4833-ae97-438caf22c150 at exact clean reviewed 8a2b593bc66d491fea5ec0731149b9a28cb89447. No head changes planned; awaiting runtime/trip receipt before marking C1 done and final evidence verdict. T-745 legacyDurationKeys residual explicitly excluded per Coordinator scope.
