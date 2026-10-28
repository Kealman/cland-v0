---
id: T-1409
kind: task
title: Modals take free answers and declines, and one gate holds across Discord, Telegram and the workbenches
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1408
topic: topic-1167
branch: t/T-1409-modals-take-free-answers-and-declines
created: 2026-10-27T23:38:47.618Z
updated: 2026-10-28T23:37:43.491Z
closed: 2026-10-28T23:37:43.491Z
---

## Summary

"Other answer…" and "Decline…" open a modal that shows the question above one paragraph field of up to 4000 characters. Its submission answers or declines the ask and turns the card into its outcome. An ask answered anywhere else edits every Discord copy over REST, and the first answer from any client or remote wins.

## What to build

**The modal.** A click on "Other answer…" or "Decline…" answers with `MODAL` (type 9): a title within 45 characters ("Your answer" or "Why decline"), a Text Display with the question (truncated to fit) and a Label around a required paragraph Text Input of up to 4000 characters. The `MODAL_SUBMIT` from the paired user sends `topic.answer` with the text, or `declined` with the reason. The answer is stored first, then `UPDATE_MESSAGE` turns the card into its outcome. Discord needs no reply mode and no `/cancel`.

**One gate.** On the ask's state change (an `ask` frame or an inbox departure), every mapped Discord copy gets an outbox edit over `PATCH /channels/{c}/messages/{m}` with the outcome and no components. The state change can be an answer from Telegram, Neovim or the web, a withdrawal or a cancellation. These edits merge per card and go ahead of General. A `card` job whose ask closed before it left is dropped through `sourceOpen`.

Telegram's cards already follow the hub's record, so an answer given on Discord edits the Telegram copy. One test with both fakes proves it.

Spec §3.5 (free answers and declines on Discord, one gate); research rules 26 and 27; v0.2 §3.3.

## Acceptance criteria

- [x] C1. "Other answer…" opens a modal with the question above one paragraph field of up to 4000 characters, and submitting it answers the ask with that text and turns the card into its outcome (test).
  - done: impl-1409 · 2026-10-28T23:01:14.641Z
  - verified: rev-32 [reviewer] · run rev-20261028-1409-evidence1 · 2026-10-28T23:31:10.085Z · commit ebc84af1927edaa303d142b40ff800ae7f87730e
- [x] C2. "Decline…" followed by a submitted reason records `declined` with that reason, and the card's outcome shows it (test).
  - done: impl-1409 · 2026-10-28T23:01:14.740Z
  - verified: rev-32 [reviewer] · run rev-20261028-1409-evidence1 · 2026-10-28T23:31:10.085Z · commit ebc84af1927edaa303d142b40ff800ae7f87730e
- [x] C3. An ask answered from a Discord modal turns its Telegram copy into the same outcome, and one answered from Telegram, Neovim or the web edits the Discord card over REST with no components (test).
  - done: impl-1409 · 2026-10-28T23:11:00.415Z
  - verified: rev-32 [reviewer] · run rev-20261028-1409-evidence1 · 2026-10-28T23:31:10.085Z · commit ebc84af1927edaa303d142b40ff800ae7f87730e
- [x] C4. A withdrawn ask's card says it was withdrawn, a cancelled ask's card says its topic or item closed, and a card job whose ask closed before sending is dropped (test).
  - done: impl-1409 · 2026-10-28T23:11:00.541Z
  - verified: rev-32 [reviewer] · run rev-20261028-1409-evidence1 · 2026-10-28T23:31:10.086Z · commit ebc84af1927edaa303d142b40ff800ae7f87730e
- [x] C5. A Discord click and a Telegram press racing on one ask store exactly one outcome, and every copy in both remotes shows it (test).
  - done: impl-1409 · 2026-10-28T23:01:15.170Z
  - verified: rev-32 [reviewer] · run rev-20261028-1409-evidence1 · 2026-10-28T23:31:10.086Z · commit ebc84af1927edaa303d142b40ff800ae7f87730e

## Notes

Shared files: discord-cards.ts, discord-interactions.ts, discord.ts

## Comments

### impl-1409 · 2026-10-28T22:56:34.752Z

Consumer inventory before changes: DiscordCards/discord.ts dispatch and receive; DiscordApi callback transport; DiscordOutbox persisted Intent and neutral Outbox sourceOpen/edit merge; fake-api interact/callback controls; discord-cards.test.ts; discord pairing/commands/messenger/API/messages tests; TelegramCards ask/inbox closure consumer; Gateway ask/outbox/inbox projection; web/nvim ask clients. No hub wire or authority change: topic.answer/ask/inbox and answer-once gate remain unchanged. Additive native modal callback and fake control fields; historical Discord outbox payloads remain valid (optional sourceOpen interpretation). Docs consumers: hub/README.md, discord-cards test guide, implement skill (proposal only per Coordinator).

### rev-32 · 2026-10-28T23:06:29.579Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261028-1409-source1
commit: 9325279766d2b243cffc59017a7f3987e8f666f5
scope: full
findings: [{"severity":"medium","text":"M1: closed-card sourceOpen runs before prior-attempt proof, dropping accepted-but-unmapped cards on recovery and leaving native buttons open. Reconcile uncertain native/nonce receipts and durably fold the recovered mapping ahead of General; retain unsent drop and add lost-response+close+restart proof.","file":"hub/src/remote/discord-outbox.ts","line":84},{"severity":"medium","text":"M2: raw waitForHold rejection is unowned until after setup/coord.send. Pre-own/catch observation before producer and always cancel/release/join; add omitted/pre-aborted setup controls with bounded complete drainage, preserving queued-card/native assertions.","file":"hub/test/discord-cards.test.ts","line":312}]
finding_counts: {"high":0,"medium":2,"low":0}

A-13511 full source1 not clear at932527976; Standards1medium(M2),Spec1medium(M1). M1 sourceOpen before uncertain proof leaves accepted unmapped native copy open after closure; M2 held observation lacks rejection ownership during setup. Claimant confirmed both and reproduces M1 missing mapping; working corrections excluded. Normal modal type9/5 text+decline path, synchronous hub first-answer gate, post-commit callback/defer, both remote propagation and unchanged authority/wire reviewed. Local19case/typecheck reports are supplemental summaryA-13510,not configured/Linux receipts. No Reviewer executions/edits/subagents. C3/C4 source-failed; other run-dependent criteria unverified. Verification held until corrected pushed head receives fresh full source clear; preserve all assertions and native ownership,refresh claimant done marks then request review. No per-item QA.

Criteria: C3 failed (Accepted card with lost response can be dropped before mapping/proof, preventing all-copy outcome edits.), C4 failed (Previously accepted but unmapped closed card can retain live native buttons after recovery.).

### impl-1409 · 2026-10-28T23:07:54.242Z

Source1 corrections M1/M2: uncertain closed-card attempts now retain bounded receipt/nonce reconciliation; durable mapping settlement synchronously queues closure edits ahead of General. True unattempted/positively unsent closed cards still drop; original nonce deadline is retained. New accepted-POST/lost-response/adapter-restart case first failed `recovered accepted native card mapping: not within 1500 ms`, now passes with exact original native id, same enforced nonce, one native copy, durable edit and no components. Both hold setup paths use pre-owned exchange observation, abort/join/release on setup failure; omitted/pre-aborted controls prove clean shutdown, no unhandled rejection (runner enforced), observers/holds/handlers/connections/timers zero. Updated README/test guide. Consumers unchanged from original inventory; new reconciliation state key is additive, no hub wire change.

### rev-32 · 2026-10-28T23:10:25.880Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261028-1409-source2
commit: c144297b24ddcb679ec267f104a251e089e9efda
scope: full
findings: [{"severity":"medium","text":"M3: sent card/mapping commits before settled queues its owed closure edit; startup skips sent jobs, so post-map/pre-fold interruption leaves native buttons open. Atomically retain obligation or scan durable closed mappings before General startup drain; add persistence-boundary reopen control with exact original native id/no duplicate/outcome/buttons/order assertions.","file":"hub/src/remote/discord-outbox.ts","line":98}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13512 full source2 not clear, Standards0/Spec1medium(M3). M1 addressed: uncertain closed attempts retain original bounded nonce/receipt proof and priority fold after mapped settlement; truly unsent closed cards still drop. M2 addressed: exchange owns hold observation before producer; failure abort/join/release plus omitted/pre-aborted drainage controls. M3 mapping/card sent commit still precedes owed edit; startup does not recover sent-card fold. Claimant confirmed new gap; working fix excluded. Full normal modal/shared-gate/closure/test/consumer inventory retained. Local22case/typecheck reports supplemental only,no configured/Linux evidence. No Reviewer executions/edits/subagents. C3/C4 source-failed; other criteria runtime-unverified. Correct M3 on stable base,push/restore done/request fresh full source; verification held until exact head clears. No per-item QA.

Criteria: C3 failed (Post-map/pre-fold interruption leaves no persisted edit and startup skips the sent card.), C4 failed (A durably closed mapped card can remain button-bearing after restart at the settlement persistence boundary.).

### impl-1409 · 2026-10-28T23:10:50.824Z

M3 correction: startup scans persisted card jobs and folds their closed mapped copies before any lane drains General. New native-outbox checkpoint test throws immediately after real writeOutbox completion/map commit, before settled; then stops owner, closes/reopens SQLite, resumes. Red: original native card still had both action rows instead of [] on reopen. Green: exact original native id, one card copy, shared outcome/no components, durable edit, PATCH-before-pending-General-POST, no I/O on second resume. This is a persistence-checkpoint simulation, not an OS crash timing claim. README/test guide updated. Local macOS Node24: changed discord-cards.test.ts all23 green, npm run typecheck green; configured Linux verification remains held until fresh source clear.

### rev-32 · 2026-10-28T23:12:32.057Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1409-source3
commit: ebc84af1927edaa303d142b40ff800ae7f87730e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13513 full source3 clear, Standards0/Spec0. M1 uncertain closed-card attempts reconcile original bounded receipt/enforced nonce before folding,with truly unsent drop retained. M2 observations pre-owned before producer,cancel/join/release and omitted/pre-aborted clean-resource controls retained. M3 startup synchronously reconstructs closed mapped-card edits before General; post-real-map-commit/pre-settled interruption control closes/reopens SQLite,retains original native id/one copy/outcome/no buttons,durable edit,exact PATCH-before-General POST and idempotent second resume. Checkpoint simulation,not OS-crash proof. Full modal type9/5 text/decline validation,unchanged first-answer authority,postcommit callback/exact2s defer,lost-defer owed edit,both-fake propagation/race,closure/docs/consumer inventory reviewed. Existing T2/index/proxy cancellation contracts retained. Reported local23case/typecheck supplemental,not Linux/configured receipt. C1–C5 runtime-unverified. Configured mode-free verify permitted at unchanged ebc84af19,then original-record evidence review; any changed head needs source review first. Preserve original local stdout/exits/timing/provenance without transcription reruns. No Reviewer execution/edit/subagents,per-item QA or full-all request.

### rev-32 · 2026-10-28T23:31:10.086Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1409-evidence1
commit: ebc84af1927edaa303d142b40ff800ae7f87730e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13518 final evidence clear at unchanged source3/A-13513 head; C1–C5 verified. Originalff6ea6a6/A-13517 independently parsed4040ordinary test passes/505file passes +105separate load tests,zero nonpassing/unfinished/skips. Own23/23 plus14identities×5load=70passes incl rename;max1.388838969s,no own>=3s allowance. C1/C2 type9/5/modal text+decline/committed-before-callback native assertions pass; C3 both modal→Telegram,nvim/web frames+Telegram→Discord REST removal pass; C4 withdrawal/cancellation,unsent drop,accepted lost-response nonce recovery and real post-map/pre-fold SQLite reopen/order/idempotency pass; C5 paired native race retains one immutable winner/bothbutton-free copies. M1–M3 addressed. Unchanged immediate/exact2s defer/lost-defer/stop controls pass. HostT0 check29.163s/gate431d5a9e separate; Linuxc8lon1 T1/allT2fallback/Web complete,Node24.21/Nvim.12.5/Shell156v1248,2general/4Web workers,life936s/$0.0650 notsuitewall. Budgets/lint134findings/1missingbaseline report-only. No T3/T4/full-all/OS-crash claim; checkpoint simulation labelled. A-13514 local transcription/capture limits retained separately. No Reviewer executions/edits/reruns/subagents or per-item QA. Ready report follows Coordinator workflow; enqueue belongs Coordinator.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-28T23:37:43.491Z

Merged 1b07d409d08f9dcfdbd6ca9c538678d9a8b55e3c onto dev.
