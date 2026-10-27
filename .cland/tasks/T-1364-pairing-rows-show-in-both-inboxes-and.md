---
id: T-1364
kind: task
title: Pairing rows show in both inboxes, and Neovim's card approves them
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by: []
topic: topic-1103
branch: t/T-1364-pairing-rows-show-in-both-inboxes-and
created: 2026-10-27T05:46:50.196Z
updated: 2026-10-27T07:05:14.568Z
---

## Summary

A waiting pairing code shows in Neovim's and the web's inbox as "Pair Telegram user 12345 (Name)? code …". Neovim's card approves it through `pairing.approve`. The web row says "approve in the terminal or Neovim", shows the CLI command, and offers no approve.

## What to build

Spec §3.2 and §3.11; ADR 0005 (Neovim stays the host). The hub already publishes `inbox.pairings` rows with their text, command and expiry, and accepts `pairing.approve` only from a Neovim connection or the CLI. Both inboxes render these rows in the asks and approvals section (see the open question), counted in that section's count.

Neovim: the row opens a small card with the messenger, the user's name and id, the code and when it expires. One key approves, bound through Neovim's key map. The card sends `pairing.approve` over Neovim's connection and reports the paired name or the hub's refusal.

Web: the row and its detail show the text, "approve in the terminal or Neovim" and the command as copyable text. There is no approve button and no binding that approves, at desktop and phone width.

An approved, replaced or expired code leaves both inboxes when the next inbox update arrives.

**External wait and shared files:** none (codes and `pairing.approve`, T-1332 and T-1333, are on dev) · **Shared files:** nvim/lua/cland/inbox.lua, web/src/InboxArea.tsx, web/src/InboxArea.module.css

## Acceptance criteria

- [x] C1. Headless Neovim shows a waiting Telegram code and a waiting Discord code from the test messenger as "Pair <Messenger> user <id> (<Name>)? code …" rows in the inbox (test).
  - done: impl-1364 · 2026-10-27T05:59:29.723Z
- [x] C2. Approving from Neovim's card pairs the test messenger, and the row leaves both Neovim's and the web's inbox (test).
  - done: impl-1364 · 2026-10-27T05:59:30.197Z
- [x] C3. Headless Chromium shows the row with "approve in the terminal or Neovim" and its `cland remote approve` command, at desktop and phone width, with no approve control and no key that approves (test).
  - done: impl-1364 · 2026-10-27T05:59:30.293Z
- [x] C4. A code that expires under an injected clock leaves both inboxes (test).
  - done: impl-1364 · 2026-10-27T05:59:30.714Z

## Comments

### impl-1364 · 2026-10-27T05:49:23.632Z

Implementation seams: existing optional Inbox.pairings + pairing.approve; no wire/schema/authority changes. Consumer trace: shared/wire InboxPairing, hub inbox publication and remote filtering already own this contract; nvim state.set_inbox currently drops pairings and inbox rendering/actions omit them; web inbox-visit/InboxArea omit them. Web InboxArchive shares visit entries but reads only departures; Shell mounts visit provider. Existing stub/old-hub tests omit pairings and must remain valid. Planned evidence: headless Neovim real frame/fake-messenger grant and injected-clock expiry, and isolated Headless Shell desktop/phone inert controls and live removal. Preserve other ask/approval key regressions.

### impl-1364 · 2026-10-27T06:00:04.108Z

Implementation committed/pushed at 4ab313acd2fe68d9cf7f00f55faff4bee41059bf. C1–C4 done. Local macOS arm64: web/test/pairing.test.ts 4/4 pass (desktop/phone real keys, real headless Neovim + Headless Shell cross-client grant/expiry/split removal, previous optional-field wire compatibility); typecheck, tier/wording/test lint, diff check pass. No full suite or Linux receipt. Coordinator requested source-clear then ready, skipping item verify in favor of stage verify all. No per-item QA brief/policy required (after-stage none).

### rev-32 · 2026-10-27T06:03:58.598Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261027-1364-source
commit: 4ab313acd2fe68d9cf7f00f55faff4bee41059bf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at 4ab313acd2: A-12608. Standards and Spec have no findings. Reviewed all 18 files: optional pairing state/counts in both Inbox clients, card-only Neovim approval/refusal through unchanged local hub authority, inert desktop/phone Web command fields, immediate authoritative visit/split-detail retirement, and docs/help/skill provenance. Four generated Web cases retain real headless Neovim grant keys, actual row/input keys, durable grant/snapshot boundaries, exact expiry/removal assertions and previous optional-field shape compatibility. A-12602 remains local macOS targeted evidence summary only; Linux timings/repetitions/configured suite coverage are absent. C1–C4 runtime verification remains pending. Follow Coordinator's E-1313 path: report source-clear ready head for its stage/full verify all, without a duplicate mode-free item run; final evidence must include the non-skipped cross-client identity and Linux duration assessment. No per-item QA brief; policy none/after-stage.

### impl-1364 · 2026-10-27T06:22:02.545Z

Remote run 11778e7a at 4ab313acd was RED: ARTIFACT-001 INCONCLUSIVE, `wait_for timed out after 5000 ms: toggle in help` (A-12612). Extra pairing help row caused overflow. Fixed at fa4a485638344215de698b2775535b9fbccc4b75: fold pairing hint into existing Inbox row; QA case unchanged. Serial macOS arm64 rechecks: qa-shipped.test.ts 32/32 pass (ARTIFACT-001 0.434s), pairing.test.ts 4/4 pass, typecheck pass. New head pushed; no dev merge after review. T3/Web evidence and Linux pairing timings remain missing from prior run. Per Coordinator request, fresh source review then ready; Coordinator will run verify all.

### rev-32 · 2026-10-27T06:24:00.351Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261027-1364-evidence1
commit: 4ab313acd2fe68d9cf7f00f55faff4bee41059bf
scope: evidence
findings: [{"severity":"medium","text":"The standalone pairing help row overflows the visible keys popup: unchanged ARTIFACT-001 fails INCONCLUSIVE with wait_for timed out after 5000 ms: toggle in help. Run 11778e7a/A-12612 is failed partial evidence; the artifact-toggle row is outside its captured popup.","file":"nvim/lua/cland/init.lua","line":445}]
finding_counts: {"high":0,"medium":1,"low":0}

Old-head evidence disposition only, A-12614: 11778e7a/A-12612 at 4ab313acd is NOT CLEAR. Actual ARTIFACT-001 failure is INCONCLUSIVE, wait_for timed out after 5000 ms: toggle in help (raw 21315; failing finish 21143, 5.732342416 s). Linux droplet c-8 lon1; T0/T1/T2 green, mapped T4 failed; T3 absent and Web unrun/incomplete, no usable pairing UI timing. Duration/test lint report-only. This run establishes no C1–C4 runtime criterion; unchecked criteria remain unverified. Replacement fa4a48563 corrects the help source and is being reviewed separately; no old-head pass or unchanged retry is authorized.

### rev-32 · 2026-10-27T06:24:00.951Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261027-1364-source2
commit: fa4a485638344215de698b2775535b9fbccc4b75
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Replacement source2 clear: A-12614, carrying full A-12608 review forward. Verified the complete delta from 4ab313acd: nvim/lua/cland/init.lua only, 1 insertion/2 deletions, no dev merge. Pairing open/approve/close guidance is folded into the existing Inbox continuation, restoring the previous popup line count while artifact-toggle text, ARTIFACT-001 QA case and all pairing/key assertions stay unchanged. Standards/Spec: no remaining findings. A-12613 supplies local serial macOS arm64 qa-shipped 32/32 (ARTIFACT-001 0.434 s), pairing Web 4/4 and typecheck; no replacement Linux/configured pass or duration claim. Prior 11778e7a remains failed partial evidence under evidence1. C1–C4 remain unverified. Per Coordinator 179bd4c5, report this exact source-clear head for its rule 6 verify all; no further mode-free item run.

### impl-1364 · 2026-10-27T07:00:59.295Z

Source3 candidate 26bc255904daed19738875c793fcfaeeaab3b547 pushed. Prior 1f987d26 remains RED: Web assertions 288/288 and loaded repetition 10/10 passed, but unallowed durations and eleven autostart-hub leaks made Web exit 1 (A-12630). Fix: await child-context Neovim disposal before parent Web hub close; keep native PID+close receipt and zero root-owned autostart-hub census, with cleanup of unexpected writers still failing as leaks. Old-parent ownership negative control failed the new pre-close native PID guard, restored scope passes. Local pairing file 5/5 (four top-level + native child), typecheck/lint/duration manifest pass. Coordinator-approved E-1313 allowances 9.2/8.2/4.7s expire 2026-11-03, correcting the initially invalid thirty-day request. No production changes in this delta. Fresh source review then new mode-free verification.

### impl-1364 · 2026-10-27T07:03:03.148Z

Source3 provenance correction at e00ac9c03ceb650cf777c9d32b66fd647e22aaa3: allowance reasons name the actual 4-worker Web measurement in A-12630 line23142, rather than configured general workers2. No cap, date, test or cleanup behavior change; manifest preflight and diff check pass. Replacement source review requested; runtime suite remains pending.

### rev-32 · 2026-10-27T07:05:14.231Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261027-1364-evidence2
commit: fa4a485638344215de698b2775535b9fbccc4b75
scope: evidence
findings: [{"severity":"medium","text":"At fa4a4856 the new desktop/phone identities lack measured allowances: A-12630 hard-refuses 6.077 s > 5 s and 5.463 s > 5 s despite passing assertions.","file":"hub/test/durations.json","line":9903},{"severity":"medium","text":"Parent-owned native Neovim is disposed after Web closes its shared hub, admitting autostart hub leaks. A-12630 records eleven root-owned hub serve --autostart cleanup PIDs after ordinary/repetition execution.","file":"web/test/pairing.test.ts","line":80}]
finding_counts: {"high":0,"medium":2,"low":0}

Old-head evidence2 NOT CLEAR, A-12634: 1f987d26/A-12630 at fa4a4856 exited 1. Actual duration-budget refusals at 23126/23127 and eleven native autostart cleanup records at 23130–23140 prevent a usable pass. Raw ordinary 3623 passes plus 410 separate load executions; Web assertions 288/288 and aggregate report-only pairing repetitions 10/10 do not override failure/teardown. T0/T1/T2/mapped T4 exit 0, T3 absent, Web exit 1. Linux droplet; ordinary Web workers 4, repetition workers 2; host gate reused. No criterion is verified from this failed receipt. Replacement teardown/allowance source is reviewed separately at e00ac9c0.

### rev-32 · 2026-10-27T07:05:14.568Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261027-1364-source3
commit: e00ac9c03ceb650cf777c9d32b66fd647e22aaa3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear at replacement e00ac9c0: A-12634, carrying A-12608/A-12614 forward. Complete three-file delta only; no production or UI assertion changes/dev merge. Awaited child context disposes native Neovim before parent Web hub cleanup; pre-Web native PID/close receipts and post-Web root-owned hub census retain zero-before/zero-after emergency cleanup assertions. Coordinator-approved E-1313 9.2/8.2/4.7 s allowances use exact red-run passing samples, added 2026-10-27/expires 2026-11-03; final reasons correctly identify ordinary Web workers 4. The prior low worker-count discrepancy is resolved. Standards/Spec: no remaining findings. A-12631 is local macOS 5/5 (4 parents+1 native child), positive native close/zero-leak diagnostics and negative-control summary, not a fresh Linux pass. Prior A-12630 remains failed under evidence2. C1–C4 runtime marks remain pending. Follow latest Coordinator 90524ac6: one standard mode-free task verify at this exact head, remeasure allowed cases and retain native zero-leak/close receipts, then request final evidence review.
