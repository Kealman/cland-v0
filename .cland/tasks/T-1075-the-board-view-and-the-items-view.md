---
id: T-1075
kind: task
title: The Board view and the Items view switcher
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1071
topic: topic-832
branch: t/T-1075-the-board-view-and-the-items-view
created: 2026-10-21T17:32:16.777Z
updated: 2026-10-22T04:40:03.438Z
closed: 2026-10-22T04:40:03.438Z
---

## Summary

The Board view beside the tree, and the Items header's view switcher that keeps the scope, the filter and the selection.

## Parent

E-416 (v0.1.2 §3.11 as a view; tracer step 4).

## What to build

The Items header gets the switcher (Tree, Board, Graph, Plan); Graph and Plan come in later tickets and show as disabled until then. The Board shows status sections with counts and rows with the parent prefix, the claim or verdict mark, verified/total, the blocked glyph and the next mark. At release scope, the epics show as folded rows with done/total and the breakdown, unfolding into status sections, along with the epic tabs, Direct tasks (N) and the categories' count line. The Board has no rank keys; order, `next` and `blocked` come from the hub. `nvim/lua/cland/vboard.lua` defines the behaviour.

## Acceptance criteria

- [x] C1. Switching Tree → Board → Tree on a scoped epic keeps the scope, the filter and the selected task (Web test).
  - done: impl-1075 · 2026-10-22T04:20:03.746Z
  - verified: rev-26 [reviewer] · run rev-20261022-1075-final-1 · 2026-10-22T04:34:33.836Z · commit cc3e06353c002f4e56f6beb2dbc74f14be9af811
- [x] C2. At release scope the Board shows the epics as folded rows with done/total including closed children, and unfolds one into status sections (Web test).
  - done: impl-1075 · 2026-10-22T04:20:03.919Z
  - verified: rev-26 [reviewer] · run rev-20261022-1075-final-1 · 2026-10-22T04:34:33.836Z · commit cc3e06353c002f4e56f6beb2dbc74f14be9af811
- [x] C3. The Board offers no rank or move action by key or mouse (Web test).
  - done: impl-1075 · 2026-10-22T04:20:03.990Z
  - verified: rev-26 [reviewer] · run rev-20261022-1075-final-1 · 2026-10-22T04:34:33.836Z · commit cc3e06353c002f4e56f6beb2dbc74f14be9af811

## Comments

### impl-1075 · 2026-10-22T04:20:04.062Z

Implemented Board + header switcher at 0e191e284b7f9d1e7fa35af380636f2cf7e39cb0 (tree 4f5fb7ffa12918108a5bb344aed8f5b1fa5208b9). Shared T-1074 preference/scoped-model commits cherry-picked unchanged; scoped Tree call consumes shared scope. Test-first reds: missing Board button; scoped Tree ignored scope; epic-tab narrowing incorrectly replaced release.next. All fixed. Local Darwin arm64 targeted evidence: board.test.ts 3 criterion cases + parent pass, item-card.test.ts 6 pass, shell.test.ts 8 cases + parent pass; all no skip/cancel and observed fixture teardown. Root typecheck and tier lint pass. These are targeted local checks, no suite/remote/T3/QA claim. Board screenshot A-8891; final criterion Web log artifact posted in item topic. Per launch brief, stage QA runs on dev, no per-item QA brief.

### rev-23 · 2026-10-22T04:23:13.781Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1075-source
commit: 0e191e284b7f9d1e7fa35af380636f2cf7e39cb0
scope: full
findings: [{"severity":"medium","text":"M1: Board Direct tasks reuses Tree's :direct:<scope> preference key. Opening/toggling it in Board changes the Tree fold on return, contradicting independent view folds (web/README:205–206 and vboard's board:direct namespace). Namespace Board's key and add a two-way browser fold round trip.","file":"web/src/items-board.ts","line":90}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear on one fold-state collision. Shared scope/filter/selection, authoritative totals/next and no-rank action paths otherwise look implemented; supporting local criterion4/4 is not configured proof. No runtime execution by Reviewer. All criterion marks remain pending actual accepted verification, no failed criterion asserted from static-only test gap. Full audit A-8894. Correct and request fresh source review before verify.

### impl-1075 · 2026-10-22T04:24:17.265Z

M1 fixed: Board Direct tasks now uses board:direct:<scope>, independent of Tree's :direct:<scope>. Extended the existing C2 Web case with Board→Tree and Tree→Board fold round trips. Red before fix: “Board unfolding leaves Tree folded”, 'true' !== 'false'. After fix all 3 criterion cases + parent pass locally on Darwin arm64, observed teardown; web typecheck/colour/contrast/hooks checks pass. No dev merge after first review; only this fix + regression changed. Fresh source review requested before configured verification.

### rev-26 · 2026-10-22T04:25:21.239Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1075-source-2
commit: cc3e06353c002f4e56f6beb2dbc74f14be9af811
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-8899 incorporates rev-23 full audit A-8894. M1 resolved: Board Direct tasks key board:direct:<scope> is independent from Tree :direct:<scope>; existing C2 now checks both directions and retains final rendered-row/aria-expanded assertions. Only two files differ from0e191e28; no dev merge. Shared scope/filter/selection, authoritative counts/next, disabled future views and read-only/no-rank paths rechecked. Standards0; Spec0. Local A-8898 stdout has3 criterion subtests+parent4/4 and observed teardown, but no embedded command/exit/source envelope; request-reported Darwin arm64 target remains supporting evidence. All C1-C3 await same-head configured verification; after-stage QA on dev separate. No final-ready claim.

### rev-26 · 2026-10-22T04:34:33.836Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1075-final-1
commit: cc3e06353c002f4e56f6beb2dbc74f14be9af811
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head audit A-8912: A-8910/run8df6cf86 T1/all hub+Neovim T2/actual Web exits0,2398 ordinary passes,0fail/skip/cancel. C2 release counts/status sections and independent folds2.116s; C1 scoped/filter/selection round trip0.650s; C3 no rank/move actions and exact hub rank/parent receipts1.097s; parent4.964571203s and owned cleanup census after0. All C1-C3 verified; no remaining Standards/Spec findings. A-8900 original red/typecheck tool receipts preserve precommit provenance; no exact-red-tree claim. Linux x64 c-8 lon1,453s/$0.0315; host9d96884e reused not repeated remotely. Owned parent>Web4s is report-only, no4s budget pass claimed; nine missing baselines retained. No load5/5,T3/T4,full lifecycle or after-stage QA claim. Stage QA on dev remains separate.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1075 · 2026-10-22T04:34:37.556Z

Configured same-head receipt 8df6cf86/A-8910 at reviewed cc3e06353c002f4e56f6beb2dbc74f14be9af811/tree 4a80bf0ba2b53cb97a8eed3b1b07e021856c9a17: exit 0, 2398/2398 tests, no failures/skips/cancellations. Linux x64 c-8 lon1 droplet cland-v0-d8d63672, Node24.21.0/Neovim0.12.5. T1 all123 files; fallback T2 all232 hub+Neovim files; Web all9 files actually ran. Board C2 2.116454813s, C1 0.649611028s, C3 1.097136633s, parent4.964571203s; fixture browser group18067 after0, scratch hub stopped. Board parent exceeds the report-only4s Web budget but stays below5s new-identity allowance trigger; no dated allowance added. Host npm run check passed and was not repeated remotely (host gate9d96884e); duration/test-lint gates remain report mode with132 findings/59files and9 missing baselines reported. No5/5 Web load claim: Web does not enter load lanes. Droplet lifetime453s/cost$0.0315 is executor lifetime, not suite wall time. T3 deferred to periodic dev/integrated occasions, absent configured batch tiers; no T3/T4/after-stage QA pass claimed. Head/worktree unchanged and clean; awaiting Reviewer final same-head evidence settlement.

### coord · 2026-10-22T04:40:03.438Z

Merged d52dbf6cf923b88c1ab21f64ab1be9480ea492eb onto dev.
