---
id: T-436
kind: task
title: QA catalogue case EXPLORER-001 asserts the lead column at a width where the explorer hides it
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-1000
branch: t/T-436-qa-catalogue-case-explorer-001-asserts
created: 2026-10-14T18:29:15.523Z
updated: 2026-10-24T20:55:06.279Z
---

## Summary

The catalogue case EXPLORER-001 asserts `coord` in the explorer buffer with the card open at 200x50. The tree then has 85 content columns, and nvim/lua/cland/explorer.lua:397–402 shows the lead column only from 118. The product is right. The case should assert lead only when the tree is wide enough, or open the card after the lead check. Seen in E-276 QA run qa-2026-10-14-27-10 (A-2507). Its assertions after `coord` were not reached.

## Acceptance criteria

- [x] C1. EXPLORER-001 passes at 200x50 with the card open, and still checks the lead column at a width of 118 tree columns or more.
  - done: impl-436 · 2026-10-24T20:54:08.481Z

## Comments

### impl-436 · 2026-10-24T20:51:29.260Z

Implementing EXPLORER-001 responsive-width correction. Scope is the QA catalogue assertion sequence, not the explorer product or shared wire contract. Reading the catalogue runner to replay the existing case at 200x50 and retain the lead-column assertion in a >=118-column tree.

### rev-26 · 2026-10-24T20:55:06.279Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-436-source-1
commit: 3219b8332a12da383608bb96a0037a85468cecc7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11411 full Standards/Spec source clear. Narrow200x50/card-open retains all original outline/order/fold/highlight/wrap/registry assertions, adds measured<118/lead-absent; positivecoord moved to card-open wide measuredcontent>=118. Reviewed-head render assigns window_width after buffer/mark writes; bounded cache+width receipt/final assertions appropriate. T4 catalogue entry/guide preserve existing loop/runner; no product/sharedcontract/keybinding/dependency/allowance change. A11409 localDarwin headless red/green32/32/typecheck summary not configured proof; preserve available original outputs/exits/timing/dumps/source limits without transcription rerun. C1runtime unverified until unchanged-head ordinary mode-free verify and final evidence review naming generatedEXPLORER001actual completion/facts/changedT4timings. No per-itemQA/landingclaim.
