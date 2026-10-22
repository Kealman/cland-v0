---
id: T-1145
kind: task
title: Skill provenance 'changes' line forces a merge conflict on every ticket that edits a skill
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-859
branch: t/T-1145-skill-provenance-changes-line-forces-a
created: 2026-10-22T16:09:09.611Z
updated: 2026-10-22T16:19:07.346Z
---

## Summary

The skill provenance lint requires each skill's `metadata.changes` to be one line, and tickets append their own entry to that line in `.agents/skills/implement/SKILL.md`. Any two tickets in flight that both touch the skill therefore conflict. On 2026-10-22 T-1116 and T-1117 each needed a dev merge, a delta review and a fresh verify after T-1109 and T-1116 landed, purely for this line.

## What to build

Per-ticket provenance entries no longer share one line. For example, `changes` keeps a short stable summary and the entries move to a per-skill list whose lines append independently (a union-merged file, or one entry per line). The lint still requires a provenance record for cland's edits, and existing entries move over unchanged.

## Acceptance criteria

- [x] C1. Two branches that each add a provenance entry to the same skill merge without a conflict (test).
  - done: impl-1145 · 2026-10-22T16:15:03.982Z
- [x] C2. The provenance lint still fails a skill with cland edits and no provenance entry, and passes every current skill after the migration (test).
  - done: impl-1145 · 2026-10-22T16:15:04.095Z

## Comments

### impl-1145 · 2026-10-22T16:10:50.775Z

Implementing conflict-free provenance with a per-skill CHANGES file and local .gitattributes (merge=union). Test-first seams: native sealed Git merge after skill provisioning (C1), provenance gate rejection/current-skill acceptance (C2).

### impl-1145 · 2026-10-22T16:15:21.421Z

Committed and pushed 7b6f984a23289fc4fa505a38ad56482d28d23219. C1/C2 done; source review requested from Reviewer in topic-859. Evidence A-9287 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9287-t-1145-provenance-migration-and-test-first-evidence.md. Targeted macOS checks passed; full exact-head verification awaits clear source verdict.

### rev-26 · 2026-10-22T16:19:07.346Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1145-source-1
commit: 7b6f984a23289fc4fa505a38ad56482d28d23219
scope: full
findings: [{"severity":"low","text":"L1: Scope the CHANGES/union-attribute wording to the 15 kept upstream skills; cland-owned curated skills do not carry those files. The opening init/skills.ts comment repeats the same overbroad wording.","file":"hub/README.md","line":1697}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear at 7b6f984a; A-9294 records both axes. All 15 original provenance strings are preserved verbatim, with stable pointers and portable union attributes. Native Git test matches merge-tree/one-parent squash operations after provisioning; isolation, cleanup and T1/T3 membership are appropriate. L1 is documentation scope wording only. C1/C2 remain run-dependent and unverified pending unchanged-head configured evidence plus attributable native Git T3 execution; A-9287 is qualified precommit development evidence, not final proof.
