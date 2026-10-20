---
id: T-975
kind: task
title: "Shipped role clauses have no byte headroom: trim them to pointers (or re-derive the reserve) before v0.2 adds clause lines"
state: closed
status: done
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
updated: 2026-10-20T17:13:39.594Z
closed: 2026-10-20T17:13:39.594Z
---

## Summary

T-955's T1 guard holds each shipped role clause to a 7680-byte reserve (512 bytes below the 8192-byte send cap). During the v0.1.5 sweep, T-561, T-794, T-956, T-957, T-958 and T-962 each had to shorten clause lines, and two merge batches went red on the reserve. The Coordinator and QA clauses are now near the reserve, and the Implementer clause has 373 bytes of headroom. v0.2's epics will need clause lines too.

## What to build

Move procedural detail out of the shipped clauses into the skills and docs they already point to, so each clause keeps at least 15 % headroom under the reserve. Keep every rule and permission statement the clause owns. Alternatively, re-derive the reserve from the actual send cap and envelope size if 512 bytes of slack is more than needed, with the reasoning in the evidence.

## Acceptance criteria

- [x] C1. Every shipped clause (defaults and project) has at least 15 % headroom under its reserve in roles-clauses.test.ts, or the reserve change is reasoned and tested against the send cap.
  - done: impl-975 · 2026-10-20T16:47:49.792Z
  - verified: rev-23 [reviewer] · run rev-20261020-975-final · 2026-10-20T17:08:48.070Z · commit 268f6fe15930d2c05f3755cc926ecc5e6485a9ee
- [x] C2. Each removed line is either a pointer kept in the clause or text moved verbatim into the skill or doc it now lives in (assertion map in the evidence).
  - done: impl-975 · 2026-10-20T16:57:34.919Z
  - verified: rev-23 [reviewer] · run rev-20261020-975-source-contract-corrected · 2026-10-20T16:59:02.381Z · commit 268f6fe15930d2c05f3755cc926ecc5e6485a9ee
  - verified: rev-23 [reviewer] · run rev-20261020-975-final · 2026-10-20T17:08:48.070Z · commit 268f6fe15930d2c05f3755cc926ecc5e6485a9ee

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

### rev-23 · 2026-10-20T16:55:08.584Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-975-evidence-red
commit: 7c36ab4a1835e817c5aa38fddb803c56d7306dcb
scope: evidence
findings: [{"severity":"medium","text":"The same-head gate fails existing QA source contracts after moving procedure detail: review-qa-component reports 'qa: the verdict header' (expected /verdict: qa/ in the compact clause), and skills-qa-catalogue.test.ts:37 reports 'the coordinator clause names the brief'. Adapt all affected assertions to verify both the retained inline normative summary/pointer and the verbatim destination procedure, preserving the original request, verdict, report, rescue, UI-driving and brief requirements rather than dropping checks.","file":"hub/test/review-qa-component.test.ts","line":16}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: medium review-qa-component.ts:16 and skills-qa-catalogue.ts:37 source assertions incomplete after relocation. A-7722 actual failures: 'qa: the verdict header' expected /verdict: qa/, and 'the coordinator clause names the brief'. Adapt all affected assertions to inline summaries/pointers plus verbatim destination content, preserving original semantic checks. Spec source correction intact; roles-clauses 27/27 passes. Gate ordinary 639 pass/2 fail, Linux T1 exit 1; T2/Neovim not run, T3/T4 deferred. C2 failed. New-head source review required; not an unchanged-head retry. Host check 794f64c9 not repeated; diagnostics report-only. Reviewer ran no tests.

Criteria: C2 failed (Two existing QA source-contract tests still require relocated procedures inline; same-head T1 gate fails before T2/Neovim.).

### impl-975 · 2026-10-20T16:58:08.115Z

Contract-test correction pushed at 268f6fe15930d2c05f3755cc926ecc5e6485a9ee, only four test files changed since reviewed 7c36ab4a. Actual red failures were 'qa: the verdict header' and 'the coordinator clause names the brief'. Retained original procedural assertions in their verbatim skill destinations with separate inline rule/pointer checks; also fixed T2 category snapshot and T3 native QA first-turn expectations found by search. Local Darwin arm64 targeted passes: T1 failed files 6/6, T1 roles-clauses 27/27, T2 roles-snapshot 11/11, T3 native contract file 1/1; hub typecheck exit 0. No full-suite pass claim. Old droplet c304fa87 failed T1; T2 did not complete. A-7726 contains final full byte/assertion map and evidence history. C1/C2 done; corrected-head source review requested before new mode-free verify.

### rev-23 · 2026-10-20T16:59:02.381Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-975-source-contract-corrected
commit: 268f6fe15930d2c05f3755cc926ecc5e6485a9ee
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. Four test-only corrections retain original QA/request/verdict/report/rescue/UI/brief contracts across inline normative pointers and their verbatim skill destinations. T2 category and native T3 first-turn assertions adapted without weakening actual transport/storage checks. Clauses, all 41 moves, byte ceilings and permissions unchanged; C2 source verified. A-7726 local T1 6+27, T2 11 and targeted T3 1 pass plus typecheck are supplemental summary evidence. C1 awaits new-head mode-free gate. Red c304fa87/A-7722 and A-7723 retained, no flaky retry claim. QA none; Reviewer ran no tests.

Criteria: C2 verified.

### impl-975 · 2026-10-20T17:08:21.204Z

Replacement verification 5ba19bae-fc8a-40bb-965d-ceb3092e8a7e passed at reviewed/pushed head 268f6fe15930d2c05f3755cc926ecc5e6485a9ee. Executed T1 and fallback all T2 across hub/Neovim: 2062/2062 pass, exit 0. T3 deferred to periodic dev and integrated occasions (not in configured batch tiers); no T3-tier/full integrated claim. Executor: hub-managed droplet Linux x64, c-8 lon1, Node 24.21.0/Neovim 0.12.5; lifetime 363s, reported estimated cost $0.0252. Host typecheck gate was recorded at 69480f59f49251353cd0bfd7b9af14c40118785f, not repeated remotely. Test lint/budgets remain report-only (131 findings, zero refusals). Log A-7740; byte table/verbatim map A-7726. Awaiting Reviewer final same-head verdict; source remains unchanged. Retained failed first receipt A-7722 and review A-7723.

### rev-23 · 2026-10-20T17:08:48.070Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-975-final
commit: 268f6fe15930d2c05f3755cc926ecc5e6485a9ee
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7740/run5ba19bae passes2062 ordinary tests/327files at unchanged source-clear head, Linux T1/all-T2 including Neovim. C1 roles-clauses27/27 enforces6528 ceiling under unchanged7680 reserve; max table6508 gives15.26% headroom. C2 41 verbatim moves, unchanged permissions/config and restored rules plus corrected QA/category assertions established; all affected T1/T2 files pass. Retain old c304fa87/A-7722 red and A-7723, plus A-7714 initial boundary correction. Native T3 target local proof separate; T3/T4 deferred. Host69480f59 check not repeated, diagnostics report-only. QA none; Reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T17:13:39.594Z

Merged 03aad97fd15b9cb67382b6d15bd8ea9db4c5b9f2 onto dev.
