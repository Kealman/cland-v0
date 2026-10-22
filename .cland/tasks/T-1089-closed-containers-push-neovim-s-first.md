---
id: T-1089
kind: task
title: Closed containers push Neovim's first payload to 240 KB on the live tracker, over the 128 KiB budget
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
regression_of: T-1081
topic: topic-828
branch: t/T-1089-closed-containers-push-neovim-s-first
created: 2026-10-22T01:04:50.220Z
updated: 2026-10-22T02:15:06.320Z
closed: 2026-10-22T02:15:06.320Z
---

## Summary

Since T-1081, Neovim's first item payload carries every container, closed releases and epics included. On a copy of the live tracker (1,088 items, 109 open) it is 240,750 bytes, against the 131,072-byte (128 KiB) first-payload budget that E-1006 C3 set. That is `AssertionError: first item payload budget: 240750 bytes > 131072 bytes`, found by impl-1088 at dev 780e7ba7 with the startup probe on macOS. The thousand-item test fixture stays at 121 KB because it holds few closed containers, so no suite run caught it. Connection-to-render is still 40 ms, but the budget is a hard limit.

## What to build

Neovim's first item payload, and the web's open snapshot where it feeds the same budget, holds the open items and only the containers they need: open containers, and the ancestors of open items. Fully closed containers whose subtree has no open item move to the bounded closed pages, like closed tasks. The hub's roll-ups on the remaining rows keep counting closed descendants, so done/total and the stage counts stay correct. Unfolding a closed container, or turning on `D`, loads it through the pages.

## Acceptance criteria

- [x] C1. On a copy of the live tracker, Neovim's first item payload stays at or under 120 KiB, measured by the startup probe and asserted in a test with a fixture that holds many closed containers (test).
  - done: impl-1089 · 2026-10-22T01:36:24.804Z
  - verified: rev-23 [reviewer] · run rev-20261022-1089-final · 2026-10-22T02:10:19.055Z · commit 02c00b23b70e6676d735efa48380fbbbf6d9628b
- [x] C2. Releases, epics and categories still show their full done/total and stage counts from the hub's roll-ups with closed containers out of the first payload, in Neovim and in the web tree (tests).
  - done: impl-1089 · 2026-10-22T01:57:47.288Z
  - verified: rev-23 [reviewer] · run rev-20261022-1089-final · 2026-10-22T02:10:19.055Z · commit 02c00b23b70e6676d735efa48380fbbbf6d9628b
- [x] C3. Unfolding a closed epic or showing done items loads closed containers and tasks through the bounded pages with one row per identity (test).
  - done: impl-1089 · 2026-10-22T01:57:47.406Z
  - verified: rev-23 [reviewer] · run rev-20261022-1089-final · 2026-10-22T02:10:19.055Z · commit 02c00b23b70e6676d735efa48380fbbbf6d9628b
- [x] C4. The 1 MiB items cap check and the Lua differential still pass on the copied tracker (tests).
  - done: impl-1089 · 2026-10-22T01:14:59.593Z
  - verified: rev-23 [reviewer] · run rev-20261022-1089-final · 2026-10-22T02:10:19.055Z · commit 02c00b23b70e6676d735efa48380fbbbf6d9628b

## Comments

### impl-1089 · 2026-10-22T01:13:12.863Z

Checkpoint: public-frame forest regression reproduced first reply236737 >122880 bytes; ancestor-closure projection reduces it to3017. Closed parent pages now include containers with numeric identity cursors; Neovim scoped/all archive reads discover new containers recursively, and Web traverses/deduplicates nested pages. Local Darwin arm64 targeted: item-summary10/10, tracker-summary12/12, snapshot12/12, native progress6/6, native copied closed-pages1/1 (6.048s), browser items8/8 (new identity0.831s), copied-body Lua1/1 (6.640s,1088+3 bodies,0differences,121791-byte snapshot). npm check passed; test lint report mode,0refusals. Supporting worktree evidence only, not exact-head Linux/suite proof. Startup support/probe contract intentionally untouched until Coordinator posts T-1088 landing, per decision e1bbd285.

### rev-23 · 2026-10-22T01:40:50.586Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1089-source
commit: 298df83db31c0dc65741c5eb1012f98a66045bb6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no Standards/Spec findings across pinned ef469c21...298df83d. Open ancestor closure, bounded mixed-kind closed pages, nested Neovim/Web discovery and identity dedup preserve complete hub roll-ups. Dense startup assertion and copied-body Lua restoration match C1–C4. A-8846 local source-equivalent receipts show 111470-byte copied-live reply, 121518-byte dense fixture and 125244-byte Lua snapshot/zero differences; no exact-head configured/Linux claim yet. Final marks await mode-free verification. Coordinator 796b94ad explicitly says mode-free only/no separate full pre-merge. Review artifact A-8849. After-stage QA separate.

### rev-23 · 2026-10-22T01:50:47.449Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1089-task-red
commit: 298df83db31c0dc65741c5eb1012f98a66045bb6
scope: evidence
findings: [{"severity":"medium","text":"M1: T2 stub still uses old all-non-task first snapshot/task-only closed parent pages. New client replaces closed rows of every kind, dropping archived containers and closed question leaves; three required Neovim assertions fail. Align boundary/producers and affected recordings with new protocol while preserving final assertions; fresh source review before retry.","file":"nvim/test/stub-hub.ts","line":483}]
finding_counts: {"high":0,"medium":1,"low":0}

A-8852 exactly matches head but exits 1: T1 green, T2 three assertion failures, Web not run. Actual errors include global done 4 vs 5, closed child absent, and map 0/3 vs 1/4; screen also reports unrecorded task.view key. Report-only duration warnings are not the actual gate. Source audit missed the unchanged T2 boundary compatibility gap; corrected in A-8853. Coordinate deferred fixture-refresh prerequisite if needed. No separate full run requested.

Criteria: C2 failed (A-8852 required Neovim map/count assertion loses closed question T-6: actual 0/3 vs expected 1/4.), C3 failed (A-8852 archive/global-count and closed-component unfolding assertions fail at the recorded client boundary.).

### rev-23 · 2026-10-22T01:59:36.702Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1089-source-2
commit: 02c00b23b70e6676d735efa48380fbbbf6d9628b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

M1 resolved; fresh source clear. Stub parent pages cover every closed kind and summaryLists matches open ancestor closure. Original three failed tests unchanged; progress checks keep full counts while requiring pruned closed epics unloaded. Independently decoded catalog/shell additions: exactly five new records, zero existing changes/removals; explorer 296-key slice unchanged. Actual shell failure/scoped refresh/ordinary replay retained per Coordinator 80381da0/9910ed7b; zero/reduced guards and minima unchanged. A-8854 local shell60/explorer21/progress6/card15 supporting passes, no configured new-head proof. C1–C4 final marks await mode-free retry, no separate full run per Coordinator. Review A-8855.

### impl-1089 · 2026-10-22T02:09:22.734Z

Mode-free verification abd69565-8f68-402c-8fe1-ce33d9f61457 / A-8856 passed at source-clear02c00b23b70e6676d735efa48380fbbbf6d9628b, Linux x64 c-8 lon1 droplet, Node24.21.0/Neovim0.12.5: T1, all fallback T2 across hub+Neovim, actual Web exit0; reported2394passes/0fails/0skips. New membership and forest identities each explicit5/5 load passes; forest max load2.234s, Web new container case2.258s (<5s new-identity allowance threshold). Host check gate reused, not remotely repeated; lint/duration/resource/ratchet diagnostics report-only, including forest ordinary2.065s vs2s T2 budget. No T3/T4 claim; Coordinator requests no separate full run and owns stage covers. Original failed A-8852 remains historical evidence; current head clean/fixed. Final Reviewer C1–C4 marks pending.

### rev-23 · 2026-10-22T02:10:19.055Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1089-final
commit: 02c00b23b70e6676d735efa48380fbbbf6d9628b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C1–C4 verified. A-8856 exactly matches reviewed head: T1/all-T2/Web exit 0, 2394 ordinary passes; both new task-gated identities five distinct load passes/explicit 5/5. All three A-8852 failures, six aggregate regressions and browser nested archive pass. C1 copied-live111470 B/dense121518 B and C4 Lua125244 B/zero differences retain A-8846 local source-equivalent provenance; native/product source unchanged by correction. Coordinator 796b94ad requires no separate full; no new Linux T3 claim. Forest 2.0645 s/max2.2339 s is a report-only 2 s overage. Other report-only diagnostics, deferred T-1090 refresh and after-stage QA retained. Final audit A-8857; ready for Coordinator enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-22T02:15:06.320Z

Merged 3b54cdcd8864b8278c53713b3ab623fff66e2607 onto dev.
