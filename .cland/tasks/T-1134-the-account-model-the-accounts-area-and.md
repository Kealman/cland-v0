---
id: T-1134
kind: task
title: "The account model: the Accounts area and the accounts strip"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1130
topic: topic-875
branch: t/T-1134-the-account-model-the-accounts-area-and
created: 2026-10-22T15:16:15.395Z
updated: 2026-10-23T00:15:25.938Z
closed: 2026-10-23T00:15:25.938Z
---

## Summary

The Accounts area lists the registry with every window its source sent, and the Sessions area gains the strip of P20, both drawn from one account model over the snapshot's account views.

## Parent

E-418 (§3.2 the Accounts area and the accounts strip, P20; v0.1.2 §3.13; tracer steps 2 and 5). One ticket because the area and the strip are two read-only renderings of the same model and fixture.

## What to build

- **The account model** (pure): per account its windows with the used share, the reset time and the colour (amber from 75 percent, red from 90, or the source's severity); the worst window (the highest used share); the reading's age and source (the session that sent it, or a poll); the limited mark (since, reason, the session that hit it, the reset or "until cleared"); and the cases without data (no reading yet, signed out, OpenCode's none), which never read 0 percent.
- **The Accounts area** (read-only): one block per account in registry order, the synthetic defaults last, with its name, harness and directory or database path (never a secret), then every window with its share, reset, the reading's age and source, and the limited mark; the registry's error when it fails to read. Opening the area asks the hub to poll the idle accounts (`account.poll`), as Neovim's sessions panel does; clearing a limited mark stays in the CLI.
- **The strip** in the Sessions area: one cell per account in registry order with its name, harness and worst window as a share, a meter along the foot and the reset; a limited account in red with its reset and the session that hit it; a dash without data; the other windows, the age and the source in the cell's tooltip. The strip folds like a block and links to the Accounts area.

Neovim's `accounts.lua` defines the formats. The profile block joins the top of this area in the sign-in slice.

## Acceptance criteria

- [x] C1. The account model gives the worst window, amber from 75 and red from 90 percent, the limited mark with its reset, and a dash, never 0 percent, for an account with no reading, signed out or on OpenCode (T1 test).
  - done: impl-1134 · 2026-10-22T23:19:28.371Z
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final · 2026-10-22T23:46:31.151Z · commit 414b0d2020b85e0c991ba556d4e2d9f1fa2abeef
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final-2 · 2026-10-22T23:58:57.738Z · commit c98daf27f08c741df8f2a8691d8509ae4a7457eb
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final-3 · 2026-10-23T00:10:41.305Z · commit be804a632461a13b38f3df3342f364215e9c30af
- [x] C2. With a registry of three fake accounts with limit readings, one limited, the Accounts area lists each in registry order with its harness, path and every window with its share, reset, age and source, and the limited one with its mark (Web test).
  - done: impl-1134 · 2026-10-22T23:35:32.361Z
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final · 2026-10-22T23:46:31.151Z · commit 414b0d2020b85e0c991ba556d4e2d9f1fa2abeef
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final-2 · 2026-10-22T23:58:57.738Z · commit c98daf27f08c741df8f2a8691d8509ae4a7457eb
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final-3 · 2026-10-23T00:10:41.305Z · commit be804a632461a13b38f3df3342f364215e9c30af
- [x] C3. Opening the Accounts area sends one `account.poll` (Web test).
  - done: impl-1134 · 2026-10-22T23:19:28.565Z
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final · 2026-10-22T23:46:31.151Z · commit 414b0d2020b85e0c991ba556d4e2d9f1fa2abeef
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final-2 · 2026-10-22T23:58:57.738Z · commit c98daf27f08c741df8f2a8691d8509ae4a7457eb
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final-3 · 2026-10-23T00:10:41.305Z · commit be804a632461a13b38f3df3342f364215e9c30af
- [x] C4. The strip shows a cell per account with its worst window and reset, the limited account in red with its reset and the session that hit it, the other windows in the tooltip, and its link opens the Accounts area (Web test).
  - done: impl-1134 · 2026-10-22T23:19:28.764Z
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final · 2026-10-22T23:46:31.151Z · commit 414b0d2020b85e0c991ba556d4e2d9f1fa2abeef
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final-2 · 2026-10-22T23:58:57.738Z · commit c98daf27f08c741df8f2a8691d8509ae4a7457eb
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final-3 · 2026-10-23T00:10:41.305Z · commit be804a632461a13b38f3df3342f364215e9c30af
- [x] C5. `web/README.md` describes the Accounts area and the strip (docs).
  - done: impl-1134 · 2026-10-22T23:19:28.870Z
  - verified: rev-32 [reviewer] · run rev-20261023-1134-source · 2026-10-22T23:23:48.836Z · commit 27a9fa9904391d90f5dbf920bbca332641e805c5
  - verified: rev-32 [reviewer] · run rev-20261023-1134-source-2 · 2026-10-22T23:35:27.961Z · commit 414b0d2020b85e0c991ba556d4e2d9f1fa2abeef
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final · 2026-10-22T23:46:31.151Z · commit 414b0d2020b85e0c991ba556d4e2d9f1fa2abeef
  - verified: rev-32 [reviewer] · run rev-20261023-1134-delta · 2026-10-22T23:48:37.753Z · commit c98daf27f08c741df8f2a8691d8509ae4a7457eb
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final-2 · 2026-10-22T23:58:57.738Z · commit c98daf27f08c741df8f2a8691d8509ae4a7457eb
  - verified: rev-32 [reviewer] · run rev-20261023-1134-delta-2 · 2026-10-23T00:00:34.796Z · commit be804a632461a13b38f3df3342f364215e9c30af
  - verified: rev-32 [reviewer] · run rev-20261023-1134-final-3 · 2026-10-23T00:10:41.305Z · commit be804a632461a13b38f3df3342f364215e9c30af

## Comments

### impl-1134 · 2026-10-22T23:18:10.677Z

Implemented one pure account projection consumed by the read-only Accounts blocks and P20 Sessions strip. Targeted T1 model tests and 4 isolated Web tests are green on the current worktree on local macOS; no provider binaries or real account directories used. npm run check passed (test lint is report-only; 0 refusals). C1–C4 include source severity, missing-data dashes, all windows/paths, limited details, one poll per area entry, deltas, fold persistence, tooltips and link; registry failure readback is covered too. Existing area/palette/connection regression checks are next before source review. Per-item QA is after-stage, with no outstanding qaCriteria; no per-item QA brief supplied.

### rev-32 · 2026-10-22T23:23:48.836Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1134-source
commit: 27a9fa9904391d90f5dbf920bbca332641e805c5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear A-9509, findings []. Shared pure account projection matches worst-window/severity/75–90 thresholds, missing-data dashes, local reset/age/source, synthetic-default ordering and limited details. Accounts blocks/read-only poll-on-entry, complete registry reply refresh, P20 strip/meter/tooltips/fold/same-pane navigation, page/drawer facts and README match item/epic. Three new T1 tests and four sealed Web cases establish source paths for C1–C4 with bounded retained request/result/rendered-delta receipts; run-dependent criteria remain unverified until fresh configured same-head execution. C5 docs verified. A-9495 local implementation narrative is supplemental, not a configured suite/overall runtime pass. No new protocol/dependency/keymap/permission, or reviewer test/probe/browser run. Mode-free verify may run at this exact head; QA remains affected/after-stage.

Criteria: C5 verified.

### rev-32 · 2026-10-22T23:34:21.209Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261023-1134-evidence
commit: 27a9fa9904391d90f5dbf920bbca332641e805c5
scope: evidence
findings: [{"severity":"medium","text":"M1: cross-area regression still requires the removed Accounts objects stand-in list. A-9532 actual: locator.waitFor Timeout3000ms waiting for list Accounts objects. Update Accounts rendered readiness to the new account surface, keeping Sessions selection/drawer/help/palette/split assertions and bounds.","file":"web/test/key-contexts.test.ts","line":53}]
finding_counts: {"high":0,"medium":1,"low":0}

A-9534 audits failed same-head 186ba376/A-9532. Actual locator.waitFor Timeout3000ms at key-contexts.test.ts:53 waits for list Accounts objects, intentionally removed by the new account blocks. Migrate this compatibility fixture, preserving every remaining assertion; no timeout increase or timing diagnosis. Linux x64 c-8 lon1, Node24.21/Neovim0.12.5; T1/all-T2 complete exit0, Web exit1; aggregate2537 tests/2536pass/1fail/0skip. Generic budgets/lint/ratchet report-only, no T3/T4/QA/full-suite pass. No new production finding. C2 failed; other run-dependent final marks withheld. Fresh source review required after correction before mode-free verify.

Criteria: C2 failed (Accounts surface migration leaves key-contexts.test.ts:53 waiting for removed Accounts objects list; configured Web phase fails (A-9532).).

### rev-32 · 2026-10-22T23:35:27.961Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1134-source-2
commit: 414b0d2020b85e0c991ba556d4e2d9f1fa2abeef
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear A-9538 carrying full audit A-9509. Sole change updates key-contexts.test.ts Accounts readiness from removed stand-in list to actual pane plus accounts key-context assertion. All other areas' list receipts/headings, every Sessions selection/drawer/help/palette/split assertion and original timeout unchanged. M1 resolved; no production/resources/docs changes or remaining findings; diff check clean. C5 README source-verified at this head. C1–C4 await fresh configured same-head evidence; A-9536 local post-fix output at source later committed is supplemental, and A-9532 remains prior-head red. No suite/Linux/QA green claimed. Mode-free verify permitted at this exact head.

Criteria: C5 verified.

### impl-1134 · 2026-10-22T23:46:17.294Z

Same-head configured verification ab1e6ff6 is green at 414b0d2020b85e0c991ba556d4e2d9f1fa2abeef: Linux x64 droplet c-8 lon1, T1 plus fallback T2 in both packages and Web, 2537/2537 passing. Log A-9568: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9568-suite-ab1e6ff6-269a-4f22-b945-d38735756b90-auto-at-414b0d2.log. Typecheck uses the recorded host-gate receipt (not repeated remotely); duration/test-lint gates are report-only. T3 is deferred to periodic dev/integrated occasions and is not included in this pass. Droplet lifetime 585 s, cost $0.0406. Head unchanged; final same-head evidence settlement remains with Reviewer.

### rev-32 · 2026-10-22T23:46:31.151Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1134-final
commit: 414b0d2020b85e0c991ba556d4e2d9f1fa2abeef
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear A-9569, carrying source A-9538. A-9568/run ab1e6ff6 on unchanged 414b0d20: Linux x64 c-8 lon1 droplet, T1/all-T2 hub+Neovim/Web exit0; aggregate2537 pass, zero fail/cancel/skip/todo. Three new model identities each have actual5/5 load completion; four Accounts Web tests and all three key-context tests passed. Prior M1 obsolete Accounts placeholder readiness resolved with preserved cross-area assertions and unchanged timeout. C1 model, C2 registry/facts, C3 entry poll, C4 strip/navigation and C5 docs all established. Host check/typecheck gate reused, not remotely repeated. Generic lint/duration/ratchet report-only; measured Web phase wall66.094s>40s report budget, no timing-budget pass claimed. No configured T3/T4 or per-item QA (affected/after-stage). No remaining Standards or Spec findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-32 · 2026-10-22T23:48:37.753Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1134-delta
commit: c98daf27f08c741df8f2a8691d8509ae4a7457eb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear A-9575 after Coordinator-authorized dev merge. All12 own-only and29 incoming-only paths preserve their parent blobs exactly; shared tiers/README retain both sets of identities/guidance. connection.ts retains AccountList, command timeout option and pollAccounts alongside ArtifactInventoryPage, loadMoreArtifacts, reconnect artifactRead invalidation and artifact loading/error resets; both live account/artifact handlers preserved. No remaining Standards/Spec findings. C5 verified at merge head; C1–C4 await fresh exact-head configured receipt. A-9573 original merged-source local macOS targeted Accounts4/4, key-contexts3/3, palette11/11 supplemental; prior Linux A-9568 is parent-only. Mode-free verify may run at exact c98daf27.

Criteria: C5 verified.

### rev-32 · 2026-10-22T23:58:57.738Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1134-final-2
commit: c98daf27f08c741df8f2a8691d8509ae4a7457eb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Post-merge final clear A-9607 at unchanged source-clear c98daf27. A-9606/run2afdd2a8: Linux x64 c-8 lon1 droplet T1/all-T2 hub+Neovim/Web exit0; aggregate2547 pass, zero fail/cancel/skip/todo. Three model identities5/5; all Accounts, key-contexts, area-slots and palette cases pass. C1–C5 established including shared connection integration; source delta A-9575 retained. Supplemental same-source local macOS area-slot4/4 A-9605. Host check/typecheck gate reused, not remotely repeated. Generic budgets/lint/ratchet report-only, Web measured wall62.113s>40s report budget, no timing-budget pass claim. No configured T3/T4/per-item QA (affected/after-stage). No remaining findings. Claimant still follows Coordinator's fresh dev-conflict check before ready; verdict covers this commit.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-32 · 2026-10-23T00:00:34.796Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1134-delta-2
commit: be804a632461a13b38f3df3342f364215e9c30af
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear A-9614. Merge preserves all10 own-only and24 incoming-only parent blobs exactly. Five shared paths preserve both manifest/docs additions, Accounts key-context readiness and incoming Sessions button/help/action assertions. AreaSlot forwards both navigate/openPage; Shell binds both callbacks to the mapped pane, preserving Accounts routing and incoming Sessions page opening. Own Accounts model/views/strip/connection remain unchanged, prior artifact resolution retained. No Standards or Spec findings. C5 verified; C1–C4 await new mode-free same-head receipt. A-9609 original local macOS targeted Accounts4/4, area-slots4/4, key-contexts3/3, palette11/11 supplemental only; Linux A-9606 parent-only. Mode-free verification permitted at exact be804a63.

Criteria: C5 verified.

### rev-32 · 2026-10-23T00:10:41.305Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1134-final-3
commit: be804a632461a13b38f3df3342f364215e9c30af
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear A-9632 at unchanged be804a63 carrying delta A-9614. Fresh A-9631/run d0f336d4: Linux x64 c-8 lon1 droplet T1/all-T2 hub+Neovim/Web exit0, aggregate2567 pass/zero fail/cancel/skip/todo. Three model identities actual5/5; four Accounts Web cases2.151/1.287/1.506/1.173s (no4s allowance trigger), key-contexts/area-slots/palette/session-actions files passed. All C1–C5 verified including pane-scoped integration. Host check/typecheck gate reused, not remotely repeated. Generic lint/duration/ratchet report-only; Web measured wall62.293s>40s report budget, no timing-budget pass claim. No configured T3/T4/per-item QA. No remaining Standards/Spec findings. Claimant follows requested fresh dev-conflict check before ready; verdict covers this head.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-23T00:15:25.938Z

Merged 740d6f0f3b9ac5bc59f4ffe657af2b39c5fd6964 onto dev.
