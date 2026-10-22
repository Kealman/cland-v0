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
updated: 2026-10-22T16:15:21.421Z
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
