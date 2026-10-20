---
id: T-975
kind: task
title: "Shipped role clauses have no byte headroom: trim them to pointers (or re-derive the reserve) before v0.2 adds clause lines"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-748
branch: t/T-975-shipped-role-clauses-have-no-byte
created: 2026-10-20T15:38:57.185Z
updated: 2026-10-20T16:51:18.450Z
---

## Summary

T-955's T1 guard holds each shipped role clause to a 7680-byte reserve (512 bytes below the 8192-byte send cap). During the v0.1.5 sweep, T-561, T-794, T-956, T-957, T-958 and T-962 each had to shorten clause lines, and two merge batches went red on the reserve. The Coordinator and QA clauses are now near the reserve, and the Implementer clause has 373 bytes of headroom. v0.2's epics will need clause lines too.

## What to build

Move procedural detail out of the shipped clauses into the skills and docs they already point to, so each clause keeps at least 15 % headroom under the reserve. Keep every rule and permission statement the clause owns. Alternatively, re-derive the reserve from the actual send cap and envelope size if 512 bytes of slack is more than needed, with the reasoning in the evidence.

## Acceptance criteria

- [x] C1. Every shipped clause (defaults and project) has at least 15 % headroom under its reserve in roles-clauses.test.ts, or the reserve change is reasoned and tested against the send cap.
  - done: impl-975 · 2026-10-20T16:47:49.792Z
- [x] C2. Each removed line is either a pointer kept in the clause or text moved verbatim into the skill or doc it now lives in (assertion map in the evidence).
  - done: impl-975 · 2026-10-20T16:50:35.397Z
  - verified: rev-23 [reviewer] · run rev-20261020-975-source-corrected · 2026-10-20T16:51:18.450Z · commit 7c36ab4a1835e817c5aa38fddb803c56d7306dcb

## Comments

### impl-975 · 2026-10-20T16:40:42.841Z

Baseline fixed-fixture rendered reply bytes (reserve 7680): defaults coordinator 7586, implementer 7235, reviewer 5500, qa 7427, aide 2851, lead 5331; project coordinator 7658, implementer 6665, reviewer 5373, qa 7066, aide 2877, lead 5280. Keeping reserve unchanged; adding ≤6528 guard (15% headroom). Moving procedures verbatim to existing pointed-to docs/skills while retaining normative summaries and permissions in clauses.

### impl-975 · 2026-10-20T16:47:29.960Z

Implementation committed and pushed as 7611b0cce53d59f400e8c77f6d697139619bf8be (tree 844bc38a53a8f080dafd141a3c0136e23c06b3b5), branch t/T-975-shipped-role-clauses-have-no-byte; origin/dev fetched/merged before first review. Evidence A-7709 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7709-t-975-clause-bytes-and-verbatim-procedure-assertion-map.md includes 12-role before/after byte table, all 41 verbatim relocations and retained inline summaries. Tightest headroom: project Coordinator 6481/7680, 15.61%. T1 clause file 27/27 passed at final tree; T2 role component 5/5 passed on same implementation code before final doc-only cleanup. Local Darwin arm64. Typecheck/static passed; test lint report-only, 131 findings, 0 refusals. Mode-free head-bound verify awaits clear source review. QA policy none/per-item, no QA criteria or supplied brief.

### rev-23 · 2026-10-20T16:49:24.001Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-975-source
commit: 7611b0cce53d59f400e8c77f6d697139619bf8be
scope: full
findings: [{"severity":"medium","text":"The Coordinator summary changes the brief deadline from 'Before launching an item needing QA' to 'Before QA launches' (also .cland/roles.toml:67). That allows launching implementation without its committed brief, contrary to the unchanged rule preserved in the destination QA skill and this item's requirement to retain rules. Keep the original pre-item-launch boundary in both inline summaries and guard it in T1; compact command details can remain in the skill.","file":"hub/src/roles/default-roles.ts","line":79}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: no independent finding; reserve unchanged, added 15% fixture guard and docs/provenance coherent. Spec: medium default-roles.ts:79 and roles.toml:67 change 'Before launching an item needing QA' to 'Before QA launches'. Restore the original item-launch prerequisite in both summaries and assert it at T1. All 41 removed lines independently found verbatim at destinations; both sources' non-clause permissions/configuration deep-equal and other roles unchanged. Source artifact records audit and A-7709 local-target limits. C2 failed; C1 final proof pending corrected source/gate. No verification run yet; Reviewer ran no tests.

Criteria: C2 failed (Coordinator inline summaries delay committed QA brief readiness from before launching the item to before launching QA, conflicting with the preserved original rule.).

### impl-975 · 2026-10-20T16:50:48.778Z

Addressed source finding rev-20261020-975-source in pushed head 7c36ab4a1835e817c5aa38fddb803c56d7306dcb: restore both Coordinator clauses' pre-item-launch committed-brief prerequisite and add T1 assertion. Targeted local Darwin arm64 red proof 25 pass/2 fail on old wording, corrected T1 27/27 pass; hub typecheck exit 0. Updated evidence A-7717, all 41 original lines re-audited. Minimum free reserve now 15.26% (project Coordinator 6508/7680). Both criteria done; corrected source review requested before verification.

### rev-23 · 2026-10-20T16:51:18.450Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-975-source-corrected
commit: 7c36ab4a1835e817c5aa38fddb803c56d7306dcb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. Both Coordinator summaries restore committed brief/lead path before launching the item; T1 now asserts that boundary for both sources. Original 41-line verbatim map, unchanged non-clause permissions/configuration and other normative summaries revalidated; C2 established. A-7717 corrected local T1 27/27/hub typecheck and byte table: max 6508 <= 6528, unchanged 7680 reserve. Earlier T2/T0 receipts explicitly pre-correction; C1 final gate proof awaits exact-head mode-free verify. Corrected source artifact records limits; A-7714 retained. QA none; Reviewer ran no tests.

Criteria: C2 verified.
