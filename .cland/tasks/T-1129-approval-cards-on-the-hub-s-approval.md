---
id: T-1129
kind: task
title: Approval cards on the hub's approval records
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1123
  - T-1126
  - T-1111
topic: topic-903
branch: t/T-1129-approval-cards-on-the-hub-s-approval
created: 2026-10-22T15:16:14.682Z
updated: 2026-10-23T10:25:33.977Z
closed: 2026-10-23T10:25:33.977Z
---

## Summary

A relayed approval shows as a card with the command in full and Approve once, Always for this command and Deny with a note, answered through E-414's gate; an approval that stays in a harness's TUI is marked "answer in Neovim" and has no buttons.

## Parent

E-417 (§3.4 approvals as cards; §3.8; P23; tracer step 5, the approvals half; answers through the gate of E-414).

## What to build

The asks and approvals section of the inbox shows each approval record of E-414 as a card (P23): the session, the harness, the command or the file change in full, since when, and the choices the record offers. Approve once and Always for this command answer at once; Deny opens a note that must be filled before Deny is enabled, and Escape never answers. The answer goes through the hub's gate, is shown pending until the receipt, then applied or failed; an answer refused because another client or the harness's TUI answered first folds the card to that outcome. An answered approval folds to one line with its outcome and follows the inbox's leave rule. A record the hub marks as staying in the harness's TUI (Claude Code) shows the command and "answer in Neovim" with no buttons. With an approval row selected, the drawer shows the session's recent thread. The card is one component the session's drawer of E-418 reuses. This ticket waits for E-414's record and Codex relay; if E-414 has not landed when its stage starts, the Coordinator moves it after E-414.

## Acceptance criteria

- [x] C1. A fake Codex approval shows in the inbox as a card with its command in full and Approve once, Always for this command and Deny, and Approve once folds it with "approved once by the human", as a frame client reads it (Web test).
  - done: impl-1129 · 2026-10-23T10:09:28.254Z
  - verified: rev-23 [reviewer] · run rev-20261023-1129-final · 2026-10-23T10:20:55.430Z · commit 599bb7e08c2dec530c925584ce394b6515600f5c
- [x] C2. Deny sends with or without a note, since the note is optional per E-414's decision on ask 9a81a158; a typed note reaches the record with the denial, and Escape never answers (Web test).
  - done: impl-1129 · 2026-10-23T10:05:18.045Z
  - verified: rev-23 [reviewer] · run rev-20261023-1129-final · 2026-10-23T10:20:55.430Z · commit 599bb7e08c2dec530c925584ce394b6515600f5c
- [x] C3. A fake Claude Code approval shows marked "answer in Neovim" with no buttons (Web test).
  - done: impl-1129 · 2026-10-23T10:05:18.126Z
  - verified: rev-23 [reviewer] · run rev-20261023-1129-final · 2026-10-23T10:20:55.430Z · commit 599bb7e08c2dec530c925584ce394b6515600f5c
- [x] C4. An answer refused because another client answered first folds the card to the winner's outcome (Web test).
  - done: impl-1129 · 2026-10-23T10:05:18.328Z
  - verified: rev-23 [reviewer] · run rev-20261023-1129-final · 2026-10-23T10:20:55.430Z · commit 599bb7e08c2dec530c925584ce394b6515600f5c

## Comments

### impl-1129 · 2026-10-23T09:54:21.093Z

Implementation started with approved Web/frame seams retained as A-9952 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9952-t-1129-implementation-and-test-seams.md). Dependency gate: wait for T-1128 on origin/dev, merge before code. Baseline 8614eb64 local macOS arm64: build and targeted area-slots/key-contexts/palette/inbox 34/34 passed; targeted evidence only.

### impl-1129 · 2026-10-23T10:06:18.224Z

Source review requested from reviewer at 6fb2a98d0fce138917099eacc52dc44ec4649226, pushed to local origin; resolved to rev-23. C1–C4 done. Evidence A-9961 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9961-t-1129-source-review-evidence.md): root npm run check passed (test lint report-only, 132 findings/59 files, zero refusals), final Web typecheck passed, seven targeted Web files 62/62 passed on local macOS arm64. No suite receipt yet; await source verdict then exact-head mode-free verify. QA affected after-stage, no per-item criteria/brief.

### impl-1129 · 2026-10-23T10:08:39.464Z

Review M1 corrected at pushed 599bb7e08c2dec530c925584ce394b6515600f5c: each approval selection refreshes its session-history view, including two approvals from one session. New held-old-read/new-message/select-B regression failed at the exact rendered newer-message wait before the fix, then passed after keying by approval.id. Full targeted Inbox 22/22 and Web typecheck passed on local macOS arm64; no new passing sample ≥4s. Awaiting consolidated review; no mode-free suite submitted.

### rev-23 · 2026-10-23T10:09:15.108Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1129-source
commit: 6fb2a98d0fce138917099eacc52dc44ec4649226
scope: full
findings: [{"severity":"medium","text":"M1: SessionRecentThread keyed by sessionId and effect lacking approval selection identity retains stale history when another approval from the same session is selected; refresh per selected approval and fence held prior response.","file":"web/src/InboxArea.tsx","line":168}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1129 full source review
Head 6fb2a98d0fce138917099eacc52dc44ec4649226 / tree4c54324e73f319f23406bf30601605e61e38eeb4
Base558262e4ffb41f285a046720a3cc19b2392fd2a7; git diff558262e4...6fb2a98d,12files266+/19-.
Run rev-20261023-1129-source. Not clear; one medium finding, C1 failed for incomplete selected-approval drawer behavior; C2–C4 remain runtime pending.

Standards: no independent findings. Existing authoritative record, answer/recovery guard and read-only public history seam reused. Shared physical keymap and one Shell dispatcher own reusable card actions; denial field declares its Escape context and keeps native typing/Enter. Optional-note behavior matches amended C2 and E-414 decision9a81a158; complete-subject cap fallback matches E-414 2026-10-22 23:30Z decision. Matched Web/hub README and test/implement guidance with CHANGES provenance. No hub/protocol/dependency/role authority changes. Existing held delivery/failure/manual retry and exact-id winner recovery assertions retained.

Spec:
M1 medium — web/src/InboxArea.tsx:168, with SessionRecentThread.tsx:21. Recent-thread component is keyed by approval.sessionId and reads only when command/live/session/retry changes. Selecting approval B from the same session as approval A retains the prior component and result, so newer session messages are missing indefinitely after selection (successful view has no refresh action). This violates selected approval's recent-thread context and Web README's claimed selection refresh. Fix read identity to include approval selection; add a public Web regression that holds A's history response, receives a new session message, selects B, observes exact newer message, releases A and retains B's result. Preserve bounded read and stale-response fencing. Implementer confirmed source path and reports this regression red then green at a replacement head; that head is not covered by this verdict.

Rest of source audit: complete public subject renders command and change separately, plus cwd/reason/files and session/harness/since; long subject is scrollable without slicing. Offered choices and TUI-only branch remain authoritative; answer() additionally refuses answerIn!=hub. Optional denial note sent only when nonblank; Escape/Cancel clears local note without answer and restores Deny focus. Pending/offline/recovering disable answers; manual retry keeps failed note. Closed card displays attributed choice/human/via/time and existing visit lifecycle remains. Drawer resolves current approvalCards state before rendering; retained split revalidation and exact winner preserve newer Inbox rows/counts. Recent history is bounded20 and guarded by effect cleanup, but missing selection identity is the blocker.

A-9961 local evidence is a summary: feature source committed as6fb2a98d, Darwin arm64, check and final Web typecheck passed, seven targeted files62/62 with no skips/failures, report-only lint. No configured suite or head-cleared runtime evidence yet. No independent reviewer tests/browser/trace execution. Preserve original raw stdout/exits/timings and dirty-tree/head attribution without transcription reruns.

Findings complete: M1 only. Fresh source review requested at corrected pushed head before mode-free verification. After-stage affected QA separate; no per-item brief/criteria.

Criteria: C1 failed (Selected approval drawer reuses stale recent-thread read when another approval from the same session is selected.).

### rev-23 · 2026-10-23T10:10:06.751Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1129-source-2
commit: 599bb7e08c2dec530c925584ce394b6515600f5c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1129 corrected source review
Head599bb7e08c2dec530c925584ce394b6515600f5c / treecd1e0e589c48b51e7da38d61a39e2c79c7e41594
Parent6fb2a98d0fce138917099eacc52dc44ec4649226; no dev merge.
Run rev-20261023-1129-source-2. Clear, findings[]. C1–C4 runtime pending.

Standards: pass. Four-file focused correction changes only recent-history component identity, adds one sealed public Web regression, and updates test guidance/CHANGES. Full original source audit A-9962 carries forward except resolved M1. No command/authority/protocol/helper/timing policy changes, new test process fixture or timeout expansion.

Spec: M1 resolved. InboxArea.tsx now keys SessionRecentThread by approval.id. Selecting B from the same session unmounts A's read component, invokes its existing cleanup/current=false guard and mounts a fresh20-message read for B. Older A result cannot populate B's component. Current approval rendering/choices/outcomes and E-414 optional-note/full-subject cap fallbacks are unchanged.

Regression arms the WebSocket result interception before opening A; waits for its first session.history response to be held; sends a new real session message; raises/selects B from the same session; observes the exact new message in B's recent-thread log; then releases A and observes that result delivered, retaining final exact newer-message text. Observer before release and final assertion retained. Existing bounded native/frame tests unchanged.

Implementer reports original red at old reviewed source waiting for newer message, corrected green596.556042ms, then full targeted Inbox22/22 plus Web typecheck on Darwin arm64. Raw outputs/exits/timing remain in original session records, not a newly re-created transcript; these remain local targeted evidence, not configured same-head verification. Baseline check/62-target summary A-9961 retains original attribution limits. C1 done refreshed after historical failed verdict.

Proceed with exact-head mode-free verification. Inspect actual new passing Web samples before allowance decisions; preserve original receipts without transcription reruns. Reviewer read only, no tests/browser or edits. After-stage affected QA separate.

### impl-1129 · 2026-10-23T10:10:35.319Z

Fresh source review clear at exact 599bb7e08c2dec530c925584ce394b6515600f5c (rev-20261023-1129-source-2, A-9964). Mode-free verify admitted as bc208413-78d2-4aee-bb9d-f63e97409c89, queue position 1, no executor override. Waiting for hub result; original M1 correction excerpts are A-9963, no transcription reruns.

### rev-23 · 2026-10-23T10:20:55.430Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1129-final
commit: 599bb7e08c2dec530c925584ce394b6515600f5c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1129 final evidence review
Head 599bb7e08c2dec530c925584ce394b6515600f5c / tree cd1e0e589c48b51e7da38d61a39e2c79c7e41594; branch tip unchanged.
Run rev-20261023-1129-final. Clear, findings []; verified C1,C2,C3,C4.

Standards: source correction audit A-9964 carries forward. M1 from A-9962 resolved by approval-id identity and stale-read cleanup; A-9963 retains original precommit red/green command exits/timings with honest attribution. Existing record/choice/answerIn, recovery and first-winner authority remain unchanged. Optional denial note follows amended C2 and E-4149a81a158 decision; complete subject overflow remains TUI-only under E-41423:30Z decision.

Spec/criteria:
C1 verified: full long command, session/harness/since, offered choices, real once answer and frame/archive “Approved once by the human” web outcome. Reusable physical Always/help case also passes. Selected drawer shows bounded session recent messages; M1 held-A/new-message/select-B exact-id regression passes and retains B's newer message after old A reply delivered.
C2 verified: Escape clears denial note, restores Deny focus and leaves record pending with no adapter answer. Empty optional note sends denial without note; typed note reaches archived outcome, with adapter choices asserted. Held native delivery stays answering/disabled; failure retains note and manual retry succeeds.
C3 verified: fake Claude Code subject shown with Answer in Neovim and no buttons; file command/change/paths render complete and offered choices authoritative. A later same-id TUI-only update removes controls. This verifies public UI fallback, not a new native payload-cap execution.
C4 verified: held losing answer is genuinely refused, exact archived human winner folds the card while newer Inbox rows/count remain. Split revalidation/peer closure, fresh epoch and same-id TUI authorization recovery tests pass.

Configured mode-free bc208413-78d2-4aee-bb9d-f63e97409c89 / A-9971 exits0 at exact source-cleared head. Raw progress audit2712/2712 ordinary tests and402/402 files pass, no fail/skip/cancel. No load-gate-scope repetitions present; generic five-repetition headers do not prove repetitions. Actual T1, fallback all hub+Neovim T2 and complete Web all exit0. No T3/T4; configured task policy defers T3.

Executor Linux x64 c-8 lon1 cland-v0-e8dc0aa4, Node24.21.0/Neovim0.12.5, workers2/Web4; lifetime547s/$0.0380. Host check8fec7c7dd6b5b71986ec471dc1926c52ee37839d reused, not repeated remotely. Generic duration/test-lint/tier/ratchet report-only diagnostics and four missing baselines retained. Actual Web phase106.37s; projected95.162s at2workers is not measured wall time. No clean-budget or new T3/integration claim.

Six new passing Web durations in seconds:
complete-command/once1.401058694;
Escape/optional-note1.543981997;
full-file/TUI1.116285041;
recent-thread0.978521312;
selection refresh/held-old-read1.040073902;
held native failure/manual retry1.222527312.
All below4s; no new identity allowance trigger. Existing Plan-navigation5.285977482s is an unchanged identity under its existing allowance, not a new task sample. All22 Inbox cases pass.

Reviewer performed only read-only source/log/identity inspection; no tests/browser, edits or merge. After-stage affected QA remains separate; no per-item brief/outstanding QA criteria. Final clear at this head.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1129 · 2026-10-23T10:21:16.566Z

Final clear rev-20261023-1129-final at unchanged 599bb7e08c2dec530c925584ce394b6515600f5c verifies C1–C4, no findings (A-9973). Mode-free bc208413/A-9971: 2712/2712 pass, Linux droplet, T1/all fallback T2 in both packages/Web; host check reused, lint/budgets report-only; no T3/T4/load repetitions. Six new Web samples <1.544 s, no allowance trigger. A-9972 records original timings and post-run conflict check versus fetched dev 4624720e (merge-tree exit 0); no source/ref/worktree change. Ready report sent to Coordinator as requested; no merge. After-stage QA separate; retaining claim until landing.

### coord · 2026-10-23T10:25:33.977Z

Merged 720842c2d1df7988c9372d2a64436ee485973be6 onto dev.
