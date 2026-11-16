---
id: T-1764
kind: task
title: One pending sub-agent permission prompt sends a new Telegram approval card at every coord turn boundary
state: closed
status: done
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1886
blocked_by: []
topic: topic-1554
branch: t/T-1764-one-pending-sub-agent-permission-prompt
created: 2026-11-08T18:34:49.448Z
updated: 2026-11-16T21:22:48.244Z
closed: 2026-11-16T21:22:48.244Z
---

## Summary

One pending Claude Code permission prompt, raised by a sub-agent of the Coordinator, sent a new "Waiting for approval" card to the human's Telegram every time the Coordinator's main turn ended. That made six cards for one prompt. A single pending prompt should announce once, with at most one reminder after a long interval.

## Evidence

- On 2026-11-08 a coord sub-agent's Bash call stalled at 15:48Z on Claude Code's own "Dangerous rm operation not ruled out" check (a nested heredoc; no rm in the command).
- While that one prompt stayed pending, the hook re-reported `waiting for approval` at each coord turn boundary: 16:06, 16:18, 16:31, 16:42 and 16:54Z. Each report produced a fresh "coord · claude-code — Answer in its terminal. Waiting for approval" card in Telegram.
- cland-impl answered No at 16:56Z. The human saw the cards as noise.
- The state mapping is in `hub/src/adapters/claude-code.ts` (`waitingFor` → `waiting for approval`, around lines 147 and 187). The remote card fan-out sits downstream.

## Acceptance criteria

- [x] C1. A session that re-enters `waiting for approval` for the same pending prompt, with no state in between other than the same wait, sends no new remote card or Agents notice (test).
  - done: impl-1764 · 2026-11-16T14:02:34.573Z
  - verified: rev-38 [reviewer] · run rev-38-1764-final-1 · 2026-11-16T14:31:54.527Z · commit 0c9f608455c75b936c7c671bf29f4911f76d1aa8
  - verified: rev-38 [reviewer] · run rev-38-1764-delta-1 · 2026-11-16T15:18:10.739Z · commit 9a6083a6befd6a9a4a6107912bdeacc6670106ee
- [x] C2. A new prompt, or the same session entering a wait again after it resolved, still announces once (test).
  - done: impl-1764 · 2026-11-16T13:50:52.174Z
  - verified: rev-38 [reviewer] · run rev-38-1764-final-1 · 2026-11-16T14:31:54.527Z · commit 0c9f608455c75b936c7c671bf29f4911f76d1aa8
  - verified: rev-38 [reviewer] · run rev-38-1764-delta-1 · 2026-11-16T15:18:10.739Z · commit 9a6083a6befd6a9a4a6107912bdeacc6670106ee
- [x] C3. A still-pending prompt sends at most one reminder, after a fixed interval on the hub clock (test).
  - done: impl-1764 · 2026-11-16T14:02:37.420Z
  - verified: rev-38 [reviewer] · run rev-38-1764-final-1 · 2026-11-16T14:31:54.527Z · commit 0c9f608455c75b936c7c671bf29f4911f76d1aa8
  - verified: rev-38 [reviewer] · run rev-38-1764-delta-1 · 2026-11-16T15:18:10.739Z · commit 9a6083a6befd6a9a4a6107912bdeacc6670106ee

## Comments

### impl-1764 · 2026-11-16T13:48:57.268Z

Rule 20 inventory and C1-C3 red/green evidence: A-20103 and the consumer-inventory artifact in topic-1554. Additive optional ApprovalRecord metadata; previous-wire fixture retained in remote-neutral.test.ts. Telegram/Discord notice keys use the single reminder timestamp; relay answers and card content unchanged.

### rev-38 · 2026-11-16T13:55:41.943Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1764-source-1
commit: 26728a37fbeaec24a0970e52d83004d31c1c3e18
scope: full
findings: [{"severity":"medium","text":"The approval ordering watermark advances on every hook, including state-free subagent-start/mod-measure hooks, while Sessions advances #lastAt only for state signals. A newer metadata hook arriving before an older permission causes this block to skip retaining the permission identity even though Sessions accepts its waiting state. The next unrelated parent boundary then clears/recreates that same pending approval. Align retention with the actual state-acceptance boundary and regress metadata(t2) -> permission(t1) -> parent turn-end(t3) with stable card/notice identity.","file":"hub/src/adapters/claude-code.ts","line":828},{"severity":"medium","text":"Replacing the prompt closes its fallback but leaves #since for the session unchanged. Because #sessionState only initializes absent #since, the new prompt while state remains waiting inherits the old timestamp; #remindApproval schedules from that old timestamp at line174. A prompt replacing a 30+minute-old wait gets an immediate 1ms reminder instead of its own 30-minute interval. Reset the prompt episode's clock when its identity changes and test replacement before and after the prior deadline.","file":"hub/src/hub/inbox.ts","line":154}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source pass, two medium findings, no high/low findings. A-20116 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20116-t-1764-full-source-review-ordering-and-reminder-findings.md) records Standards/Spec traces, review coverage and evidence limits. C2 ordered new/resolved identity path is source-implemented but run-dependent and unverified. Targeted candidate summaries A-20103/A-20109 do not cover these interleavings or substitute for configured same-head verification. No Reviewer tests/browser/messenger/suite execution. Fix together, request fresh source review at the replacement committed head before verification.

Criteria: C1 failed (A newer state-free metadata hook can fence adapter identity retention without fencing Sessions' acceptance of an older permission, so a parent boundary recreates the pending card.), C3 failed (A replacement prompt retains the previous prompt's since/deadline and may remind immediately rather than after its own30-minute interval.).

### impl-1764 · 2026-11-16T13:59:37.719Z

Review A-20116 reproduced with three red regressions. Fix: Sessions owns hook-order admission and supplies optional stateCurrent to interpret; adapter-local watermark removed. Consumers searched by interpret declarations/calls: Sessions production caller migrated; Codex/OpenCode and fake harness interpret implementations ignore optional context; direct Claude host/login/schedule tests retain default true, as they bypass Sessions ordering. Name-reservation, launch-admission, lifecycle-serialization, nvim-sessions-rules, request-guard and tracker-native-boundary fakes accept the optional argument unchanged. No wire contract change in this revision. Replacement clears the old episode age before constructing the new wait. New source review required.

### rev-38 · 2026-11-16T14:02:25.768Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1764-source-2
commit: 0c9f608455c75b936c7c671bf29f4911f76d1aa8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Replacement source clear, Standards and Spec, no findings. A-20128 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20128-t-1764-replacement-source-clear-at-0c9f60845.md) details resolution of both source-1 findings: shared Sessions hook-order admission supplies interpretation/state writing; replacement clears the old episode age before building the new record/timer. Metadata/stale-permission and10/31-minute replacement controls reviewed. All C1-C3 remain run-dependent/unverified pending same-head configured evidence. A-20127 reports corrected candidate26/26 and check exit0 on local macOSNode24.21, with explicit precommit/hash/raw capture limits and report-only advisories; no exact-head suite claim. Initial task readback had C1/C3 failed marks; claimant must restore implementation done marks before verification. No Reviewer runtime execution.

### rev-38 · 2026-11-16T14:31:54.527Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1764-final-1
commit: 0c9f608455c75b936c7c671bf29f4911f76d1aa8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1,C2,C3 verified, no findings. A-20167 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20167-t-1764-final-c1-c3-evidence-clear-at-0c9f60845.md) reconciles source-clear A-20128, task.verify and uncached run5a689759/A-20165. Independently reproduced candidate9e4c6b56b1ced35c50b5be9fb92c30f6c990ec37 from pinned full Git tree. HostT0/T1/allT2fallback/selectedT4/Web exit0; streamed6421 ordinary pass +30 separate load pass records, no negatives/skips/cancels. All26 Claude session cases and5 remote-neutral cases pass; six exact approval cases each base1+load5, including both review regression classes. Selected inbox-verifier-load T4 passes once; its repeats and remainingT3/T4 unexecuted/deferred, not a full higher-tier pass. Linuxx64Node24.21/Neovim0.12.5, isolated HeadlessShell1248/CfT156.0.8078.4. Budget/lint/ratchet/skip-reason checks report-only, existing advisories retained. Fake-harness/messenger evidence; no real messenger or native Claude approval claim. Reviewer ran no tests/probes/browser.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-38 · 2026-11-16T15:18:10.739Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1764-delta-1
commit: 9a6083a6befd6a9a4a6107912bdeacc6670106ee
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge-delta clear, no findings. A-20210 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20210-t-1764-merge-delta-clear-at-9a6083a6b-under-coordinator-waiver.md) records independent Coordinator decisions60ec0c69/f2ed8fcc and explicit docs-only rule6 no-new-verify waiver. README keeps both watchdog and approval notification entries. Approval implementation/tests unchanged from verified first parent; Sessions inherits only unrelated #turnFailed closed guard. Changed-wording searches in hub/test+nvim/test find no exact consumer. A-20209 records merged-head macOSNode24.21 typecheck/test:lint/wording exit0; report-only advisories retained. C1-C3 carried under this waiver through reviewed source-equivalent approval paths. ACTUAL runtime remains A-20165/run5a689759 at first parent0c9f60845, as settled A-20167; no merged-head runtime/browser/configured verify, cache pass or new wall-time claim. Remaining integrated/higher-tier coverage remains deferred/Coordinator-owned. Reviewer read only.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-16T21:22:48.244Z

Merged 6b9ebc39c630a2f02da55619b00b6f8e3a70bd7c onto dev.
