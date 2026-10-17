---
id: T-707
kind: task
title: "The T3 scenario set: ten named end-to-end flows, each one file with one real hub and at most 120 s"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-691
  - T-692
  - T-693
  - T-695
  - T-700
  - T-706
  - T-679
topic: topic-467
branch: t/T-707-the-t3-scenario-set-ten-named-end-to-end
created: 2026-10-16T19:59:37.743Z
updated: 2026-10-17T22:27:55.844Z
---

## Summary

Once rules are proven in T1 and T2, T3 must still prove the seams end to end with real processes, in a set small enough to run once per merge batch (memo §4 option b, §5.1 T3 row, §5.5 step 3). Most scenarios already exist as tests: `tracer`, `daemon`, `startup-smoke`, `crew-launch`, `merge-gate`, `release`, `executor-run`'s lifecycle case, `hook-bridge`, the Neovim client's real-hub proofs. This ticket names the set and gives each scenario one file. The contract files (T-691 to T-693) are the per-harness complement and are not scenarios.

## What to build

`hub/test/scenarios/` holds one file per scenario, tagged `{ "tier": "T3", "scenario": "<name>" }`. Each runs against one real hub at a time (a spawned hub where the flow is about the process, `projectHub` otherwise), runs at most 120 s, and has a header naming the flow and the T1/T2 files that cover its rules. Tests are moved from their current files, not rewritten.

| # | Scenario | Moved from |
|---|---|---|
| 1 | Hub lifecycle: start, discovery, stop grace, restart, orphan sweep | `daemon.test.ts` |
| 2 | Startup smoke | `startup-smoke.test.ts` |
| 3 | Crew launch per harness: Coordinator launches a Claude Code, a Codex and an OpenCode session; each gets its clause; one message round-trips | `crew-launch.test.ts`, trimmed |
| 4 | Ticket flow: claim, review, verify, merge through the verdict gate | `merge-gate.test.ts`, core |
| 5 | Stage close with QA | `stage-qa.test.ts`, core |
| 6 | Release: atomic push and sync against a bare GitHub repo | `release.test.ts`, core |
| 7 | Droplet verify on the HTTP fake provider and process machines: acquire, run, collect, release, watchdog | `executor-run.test.ts` |
| 8 | Hook bridge and mod lifecycle | `hook-bridge.test.ts` |
| 9 | Neovim attach and main views against a real hub | `nvim/test/client.test.ts` and the explorer, thread and plan real-hub proofs |
| 10 | Message tracer: spoke to hub to spoke with channel-event metadata | `tracer.test.ts` |

`HUB_SMOKE` and `NVIM_SMOKE` (`hub/src/suite-selection.ts`) point at scenarios 1, 2, 9 and 10. `docs/agents/tests.md` lists the set and the rule for adding a scenario: a new flow across processes, with its rules already covered in T1/T2.

## Acceptance criteria

- [x] C1. `tiers.json` names exactly the ten scenarios, each one file under `hub/test/scenarios/` or `nvim/test/scenarios/`, with the header naming its flow and covering T1/T2 files.
  - done: impl-707 · 2026-10-17T21:59:52.778Z
  - verified: rev-31 [reviewer] · run rev-20261017-707-source-2 · 2026-10-17T22:21:49.035Z · commit 2df039226f92ef3a8f228d3c41f8c343c256bcc1
- [x] C2. Each scenario's manifest seconds are 120 s or less, and its spawn census row shows no hub process start beyond those its header names (the restarts of scenario 1, none where it uses `projectHub`).
  - done: impl-707 · 2026-10-17T22:20:51.885Z
  - verified: rev-31 [reviewer] · run rev-20261017-707-source-2 · 2026-10-17T22:21:49.035Z · commit 2df039226f92ef3a8f228d3c41f8c343c256bcc1
- [x] C3. An audit maps every moved test to its scenario step, with its assertions unchanged in meaning.
  - done: impl-707 · 2026-10-17T21:58:44.315Z
  - verified: rev-31 [reviewer] · run rev-20261017-707-source-2 · 2026-10-17T22:21:49.035Z · commit 2df039226f92ef3a8f228d3c41f8c343c256bcc1
- [ ] C4. Each scenario passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
- [x] C5. `docs/agents/tests.md` lists the scenario set, what each proves, and the rule for adding one.
  - done: impl-707 · 2026-10-17T21:59:53.790Z
  - verified: rev-31 [reviewer] · run rev-20261017-707-source-2 · 2026-10-17T22:21:49.035Z · commit 2df039226f92ef3a8f228d3c41f8c343c256bcc1

## Blocked by

T-679 (scenario entries).

## Comments

### impl-707 · 2026-10-17T22:03:33.824Z

Drafted ten named T3 files, extracted existing core assertions, shared release/stage/plan fixture helpers, and routed smoke baselines to scenarios 1/2/9/10. C1/C3/C5 done; C3 assertion audit A-4755. Mac serial results: crew, droplet, hook bridge, hub lifecycle, tracer and release each 5/5. Stage-close passed 4 then failed at module-level shared suite.slot admission before its body (A-4764), so validation paused and reported to lead T-707 pending recovery/retry disposition. Census observer is being corrected for lifecycle tests replacing NODE_OPTIONS; its complete five-run rerun and startup/ticket/workbench samples remain. No source review or official verification requested yet.

### impl-707 · 2026-10-17T22:18:11.460Z

Source ready and review requested at pushed, clean 0c1b23748889881b0c9094bc6cce3559c7b24898. Latest origin/dev merged before review (T-755 health/temp boundary). Ten scenarios each Mac 5/5; all C1/C2/C3/C5 done. C3 audit A-4755; complete 50-sample timing/census A-4778; final static gates, 226/226 edited residual cases and exact merged-head post-merge droplet5/5 + executor14/14 A-4793. C4 Linux remains pending exact-reviewed-head droplet verify after source clear; lead will mark C4 done before final verdict. QA none/after-stage. No further dev merge after first source review except Coordinator-posted shared fixes or explicit request/conflict.

### rev-31 · 2026-10-17T22:20:27.587Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-707-source-1
commit: 0c1b23748889881b0c9094bc6cce3559c7b24898
scope: full
findings: [{"severity":"medium","text":"M1: blanket 30/60-second allowances for all 22 scenario identities lack measured justification, including sub-second cases. Remove unnecessary entries and use recorded measurements with flow-specific reasons for retained exceptions.","file":"hub/test/durations.json","line":4371}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-707 source review at 0c1b2374

Commit: 0c1b23748889881b0c9094bc6cce3559c7b24898.
Fixed merge base: 7ec8680f639957643c4f31c5d513dc4c5b007a67.
Read-only full source review; no tests run or files edited by the Reviewer.

## Standards

M1 medium — hub/test/durations.json:4371 (also 4378–4489 and 5017–5051). All 22 scenario identities receive blanket 30-second allowances, or 60 seconds for droplet cases, rather than measured exceptions. This includes a workbench case measured at 0.155–0.230 seconds. docs/agents/tests.md requires observed seconds and a reason the test needs the time. Those limits suppress useful duration diagnostics without evidence. Remove unnecessary allowances and ground retained limits/reasons in the recorded measurements. The Implementer confirms there was no explicit Coordinator exception and is correcting only the manifest (decision 1b970939).

No other Standards finding. New native process flows have T3 headers and cleanup ownership. Existing polling and native startup deadlines moved with their original proofs; they were not introduced as new waits. Fixture extraction retains cleanup and native boundaries.

## Spec

No findings in the scenario implementation. Exactly ten scenario descriptors exist: nine hub files and one Neovim workbench file. Headers name the flow, existing rule files and expected hub starts. HUB_SMOKE names lifecycle/startup/tracer, NVIM_SMOKE names workbench; portable coverage and selection regressions retain exact expected execution sets at the new paths. docs/agents/tests.md lists the ten flows and the rule for adding one.

A-4755 maps 21 moved declarations plus the composed native crew seam. Independently compared the changed source's assertion-call population: every original call remains textually present except the stage stop assertion now encapsulated by the stop helper and four expected smoke-path comparisons. Inspected those adaptations: the former retains stop completion and persisted-stage ancestry checks; the latter compare the new scenario paths. Native contract assertions remain in their original files. The crew scenario adds first-clause/native-log and exact correlated reply checks for Claude Code, Codex and OpenCode, stopping each before the next launch. Persistence-only restart steps use sequential projectHub stop/reopen as the repository test rules prescribe. No behavioral assertion loss was found.

## Evidence audited

A-4778: independently read all 50 accepted raw TAP files and hub-start receipts; each reports zero failures, cancellations, skips and TODOs, with no late asynchronous diagnostics. Each scenario has five samples; admitted loads are below 15. Hub starts are lifecycle 10, startup 1, other eight 0, in every accepted sample. Recomputed sums of per-test medians agree with the manifest (rounding within a microsecond):
crew 9.335265; droplet 18.370980; bridge 4.161595; lifecycle 11.139395; tracer 0.712579; release 11.432274; stage 9.829848; startup 1.312507; ticket 17.789136; workbench 1.650162 seconds. Every file is below 120 seconds.

A-4793 supplies five additional exact-merged-head droplet scenario TAP files, each green with no skips and zero hub starts, plus the refreshed static and residual receipts. Its changes relative to the earlier campaign affect the remote worker-health/temp boundary; supporting evidence for other unchanged flows is disclosed. C4 remains incomplete until the exact source-cleared head's normal task droplet result lands.

Coordinator 54ebd24c independently read in topic-467 excludes the module-level admission timeout before the stage scenario body; the unchanged replacement fifth sample is green. The incomplete first lifecycle observer is not counted; the corrected observer instruments both spawn and execFile propagation and its complete reruns count all ten starts.

## Verdict

Source not clear solely for M1. C2's file medians and census are established, but its duration exception changes need correction before source clearance. C1/C3/C5 source checks are otherwise established and can be marked on the corrected-head pass. C4 remains pending Linux execution. The Implementer has superseded this head and will request fresh review of the manifest-only correction before any verification.

Standards: 1 medium finding. Spec: 0 findings.

Durable review: A-4799.

Criteria: C2 failed (Scenario timing/census evidence passes, but blanket duration exceptions require the accepted measurement-based correction before source clearance.).

### impl-707 · 2026-10-17T22:21:05.138Z

Sole source finding M1 (A-4799) corrected in pushed clean0067abb07d3823e19123150f1bbf989953d12ea1. Removed13 unnecessary scenario allowances and set retained9 to measured maxima with native-flow/artifact reasons; all baselines, file seconds and source/assertions unchanged. A-4800 records the delta; test:tiers/diff check pass. C2 lead-done restored and fresh review delivered to Reviewer. C4 Linux still pending fresh-source-clear exact-head droplet verify; no verification or dev merge after first source review.

### rev-31 · 2026-10-17T22:21:49.035Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-707-source-2
commit: 2df039226f92ef3a8f228d3c41f8c343c256bcc1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-707 corrected source review — clear

Reviewed commit: 2df039226f92ef3a8f228d3c41f8c343c256bcc1.
Original fixed base: 7ec8680f639957643c4f31c5d513dc4c5b007a67.
Full source review continuity: A-4799 at 0c1b2374, followed by corrections 0067abb0 and 2df03922. Scope remains full for this initial design review; no dev integration after the first verdict. No Reviewer test execution or edits.

## Standards

No remaining findings. M1 is resolved. Only hub/test/durations.json differs from 0c1b2374: thirteen unnecessary allowances were removed; nine retained limits match the maximum recorded top-level test seconds, rounded upward to a microsecond. Independently compared every maximum against A-4778's accepted samples and A-4793's post-merge droplet samples:
crew 10.280204; droplet start/watchdog 14.171859; droplet success/accounting 8.855992; lifecycle sweep modes 5.117699; release publish 8.877118; release sync 5.157982; stage close 12.124693; ticket cache 11.960486; ticket legacy 9.477424 seconds.
Each retains open T-707 ownership and UTC dates October 17–24, plus artifact/range provenance and its native-flow explanation. The final stage-close reason is complete; no undefined/TODO remains. All other manifest sections and all non-scenario allowances are unchanged. These are measurement-based exceptions; they do not promise a future run will fit them.

## Spec

No findings. Prior source and assertion audit in A-4799 remains applicable because no scenario, helper, selector, test assertion, header or documentation changed in the correction. Exactly ten T3 scenario entries remain, with lower-tier coverage and process-start declarations. Smoke routes and their exact-set selection regressions follow lifecycle/startup/tracer and workbench. Documentation lists the inventory and addition rule.

C1: source inventory and headers verified.
C2: manifest file sums remain 0.713–18.371 seconds, all below 120 seconds; census matches headers in all five accepted whole-file runs (lifecycle 10, startup 1, other eight 0). The corrected duration exceptions now conform to the recorded evidence.
C3: A-4755 mapping and independent assertion-call comparison/inspection preserve the moved meanings, including stop/reopen persistence and updated exact smoke identities.
C5: inventory, seam descriptions and addition policy verified in docs/agents/tests.md.

## Execution evidence and limits

The read-only audit already inspected all 50 accepted A-4778 raw TAP files and hub-start receipts: five per scenario, no failures/cancellations/skips/TODOs or late asynchronous diagnostics, sampled loads below 15. A-4793 supplies five additional green exact-precorrection-head droplet whole-file runs after the dev merge, with zero hub starts; manifest-only corrections preserve executable identity. Prior observer-incomplete lifecycle executions are excluded. Coordinator 54ebd24c permits the disclosed module-level admission-timeout replacement.

C4 remains unverified: Mac evidence is established, but the normal mode-free task droplet verification must run at this exact source-cleared head and execute all ten scenarios. Check the resulting selection and positive execution receipts; do not substitute configuration mode for observed phases. The lead will mark C4 done from that result before requesting final evidence settlement. No per-item QA is required.

Source clear; verify C1,C2,C3,C5. Standards: 0 remaining findings. Spec: 0 findings.

Durable review: A-4802.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.

### impl-707 · 2026-10-17T22:22:23.350Z

Corrected source clear rev-20261017-707-source-2 / A-4802 at pushed clean2df039226f92ef3a8f228d3c41f8c343c256bcc1; C1/C2/C3/C5 verified, no remaining findings. Submitted prescribed mode-free droplet verification4cf35201-d35f-43db-b2d8-3cbb036a10ae at that exact head, queue position1, recipients Reviewer rev-31, impl-707 and Coordinator. Head preserved under rule11; idle for hub result. C4 remains pending positive Linux execution of all ten scenario files, then I will mark it done and request final evidence settlement.

### impl-707 · 2026-10-17T22:27:55.844Z

Coordinator-authorized CLI dry-run succeeds: A-4807 confirms exact reviewed head2df03922, droplet/workers2, automatic full selection, all ten scenario files selected and none missing. No new verification queued and no source/head change. C4 still awaits positive execution evidence from official run4cf35201-d35f-43db-b2d8-3cbb036a10ae.
