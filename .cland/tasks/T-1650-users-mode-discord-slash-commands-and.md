---
id: T-1650
kind: task
title: Users-mode Discord slash commands and first-answer-wins across paired users have no test
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
  - release-blocker
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1368
branch: t/T-1650-users-mode-discord-slash-commands-and
created: 2026-11-03T02:48:20.364Z
updated: 2026-11-03T16:01:17.802Z
closed: 2026-11-03T16:01:17.802Z
---

## Summary

T-1574 (head c35d60b5, queued 2026-11-03) changed users-mode Discord slash commands, but no test covers them. Its docs say `/cland inbox` re-sends only in the invoking channel and folds every copy, and it also changed the users-mode help line and the user attribution of `/cland decision` and `/cland question`. `discord-users.test.ts` has no slash-command case, and `discord-commands.test.ts` is single-mode. The spec's "the first answer wins" across two paired users (spec §3.8) is untested on both remotes too: every card test has a stranger press it, then one paired user answers, and a second paired user never presses. Found while drafting the E-1536 stage-4 QA brief, which lists these as out of scope.

## What to build

Tests only, using the fake native Telegram and Discord doubles: users-mode `/cland inbox`, help, decision and question with two paired Discord users; and a card pressed by two paired users on each remote. The second press must be refused or ignored as the spec states, and every copy must fold once with the first answerer's name.

## Acceptance criteria

- [x] C1. A users-mode Discord test with two paired users covers `/cland inbox` (re-sent only in the invoking channel, every copy folded), the help line, and `/cland decision` and `/cland question` attributed to the invoking user (test).
  - done: impl-1650 · 2026-11-03T14:43:10.647Z
  - verified: rev-35 [reviewer] · run rev-35-1650-final-1 · 2026-11-03T15:18:17.511Z · commit e983019d57a758b8e49b762391b66ad8f80e27ff
- [x] C2. On Telegram and on Discord, a card answered by one paired user and then pressed by a second paired user records only the first answer, folds every copy once with the first answerer's name, and gives the second user the documented refusal (test).
  - done: impl-1650 · 2026-11-03T14:52:39.358Z
  - verified: rev-35 [reviewer] · run rev-35-1650-final-1 · 2026-11-03T15:18:17.511Z · commit e983019d57a758b8e49b762391b66ad8f80e27ff

## Comments

### impl-1650 · 2026-11-03T14:42:07.463Z

C1/C2 implemented with fake-only tests, no product changes. New Discord slash/approval identities belong to existing T2 file entries in tiers.json. Both native handlers expose exact refusal “Already answered”. Added durable answer-row counts for asks, one forwarded answer request for asks/approvals, outcome identity/preservation, all native final text/components and one REST fold per copy. Existing fixture owners join all writers; no processes added. Local macOS Node24.21.0 users files19/19 passed; Linux/load and queued tiers remain pending. Notes: .agents/skills/implement/CHANGES/T-1650-users-mode-regressions.md.

### rev-35 · 2026-11-03T14:47:56.892Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1650-source-1
commit: b7d140828a4249fe77d1494258e92b6dc4ccf49a
scope: full
findings: [{"severity":"medium","text":"The ask and paired-approval additions wait only for answerCallbackQuery to appear, then assert no second forward/fold and unchanged state (approval repeats at148–157). That acknowledgement precedes remaining handler work in telegram-cards.ts:96–112, so the counts can pass before a delayed duplicate edit/forward is attempted. Await the durable confirmation of the exact callback update (polling confirms it only after handler completion), or an equivalent exact owned-handler receipt, before final assertions; add a held post-ack control proving the assertion cannot run early.","file":"hub/test/telegram-users.test.ts","line":85},{"severity":"medium","text":"Both second-press cases observe only the private callback, then call hub.stop before asserting final PATCH/answer counts (approval at283–295). Discord closed-card paths await that reply and only afterwards call outcome/closeApproval (discord-cards.ts:159/219), while DiscordRemote.stop aborts the signal before joining work. Shutdown can therefore suppress the duplicate follow-up the test intends to detect. Await natural completion of the exact second interaction's owned handler before stopping/snapshotting; keep all count/state assertions and demonstrate with a held post-ack handler control.","file":"hub/test/discord-users.test.ts","line":239}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear:2medium receipt-boundary findings in A-16287. Both native handlers perform work after their Already answered callback; Telegram additions inspect counts before exact completed-update receipt, and Discord calls aborting hub.stop before final PATCH/answer assertions. Require exact natural-handler/update completion before final state/count snapshots, with an armed held post-ack control, preserving all existing assertions. C2 failed; C1 source assertions cover requested two-user slash/inbox/attribution paths but remain unverified pending runtime evidence. Existing fake-only/T2/sealed fixtures and docs inspected; no production/shared fake or native-process changes. Reported local19/19 macOS Node24.21 checks are supplemental, no queued/Linux/Web/load proof yet. No Reviewer runtime checks/edits/browser/delegation. Fresh corrected-head source review before mode-free verify; qaPolicy none. Detail A-16287: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16287-t-1650-source-review-second-press-handler-completion-receipts.md.

Criteria: C2 failed (Second-press count/state assertions await native acknowledgement rather than completed handling; Telegram can assert before follow-up work and Discord stop can abort that work before final counts.).

### rev-35 · 2026-11-03T14:54:20.709Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1650-source-2
commit: e983019d57a758b8e49b762391b66ad8f80e27ff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. A-16287 fixed: second-press observers arm before action; per-instance successful native ack is held; exact completion marker absence/observer unfinished asserted; release then exact Telegram update/Discord interaction marker awaited before every retained state/count/fold assertion. Production trace confirms markers follow awaited handler/card idle; Discord stop now follows final assertions. Additive fresh-callback fake control preserves raw update/expiry semantics; optional nativeApi flag preserves existing fixture paths; bounded cleanup-owned hold adds no process/product code. C1 source coverage and all C2 first-winner/refusal/identity/count/final-copy assertions retained. C1–C2 remain unverified pending exact-head configured verification. Reported local macOS19 users+112 unchanged preservation checks are supplemental, not queued/Linux/load proof. No Reviewer runtime execution/edits/browser/delegation. Submit mode-free verify at this exact head; changed head needs fresh source review. qaPolicy none. Detail A-16290: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16290-t-1650-clear-source-review-natural-handler-completion-barriers.md.

### impl-1650 · 2026-11-03T15:17:06.563Z

Same-head verify6918ce6d/A-16293 passed at e983019d57a758b8e49b762391b66ad8f80e27ff/treea1eee42743beb44350ee8a2c608ae334595c1cb0,cache null. T0,T1,fallback all T2,Web completed;4921pass,0fail/cancel/skip/todo. Linuxx64 6.8.0-142-generic,droplet c-8 sfo2,Node24.21.0,Neovim0.12.5,workers2; isolated chrome-headless-shell1248 / Google Chrome for Testing156.0.8078.4. New Discord slash/approval base cases0.427s/0.230s and each5/5 load repetitions passed; Telegram ask0.257s,paired approval0.233s pass. Budget/lint advisories remain report-only. T3 deferred to merge batch/integrated occasions,T4 unexecuted. Reviewer same-head evidence settlement requested; claim retained.

### rev-35 · 2026-11-03T15:18:17.511Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1650-final-1
commit: e983019d57a758b8e49b762391b66ad8f80e27ff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, no findings; C1/C2 verified. Exact source-cleared/current head run6918ce6d/A-16293 passed4921/4921, zero fail/cancel/skip/todo. Independently read both new Discord ordinary passes plus5/5 distinct scope=load-gate finish/pass receipts each, extended Telegram ask/paired approval passes, all19 users cases, unchanged Telegram API/cards/approval112 ordinary passes and Discord cards70/commands10. Exact generated case names/log lines mapped to criteria in A-16295; source-reviewed natural handler completion and held post-ack assertions exercised. T0/T1/fallback allT2/Web completed; T3 deferred to batch/integrated occasions, T4 unexecuted; QA none. Uncached Linuxx64 6.8.0-142-generic c-8sfo2 Node24.21/Nvim0.12.5 workers2, runner treea1eee42743beb44350ee8a2c608ae334595c1cb0; isolated Web HeadlessShell1248/ChromeForTesting156.0.8078.4, item remote tests fake-only. skips[]/missing0 report; budgets/lint/ratchet advisory. Billing1259s/$0.0874 not suite wall time. No Reviewer runtime checks/edits/browser/delegation. Detail A-16295: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16295-t-1650-final-clear-exact-head-remote-user-regression-evidence.md.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-03T16:01:17.802Z

Merged 9bd3b0ebf238d560d0323a692ba14870d922e24d onto dev.
