---
id: T-1635
kind: task
title: A landing that closes an item can turn the closed-item wording lint red on dev
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1643
branch: t/T-1635-a-landing-that-closes-an-item-can-turn
created: 2026-11-02T15:55:22.884Z
updated: 2026-11-19T05:23:22.375Z
closed: 2026-11-19T05:23:22.375Z
---

## Summary

T-1588 landed at 14:00Z (b8b1a95b) and closed. Its own `docs/agents/host-agent.md:22` said "a missed exit is conservatively fenced until the host lifecycle clears it" in a paragraph naming T-1588. Once T-1588 was closed, `lint-closed-item-wording` flagged that line, so `npm run check` (T0) was red on dev for every task after it. impl-1620 found it at 15:54Z. The batch's T0 ran before the close, while the item was still open, so the landing passed.

## What to build

The merge batch evaluates the closed-item wording lint against the tracker state its landing will produce: each member counts as closed. A violation refuses the batch the same way as a T0 failure, naming the member and the line.

## Acceptance criteria

- [x] C1. A batch member whose own docs pair its id with `until` wording is refused before landing, with the file and line named (test).
  - done: impl-1635 · 2026-11-19T03:20:10.429Z
  - verified: rev-35 [reviewer] · run rev-35-1635-evidence-1 · 2026-11-19T04:05:50.020Z · commit 76f523024f3170c705e6b4894f32765f3833f0e2
- [x] C2. A member whose docs only name another open item is unaffected (test).
  - done: impl-1635 · 2026-11-19T03:20:11.268Z
  - verified: rev-35 [reviewer] · run rev-35-1635-evidence-1 · 2026-11-19T04:05:50.020Z · commit 76f523024f3170c705e6b4894f32765f3833f0e2

## Comments

### impl-1635 · 2026-11-19T02:59:24.261Z

Implementation targets immutable batch preparation, supplementing T0 with projected member closure. Shared wording/MDX policy extracted; batch facts receives prepared IDs, existing fakes ignore the additive argument. Consumers searched across hub/nvim/web/shared/docs/qa/skills, including direct prepareMergeBatch calls, dispatch/daemon/harness, dev-t3 ProbeRepository Pick, frozen usage fixtures and all tier manifests. No wire shape or help text changes. Regression red: expected closure IDs [T-1], received undefined; prepareMergeBatch assertion failed before source fix. Other-open-item control added.

### rev-35 · 2026-11-19T03:12:41.239Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1635-source-1
commit: 5cdc9a551ac651452b3a81eb9f7b2b2abb6560e9
scope: full
findings: [{"severity":"medium","text":"Standards M1: the two new async fake-Git callbacks bypass guardedMemberCase/boundedJoinedCase, have no separate bounded original-work owner and install no positively controlled native-launch guard. A fake repository alone is not rule38 proof. Enroll the existing owner/guard before preparation and retain controls until original work/cleanup joins, keeping the current final C1/C2 assertions.","file":"hub/test/merge-batches.test.ts","line":1241}]
finding_counts: {"high":0,"medium":1,"low":0}

Full first source NOT CLEAR at clean5cdc9a551ac651452b3a81eb9f7b2b2abb6560e9, treef7e91babc26c85a9ed566cf328e21d890fd4fa2b, base13cefb4b. Standards one medium; Spec no source findings. Implementer5582a25e confirms no owner/guard/disposition for the two new callbacks. A-21524 provides the bounded correction: use existing appropriate case owner/guard, retain exact assertions, no unrelated migration or production redesign. Shared grammar and immutable per-member projected closure before admission are accepted; member/file/line refusal, open-item exception and infrastructure read identity match the spec. Consumer/docs/skill provenance reviewed; no wire/help bytes changed. A-21518 plus retained-return supplement is scoped local corrected-source evidence: targeted105/105 and full typecheck/lint0, not complete T1 or configured verification. Earlier red/map/typing epochs remain failed and were edited while processes ran; immutable loaded-source/raw/signal/scan fields remain unknown. C1/C2 failed this pass, no verified marks. Hold released for consolidated test-owner/guard correction and fresh exact-head source review before verify. Reviewer ran no tests/probes or source mutations.

Criteria: C1 failed (The new projected-closure refusal control lacks bounded original-work ownership and a positively controlled native-launch guard.), C2 failed (The new other-open-item control lacks bounded original-work ownership and a positively controlled native-launch guard.).

### rev-35 · 2026-11-19T03:21:07.214Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1635-source-2
commit: 76f523024f3170c705e6b4894f32765f3833f0e2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source CLEAR at clean76f523024f3170c705e6b4894f32765f3833f0e2, tree2190823323f7e51a435ed908e32eb9befa7b0fad. Standards clear; Spec clear; no findings. M1 is closed: both new cases enter guardedMemberCase before native guard setup, step owns original preparation, named wait bounds observation and assert.rejects runs inside that bound to retain original BatchRefusal/member/file/line identity. Final open-item/candidate/tracker assertions remain. Only two callbacks and guidance changed; production/shared grammar, error identity and immutable projection retain the first source review's positive checks. No dev merge or unrelated migration. A-21531 records source/evidence scopes; A-21529 preserves failed3f41671a4 separately and final committed-head105/105 targeted T1, full typecheck/lint0/zero refusals, with report-only findings and unknown independent native/scan fields labelled. C1/C2 implementation-done reconciliation confirmed by lead4aca5c07; no criteria verified in this source pass, pending same-head configured evidence. Source clear permits verification at this exact head under Coordinator window. Reviewer ran no tests/probes or source mutations.

### rev-35 · 2026-11-19T04:05:50.020Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1635-evidence-1
commit: 76f523024f3170c705e6b4894f32765f3833f0e2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence CLEAR at unchanged clean76f523024f3170c705e6b4894f32765f3833f0e2, Git tree21908233, preserving source2/A-21531. A-21552 audits df1e4969/A-21550: autoexit0;6906 ordinary case and722 file passes; separate220 load case/file passes; no nonpass or unmatched start. Both exact generated projected-closure cases pass ordinary+5/5 load and10 load file closures: C1 requires member-bound BatchRefusal with docs/guide.md:2/T-1; C2 returns tree for only-other-open-item wording; both retain state:open input assertion. Source/real-policy fake-Git boundary is explicit, no native landing experiment claimed. T0/T1/allT2 including44Neovimfiles385cases/Web complete; T3 batch-deferred,T4 unexecuted. Uncached Linuxx64/Node24.21 droplet, isolated HeadlessShell1248/Chrome156.0.8078.4. Snapshot943f0e53 differs from Git tree; advisories/lint remain report-only. Earlier mutable/failed/3f104-of105/local76 epochs retained separately, never promoted to green. Standards clear, Spec clear, findings[]. C1/C2 verified; hold released. No Reviewer test/probe/edit or further rerun/source change requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T05:23:22.375Z

Merged 9ff9581f30ba10bb03e207a26c5801108101f08b onto dev.
