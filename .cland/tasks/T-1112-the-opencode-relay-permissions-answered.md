---
id: T-1112
kind: task
title: "The OpenCode relay: permissions answered through the gate"
state: closed
status: done
size: M
criterion_seq: 9
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1110
topic: topic-869
branch: t/T-1112-the-opencode-relay-permissions-answered
created: 2026-10-22T15:16:11.536Z
updated: 2026-10-22T23:49:49.677Z
closed: 2026-10-22T23:49:49.677Z
---

## Summary

The OpenCode adapter reports `permission.asked` as records, answers them on the permission reply endpoint through the gate, and closes them on `permission.replied`. `approvalRelay` becomes `reliable` for OpenCode.

## Parent

E-414 (§3.8 "The OpenCode relay"; tracer step 3).

## What to build

Each `permission.asked` the OpenCode adapter tracks becomes a record of the parent session, whether it comes from the session or one of its children. The record carries the action, the full shell command read from the tool part where the action is one, and the resources. It offers three choices: Approve once (`once`), Always for this command (`always`, OpenCode's own wider grant) and Deny (`reject`). The adapter answers the gate with `POST /api/session/{id}/permission/{requestID}/reply` on the session that asked, sending the decision with the note as its message. A Deny is always `reject`.

`permission.replied` closes the record. When another client, an attached TUI, replied, the record takes the harness's reply as its outcome. A reply the server refuses as not found leaves the outcome to that event. At a reconnect, the pending permissions in the snapshot rebuild the same records, and a permission answered while the stream was down closes its record. The adapter checks every field it relies on. A permission that fails the check becomes a record answered in the TUI, with a warn-level event. The permission's private metadata never enters a record. The capability table reads `approvalRelay: reliable` for OpenCode. Refresh the Neovim recordings that carry the capability table; if the Codex relay lands first, merge dev and refresh again.

The fake OpenCode logs the decision and the message each reply carries. The scripted transport double takes replies.

## Acceptance criteria

- [x] C1. A scripted `permission.asked` with a shell tool part becomes one record answered in the hub, with the full command, its three choices and `pending` (test).
  - done: impl-1112 · 2026-10-22T23:31:29.374Z
  - verified: rev-32 [reviewer] · run rev-20261023-1112-final · 2026-10-22T23:44:14.760Z · commit 0d06915a59ebb37c1568accd61a958066883aef7
- [x] C2. Approve once, Always for this command and Deny with a note reach the reply endpoint as `once`, `always` and `reject`, with the note as the message (test).
  - done: impl-1112 · 2026-10-22T23:22:45.528Z
  - verified: rev-32 [reviewer] · run rev-20261023-1112-final · 2026-10-22T23:44:14.760Z · commit 0d06915a59ebb37c1568accd61a958066883aef7
- [x] C3. `permission.replied` from another client closes the record with that reply as the harness's outcome, and every client reads it (test).
  - done: impl-1112 · 2026-10-22T23:22:45.608Z
  - verified: rev-32 [reviewer] · run rev-20261023-1112-final · 2026-10-22T23:44:14.760Z · commit 0d06915a59ebb37c1568accd61a958066883aef7
- [x] C4. A child session's permission is a record of the parent session, and its answer goes to the child's endpoint (test).
  - done: impl-1112 · 2026-10-22T23:22:45.799Z
  - verified: rev-32 [reviewer] · run rev-20261023-1112-final · 2026-10-22T23:44:14.760Z · commit 0d06915a59ebb37c1568accd61a958066883aef7
- [x] C5. After the event stream reconnects, the snapshot's pending permission keeps the same record id, and a permission answered while the stream was down reads as closed (test).
  - done: impl-1112 · 2026-10-22T23:22:45.872Z
  - verified: rev-32 [reviewer] · run rev-20261023-1112-final · 2026-10-22T23:44:14.761Z · commit 0d06915a59ebb37c1568accd61a958066883aef7
- [x] C6. A permission missing a field the adapter relies on becomes a record answered in the TUI, with a warn-level event, and the permission's private metadata never reaches a frame (test).
  - done: impl-1112 · 2026-10-22T23:31:29.459Z
  - verified: rev-32 [reviewer] · run rev-20261023-1112-final · 2026-10-22T23:44:14.761Z · commit 0d06915a59ebb37c1568accd61a958066883aef7
- [x] C7. The capability table reads `approvalRelay: reliable` for OpenCode (test).
  - done: impl-1112 · 2026-10-22T23:22:46.030Z
  - verified: rev-32 [reviewer] · run rev-20261023-1112-final · 2026-10-22T23:44:14.761Z · commit 0d06915a59ebb37c1568accd61a958066883aef7
- [x] C8. A targeted run of the OpenCode contract file, with its receipt posted in the item topic, shows through the fake binary that a Deny with a note reaches the fake as `reject` with that note (test).
  - done: impl-1112 · 2026-10-22T23:22:46.213Z
  - verified: rev-32 [reviewer] · run rev-20261023-1112-final · 2026-10-22T23:44:14.761Z · commit 0d06915a59ebb37c1568accd61a958066883aef7
- [x] C9. `hub/README.md`'s OpenCode capability row describes the relay, the three choices and their OpenCode replies, and that the note travels as the reply's message (docs).
  - done: impl-1112 · 2026-10-22T23:22:46.288Z
  - verified: rev-32 [reviewer] · run rev-20261023-1112-source-2 · 2026-10-22T23:32:27.586Z · commit 0d06915a59ebb37c1568accd61a958066883aef7
  - verified: rev-32 [reviewer] · run rev-20261023-1112-final · 2026-10-22T23:44:14.761Z · commit 0d06915a59ebb37c1568accd61a958066883aef7

## Comments

### impl-1112 · 2026-10-22T23:22:46.372Z

Implemented test-first at the approved native transport/frame seams. Head 3a0e0877 (pre-review origin/dev merged at 053184b0) passes local darwin arm64 targeted OpenCode T2 25/25 (A-9503), T3 contract 14/14 with literal reject/message receipt (C8, A-9504), and recorded OpenCode capability replay 1/1 (A-9505). npm run check exits 0 (A-9502), lint report-only: 132 findings/59 files, 0 refusals. Sealed Neovim refresh A-9496 passes 61/61; aggregate 5665→5681, shell-component slice 2243→2259, other slices unchanged. Earlier unsealed refresh receipt is superseded due to T-1156; shared launcher unchanged. No full configured verification yet. QA policy is after-stage, so no per-item QA request.

### rev-32 · 2026-10-22T23:29:31.748Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261023-1112-source
commit: 3a0e0877c4e9d648aecf63117d6e2657f0f42f20
scope: full
findings: [{"severity":"medium","text":"M1 Spec/C6: native reply HttpError escapes answerApproval; OpenCodeClient.request includes 300 bytes of native response body and the shared gate logs/rethrows it to result frames. Sanitize failures to safe status/category, retaining not-found pending/no-outcome and later native close; test planted private reply metadata absent from frames/logs.","file":"hub/src/adapters/opencode.ts","line":341},{"severity":"medium","text":"M2 Spec/C1,C6: hub choices are offered before the shared 64 KiB serialized subject cap silently truncates a long shell command. The displayed command then differs from the operation receiving once/always. Keep the cap and make incompletely representable commands TUI-only with warning/no endpoint call; test boundary, oversize and multibyte trailing operation.","file":"hub/src/adapters/opencode.ts","line":424}]
finding_counts: {"high":0,"medium":2,"low":0}

A-9521 complete source audit: two medium Spec findings. M1 opencode.ts:341 raw reply HttpError includes native response body through client.ts:49 and shared inbox logs/result error; sanitize to safe status/category, retaining pending/no-outcome/not-found close semantics and planted-private-marker regression. M2 opencode.ts:424 offers choices before approvalSubject truncates a command to the 64 KiB JSON cap; keep incompletely representable command TUI-only with warning/no endpoint call, cover UTF-8 boundary and trailing operation. No additional finding in child routing, choices, native outcomes, reconnect identity or next-tracker-episode guard; no separate Standards finding. C8 A-9504 exact-head local Darwin targeted stdout contains 14 passing tests and literal reject/message receipt, supplemental not configured/Linux green. Fresh source review at corrected head precedes mode-free verification; no reviewer tests/probes/browser.

Criteria: C1 failed (M2: a command exceeding the serialized subject cap remains hub-answerable after silent command truncation.), C6 failed (M1 native failed-reply body escapes into frames/logs; M2 incomplete command still offers native choices.).

### rev-32 · 2026-10-22T23:32:27.587Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1112-source-2
commit: 0d06915a59ebb37c1568accd61a958066883aef7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear A-9531, carrying full audit A-9521. M1 resolved by safe status/not-found/transport categories; regression excludes planted native body from result/all frames/log and retains pending/no-outcome/later deny close. M2 resolved by whole-subject serialized UTF-8 64 KiB check before choices; exact boundary and oversized ASCII/multibyte tests preserve full in-bound command and refuse TUI/no choices/no endpoint beyond cap. Resources use same check; matching docs updated. No remaining findings, no dev merge. C9 docs verified; C1–C8 source/test paths established and await fresh same-head configured evidence for final marks. A-9528 exact-head local Darwin targeted T3 contract 14/14, exit0/signal null and literal reject/note receipt retained for C8; A-9526 26/26 targeted T2 and A-9527 static check supplemental. No configured/Linux/full-suite pass claimed. Mode-free verify permitted at this exact head.

Criteria: C9 verified.

### rev-32 · 2026-10-22T23:44:14.761Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1112-final
commit: 0d06915a59ebb37c1568accd61a958066883aef7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, A-9565. A-9562/run e2ae91d7 at unchanged source-clear 0d06915a: Linux x64 c-8 lon1 droplet, T1/all-T2 hub+Neovim/Web exit 0, aggregate 2541 pass and zero fail/cancel/skip/todo. Ten new native identities and one Neovim capability identity each have actual 5/5 load completion receipts. Host check/typecheck gate reused, not remotely repeated. C8 separately established by exact-head sealed local Darwin arm64 targeted T3 contract A-9528: 14/14, child exit0/signal null, literal reject plus note receipt. C9 carried from source A-9531. Generic lint/duration/ratchet report-only; Web actual phase wall 47.981s exceeded report budget40s, so no timing-budget pass claimed. Configured Linux T3/T4 and per-item QA not claimed (QA affected/after-stage). No remaining findings across Standards or Spec; all C1–C9 verified.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.

### coord · 2026-10-22T23:49:49.677Z

Merged ee1421c70105c311a3e47f0d77c91655db3ea4a1 onto dev.
