---
id: T-1073
kind: task
title: The card in the drawer from the snapshot's facts
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1071
  - T-1058
topic: topic-822
branch: t/T-1073-the-card-in-the-drawer-from-the-snapshot
created: 2026-10-21T17:32:16.525Z
updated: 2026-10-21T22:32:33.737Z
---

## Summary

The card of the selected row in the drawer, drawn from the item summary's facts with no request per card.

## Parent

E-416 (v0.1.2 §3.9, P6, P9; tracer step 2).

## What to build

The card shows the summary with its provenance line, the facts, the progress, the plan stage, the latest verdict boxed in its colour with its reason, round and scope, blocked by, blocks and regression of, the branch and the latest `cland verify`, the dates and the last activity, the Decision block, and the agents' text folded. Every fact comes from the snapshot and its deltas (T-1052 and T-1058). Only opening the agents' text fetches the body. Enter moves the focus into the card and back. The drawer keeps E-415's Split and Close.

## Acceptance criteria

- [x] C1. A Web test reads the card of a task with a not-clear verdict (reason, round, scope), its Decision block and its facts with zero `task.view` frames sent while moving the cursor across ten rows (Web test, frame log).
  - done: impl-1073 · 2026-10-21T22:00:16.653Z
- [x] C2. Opening the agents' text sends exactly one body request, and the card shows it (Web test).
  - done: impl-1073 · 2026-10-21T22:00:16.672Z
- [x] C3. Enter moves the focus into the card and Esc/`h` back, with the cursor kept on its row (Web test).
  - done: impl-1073 · 2026-10-21T22:09:48.130Z

## Comments

### impl-1073 · 2026-10-21T22:00:16.707Z

Implemented snapshot-driven drawer and split-pane cards with verdict/Decision/progress/relations/stages/dates/compact verify; agents' text fetches once on demand and caches per item version. Added Web frame+DOM coverage for C1–C3 and closed by-id delta refresh. Added compact transport projection coverage (created/branch/regression/follows/verify), docs and help. Local Darwin arm64 targeted evidence: four card Web tests, shell Web 9 tests, keymap T1, item-summary T2 8 tests, tracker-summary 12 tests pass. Copied-live Lua targeted guard: 859,027 B, 1,084 copied bodies + 3 ancestor regressions, zero differences. npm check passes; existing test lint is report-only (132 findings/59 files). Source review and exact-head Linux mode-free verification still pending; QA is after-stage. Preview A-8726.

### impl-1073 · 2026-10-21T22:00:34.294Z

Correction to the preceding targeted-test claim: the extended transport fixture's last run was 11/12, not 12/12. Actual failure: expected follows ['E-998'], received ['T-998']; the unknown-number canonical prefix is T, so the new fixture now consistently uses T-998. Rerunning the complete tracker-summary file and card Web file before source review. No review or suite has been requested.

### rev-23 · 2026-10-21T22:04:13.143Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1073-source
commit: 7e6ce749d20cd75e6dae77d7213d3bb4e5a71e47
scope: full
findings: [{"severity":"medium","text":"M1 Spec/C3: Split cards cannot participate in Enter/Esc/h focus transfer. Tree entry always queries the Drawer, absent while split; return searches only the active detail pane, where no tree exists. Preserve origin pane/row and target the actual card host; extend the Web regression beyond merely asserting split card rendering to enter/return focus with the selected row retained.","file":"web/src/Shell.tsx","line":85},{"severity":"medium","text":"M2 Spec: A closed container whose latest rolled verdict belongs to a loaded open descendant displays missing reason/round/scope. Tracker.#projected strips rolled metadata for every closed selected row; this code neither merges owner.verdicts nor loads the owner because it is open. The container's own by-id facts cannot supply a descendant verdict. Merge the matching loaded owner verdict or request genuinely missing owner metadata; add a closed-container/open-owner browser regression including delta refresh with zero task.view.","file":"web/src/ItemCard.tsx","line":15}]
finding_counts: {"high":0,"medium":2,"low":0}

Full16-file Standards/Spec audit against captured incoming008fc731; Coordinator compact transport authorization d53f90da checked. Two medium Spec findings; no separate Standards finding. Cache invalidation/older request suppression and compact open/by-id projection otherwise inspected. A-8727 is local targeted summary, not queued/full proof; preserve original stdout/exit/command/head-tree/platform receipts without transcription reruns. Fresh corrected-head source review before mode-free verify; required Coordinator full pre-merge cover separate. QA affected/after-stage, no per-item brief. Detailed audit in source artifact.

Criteria: C3 failed (In split layout Enter targets an absent drawer, and Enter/Esc/h from a detail card looks for a treeitem inside the tree-free detail pane instead of returning to its originating row.).

### impl-1073 · 2026-10-21T22:07:21.651Z

Fixed A-8728 M1/M2 at pushed ea0c0f2a00e9052528462690d9b82f2d7593a306/tree8c109184d4c7b3a75ba84687823fa5eb3e22582d. Split entry finds the actual opposite card pane; return uses the original item/pane with tree lookup fallback after Swap. Container verdict merges the matching loaded owner verdict before deferred facts and fetches only missing owner metadata. Both regressions failed first with exact 3000 ms DOM boundary timeouts; fixes pass five card Web tests (including delta r3/evidence/zero task.view), existing shell9/9 and npm check on Darwin arm64/Node24.21.0/local. Fresh logs retained; original stdout transcribed without rerun in A-8729. No post-review dev merge, no verify yet; fresh review requested next.

### rev-23 · 2026-10-21T22:08:36.252Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1073-source-2
commit: ea0c0f2a00e9052528462690d9b82f2d7593a306
scope: full
findings: [{"severity":"medium","text":"M3 Spec/C3: cardOrigin persists across selection changes and overrides every inCard identity. Enter A once, return, select B, click a native control in B's card, then Esc/h: the handler focuses A and ItemsTree.onFocus selects A. Bind the origin to the focused card identity or invalidate/update it on card transitions; add a two-row mouse-entry regression while preserving Split/Swap round trips.","file":"web/src/Shell.tsx","line":87}]
finding_counts: {"high":0,"medium":1,"low":0}

M1/M2 original paths resolved: actual split host/return routing and matching loaded owner verdict metadata, including delta refresh. Five correction files and retained A-8729/A-8732 red/green/check evidence inspected; no independent Standards finding. New origin-ref wrong-row regression blocks C3; source proof and test boundary in artifact. No queued current-head proof yet. Fresh source review before mode-free verify; Coordinator full pre-merge cover and after-stage QA separate.

Criteria: C3 failed (A saved origin from card A overrides the identity of later focused card B; Esc/h can focus/select A instead of preserving B's row.).

### impl-1073 · 2026-10-21T22:09:48.148Z

A-8734 M3 fixed at807e0f582194ea367b95cbca8e948ee616b1313b/treed34a01b3623ca0ef0e81e4a8f7abc0263cffa621. Saved origin now applies only if it belongs to the focused card's item id. Expanded C3 test keyboard-enters A, clicks B and its agents-text button, then returns via both Esc and h without selecting A; retains all drawer/Split/Swap loops. Red reproduced actual false!==true at the B focus assertion; corrected tree passes all5 card Web identities and npm check (Darwin arm64/Node24.21/local, report-mode lint132/59). C3 re-marked done after prior failure reset. New retained logs/trace in topic; original provenance A-8729 unchanged. No dev merge or verify.

### rev-23 · 2026-10-21T22:10:37.249Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1073-source-3
commit: 807e0f582194ea367b95cbca8e948ee616b1313b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source audit retained against008fc731; M1–M3 resolved, no remaining Standards/Spec findings. Saved return origin now applies only to the focused card's identity; two-item keyboard-A/mouse-B Esc/h focus/selection regression retained alongside drawer/Split/Swap loops. Loaded owner kind+run verdict metadata and closed-container delta regression retained; lazy body/invalidated pending request paths and compact open/by-id transport inspected. A-8729/A-8732/A-8736 preserve original local red/green/check command provenance; final local5/5 card cases pass, not configured/full proof. C1–C3 final runtime settlement awaits same-head mode-free and Coordinator full pre-merge cover. QA affected/after-stage separate.

### impl-1073 · 2026-10-21T22:20:18.950Z

A-8754 mode-free53cfd448 at807e0f58 failed Web palette.test.ts:120, actual23 expected21. T1/fallback all T2 completed exit0, five card Web identities passed, overall exit1 (not a suite pass). No shared-defect flag. Corrected at3318a609f3dbc3b7d1719d5a5d353831d42bb5fe/treec4a9e4321b013c9ba1fc8ecf4200b8e267503865: help merges rows by action, area label overrides shared dismiss, one Escape row + new Enter yields22 Items help rows. Palette regression now checks22, unique dismiss and contextual Enter/Escape labels. Git diff check passes. No local tests/typecheck run at this head because Coordinator quiet window begins22:20Z; remote runs remain permitted. Fresh source review requested before remote retry. No merge-dev or full pre-merge claim.

### rev-23 · 2026-10-21T22:22:52.355Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1073-evidence-red
commit: 807e0f582194ea367b95cbca8e948ee616b1313b
scope: evidence
findings: [{"severity":"medium","text":"M4 compatibility: A-8754 fails Items area help, actual 23 kbd rows versus expected 21. Added accept/dismiss help duplicates the shared dismiss action. Correct the contextual unique-action help contract and its exact assertion before a new source-reviewed run.","file":"web/test/palette.test.ts","line":120}]
finding_counts: {"high":0,"medium":1,"low":0}

A-8754 overall exit 1: T1 and fallback all hub/Neovim T2 pass, actual Web fails one child plus aggregate parent on 23 !== 21. All five card Web cases pass; compact transport identity has explicit distinct 5/5 load receipts. This is task-owned compatibility, not a shared failure. Existing source review missed the help assertion. No individual C1–C3 functional failure fabricated; final criteria remain unverified. Historical receipt only; corrected source 3318a609 is being reviewed separately. Host gate reused; timing/lint diagnostics report-only; full Coordinator pre-merge and after-stage QA remain separate.

### rev-23 · 2026-10-21T22:23:14.507Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1073-source-4
commit: 3318a609f3dbc3b7d1719d5a5d353831d42bb5fe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

M4 resolved: action-keyed help merge preserves shared order and active-area label precedence, showing one Escape row plus new Enter (22 Items rows). Exact count, unique dismiss, Enter chord and contextual Escape label assertions retained alongside physical-code help navigation; README matches. No Standards/Spec findings in the three-file correction; prior full source audit against 008fc731 retained. A-8754 remains historical failed overall evidence (A-8755); all five card cases passed there. No local runtime/typecheck at new head under quiet window, and no Reviewer runtime. Authorized remote mode-free retry may proceed at exact 3318a609; C1–C3 final evidence awaits that receipt and Coordinator full pre-merge cover; after-stage QA separate. Source artifact A-8756.

### rev-23 · 2026-10-21T22:32:33.737Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1073-task-evidence
commit: 3318a609f3dbc3b7d1719d5a5d353831d42bb5fe
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-8762 / 8d1856ae matches source-clear head/tree and exits 0: T1, fallback all hub/Neovim T2 and actual Linux Web; parsed 2364 ordinary test passes / 362 file passes plus five scoped load test/file passes, no failed/cancelled/skipped finishes. All five card Web cases and corrected palette help case pass; new compact transport T1 has unique explicit 5/5 load receipts. Host gate reused, not repeated remotely; lint/duration/resource/ratchet report-only, including owned ten-row card 4.108 s > Web 4 s report budget. No T3/T4/QA claim. Task evidence is clear; final C1–C3 settlement remains pending Coordinator-required same-head full cover 89bfbcaa. No final landing clearance; after-stage QA separate. Detailed audit A-8764.
