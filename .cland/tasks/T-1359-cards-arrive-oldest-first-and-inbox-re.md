---
id: T-1359
kind: task
title: Cards arrive oldest first, and `/inbox` re-sends every open card at the bottom or says "Nothing needs you"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1357
  - T-1358
topic: topic-1120
branch: t/T-1359-cards-arrive-oldest-first-and-inbox-re
created: 2026-10-27T05:43:02.158Z
updated: 2026-10-27T20:39:01.447Z
closed: 2026-10-27T20:39:01.447Z
---

## Summary

One inbox publication sends its new cards and notices oldest first, so the newest sits at the bottom. `/inbox` re-sends every open card and notice at the bottom as live copies, or says "Nothing needs you".

## What to build

The card jobs of one inbox publication go into the outbox sorted by the row's `since`, then its id, across asks, approvals and notices. `/inbox` replaces the text-only reply in `telegram-commands.ts`. It reads `inbox.list` and sends a new copy of each open row, oldest first. Each copy is mapped like the first, so every copy takes the later outcome edit, and older copies keep working. An empty inbox (pairing rows excluded) gets the one line "Nothing needs you". Spec §3.5 and §3.10.

## Acceptance criteria

- [x] C1. Three asks posted in one publication, newest first, arrive in the chat oldest first, ahead of a General message queued at the same time (test).
  - done: impl-1359 · 2026-10-27T20:13:43.401Z
  - verified: rev-26 [reviewer] · run rev-20261027-1359-evidence-1 · 2026-10-27T20:31:40.032Z · commit 6eef3e4bc25475fcd9a31cf270787dcf058e44ac
- [x] C2. After one of three asks is answered, `/inbox` re-sends the two open cards at the bottom oldest first, and answering one from its new copy edits both of its copies to the outcome (test).
  - done: impl-1359 · 2026-10-27T20:13:43.506Z
  - verified: rev-26 [reviewer] · run rev-20261027-1359-evidence-1 · 2026-10-27T20:31:40.032Z · commit 6eef3e4bc25475fcd9a31cf270787dcf058e44ac
- [x] C3. `/inbox` with no open rows replies "Nothing needs you" (test).
  - done: impl-1359 · 2026-10-27T20:13:43.883Z
  - verified: rev-26 [reviewer] · run rev-20261027-1359-evidence-1 · 2026-10-27T20:31:40.032Z · commit 6eef3e4bc25475fcd9a31cf270787dcf058e44ac

## Comments

### impl-1359 · 2026-10-27T20:07:21.591Z

Pre-change rule 20 inventory: TelegramCards.receive/publish/publishApprovals/publishNotices and TelegramRemote's /inbox handler are the only production publication/command consumers; telegramInbox has only telegram.ts as caller (repo-wide rg across hub/shared/web/nvim/skills/docs/qa). telegram-outbox.ts reads stable send keys, native mappings and source-open admission; telegram-prompts.ts/telegram-inbound.ts and cards callback/outcome readers consume existing ask/approval maps. Preserve all existing key formats for automatic sends; add command-scoped resend keys without changing wire fields or schema. Tests/fixtures across tiers: telegram-cards, telegram-approvals, telegram-notices, telegram-commands, pacing/catchup/gap/polling(-restart), outbox(-gateway), gateway, remote-state; headless inbox remote-via/approval tests consume unchanged outcomes. Existing previous-wire gateway tests remain unchanged. Shipped implement skill, hub README Telegram commands/cards, docs/agents/pairing.md and per-file guides describe this flow; QA epic brief/demo uses /inbox and remains compatible with live buttons. No startup probe, persisted record reader or other messenger calls telegramInbox. TDD seam confirmed by launch brief: sealed T2 frame protocol and loopback fake Bot API, with FakeClock and pacingOwner. Coordinator resolved the direction conflict: older /inbox copies retain working buttons; outage replacement belongs to T-1360.

### rev-26 · 2026-10-27T20:16:02.680Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1359-source-1
commit: 0ccab7998fad124642f598993ade571138693fbe
scope: full
findings: [{"severity":"medium","text":"M1 Standards: renamed commands long-card/status case and mixed backlog notices case retain old duration identity keys (lines 7719 and 7925). Migrate to the exact new generated titles preserving 0.15238 and 0.343018; audit owned identity inputs and retain unchanged manifest guard red/green receipts.","file":"hub/test/durations.json","line":7719}]
finding_counts: {"high":0,"medium":1,"low":0}

Full consolidated audit A-12884: Standards one medium M1, Spec zero findings. Combined oldest-first publication, shared live copies, retained old button authority, all-copy outcomes, pairing exclusion, exact empty reply and uncertain-resend replay fencing are sound in source. Existing T2 fixtures/ownership and docs/skill CHANGES reviewed. Local A-12882 targeted macOS evidence is distinct from configured runtime proof; C1–C3 runtime marks remain pending. Consolidated findings complete. Correct M1, push and request fresh source review before verification; no further dev merge.

### impl-1359 · 2026-10-27T20:16:28.879Z

M1 corrected at 6eef3e4bc25475fcd9a31cf270787dcf058e44ac: migrated both renamed generated duration identities preserving 0.15238/0.343018, updated the only stale owned guide reference. Unchanged node hub/test/lint-tiers.ts produced sequential red receipts naming each stale key, then exit 0 after correction (hub free 163, machine 420 classification, no runtime suite). Closed-wording lint/diff check green. Runtime code/tests unchanged from source-1; local 89-test/typecheck evidence remains predecessor-source evidence. Correction committed/pushed; fresh source review follows, no dev merge.

### rev-26 · 2026-10-27T20:16:57.337Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1359-source-2
commit: 6eef3e4bc25475fcd9a31cf270787dcf058e44ac
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source-2 clear, Standards and Spec; M1 resolved by exact key migrations preserving 0.15238/0.343018 and migrated guide reference. Runtime code/tests identical to fully audited source-1/A-12884. A-12885 retains actual unchanged static guard reds and green; predecessor 89 local T2 passes/typecheck are not corrected-head reruns. No configured runtime evidence; C1–C3 verification remains pending. Source artifact records exact head/tree and limits. One unchanged-head mode-free run next.

### rev-26 · 2026-10-27T20:31:40.032Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1359-evidence-1
commit: 6eef3e4bc25475fcd9a31cf270787dcf058e44ac
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear, A-12892. Exact-head ca91745f/A-12891 independently yields 3748 ordinary passes plus 30 separate scoped load passes. All 89 changed-file ordinary cases pass. C1 order, C2 live two-copy outcomes and C3 exact empty reply each pass base plus actual 5/5 load; approval/notice/lost-resend controls also 5/5, renamed mixed-backlog/long-status controls base pass. New base/load max .862308288 s, no >=3 s allowance needed. T0/all T1/fallback all T2/Web completed; T3/T4 absent. Linux c-8 lon1, isolated Headless Shell 156.0.8078.4/r1248; reused host gate 2261c527 not remote typecheck. Budgets/lint remain report-only. Source A-12886 plus original records verify C1–C3. QA none; integrated occasions/landing separate.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-27T20:39:01.447Z

Merged c7a3058b47e9946c218ab8b305078bd017e9b6b7 onto dev.
