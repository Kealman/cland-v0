---
id: T-1564
kind: task
title: Both workbenches show who wrote
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1561
topic: topic-1311
branch: t/T-1564-both-workbenches-show-who-wrote
created: 2026-10-31T23:47:51.380Z
updated: 2026-11-01T23:08:32.790Z
---

## Summary

In users mode the web and Neovim threads show a human message's author: "you" for the viewer's own user and the display name for any other user. Single mode keeps "you" everywhere. The web follows the web/ rules: CSS Modules, tokens, 4.5:1 secondary text and no local key listeners.

Hot files: `web/src/MessageBlock.tsx`, `web/src/MessageBlock.module.css`, `web/src/PhoneTopicThread.tsx`, `nvim/lua/cland/thread.lua`, web and nvim tests. No hub file.

## Acceptance criteria

- [x] C1. In a web page signed in as one user, that user's messages show "you" and another user's show that user's display name, on desktop and phone layouts.
  - done: impl-1564 · 2026-11-01T22:41:56.543Z
  - verified: rev-35 [reviewer] · run rev-35-1564-final-1 · 2026-11-01T23:08:32.154Z · commit 72cad1375dfae5796292c48772f8c15ce528d734
- [x] C2. In Neovim, acting as the first user, the first user's messages show "you" and another user's show the display name.
  - done: impl-1564 · 2026-11-01T22:49:46.190Z
  - verified: rev-35 [reviewer] · run rev-35-1564-final-1 · 2026-11-01T23:08:32.154Z · commit 72cad1375dfae5796292c48772f8c15ce528d734
- [x] C3. In single mode both workbenches show "you" for human messages, with the existing thread tests unchanged.
  - done: impl-1564 · 2026-11-01T22:36:59.530Z
  - verified: rev-35 [reviewer] · run rev-35-1564-final-1 · 2026-11-01T23:08:32.154Z · commit 72cad1375dfae5796292c48772f8c15ce528d734
- [x] C4. The web change passes the typecheck's colour and contrast checks, adds no colour outside `tokens.css` and no key listener outside `keymap.ts`.
  - done: impl-1564 · 2026-11-01T22:37:00.021Z
  - verified: rev-35 [reviewer] · run rev-35-1564-final-1 · 2026-11-01T23:08:32.154Z · commit 72cad1375dfae5796292c48772f8c15ce528d734

## Comments

### impl-1564 · 2026-11-01T22:31:33.924Z

Coordinator decision (coord, 2026-11-01 22:32Z): supersedes no-hub-file note. Add optional Message.userDisplayName at read time in the common Store mapper from users table, additive with old-wire fallback and id comparison for you. Single mode carries no field. Inventory all consumers; README message-section sentence only.

### impl-1564 · 2026-11-01T22:34:22.874Z

Contract inventory: A-15438 lists every matched Message reader/writer across production, startup, skills/QA and all test tiers; migration decisions in item artifact T-1564 contract migration decisions. Optional userDisplayName only changes common Store projection and thread labels; all other consumers unaffected because existing from/userId and wire shapes remain valid. Older payload regressions in web/nvim; withdrawal unchanged.

### rev-36 · 2026-11-01T22:38:19.093Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1564-source-1
commit: 8fd3ce86bcf9ec1f2a00316f17b9dbf2ac9229d4
scope: full
findings: [{"severity":"medium","text":"userDisplayName is added only by #messageFromRow, but live human messages bypass it: sendFromHuman builds raw Message, #emitMessage passes it into threadRuns (which only annotates runId), then broadcasts it. Live messages from another user therefore render as 'you' in both clients until history reload. Project live publication through the common stored-message mapper and add regressions with observers/threads ready before a second-user send; web currently sends before opening pages and Neovim supplies the field synthetically.","file":"hub/src/hub/store.ts","line":928}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear: medium Store:928 adds display name only on stored reads. core.sendFromHuman builds raw userId-only Message; #emitMessage→threadRuns adds runId but never maps stored row before live broadcast. Both clients fall back to you for another user's live message. Web test sends before opening pages; Neovim hand-builds the field. Use the common current Store projection at live publication and add production live-frame/render assertions with observers ready before send, retaining history/rename/single/old-wire checks. Coordinator's hub scope exception confirmed; types/docs/style/tier changes otherwise inspected. A-15444 local summary is not live-path evidence. No Reviewer execution/browser/edits; fresh source review before verify.

Criteria: C1 failed (An already-open web desktop/phone thread receives raw live messages without userDisplayName, so another user's author label falls back to you.), C2 failed (An already-open Neovim thread has the same missing production live display-name field; synthetic recorder frames bypass the producer.).

### impl-1564 · 2026-11-01T22:39:52.494Z

Review finding A-15446 confirmed red on live browser row (you vs display name) and production Neovim message frame (userDisplayName undefined). Live producer migration added: core #emitMessage rereads human messages through Store.message before threadRuns/publication. New real-hub Neovim live frame+render regression, and desktop/phone controls send only after own history row is installed. Existing synthetic, read-time rename, single-mode and old-wire controls retained.

### rev-35 · 2026-11-01T22:47:32.538Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1564-source-1
commit: 8f3f2c57affb822026b5bc9d8835cb4cd847a0de
scope: full
findings: [{"severity":"medium","text":"Raw userDisplayName enters a single Neovim header line, but Users.add permits embedded LF. nvim_buf_set_lines rejects newline-containing replacement lines, so another user's valid display name can abort thread rendering. Normalize the presentation to one line before computing header marks and add an other-user newline-name rendering regression; keep identity comparisons by userId.","file":"nvim/lua/cland/thread.lua","line":289}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at exact head. Medium thread.lua:289: unrestricted userDisplayName reaches add(text):358 and nvim_buf_set_lines:477, whose replacement-line validation rejects embedded LF. C2 fails; normalize the presented name and retain exact rendered header/body assertions for this input. Prior A-15446 live projection issue is resolved by the common Store.message publication path and ready-before-send live controls. Standards: no additional findings; Spec: one medium. C1/C3/C4 runtime evidence remains unverified. Details and primary API source A-15455. No Reviewer edits, test or browser execution. Fresh source review before task verification.

Criteria: C2 failed (Another user's permitted multiline displayName is inserted into one Neovim buffer line and can abort thread rendering.).

### impl-1564 · 2026-11-01T22:48:35.410Z

A-15455 reproduced with permitted Other CR/LF Person display name: production frame kept raw name, native Neovim header replacement failed and body never rendered. Header now collapses CR/LF runs to a space before mark calculation, keeping userId comparison and raw wire values. Real-hub live regression now asserts the normalized Other Person header and intact body; red before, green after. Existing duplicate-name/old-wire fixture and 24 unchanged thread cases passed.

### rev-35 · 2026-11-01T22:50:22.601Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1564-source-2
commit: 72cad1375dfae5796292c48772f8c15ce528d734
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. A-15455 resolved: CR/LF normalization occurs before header construction/byte marks, preserving raw wire displayName and userId identity. Real-hub regression checks raw production frame plus normalized header over intact live body with observers ready before send; prior common Store live projection fix and duplicate-name/old-wire controls remain. Standards and Spec both clear. A-15462 records review. C1–C4 runtime portions remain unverified; same-head queued mode-free verification and named outcome review still required. A-15460 local receipts are supplemental, not a post-source-clear suite. No Reviewer execution/browser/edits.

### rev-35 · 2026-11-01T23:08:32.154Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1564-final-1
commit: 72cad1375dfae5796292c48772f8c15ce528d734
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C4 verified. Exact-head uncached queuede0a524d8/A-15477 exit0,4642 pass, zero fail/cancel/skip/todo. Actual named timing records confirm read-time rename/single mode, stored ownership, production live Neovim raw multiline frame+normalized header/body, duplicate-name/old-wire Neovim, desktop/phone history/live/old-wire, unchanged Neovim thread24 and web messages5. T0 typecheck includes token-only colour sources and23 text tokens≥4.5:1; source has no new colours/key listeners. Linux x64 droplet Node24.21/Neovim0.12.5/isolated HeadlessShell1248 Chrome156.0.8078.4, treeeb61375a48dec1eeb484701219fb67cecde58020. T0/T1/allT2/Web/changedT3/two mappedT4 base complete; remainingT3 deferred, T4 repetitions skipped, diagnostics report-only. Source-clear head unchanged. QA after-stage separate. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
