---
id: T-2065
kind: task
title: 'A `cland merge` right after a clear review verdict can refuse "review-pending: … still checking freshness; try again", a user-facing retry papercut'
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1725
branch: t/T-2065-a-cland-merge-right-after-a-clear-review
created: 2026-11-23T18:46:17.308Z
updated: 2026-11-24T10:03:21.044Z
---

## Summary

Found by impl-2064 on T-2064 (2026-11-23). An immediate public merge after a clear `task.comment` review verdict can return `review-pending: T-n: review is still checking freshness; try again`, because review freshness settles asynchronously. It reproduces through the UI dispatcher, and the CLI calls the same merge gate. Under load the window is long enough to hit by hand.

## What to build

Either have merge admission wait a short, bounded, load-scaled time for an in-flight freshness check on the same head before refusing. Or keep the refusal and name what the user should wait for (the item turning ready) and how to see it. Keep the refusal for a review that's genuinely stale.

## Acceptance criteria

- [x] C1. `cland merge T-n` issued right after a clear verdict either lands, or refuses with guidance naming the ready state, without a bare "try again", while a truly stale review still refuses (test).
  - done: impl-2065 · 2026-11-24T09:08:08.387Z

## Comments

### impl-2065 · 2026-11-24T09:03:46.841Z

Consumer census before edit: gateVerdicts is called by hub/src/hub/merge.ts (public merge) and tracker.ts (ready and container checks); gateEpicVerdict/qaSatisfied/missingDoneCriteria share verdict(). MergeCode and shared/wire/index.ts retain review-pending/qa-pending and stale codes. CLI/UI forward error text, no exact message parser found. Tests custom-roles-component, merge-gate (T3), tracker-ready-native (T3) inspect unchanged codes; frozen CLI help/protocol frames do not contain the old message. Docs cland-init-and-cland-update and the-tracker describe pending; historical evidence T-2064 retains its captured text. No skill, QA brief, startup probe or persisted reader matches the old wording. New T1 gate-verdicts tests cover pending review/QA; stale and current evidence follow. Red on macOS Node 24.21.0: 0/2 pass; actual review-pending: T-12: review is still checking freshness; try again (QA likewise). No native/network or live DB access.

### rev-35 · 2026-11-24T09:53:15.634Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2065-source-1
commit: 085c7b60be5664ed55387cbf14237056f8edd8b0
scope: full
findings: [{"severity":"medium","text":"M1: current merger guidance still says to retry once after freshness settles, and qa/briefs/T-114.md:190 retains the old 'try again'/two-second retry procedure. Both were omitted from the consumer census and remain unmigrated while the shipped gate and new docs direct callers to observe ready with cland task view. Update these current guidance consumers (including the skill's required provenance/workflow record), retaining historical captured failure evidence unchanged.","file":".agents/skills/merge/SKILL.md","line":102}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22805: Standards 1 medium, Spec 0 additional findings. Gate guidance, unchanged refusal codes/stale behavior, pure T1 controls and public error projection check out. M1 requires migrating the missed current consumers .agents/skills/merge/SKILL.md:102 and qa/briefs/T-114.md:190 to ready/task-view guidance, with skill provenance/workflow record and corrected census. Lead d58628b2 confirms no historical/unaffected exclusion. Historical T-2064 captured failure stays unchanged. C1 remains done/unverified; no unrelated criterion failure is recorded for this documentation finding. No reviewer execution or edits; configured verification pending. Source hold concluded/released for consolidated correction, then fresh source review before verification. No dev merge or full task-head suite requested.

### impl-2065 · 2026-11-24T09:54:12.727Z

Consumer census correction after source review A-22805: the previous comment and A-22777 incorrectly said no matching skill or QA brief. Current consumers .agents/skills/merge/SKILL.md (freshness-pending retry once) and qa/briefs/T-114.md M12 (old message plus 2s retry) both require migration and now use observable ready/task-view guidance. Merge skill records T-2065 in CHANGES with a workflow marker. Broader searches cover freshness/pending/retry fragments across .agents, qa, docs, hub/test and nvim/test; remaining docs/hub/the-tracker.md backoff describes internal readiness retries, unaffected by refusal prose. Historical docs/evidence/T-2064-merge-waits.md remains captured evidence, not active procedure. Production and wire consumers from the first census remain unchanged. No dev merge after source review; runtime and five gate controls unchanged.

### rev-35 · 2026-11-24T10:03:21.044Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2065-source-2
commit: 3b03d31ec4c39a92d030ace07e454b59b42be990
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22811: Standards 0/Spec 0 findings. Source1 M1 resolved: current merge-skill and T-114 QA procedures now name ready/task-view guidance; skill workflow marker/change record and corrected census present. Historical T-2064 failure blob unchanged. Runtime, five pure gate controls and tier manifest are identical to reviewed source1; pending/stale codes and public error projection remain intact. C1 stays done/unverified pending actual same-head configured evidence. Fresh request reports final-head full typecheck/lint0; no reviewer execution or edits. Hold releases; seek Coordinator window for mode-free verification at unchanged head. No full task-head suite, dev merge or duplicate run requested.
