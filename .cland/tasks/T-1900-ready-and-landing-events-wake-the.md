---
id: T-1900
kind: task
title: Ready and landing events wake the Coordinator
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1550
branch: t/T-1900-ready-and-landing-events-wake-the
created: 2026-11-16T07:29:46.895Z
updated: 2026-11-16T13:13:01.632Z
closed: 2026-11-16T13:13:01.632Z
---

## Summary

T-1795 waited 3.6 h because ready events don't start a Coordinator turn (§3.8). Current delivery semantics are unverified. §7 #9.

Kind: product. Triage ticket H-12 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [x] C1. A lead's ready report and a landing reach an idle Coordinator as deliveries that start a turn (test with the fake Claude).
  - done: impl-1900 · 2026-11-16T11:37:34.819Z
  - verified: rev-35 [reviewer] · run rev-35-1900-final-1 · 2026-11-16T12:02:56.764Z · commit 4bb04271b7f697b601f07db8a9e59a7cb5f723f0

## Dependencies

none

## Comments

### impl-1900 · 2026-11-16T11:27:53.811Z

Consumer sweep and current-behaviour evidence: A-19986 path inventory; A-19987 findings, mutations, exact test output and unaffected consumers. Searched production routing/store, all three adapters, shared wire, Neovim/web, CLI/spoke, skills, QA briefs, startup/recovery and all test tiers. No shared contract change: current ready digest-now and landing report policy already holds; all consumers retain prior wire shape. T2 ordinary queue case adds idle fake-Claude injection and held progress control; 38/38 full-file pass on macOS Node v24.21.0. Mutation report to progress failed the new exact-id injection wait and was reverted.

### rev-36 · 2026-11-16T11:37:05.241Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1900-source-1
commit: b89fdaf6db2748065360ec4ef6ca49f633fe00eb
scope: full
findings: [{"severity":"medium","text":"New coord.waitForEvent promise/timer is armed before awaited send and has no failure-path consumer/join if send rejects. Spoke close rejects it, risking an unhandled rejection during fixture cleanup; caseDeadlines does not own it (claimant ffd5d5c7 confirmed). Assert send success first and use a named shared until over retained coord.events, or explicitly cancel/join on all exits; preserve digest/injection/persisted receipt assertions.","file":"hub/test/merge-queue.test.ts","line":618}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source audit A-19997: one medium Standards ownership blocker; no additional Spec findings. Production already satisfies normal report/digest/landing routing; test-only fake Claude proof otherwise matches criterion and retains existing landing semantics. Exact Coordinator injected journal receipt correctly avoids aggregate claimant-stage ambiguity; mutation sensitivity strong. A-19996 original command/cwd/completion/candidate/raw/170-path tier-disposition limits retained; no current-head configured pass. Hold released: repair waiter, restore C1 mark, commit/push/request fresh review before verify. No runtime repro/provenance-only rerun requested.

Criteria: C1 failed (The new ready-event observation is pre-armed without a failure-path joining owner if send fails.).

### rev-36 · 2026-11-16T11:39:28.065Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1900-source-2
commit: 4bb04271b7f697b601f07db8a9e59a7cb5f723f0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source audit A-20001: Standards0/Spec0. Sole ownership blocker resolved: await/assert send success before named shared until over retained coord.events; no detached pre-armed waiter remains. All ordered digest/exact fake injection/history/recipient-specific journal and landing assertions preserved. No production/dev merge/contract change; private fixture only returns existing fakes. A-19999 targeted1/1/root typecheck candidate completion/source-linkage limits retained; old38/38/lint and mutation history A-19996 remain qualified. C1 done restored but unverified until same-head configured receipt and actual consumer selection. Source clear permits authorized verify at4bb04271b; no final ready claim.

### rev-35 · 2026-11-16T12:02:56.764Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1900-final-1
commit: 4bb04271b7f697b601f07db8a9e59a7cb5f723f0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence A-20017, independent reconciliation A-20016. C1 verified: exact ordinary fake-Claude case at A-20015:22687 passes with idle ready-report/digest/injection/persisted histories and exact-once landing/journal assertions; all 38 file cases positive, file22720. Parsed6398 ordinary tests/702 files plus separate210 load tests/files all positive. Actual221T1/426T2/55Web;268T3/17T4 unexecuted. Original170 consumer paths preserved, no complete-transitive/runtime-branch claim. Exact head, clean tree, uncached Linux x64/Node24.21 and actual Headless Shell1248/Chrome156 browser receipts confirmed. Source clearance remains rev-36 A-20001. Prior capture/mutation/failed-intermediate and report-only limits retained. No Reviewer runtime; hold released, Coordinator retains landing/integrated-stage gates.

Criteria: C1 verified.

### coord · 2026-11-16T13:13:01.632Z

Merged 21f46b3f28b5d3dd93678b936ca9db981920292c onto dev.
