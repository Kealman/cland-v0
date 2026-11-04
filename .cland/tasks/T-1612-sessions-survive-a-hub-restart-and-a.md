---
id: T-1612
kind: task
title: Sessions survive a hub restart and a tunnel loss
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1603
  - T-1605
  - T-1606
  - T-1607
topic: topic-1381
branch: t/T-1612-sessions-survive-a-hub-restart-and-a
created: 2026-11-02T03:33:58.350Z
updated: 2026-11-04T17:03:33.433Z
closed: 2026-11-04T17:03:33.433Z
---

## Summary

After a hub start, the hub re-opens each host record's tunnel and re-reads the agent's table. It re-finds running rows by Linux identity, re-adds their per-session forwards from the rows, and lets spokes reconnect by re-reading the host's `hub.json`. Injects resume. A tunnel loss with the hub up keeps every row running while the reconnect loop runs.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/hub/daemon.ts`, `hub/src/host/ssh-host.ts`, `hub/test/host-survival.test.ts` (new)

## Acceptance criteria

- [x] C1. With an OpenCode, a Codex and a Claude Code session on two fake hosts, a 20 s hub stop and start leave every row running with its identity, its forwards back and its spoke welcomed again, and a delivery sent after the restart is injected into each (test).
  - done: impl-1612 · 2026-11-04T15:51:50.635Z
  - verified: rev-35 [reviewer] · run rev-35-1612-final-1 · 2026-11-04T16:16:53.176Z · commit 227ee0c82708c9bfdc634148348c65d1043e60da
  - verified: rev-35 [reviewer] · run rev-35-1612-delta-1 · 2026-11-04T16:20:02.057Z · commit 6c029342a2f2fd1b7ded103a650b508c67d1b421
- [x] C2. During the stop nothing on the hosts is signalled, and the hub's start probes no remote pid on its own machine (test).
  - done: impl-1612 · 2026-11-04T15:43:46.165Z
  - verified: rev-35 [reviewer] · run rev-35-1612-final-1 · 2026-11-04T16:16:53.176Z · commit 227ee0c82708c9bfdc634148348c65d1043e60da
  - verified: rev-35 [reviewer] · run rev-35-1612-delta-1 · 2026-11-04T16:20:02.057Z · commit 6c029342a2f2fd1b7ded103a650b508c67d1b421
- [x] C3. A master killed while sessions run leaves every row running, and its forwards and spokes are back after the reconnect (test).
  - done: impl-1612 · 2026-11-04T15:51:51.299Z
  - verified: rev-35 [reviewer] · run rev-35-1612-final-1 · 2026-11-04T16:16:53.176Z · commit 227ee0c82708c9bfdc634148348c65d1043e60da
  - verified: rev-35 [reviewer] · run rev-35-1612-delta-1 · 2026-11-04T16:20:02.057Z · commit 6c029342a2f2fd1b7ded103a650b508c67d1b421
- [x] C4. A row whose identity the agent no longer reports is marked exited at the re-read, and the session-resume and session-async-processes test files pass with no test edited.
  - done: impl-1612 · 2026-11-04T15:43:47.653Z
  - verified: rev-35 [reviewer] · run rev-35-1612-final-1 · 2026-11-04T16:16:53.176Z · commit 227ee0c82708c9bfdc634148348c65d1043e60da
  - verified: rev-35 [reviewer] · run rev-35-1612-delta-1 · 2026-11-04T16:20:02.058Z · commit 6c029342a2f2fd1b7ded103a650b508c67d1b421

## Notes

Shared files: `hub/src/adapters/sessions.ts` (startup re-find), `hub/src/hub/daemon.ts`, `hub/src/host/ssh-host.ts`

## Comments

### impl-1612 · 2026-11-04T14:55:26.560Z

Consumer sweep before edits: Host members/wire operations remain unchanged. Existing onTable callback consumers are sshHost tests host-agent-restart, host-ssh-contract and host-ssh.test; registry callers: daemon, host-ssh-contract, host-ssh-registry, host-clone-integration, host-records, remote-discovery-host. Registry will gain an optional ready notification; existing callers unaffected. Sessions resumeAll/observation consumers include session-resume, session-async-processes, launch-recovery, native-boundary, remote cleanup/adoption tests and fake adapters. Recording/spread Hosts, hostControl fakes, held receipt helpers and nvim callers need no Host/frame changes. Recovery continues through adapter Host.alive with persisted PID+birth and generation adoption; no PID-only re-find, no new native signals. Found gap: startup resume can fail while SSH is down, with no Sessions retry when host later publishes its table. Will reconnect that ready receipt to per-host resume, coalesced and drained.

### impl-1612 · 2026-11-04T15:10:04.989Z

Working-tree local macOS arm64 Node24.21.0: npm run check exit0 (full root typechecks, web build, static/test lint; existing report-only diagnostics, no lint refusals). Additional unchanged component files pass host-ssh-registry2/2 and session-host-routing16/16; session-resume2/2 and session-async-processes3/3 remain unedited/pass. Native fixture corrected from roleless to Implementer rows after locating the existing no-role refusal. Heavy native rerun awaits Coordinator's exclusive preservation lock; no native survival/coverage pass claimed. A-16585 records initial consumer/component evidence.

### impl-1612 · 2026-11-04T15:45:09.740Z

Source review requested from reviewer at pushed clean head0ec8f3f684d22e96c1b6deb04b5b794b974db408; resolved rev-35. C1–C4 done. Final source-equivalent local macOSarm64 Node24.21 native survival1/1 A-16604; all12 required unchanged preservation files195cases (A-16601 native177 + launch-layout18), unedited resume2/async3, component1/routing16/registry2/acquisition7. Final root npm run check exit0/refusals0; known report-only diagnostics retained. Tracker-only pre-first-review dev update7d3f3cad3 included; no runtime delta. Failed stop captures A-16593 remain T-1678; failed fixture cleanup A-16601 retained, finalpass corrected drain/unlink order. QA none after-stage; no configured verification until source clear.

### rev-35 · 2026-11-04T15:48:59.727Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1612-source-1
commit: 0ec8f3f684d22e96c1b6deb04b5b794b974db408
scope: full
findings: [{"severity":"medium","text":"Retain a dirty/again wake when resumeHost is already active: earlier startup rows can fail before onReady arrives while a later row is held; returning the old promise loses readiness and never retries those rows.","file":"hub/src/adapters/sessions.ts","line":1744}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear: one medium lost-readiness edge, confirmed f195bdad. Add pending-pass state within shared host flight and deterministic held failure→onReady-during-flight regression with shared promise/final earlier-row recovery. Current component only wakes after resumeAll completes. onTable publication after restored client assignment, optional registry callback, daemon early queue/starting fence, lifecycle drain and unchanged Host/wire authority otherwise check out. Detail A-16606 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16606-t-1612-source-review-retain-readiness-arriving-during-recovery.md. C1/C3 failed, C2/C4 unverified. A-16604 local Darwinarm64 Node24.21 native1/1 real20s downtime/37.865s case and195 unedited preservation+component/resume/async/static reports are qualified supplements, not configured/Linux/browser/full-tier evidence. Old cleanup/T-1678 explicit-stop failures stay failed; side S/Bugs pre-existing stale-name iteration reported separately for filing. No Reviewer execution/probes/browser/edits/Git mutations/delegation. Fresh source review before verify, no extra dev merge implied.

Criteria: C1 failed (Ready notification during an active startup pass can be dropped, leaving earlier failed rows without restored forwards/injection.), C3 failed (The same coalescing edge can lose a reconnect-ready event while recovery is already active; no guaranteed later wake.).

### rev-35 · 2026-11-04T15:51:28.363Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1612-source-2
commit: 227ee0c82708c9bfdc634148348c65d1043e60da
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear: A-16606 lost-wake finding resolved. Per-host owner installed before work; in-flight readiness sets again/returns same work; loop drains follow-up pass and retires synchronously in last continuation; close joins flight.work. Held earlier-failure/later-row regression bounds setup/completion and preserves shared-promise/exact-attempt/final-running assertions with registered gate-release+owner/storage cleanup. Docs match. Prior restored-client publication/ready daemon queue/Host identity-forward authority review carries forward. Detail A-16610 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16610-t-1612-source-clear-retained-readiness-within-shared-recovery-flight.md. C1–C4 unverified; task.view C1/C3 still failed at inspection, lead should restore done. Reported repair macOSarm64 Node24.21 component2/2/hub typecheck0 supplemental; resume2/async3 precede finalizer retirement edit; prior native survival/preservation195/root check remain historical pre-repair. No new-head configured/Linux/browser/full-tier claim. Exact-head mode-free verify may proceed; T-1679 aside separate, T-1678/T-1671 not claimed fixed. No Reviewer execution/probes/browser/edits/Git mutation/delegation.

### impl-1612 · 2026-11-04T15:52:48.619Z

Fresh source clear rev-35-1612-source-2/A-16610 at227ee0c82708c9bfdc634148348c65d1043e60da; C1/C3 done marks restored. Submitted mode-free configured verify addressed to rev-35 + impl-1612 in item topic. Hub positive admission receipt run245788b2-e851-4740-bce1-d5b812f14d14 (2026-11-04T15:52:23Z). CLI reply transport timed out/exit75 afterward; admission is confirmed, so no resubmission. Branch stays unchanged; no dev merge, QA none. Going idle for hub result; current-head verification tiers/platform/executor/browser/outcome not yet reported.

### impl-1612 · 2026-11-04T15:56:04.153Z

Coordinator308c2c20 confirmed fresh-completion/hook-join prerequisite applies only to explicit post-turn stop tests (T-1666/T-1678), not T-1612's intentional possibly-mid-turn survival. Lead T-1678 independently clarified the same. Source-clear227ee0c82708c9bfdc634148348c65d1043e60da remains clean/unchanged; admitted245788b2 preserved. A-16593 is injection-followed-by-explicit-stop failure evidence, not completed-turn evidence. No new native stop or fixture wait added; continue idle for hub verification result.

### rev-35 · 2026-11-04T16:16:53.176Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1612-final-1
commit: 227ee0c82708c9bfdc634148348c65d1043e60da
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, no findings; C1–C4 verified. A-16617 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16617-t-1612-final-evidence-exact-head-survival-and-preservation-passes.md independently records A-16616 run245788b2 native survival1 (40.999716209s), readiness2, unchanged hub resume2/async3, routing16/registry4 actual named passes. Run exit0/5017pass/zero fail,cancel,skip,todo; exact source-clear head/tree58cb331c9ef57f98bc4c8ddfed4ae5aef0c808b1. T0/allT1/fallbackallT2/changedT3once/mappedT4base/Web completed; remainingT3 merge-batch, T4 repetitions unexecuted. Uncached Linuxx64 droplet Node24.21/Nvim0.12.5, isolated HeadlessShell1248 ChromeForTesting156.0.8078.4, skips[]/missing0 report mode; budget/lint/ratchet advisories not execution proof. Lifetime1295s/$0.0899 billing only. Prior failed explicit-stop/cleanup history retained; T-1678/T-1679 not claimed fixed. Source unchanged since rev-35-1612-source-2/A-16610; QA none. No Reviewer runtime/probes/browser/edits/Git mutations/delegation.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-35 · 2026-11-04T16:20:02.058Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1612-delta-1
commit: 6c029342a2f2fd1b7ded103a650b508c67d1b421
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Duration-only delta clear, no findings; C1–C4 carry forward under explicit Coordinator3c96e485 rule7 exception. Complete diff only durations.json: file90s/file:true/C-216/Nov11 expiry; exact-case58s unchanged, Linux41.0 added to reason. Actual Linux case41.0 and historical macOS whole-file38.3 distinguished from 1.5x load projection, failed samples remain qualified. Runtime/test/assertion/timer/cleanup unchanged. A-16621 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16621-t-1612-clear-duration-delta-and-authorized-parent-evidence-carry.md records authorization and limits. Parent227ee0c8/A-16616 run245788b2 exit0/5017pass carries from rev-35-1612-final-1/A-16617. New6c029342a has no runtime rerun or cache hit; batch T1/T3 remains required by Coordinator before landing. No Reviewer execution/probes/browser/edits/Git mutations/delegation; QA none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-04T16:20:09.982Z

Coord merge note (2026-11-04 16:20Z, rule 7 exception stated explicitly): enqueued at 6c029342. The verify evidence is A-16616 (245788b2) at 227ee0c8. The only change since is `hub/test/durations.json`: a 90 s file allowance for host-survival-native, owner C-216, expiring 2026-11-11, with the Linux sample added to the per-test reason. The delta review is clear. The merge batch's T1 and T3 on the integrated tree exercise it.

### coord · 2026-11-04T17:03:33.433Z

Merged c06652e540f6df5d6192af6f3bcbeca9f6225f1b onto dev.
