---
id: T-1508
kind: task
title: An uncertain Telegram gap notice blocks all outbound Telegram traffic indefinitely
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-1266
branch: t/T-1508-an-uncertain-telegram-gap-notice-blocks
created: 2026-10-31T08:43:38.437Z
updated: 2026-10-31T08:56:24.729Z
---

## Summary

Outbound Telegram has been stalled since 2026-10-30 21:25Z: General mirror messages, notices and ask cards reach Discord but not Telegram (reported by the human on 2026-10-31 08:41Z). The cause is the Telegram gap notice ("N General messages missed since …"). It was sent during poll stalls, and its single attempt ended `unknown`. The outbox keeps an uncertain send fenced without proof, which is correct, but `#caughtUp()` re-sends the saved gap with the same key on every poll. It throws every time, so catch-up never completes and the remote stays offline indefinitely. The hub log shows 13,762 `telegram-poll-retry` lines with reason `catch-up incomplete`, and no line names the underlying error. No operator command clears this state. Unpairing and pairing again in the same chat keeps the saved gap.

## Evidence

Read-only from hub.db, hub #64:
- `remote_outbox` has one Telegram `message` job `3a5acb7d-…` in state `uncertain`, created 21:25:25.228Z. Its one attempt has outcome `unknown`, and its `updated` field changes on every catch-up.
- `remote_state` `telegram.gap` holds key `telegram-gap-c99ee3f5-…` with the text "1 General messages missed since 22:21", one captured job.
- 8 `general` jobs are `missed` (21:21Z to 08:41Z) and 1 `card` is `queued` (the 08:17Z rule-batch ask).
- Code path: `hub/src/remote/telegram.ts` `#caughtUp()` → `flushTelegramGap` → `outbox.send({…}, { key })`. The exception is caught in `telegram-polling.ts`, which logs only `catch-up incomplete`.

## Acceptance criteria

- [x] C1. When the gap notice's send ends uncertain, catch-up still completes. The gap line is never resent (the fence holds), its captured jobs settle as reported, the saved gap clears, and later General messages, notices and cards flow again. A test on a fake Telegram server reproduces the stuck state and fails before the fix.
  - done: impl-1508 · 2026-10-31T08:49:28.852Z
- [x] C2. A hub that starts with this exact persisted state (an uncertain gap job with a saved `telegram.gap`) recovers on its own: after the first successful poll the queued card and new General messages are delivered. This is tested from a seeded hub.db state, not only from the live sequence.
  - done: impl-1508 · 2026-10-31T08:53:41.489Z
- [x] C3. A catch-up failure logs a fixed, redacted reason class that names the failing step (gap, outbox resume, inbound recover or card catch-up) instead of the bare `catch-up incomplete`.
  - done: impl-1508 · 2026-10-31T08:49:29.804Z
- [x] C4. When a remote stays offline because catch-up keeps failing for more than 5 minutes, an `offline` notice reaches General through the hub, not only through the stalled messenger, so the human learns about it from the workbench or the other remote. The notice is sent once per outage.
  - done: impl-1508 · 2026-10-31T08:49:29.874Z

## Comments

### impl-1508 · 2026-10-31T08:44:44.957Z

Consumer inventory before change: flushGap is consumed by telegram-gap.ts, discord.ts and remote-neutral.test.ts; flushTelegramGap by telegram.ts, telegram-gap.test.ts and telegram-gap-fixture.ts. telegram.gap persisted readers: gap.ts through wrapper, telegram-catchup.test.ts, remote-neutral.test.ts (isolation sentinel), gap guides, README. caughtUp callback consumers: telegram.ts and telegram polling tests/fixtures; telegram-poll-retry readers: liveness fixture/tests and polling fixture/tests. Searched hub/web/nvim/shared/docs/.agents skills by field, frame and function names, including T3/T4. Plan leaves persisted and wire shapes unchanged, Telegram-only durable uncertain-gap settlement; Discord unaffected. Previous callback shape remains supported. Tests use existing authorized production factory/fake server and persisted Store seams.

### impl-1508 · 2026-10-31T08:51:40.539Z

Consumer inventory correction from source review M1: REMOTE_USAGE is consumed by frozenUsage() in cli-usage-fixture.ts, commands.json and top-level help.txt. Unchanged cli-usage-compatibility.test.ts and cli-help.test.ts failed on changed owning help bytes, then passed after only REMOTE_USAGE row/help line migration. Also cli-command-help.test.ts checks pure dispatcher prerequisites and cli-usage-merge.test.ts uses commands.json for independent merge exercise; no expected output changes there. Reviewer consolidated audit pending; no verification submitted.

### rev-26 · 2026-10-31T08:53:20.125Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1508-source-1
commit: acde19fd4faa19bfcd2deeaad1f0be846c20703f
scope: full
findings: [{"severity":"medium","text":"M1: changed REMOTE_USAGE lacks owning frozen commands.json row migration, breaking unchanged compatibility/native help expectations; reproduce complete guards and retain red/green. help.txt uses placeholders and stays unchanged.","file":"hub/src/cli/usage/remote.ts","line":2},{"severity":"medium","text":"M2: strict userId equality excludes supported persisted payloads with userId absent; matching unknown gap then rejects on every catch-up and never clears. Resolve captured saved-gap/current-pairing authority with existing legacy matcher; seed absent-userId recovery and conflicting user/chat negatives while preserving unknown attempt/no resend.","file":"hub/src/remote/telegram-gap.ts","line":20}]
finding_counts: {"high":0,"medium":2,"low":0}

Consolidated full source not clear M1/M2 at frozen head. A-14861 contains Standards/Spec audit; supersedes A-14860 solely to clarify help.txt placeholder metadata. Current-shape settlement, fixed diagnostics and timer correction reviewed without further findings. Lead has separately reported M1 complete-guard red/green and M2 legacy seeded deadline red plus working-tree corrections; none is a change to this reviewed head. Complete corrections together and request fresh exact pushed-head source review before configured verification. C1–C4 remain runtime-unverified; local A-14859 is reported evidence, not independently rerun; its pre-change C4 assertion limitation retained.

Criteria: C2 failed (Restart recovery remains stuck for the supported persisted uncertain-gap payload shape with userId absent.).

### rev-26 · 2026-10-31T08:55:11.388Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1508-source-2
commit: b69483625ec47557321589d8b537d5503ffad653
scope: full
findings: [{"severity":"medium","text":"M3: store.pairing() now executes once for every retained outbox row before filters, creating N synchronous SQLite queries per uncertainty check and recovery work proportional to unrelated terminal history. Capture pairing once outside predicate, restrict candidate query to uncertain rows, retain legacy/conflict assertions and a positive constant-work control.","file":"hub/src/remote/telegram-gap.ts","line":21}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14863: consolidated source2 not clear only for new M3 retained-history query amplification. M1 owning frozen metadata and M2 shared legacy captured-identity matcher closed. Lead reports new 500-row control red ('502 pairing queries exceed the constant work budget') and working-tree correction; this is separate from frozen reviewed b69483625. No additional findings. All criteria remain runtime-unverified. Complete M3 and request fresh exact pushed-head source review before configured verify. Preserve original local native output/tree receipts for final audit, no unnecessary evidence-recreation reruns.

### rev-26 · 2026-10-31T08:56:24.729Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1508-source-3
commit: 7d8c456cf23e943663da0f9f7794a496f0140983
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14866: source3 clear; M1–M3 closed. Pairing captured once per uncertainty check, candidate lookup restricted to uncertain rows; 500-retained-row control retains <=3 total pairing-read budget plus final gap-clear/native-uncertain/no-send assertions. Legacy absent-userId and conflicting user/chat controls unchanged. Source1 diagnostics/timer and native replay fences retained. Independently read A-14864 7/7 and A-14865 11/11 original local named outputs; macOS Node24 per request, partial local evidence only. Request reports typecheck green and final lint running; finish existing static checks, then one mode-free configured verify at frozen head and original-record final evidence review. C1–C4 remain done/runtime-unverified. No integrated/live restart/full local coverage inferred.
