---
id: T-1122
kind: task
title: Ask cards in the thread and the inbox on one record
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1119
topic: topic-884
branch: t/T-1122-ask-cards-in-the-thread-and-the-inbox-on
created: 2026-10-22T15:16:13.408Z
updated: 2026-10-23T02:01:32.179Z
---

## Summary

An ask is one record shown as a card in its thread and as a row in the Inbox, answered with the same keys: options on `1` to `9`, a free answer, and decline with a reason on `d`, never on Escape. Once answered from any client it folds to one line with its outcome in both places.

## Parent

E-417 (§3.4 "An ask lives in two places with one state"; P14, P37, P38; choice "Decline's key"; tracer step 2).

## What to build

The card (P14) is an amber band with the question, each option as a button with its number key, and a free answer with Send answer when the ask allows one, plus a link to the same ask in the inbox. A click or the number key answers at once while the card or its inbox row has focus. `d` turns the free answer into a reason field and its button into a red Decline that stays disabled until a reason is typed; Answer instead turns it back (P37). Escape never answers or declines. An answer is shown pending until the hub's receipt, then applied or failed, and a failure keeps what the human typed. The first answer from any client wins: a client whose answer lost folds the card to the winner's outcome. An answered ask folds to one line with the option or the answer, who answered and when (the hub's outcome, T-1057), in the thread for good and in the inbox row. In the Inbox area the asks show as these rows in the asks and approvals section; the other kinds keep their stand-in rows until the inbox ticket. Answering marks the topic read up to the ask. A declined ask leaves its topic open.

## Acceptance criteria

- [x] C1. An open ask shows as a card in its thread and as a row in the Inbox with the same question and options, and `2` answers it with option 2, as the asking fake session receives it (Web test).
  - done: impl-1122 · 2026-10-23T01:48:49.593Z
  - verified: rev-23 [reviewer] · run rev-20261023-1122-final · 2026-10-23T02:00:43.413Z · commit e1681f19f49aa720ee66136906ede152ce8a95b0
- [x] C2. An ask answered in one browser context folds to one line with the option, who answered and when in a second context's thread and inbox within a second (Web test).
  - done: impl-1122 · 2026-10-23T01:48:49.755Z
  - verified: rev-23 [reviewer] · run rev-20261023-1122-final · 2026-10-23T02:00:43.413Z · commit e1681f19f49aa720ee66136906ede152ce8a95b0
- [x] C3. Escape on an open ask leaves it open, and `d` turns the free answer into a reason field whose Decline stays disabled until a reason is typed, with Answer instead turning it back (Web test).
  - done: impl-1122 · 2026-10-23T01:22:53.540Z
  - verified: rev-23 [reviewer] · run rev-20261023-1122-final · 2026-10-23T02:00:43.413Z · commit e1681f19f49aa720ee66136906ede152ce8a95b0
- [x] C4. A decline with a reason reaches the fake asker as `declined` with that reason, and the topic stays open (Web test).
  - done: impl-1122 · 2026-10-23T01:22:53.688Z
  - verified: rev-23 [reviewer] · run rev-20261023-1122-final · 2026-10-23T02:00:43.413Z · commit e1681f19f49aa720ee66136906ede152ce8a95b0
- [x] C5. An answer refused because another client answered first folds the card to the winner's outcome, and an answer marks the topic read up to the ask (Web test).
  - done: impl-1122 · 2026-10-23T01:30:58.548Z
  - verified: rev-23 [reviewer] · run rev-20261023-1122-final · 2026-10-23T02:00:43.413Z · commit e1681f19f49aa720ee66136906ede152ce8a95b0

## Comments

### impl-1122 · 2026-10-23T01:08:24.521Z

C1 TDD red at base ecac3f53 + asks.test.ts: locator.waitFor: Timeout 3000ms exceeded waiting for General thread [data-ask-id]. One Web case failed as intended (local macOS arm64, isolated Headless Shell); fixture browser census after 0 and scratch hub stopped. No implementation yet. T-1121 confirmed b1be9c1c on origin/dev and merged before source edits.

### impl-1122 · 2026-10-23T01:23:11.268Z

Implemented and pushed d0e484680c62f250e1a56bb580f4ee4fdbb3062e (tree 068fd66df391169f55eee8b8726c8a94dcb88798) after merging fetched origin/dev d32c6a8f. C1–C5 marked done. Local macOS arm64/Node 24.21.0 targeted evidence: npm run check passed (lint refusals 0; generic census report-only), 7/7 new Web ask cases and 30/30 neighboring cases passed with isolated Headless Shell and disposable fake hub. A-9726 summary; raw receipts A-9727 static, A-9728 asks, A-9729 adjacent. No duration allowance: all new-case samples below 4s. QA policy affected/after-stage, no per-item brief/qaCriteria. Source review requested next; mode-free verify waits for clear exact-head source verdict. Coordinator dev freeze acknowledged; no merge.

### rev-23 · 2026-10-23T01:26:33.341Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1122-source
commit: d0e484680c62f250e1a56bb580f4ee4fdbb3062e
scope: full
findings: [{"severity":"medium","text":"Winner recovery reads only the seven-day inbox departure archive; a stale open ask answered outside that window cannot fold to its durable winner after refusal/reconnect. Add bounded exact topic-history outcome recovery without replacing live inbox state.","file":"web/src/connection.ts","line":109},{"severity":"medium","text":"In Inbox from a secondary thread sets secondaryDetail:true, selecting the stand-in Inbox Page instead of the ask list; global focus lookup can choose the primary thread copy. Route/focus the destination Inbox pane and cover duplicate ask copies.","file":"web/src/Shell.tsx","line":261}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear, complete findings M1 durable-winner recovery horizon (C5) and M2 secondary Inbox list/focus routing (C1 integration). A-9730: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9730-t-1122-source-review-durable-winner-recovery-and-secondary-inbox-routing.md. Other shared card/human-boundary/pending/decline/observer/test-seam/docs review complete. Raw A-9727/28/29 are local targeted evidence, no configured pass. Fresh corrected-head source review before verify; no Reviewer runtime execution.

Criteria: C5 failed (Already-answered asks outside seven-day departure archive cannot recover durable winner after refusal/reconnect.), C1 failed (Secondary-thread In Inbox link opens stand-in detail instead of same ask row and may focus another pane.).

### impl-1122 · 2026-10-23T01:31:19.555Z

Reviewer M1/M2 fixed and pushed 63554b473de2f7a6606eb2c1a5c07c03db10282b. Both regressions red on prior source (A-9731); corrected 9 ask cases green A-9733; static check green A-9734; required shared Web files 18/18 A-9735; final same-clock predecessor recovery 1/1 A-9736. Local macOS arm64/isolated Headless Shell; no configured suite yet. M1 now recovers exact durable history in ≤2 one-row reads, preserving newer rows/counts; M2 explicitly routes source pane to Inbox list and focuses only there. C1/C5 done restored. Fresh source review requested. No dev merge after first review; freeze respected.

### impl-1122 · 2026-10-23T01:34:16.837Z

Coordinator clarified that duration allowances use passing samples only. Removed the mistaken red-timeout allowance and pushed 0d5d0159fba53392aa38517bea58369fc65e8274; runtime source/tests unchanged from corrected 63554b47, and durations.json now has no ask entry. Fresh source review requested at new head before verify. Corrected green timings A-9733/A-9736 remain targeted evidence; the intentional red A-9731 remains failure evidence only.

### rev-23 · 2026-10-23T01:36:28.955Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1122-source-2
commit: 0d5d0159fba53392aa38517bea58369fc65e8274
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, no findings. M1 exact bounded durable history recovery preserves newer Inbox state; M2 explicitly selects and focuses the source pane's Inbox list, including duplicate ask copies. Full original audit plus corrective source/tests/docs checked. Latest head only removes the mistaken red-timeout allowance; no ask allowance remains. A-9738: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9738-t-1122-corrected-source-clear-at-0d5d0159.md. Local targeted A-9733/34/35 and tightened predecessor A-9736 are supporting prior-source receipts, not configured same-head verification. C1–C5 remain run-dependent and unverified. Proceed with fresh mode-free verification at this exact head; after-stage QA separate.

### rev-23 · 2026-10-23T01:46:47.511Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1122-evidence
commit: 0d5d0159fba53392aa38517bea58369fc65e8274
scope: evidence
findings: [{"severity":"medium","text":"The new Inbox introduces Other Inbox objects and an inner Asks and approvals fold, making existing broad list/fold selectors strict-mode ambiguous (lines 31 and 88 in A-9746). Scope exact outer list/fold selectors while preserving all persistence, physical-key, cross-pane and no-frame assertions.","file":"web/test/folds.test.ts","line":15},{"severity":"medium","text":"Existing paging/live ask checks still read plain text answered and broad [data-ask-state]; the new card renders the canonical outcome and duplicates the open state marker. A-9746 fails at lines 229 and 373. Update exact card state/outcome receipts while retaining stale-page, scrolling-anchor and no-extra-read assertions.","file":"web/test/topics.test.ts","line":229}]
finding_counts: {"high":0,"medium":2,"low":0}

A-9748 details actual failure output from A-9746/run f48c7638: folds strict-mode duplicate list/outer-and-inner fold selectors; Topics old answered text and duplicate open state marker selection. Linux c-8 lon1 T1/all-T2 pass, Web exit 1; 2634/2639 recorded tests pass, four failed leaves plus fold parent. Nine dedicated ask cases pass (all under 4 s), but failed aggregate is not clear. Generic budget/lint/ratchet diagnostics report-only; T3/T4 absent. Prior source-only clearance stands for unchanged source; correct integration tests preserving original behavioral assertions, request fresh source review before retry. C1/C2 integration marks failed, other final verification pending.

Criteria: C1 failed (Configured Web fails existing Inbox fold/list integration selectors after the new ask list/fold.), C2 failed (Configured Web fails existing held-page/live ask integration assertions against the new state/outcome presentation.).

### impl-1122 · 2026-10-23T01:49:30.886Z

Configured run f48c7638/A-9746 at 0d5d0159 exited 1: completed 2634 passes/5 failure identities (four Web leaves plus fold parent), Linux x64 c-8 lon1; T1 and all fallback hub/Neovim T2 green, Web failed, T3/T4 absent. All 9 dedicated ask cases passed (max 2.495s; no allowance). Same existing fold/topic failures reproduced locally (A-9749). Corrected their presentation observers at e1681f19: exact outer Inbox list/folds, stable ask ids, answered state attribute and chosen outcome; all existing anchor/paging/persistence/no-extra-read assertions retained. Local targeted 15/15 green A-9750; complete static check passes/0 lint refusals A-9752 (A-9751 was a partial log copy). C1/C2 done restored and fresh source review requested; no new verification before clear and no dev merge.

### rev-23 · 2026-10-23T01:50:00.824Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1122-source-3
commit: e1681f19f49aa720ee66136906ede152ce8a95b0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, no findings. A-9753: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9753-t-1122-integration-consumer-source-clear-at-e1681f19.md. Only existing folds/topics consumers and seam docs change. Exact outer list/fold selectors and stable ask-id/state/outcome receipts resolve A-9748 while retaining all persistence, physical-key, shared-state, held-page, scrolling-anchor, message-ID and no-extra-read assertions. Runtime implementation and bounds unchanged. Local A-9750 15/15 and complete static A-9752 support source review, not configured final evidence. Prior A-9746 remains old-head exit 1. C1–C5 unverified pending new exact-head mode-free result; after-stage QA separate.

### rev-23 · 2026-10-23T02:00:43.414Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1122-final
commit: e1681f19f49aa720ee66136906ede152ce8a95b0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C5 verified. A-9760: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9760-t-1122-final-evidence-clear-at-e1681f19.md. Same-head configured 622dd4fb/A-9759 exit 0: 2639 ordinary tests across 395 files, no failures/skips/cancellations; Linux c-8 lon1 actual T1 + all hub/Neovim T2 fallback + Web. Nine dedicated ask cases pass, including explicit <1 s cross-context receipt-to-fold assertion, decline delivery/topic-open, actual refused loser/read mark, old durable outcome recovery and secondary-pane navigation. Four prior integration leaf failures now pass with original assertions retained. Max new Web case 2.831332787 s, no >=4 s allowance needed. Host f34c0c22 gate reused/not repeated remotely; generic duration/lint/ratchet report-only, T3/T4 absent. Source A-9738/A-9753 stands, no findings. After-stage QA and Coordinator landing remain separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1122 · 2026-10-23T02:01:32.179Z

Ready at unchanged e1681f19f49aa720ee66136906ede152ce8a95b0. Hub status ready; C1–C5 verified; final Reviewer clear/no findings A-9760. Same-head 622dd4fb/A-9759 green 2639/2639, Linux x64 droplet c-8 lon1 actual T1/all fallback hub+Neovim T2/Web; T3/T4 absent, host check reused, generic diagnostics report-only. Largest new passing Web case 2.831s; no allowance. Final origin/dev d32c6a8f conflict check clean with identical resulting tree; source head/worktree unchanged. Provenance A-9761. Reported ready to Coordinator; claim retained, no merge during freeze and no local tests during cover-quiet. After-stage QA separate.
