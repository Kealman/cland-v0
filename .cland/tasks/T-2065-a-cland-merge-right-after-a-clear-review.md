---
id: T-2065
kind: task
title: 'A `cland merge` right after a clear review verdict can refuse "review-pending: … still checking freshness; try again", a user-facing retry papercut'
state: closed
status: done
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
updated: 2026-11-24T14:24:29.477Z
closed: 2026-11-24T14:24:29.476Z
---

## Summary

Found by impl-2064 on T-2064 (2026-11-23). An immediate public merge after a clear `task.comment` review verdict can return `review-pending: T-n: review is still checking freshness; try again`, because review freshness settles asynchronously. It reproduces through the UI dispatcher, and the CLI calls the same merge gate. Under load the window is long enough to hit by hand.

## What to build

Either have merge admission wait a short, bounded, load-scaled time for an in-flight freshness check on the same head before refusing. Or keep the refusal and name what the user should wait for (the item turning ready) and how to see it. Keep the refusal for a review that's genuinely stale.

## Acceptance criteria

- [x] C1. `cland merge T-n` issued right after a clear verdict either lands, or refuses with guidance naming the ready state, without a bare "try again", while a truly stale review still refuses (test).
  - verified: rev-35 [reviewer] · run rev-35-2065-evidence-1 · 2026-11-24T11:25:00.373Z · commit 3b03d31ec4c39a92d030ace07e454b59b42be990
  - verified: rev-35 [reviewer] · run rev-35-2065-delta-2 · 2026-11-24T11:31:58.681Z · commit 06562a4f379c42c3a79712b7e5fe4e66ff809538
  - done: impl-2065 · 2026-11-24T11:32:29.359Z
  - verified: rev-35 [reviewer] · run rev-35-2065-evidence-2 · 2026-11-24T12:53:26.916Z · commit 06562a4f379c42c3a79712b7e5fe4e66ff809538

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

### impl-2065 · 2026-11-24T11:23:30.592Z

Verification evidence A-22878 / run 87b73cfc-3fe3-468e-8dce-f5f686abe75a, exact head 3b03d31ec4c39a92d030ace07e454b59b42be990: configured auto exit0 on Linux x64 droplet c-8 nyc1, Node24.21.0, Neovim0.12.5. Host T0 exit0; T1, fallback all T2, selected T3 importers and Web exit0. No T4 claim; remaining T3 belongs to batch/integrated occasions. Structured suite timing receipts positively record pass for all five hub/test/gate-verdicts.test.ts cases (pending review/QA ready guidance, stale review/QA refusals, current independent clear verdicts). Chrome Headless Shell / Google Chrome for Testing156.0.8078.4 for Web. Duration budgets/ratchet remain report-only; platform prerequisite skips are retained in provenance. Droplet lifetime4468s, cost$0.3103, workers2. No rerun or source change.

### rev-35 · 2026-11-24T11:25:00.373Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2065-evidence-1
commit: 3b03d31ec4c39a92d030ace07e454b59b42be990
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22881 audits same-head87b73cfc/A-22878 finished/passed: result0/empty cause, complete run/tree-bound T0/T1/T2/selectedT3/Web. All5 pending/stale/current gate controls base+5distinct loaded passes, existing merge-gate/tracker-ready-native files pass. C1 verified with source2 public projection and corrected skill/QA guidance. Completed244T1/445T2/244T3/55Web;29T3/18T4 unexecuted. Matched ordinary9430pass/12skip and loaded25pass/5skip are scoped record counts, not invented aggregate; known3F2 finish-only separate. Linux c8nyc1 Node24.21/nvim0.12.5, Headless1248 Chrome156.0.8078.4; report-only budgets/lint. Canonical9b98a31f differs from Gita7a3d2a6. No reviewer execution/edit/full integrated cover/rerun. Final clear, findings=[].

Criteria: C1 verified.

### rev-35 · 2026-11-24T11:30:03.350Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2065-delta-1
commit: 06562a4f379c42c3a79712b7e5fe4e66ff809538
scope: delta
findings: [{"severity":"medium","text":"M1: the docs-only conflict resolution is sound, but the rule6 waiver prerequisites are incomplete: changed 'finalized log' text also matches suite-human-component.test.ts:58 and suite-remote-log.test.ts:27, and 'role broadcasts' matches custom-roles-component.test.ts:178. None has a merged-head targeted receipt or explicit waiver/disposition. Complete those matching checks under Coordinator c096e7a2 before carrying87b73cfc; do not relabel its old-head execution as current.","file":"hub/README.md","line":6}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22886: delta source retains both README intents; task gate/tests/skill/QA blobs unchanged. One medium validation finding: Coordinator c096e7a2 and rule6 condition old-run carry on every changed-text/identifier matching check. Three omitted matches lack merged-head receipts/disposition: suite-human-component T2, suite-remote-log T1, custom-roles-component T2; leadc99bac1f/33494ddc confirm. Prior87b73cfc/A-22878 stays valid at3b03d31ec only; no current-head execution claimed. C1 done/unverified at new head, no unrelated failure mark. Hold releases for those3 sequential under8 targeted checks then unchanged-head delta/evidence settlement. No source change/dev merge/new full verify requested; preserve any failed check before fixing. No reviewer execution/edit.

### impl-2065 · 2026-11-24T11:30:52.172Z

Delta validation at unchanged merged head 06562a4f379c42c3a79712b7e5fe4e66ff809538 on local macOS Node24.21.0: suite-human-component.test.ts T2 exit0 7/7, suite-remote-log.test.ts T1 exit0 1/1, custom-roles-component.test.ts T2 exit0 8/8. Run sequentially with sampled starting loads3.01,3.01,2.85, all below8; no skips or failures. Positively observed result-retry finalized-log coverage case, remote collected-receipt case, and custom role routing/broadcast controls passing. These supplement earlier merged-head typecheck exit0 and four-file receipts. Not a current-head full suite: old configured run87b73cfc/A-22878 remains at3b03d31ec, eligible for conditional rule6 carry as Coordinator directed. No source change, dev merge or verify resubmission after06562a4f3.

### rev-35 · 2026-11-24T11:31:58.681Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2065-delta-2
commit: 06562a4f379c42c3a79712b7e5fe4e66ff809538
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22887: final delta clear. M1 supplemental checks now recorded at unchanged06562a4f3: suite-human-component7/7, suite-remote-log1/1, custom-roles-component8/8, sequential local macOS Node24.21 below8/no skips/failures. Together with earlier merged-head typecheck0 and four-file checks, Coordinator c096e7a2/rule6 carry prerequisites are met. Both README intents retained, task runtime/tests unchanged; current gate5/5 additionally reported. C1 verified through approved delta/carry. Configured87b73cfc/A-22878 remains OLD-head3b03d31ec evidence as auditedA-22881, not current-head execution/cache/full cover; tracker record not rewritten. Full lint not rerun per typecheck-only grant. No reviewer execution/edit/new verify/dev merge requested. Findings=[].

Criteria: C1 verified.

### rev-35 · 2026-11-24T12:53:26.916Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2065-evidence-2
commit: 06562a4f379c42c3a79712b7e5fe4e66ff809538
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22950: fresh same-head82f5237f/A-22949 finished passed, code0/cause empty. Five exact pending/stale review/QA/current-clear guidance controls each pass base+5 distinct loaded identities; seven audited merged-head text-consumer files also pass. C1 current using actual conflict-head receipts. Complete T0/all244T1/all445T2/244selectedT3/all55Web exit0;29T3 deferred, T4 unexecuted. Linux x64 droplet Node24.21.0, nvim0.12.5, Headless1248/CfT156.0.8078.4; prerequisites and report-only advisories retained. Old87b73cfc/A-22878 remains old-head evidence; source/delta carry history preserved. Canonical verification tree distinct from Git tree; known F2 finish-only rows separate. No reviewer tests/probes/reruns/source changes.

Criteria: C1 verified.

### coord · 2026-11-24T14:24:29.476Z

Merged 5c77eed4aa937d40b15902e605b3570e3973c8f3 onto dev.
