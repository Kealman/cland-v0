---
id: T-379
kind: task
title: Tracker-only commits on dev must not cancel or invalidate an integrated dev run
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - hub
  - bug
  - ready-for-human
assignee: null
parent: E-579
blocked_by:
  - T-472
topic: topic-375
branch: t/T-379-tracker-only-commits-on-dev-must-not
created: 2026-10-14T08:41:13.625Z
updated: 2026-10-16T17:10:48.964Z
closed: 2026-10-16T17:10:48.964Z
---

## What happened

Reported by cland-impl on 2026-10-14: three tracker-only commits on dev (release and question items filed by the planning session) cancelled the Coordinator's integrated dev run mid-flight, because the hub cancels a queued dev run whenever dev's head moves, tracker-only commits included. The run had to be counted as cover by hand.

## What to build

A run's identity should follow the tree it verifies, not dev's head: commits that touch only `.cland/tasks`, `docs/` or other paths outside the suite's inputs (the tree-hash result cache of T-233 already knows the inputs) neither cancel a queued or running dev run nor invalidate its result; the result then applies to the new head. Until then the rule for everyone committing on dev: check `cland verify queue` first and wait for an integrated run owned by coord with no item, or ask coord to commit the items.

## Acceptance criteria

- [x] C1. A commit on dev that changes only tracker paths (`.cland/tasks`) or the rulebook (`.cland/RULES.md`) leaves a queued or running dev run in place and its result covers the new head. Docs stay suite inputs, because tests assert their text (narrowed by the Coordinator on 2026-10-16, matching E-579 C1 and C3).
  - done: impl-379 · 2026-10-16T16:35:40.667Z
  - verified: rev-31 [reviewer] · run rev-20261016-379-final · 2026-10-16T17:07:07.122Z · commit 621bbf2bae30c0d1e41cc9bb0f29afe52a880391
  - verified: rev-31 [reviewer] · run rev-20261016-379-merge-delta · 2026-10-16T17:10:02.835Z · commit fee0db6b8c4f1dba13bc37b77744494e0c0aef81
- [x] C2. The paths that count as suite inputs are the same set the tree-hash cache uses, defined once.
  - done: impl-379 · 2026-10-16T15:55:39.514Z
  - verified: rev-31 [reviewer] · run rev-20261016-379-source-2 · 2026-10-16T16:03:12.625Z · commit 1263d9bba15f2076c5961519acdbe8f1caeddc22
  - verified: rev-31 [reviewer] · run rev-20261016-379-delta-1 · 2026-10-16T16:35:27.177Z · commit 621bbf2bae30c0d1e41cc9bb0f29afe52a880391
  - verified: rev-31 [reviewer] · run rev-20261016-379-merge-delta · 2026-10-16T17:10:02.835Z · commit fee0db6b8c4f1dba13bc37b77744494e0c0aef81
- [x] C3. The behaviour is covered by a hub test with a fake run.
  - done: impl-379 · 2026-10-16T15:55:40.211Z
  - verified: rev-31 [reviewer] · run rev-20261016-379-source-2 · 2026-10-16T16:03:12.625Z · commit 1263d9bba15f2076c5961519acdbe8f1caeddc22
  - verified: rev-31 [reviewer] · run rev-20261016-379-delta-1 · 2026-10-16T16:35:27.177Z · commit 621bbf2bae30c0d1e41cc9bb0f29afe52a880391
  - verified: rev-31 [reviewer] · run rev-20261016-379-merge-delta · 2026-10-16T17:10:02.835Z · commit fee0db6b8c4f1dba13bc37b77744494e0c0aef81

## Comments

### coord · 2026-10-15T09:13:11.376Z

Retrospective A-2783, STOP 2: 5 of the 10 cancelled covers came from dev commits or root edits during a live cover. Prefer refusing such commits up front, at least for the integrated run's own root, over cancelling afterwards.

### impl-379 · 2026-10-16T15:50:03.967Z

Reproduced with fixture hub/fake package run: tracker-only commits while running cause exit 1 ('cancelled: submitted head ... changed ...') after successful package completion; queued admission has an independent strict-head guard. Implementing candidate-tree checks for integrated runs while preserving submitted-head provenance and strict task heads. Canonical exclusions will be .cland/tasks and .cland/RULES.md; ordinary docs/config/source remain suite inputs, per launch scope.

### impl-379 · 2026-10-16T15:55:52.818Z

Implemented and pushed b6b7639478786b7e799ea7ad7be83ac5e2db6f82. Evidence A-3938 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3938-t-379-implementation-and-pre-review-evidence.md. All C1–C3 done. Typecheck exit 0 at final head; touched files run sequentially 17/17; existing remote-delivery controls 2/2; shard lint/diff check exit 0. Source review requested from Reviewer in topic-375; verification waits for clear source verdict.

### rev-31 · 2026-10-16T15:57:59.113Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-379-source-1
commit: b6b7639478786b7e799ea7ad7be83ac5e2db6f82
scope: full
findings: [{"severity":"medium","text":"Integrated candidate validation still returns null if HEAD advances during hashing, even for tracker/rulebook-only commits with unchanged canonical inputs; queued/completion paths can cancel the run.","file":"hub/src/verification-tree.ts","line":21}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. Spec M1 verification-tree.ts:21: captureA→hash canonicalA→tracker/rulebook commitB→finalHEAD B returnsnull although canonicalA==canonicalB. Integrated admission/completion treats null as changed/dirty and cancels. Worker also passes captured current head, so fix integrated mode/callers consistently while retaining task exact-head rejection. Add controlled commit-during-hash regression and source/docs/config/dirty rejection controls. Existing new tests finish commits before releasing work/admission, missing overlap. Standards no findings; one medium Spec finding, no highs/lows. C1 failed; C2/C3 otherwise appear implemented but unmarked. Canonical paths/provenance/task strictness/allowances reviewed; A-3938 targeted17+2/typecheck/shards support only. No verify until corrected-head source clear. Artifact A-3943: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3943-t-379-source-not-clear-administrative-commit-during-identity-hashing.md. No Reviewer edits/tests.

Criteria: C1 failed (A metadata-only commit during candidateTree hashing still causes null/changed-candidate cancellation rather than preserving the integrated run.).

### impl-379 · 2026-10-16T16:00:45.317Z

Addressed not-clear source finding rev-20261016-379-source-1 at 1263d9bba15f2076c5961519acdbe8f1caeddc22 (pushed). Controlled commit-during-hash test went red before the correction; tracker/rulebook overlaps now preserve identity while source/dirty-source and explicit-head controls reject. Evidence A-3949: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3949-t-379-review-correction-commit-during-hash-proof.md. Typecheck exit 0 at exact head; sequential targeted 13/13; shard lint/diff check 0. Fresh source review requested before verification.

### rev-31 · 2026-10-16T16:03:12.625Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-379-source-2
commit: 1263d9bba15f2076c5961519acdbe8f1caeddc22
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards 0 findings, Spec 0 findings. A-3958 records the review. Prior M1 resolved: current-candidate hashing compares captured commit with HEAD using canonical suite inputs, then rechecks dirtiness; metadata-only commits overlapping hashing preserve identity. Integrated worker/local admission use current-candidate mode, while explicit task heads remain strict. A-3949 controlled read-tree barrier reproduces the old bug and covers tracker/rulebook preservation plus committed source/dirty source/strict-head rejection. Canonical cache/input set remains one definition (C2); hub fake-run tests cover queued/running changes, advanced-head cache reuse and remote provenance (C3). Reported exact-head targeted13/13, typecheck/shard lint; independent ref/diff check clean. C2/C3 verified. Former C1 failure is corrected; restore its done evidence and leave final execution verification for fresh same-head gate. No source change permitted without new review.

Criteria: C2 verified, C3 verified.

### rev-31 · 2026-10-16T16:34:36.269Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-379-evidence-1
commit: 1263d9bba15f2076c5961519acdbe8f1caeddc22
scope: evidence
findings: [{"severity":"medium","text":"Missing measured allowances for new running tracker/rulebook/source-rejection cases:5.714s,6.789s,5.022s each exceed the5s new-test budget, making the task gate exit1.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-4014. Exact reviewed-head Linuxe30632fd/A-4013 has1955pass/0ordinaryfail/5skip and all12 new identities5of5, but exit1 from three task-owned duration budget omissions (suite-candidate running tracker5.714s, rulebook6.789s, source-rejection5.022s). Neovim smoke not reached. Add measured reasoned allowances retaining assertions/bounds, request new-head source review before verification. C2/C3 source marks remain current, C1 final mark pending; no behavior criterion failed. No implicit exception or fabricated lifetime/cost (both unknown).

### impl-379 · 2026-10-16T16:35:07.908Z

A-4013 Linux run had 1955 pass, 0 ordinary failures, 5 skipped and all 12 own new identities 5/5; exit 1 was three missing measured duration allowances. Pushed manifest-only correction 621bbf2bae30c0d1e41cc9bb0f29afe52a880391; no assertions, bounds or source changed. Typecheck exit 0 at new head, shard lint/diff check 0. Evidence A-4015: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4015-t-379-linux-duration-allowance-correction.md. Fresh source review requested before explicit-droplet no-mode retry.

### rev-31 · 2026-10-16T16:35:27.177Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-379-delta-1
commit: 621bbf2bae30c0d1e41cc9bb0f29afe52a880391
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source delta clear, A-4016; Standards0/Spec0 findings. Only three measured A-4013 Linux allowance entries added (5.713784751/6.789143906/5.021503454s), each concrete fixture-lifecycle reason and own5of5 load evidence. Independent parsed comparison preserves every prior allow value and all other manifest data. No dev merge/source/test/assertion/bound change; A-3958 corrected design remains. Exact-head typecheck/shards reportedgreen; origin/diffcheck independently confirmed. C2/C3 source verification current at621bbf2b. C1 awaits fresh same-head gate; historical exit1 is not retroactively green.

Criteria: C2 verified, C3 verified.

### impl-379 · 2026-10-16T17:06:54.052Z

Same-head explicit-droplet no-mode verification 697aca2b-33d3-4579-9e72-5d5cfdc60b14 passed at reviewed head 621bbf2bae30c0d1e41cc9bb0f29afe52a880391: auto exit 0, hub-only plus Neovim smoke, 1972 tests / 1967 pass / 0 fail / 5 skipped. Linux c-8, suite duration 1320.09s. Receipt A-4043: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4043-suite-697aca2b-33d3-4579-9e72-5d5cfdc60b14-auto-at-621bbf2.log. Reviewer received the result directly and settles the final verdict; head unchanged.

### rev-31 · 2026-10-16T17:07:07.122Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-379-final
commit: 621bbf2bae30c0d1e41cc9bb0f29afe52a880391
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, Standards0/Spec0 findings; A-4044. Same-head post-review Linux697aca2b/A-4043 exit0:1967pass/0fail/5skip including Neovimsmoke12of12. All12 task identities5of5 load repetitions: queued/running administrative commits/cache reuse, source cancellation, remote provenance, canonical inputs and five controlled hash-overlap modes. Former source race and missing allowance findings resolved with corrected-head execution evidence. C1 verified; C2/C3 current under delta1 at621bbf2b. Origin tip unchanged. No gate exception/further run needed; lifetime/cost explicitlyunknown.

Criteria: C1 verified.

### rev-31 · 2026-10-16T17:10:02.835Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-379-merge-delta
commit: fee0db6b8c4f1dba13bc37b77744494e0c0aef81
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge delta clear; Standards0/Spec0 findings, A-4048. Independently read Coordinatorcb58625d authorizing dev merge, exact union and no new run. Parents621bbf2b+68765997 confirmed. All10 task implementation/test/shard blobs unchanged; README auto-merge preserves canonical inputs/provenance docs. Manifest parsed exact dev277allow entries in order +six unchanged task entries; all other data unchanged, conflict diff insertion only. Exact-head typecheck reportedgreen; ref/diffcheck independentlyclear. C1–C3 continuity atfee0db6b under explicit no-new-run disposition using prior green A-4043/finalA-4044; no exact-merge-head suite claimed. Coordinator next batch cover before restart remains. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-16T17:10:48.964Z

Merged 6123b254e0f3049be89302332b5fccd86b14f80f onto dev.
