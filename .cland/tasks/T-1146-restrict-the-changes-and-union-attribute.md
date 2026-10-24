---
id: T-1146
kind: task
title: Restrict the CHANGES and union-attribute wording to kept upstream skills
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-1010
branch: t/T-1146-restrict-the-changes-and-union-attribute
created: 2026-10-22T16:21:58.628Z
updated: 2026-10-24T21:57:32.931Z
closed: 2026-10-24T21:57:32.931Z
---

## Summary

Low finding L1 from the T-1145 review. The wording in hub/README.md (near line 1697) and the opening comment of hub/src/init/skills.ts describes the per-skill CHANGES file and its merge=union attribute as if every skill had one; only kept upstream skills do. Narrow the wording to them.

## Acceptance criteria

- [x] C1. hub/README.md and the hub/src/init/skills.ts opening comment name the CHANGES file and union attribute only for kept upstream skills (docs).
  - done: impl-1146 · 2026-10-24T21:49:33.628Z
  - verified: rev-23 [reviewer] · run rev-20261024-1146-source · 2026-10-24T21:51:11.841Z · commit 5afceb08a8ff3a70c009e285e7e3d12df674237f

## Comments

### impl-1146 · 2026-10-24T21:49:19.952Z

Implementation scope: C1 is documentation-only. Narrow the README and skills.ts opening comment so only kept upstream skills own origin metadata, sibling CHANGES and its merge=union attribute. No runtime/shared-contract change or new behavior test; validation is passage inspection, diff check and npm run typecheck.

### rev-23 · 2026-10-24T21:51:11.841Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1146-source
commit: 5afceb08a8ff3a70c009e285e7e3d12df674237f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1146 full source review — clear

Head5afceb08a8ff3a70c009e285e7e3d12df674237f/tree8eb5f772128d359053f15559b941fd6eabcca0c0; sole parent/fixed base94dd30a9ed7a9a2f3d58747981b6f2eef46b8f8b. Named task branch matches. git diff94dd30a9...5afceb08:2files4insertions3deletions, one docs commit. Scope full, run rev-20261024-1146-source. Both review axes in-session under crew no-subagent constraint. Static read-only Git/source/docs/tracker inspection; no execution, mutation, browser or delegation.

## Standards
No findings. README provenance paragraph and skills.ts opening comment now distinguish curated set composition from kept-upstream provenance requirements. Language remains consistent with skills/README.md and hub/test/lint-skill-provenance.ts: its explicit15-skill upstream list excludes cland's own skills, requiring origin/MIT metadata, sibling CHANGES and portable CHANGES merge=union only for kept upstream skills. Surrounding whole-skill hash/manifest/update/symlink behavior is unchanged and accurately retained. README skill-maintenance link remains valid. No command/setting/role/shared-contract change, so no consumer migration, help/frozen fixture or role-clause expansion required. No test changed/new test warranted for prose/comment-only correction. No material smell finding.

## Spec
C1 established directly at this head: hub/README.md:1934 explicitly says 'Kept upstream skills' for origin/CHANGES and 'Each kept upstream skill' for union attribute; hub/src/init/skills.ts:1–3 likewise limits both to kept upstream skills. cland's own skills remain part of curated set without claiming they have upstream provenance files. Exactly the two requested passages changed; no runtime behavior change or scope expansion. Verify docs criterion C1 by source.

Lead reports local macOS npm run typecheck/diff check passed; no literal original stdout/process-exit/native timing receipt reviewed here, no runtime/browser run claimed. Source inspection is evidence for C1, not configured-suite evidence. Per request, lead may now submit one ordinary mode-free configured verify at unchanged5afceb08 and return original receipt for final evidence review, retaining actual phases/platform/browser and report-only limits. Do not treat source-established docs criterion or tracker status as that pending configured receipt. No forced all run, per-itemQA(none/after-stage), merge/stage/landing claim. Coordinator owns enqueue/merge after applicable evidence/conflict check.

Standards0 findings; Spec0 findings.

Durable audit A-11512.

Criteria: C1 verified.

### coord · 2026-10-24T21:51:40.848Z

Coordinator disposition: comment- and README-only change (hub/README.md, the header comment of hub/src/init/skills.ts). No separate cland verify; `npm run typecheck` passed at head 5afceb08 (coord, worktree, exit 0). The merge batch's T1 run covers landing. Enqueued.

### coord · 2026-10-24T21:57:32.931Z

Merged f1c28d99f61afd6daa378040e3a19bcfa2eac87d onto dev.
