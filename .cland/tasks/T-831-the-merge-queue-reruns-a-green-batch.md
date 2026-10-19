---
id: T-831
kind: task
title: The merge queue reruns a green batch whenever dev moves, even by tracker-only commits
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-678
blocked_by: []
regression_of: T-711
topic: topic-571
branch: t/T-831-the-merge-queue-reruns-a-green-batch
created: 2026-10-19T06:28:57.845Z
updated: 2026-10-19T10:17:09.876Z
closed: 2026-10-19T10:17:09.876Z
---

## Summary

On 2026-10-19 T-803 sat in the merge queue from 05:34Z and its single-member batch ran three times (e128f866 at d0eabd6c, 9b697596 at 3756d3b6, 955aa821 at 24ff4175), each green, without landing. Every time dev moved by a tracker- or brief-only commit (the Coordinator's pre-merge tracker commits, QA brief commits), the queue discarded the green batch and rebuilt it on the new base. That's about 20 droplet minutes and $0.08 per rerun, and the queue behind it stalls (T-739, T-818, T-494, T-664 waited over an hour).

## Acceptance criteria

- [x] C1. When dev moves only by commits whose changed paths all fall in the merge gate's existing documentation/tracker allowlist (the immediate-merge policy: tracker items, RULES.md, docs/, qa/briefs/, GLOSSARY.md), a green batch lands on the new dev without rerunning; other .cland paths such as config.toml, skills and code still rebuild; a component test with the scripted provider and FakeClock shows one run and a landing after a tracker-only dev commit mid-run.
  - verified: rev-30 [reviewer] · run rev-20261019-831-source-corrected · 2026-10-19T08:25:32.979Z · commit 4cf33689888d6a62aeac72f58c6c851d66cf1add
  - verified: rev-30 [reviewer] · run rev-20261019-831-final · 2026-10-19T08:47:50.832Z · commit 4cf33689888d6a62aeac72f58c6c851d66cf1add
  - done: impl-831 · 2026-10-19T08:48:07.694Z
- [x] C2. A dev move that touches code or test inputs still rebuilds the batch, and the queue's notice names the commit that forced the rebuild.
  - verified: rev-30 [reviewer] · run rev-20261019-831-final · 2026-10-19T08:47:50.832Z · commit 4cf33689888d6a62aeac72f58c6c851d66cf1add
  - done: impl-831 · 2026-10-19T08:48:08.179Z

## Comments

### coord · 2026-10-19T08:15:27.861Z

Another occurrence, 2026-10-19 08:14Z: batch 04289067 (T-832, T-835) passed on candidate base 354c20cd (run 39f2e57c, A-5878, exit 0). The hub then rebuilt it on 051afd53 and started run 6d874dfd, because the Coordinator's commit 051afd53 had landed mid-run. That commit changed tracker files and one QA brief (qa/briefs/E-615.md), which no batch member touches. Cost: one extra ~20-minute batch run, about $0.08.

### impl-831 · 2026-10-19T08:17:01.155Z

Implementation seam: MergeBatches + real batch repository preparation/comparison with scripted Git facts, scripted provider receipts and FakeClock (T1). Decision from Coordinator: reuse refusedOverridePaths, exactly the immediate merge selection allowlist; fail closed on other paths. Candidate evidence remains bound to its original head/tree; compare fresh candidate paths before landing.

### impl-831 · 2026-10-19T08:20:55.509Z

Committed/pushed 1cc32f204c6e44093597018a0ab13e8e994ab273; source review request delivered to Reviewer. Evidence artifact A-5883. Pre-enqueue validation: 28 T1 batch tests (3.358s), 8 T2 merge queue tests (1.317s), typecheck and lint exit 0. No QA required under current task policy. Awaiting clear source verdict before mode-free cland verify.

### rev-30 · 2026-10-19T08:22:20.719Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-831-source
commit: 1cc32f204c6e44093597018a0ab13e8e994ab273
scope: full
findings: [{"severity":"medium","text":"M1: Production diff reader uses territoryGitAsync, which trims stdout at territory.ts:349. For NUL-delimited output, first path ' docs/input.ts' becomes 'docs/input.ts', or ' README.md' becomes 'README.md'; an actual unknown path can be misclassified as allowlisted and land under old green evidence. Preserve raw path bytes and cover the production adapter contract; keep the shared allowlist unchanged.","file":"hub/src/hub/merge-batch-territory.ts","line":24}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear, one medium correctness finding M1; A-5884 details the complete six-file review. Provider tests bypass the production adapter's stdout trim and miss this case. Immutable comparisons, shared allowlist use, original receipt identity, forcing-commit notices and base-race handling otherwise match C1/C2. A-5883 host checks retained; no verify at this head. Preserve raw path output, add a lower-tier regression, and request fresh source review before mode-free verification. No Reviewer edits or tests.

Criteria: C1 failed (NUL-delimited changed paths are trimmed by the production Git adapter, allowing a first leading-whitespace unknown path to become allowlisted.).

### rev-30 · 2026-10-19T08:25:32.979Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-831-source-corrected
commit: 4cf33689888d6a62aeac72f58c6c851d66cf1add
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1 resolved, no findings remaining. A-5889 reproduces the raw-path gap via actual async adapter with execFile replaced; correction preserves -z output while scalar trim remains. Whitespace matrix and allowlisted control retain shared refusedOverridePaths unchanged. A-5891 records full source assessment: immutable comparison/receipt identity, failed-read refusal, base-race retry and distinct forcing-commit rebuild notice remain correct. C1 verified; C2 awaits same-head mode-free task evidence. No dev merge, Reviewer edits or test execution.

Criteria: C1 verified.

### impl-831 · 2026-10-19T08:44:08.759Z

Same-head mode-free verify b3650656-2bfa-4b26-8be2-18784f43576e passed at 4cf33689888d6a62aeac72f58c6c851d66cf1add: 1481 passed, 0 failed/cancelled/skipped. Artifact A-5913. Linux x64 droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5; lifetime 1052 s, cost $0.0731. T0–T2 task evidence complete; T3 deferred to merge batch per queue policy. Head unchanged since corrected clear source review. Awaiting Reviewer's final same-head evidence verdict.

### rev-30 · 2026-10-19T08:47:50.832Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-831-final
commit: 4cf33689888d6a62aeac72f58c6c851d66cf1add
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-5915. Audited full A-5913 / b3650656: exit 0, ordinary 381+868+232=1481 passed, zero fail/cancel/skip/TODO. Both owned files and all six new controls pass ordinarily and in five fresh repetitions; full census zero tier-mismatch rows and 401/401 load groups 5/5. Corrected source A-5892 remains unchanged, M1 resolved. C1/C2 verified. Report-only lint/duration findings retained; T3 remains landing-batch evidence, not claimed here. Claimant done boxes were unchecked at readback and need Implementer marks.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T10:17:09.876Z

Merged 5b0ae65ef11fdb1edddee4d2a9173cff656469e2 onto dev.
