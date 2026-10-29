---
id: T-1415
kind: task
title: Outbound artifacts reach Discord once per remote within its file limits
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1404
  - T-1405
  - E-1311
topic: topic-1173
branch: t/T-1415-outbound-artifacts-reach-discord-once
created: 2026-10-27T23:38:48.861Z
updated: 2026-10-29T09:45:35.866Z
closed: 2026-10-29T09:45:35.866Z
---

> Pending: whether Discord attachments and voice stay in this epic (blocked by E-1311) or move to a 0.3.x release awaits the human's answer to ask 62b8d32f; the Coordinator's recommendation keeps them here. Do not launch before it is answered.

## Summary

An agent's artifacts go to the paired channel as files with the message's header as caption, each exactly once per remote. A message holds at most 10 files, each file 20 MiB and each request 25 MiB. A larger file arrives as a line naming the artifact and its path.

## What to build

**Sending.** `createMessage` gains multipart: `files[n]` with names and a `payload_json` that keeps the nonce, `enforce_nonce` and the empty `allowed_mentions`. A message's artifacts are grouped into sends of at most 10 files and 25 MiB. Each send carries the header as its caption, and a single artifact with a short text carries the text too. A file over 20 MiB becomes a line naming the artifact and its path. HTML and diagrams go as files.

**Once per remote.** E-1311's per-remote ledger records each artifact once, and a timed-out multipart send is proven by its nonce, as 09 does. A photo the human sends from Telegram reaches Discord under "you (Telegram)".

The fake accepts multipart, enforces the counts and sizes, and stores the files.

Spec §3.6 (outbound artifacts); research rule 22.

## Acceptance criteria

- [x] C1. An agent's message with an image and a PDF arrives in the channel once with both files and the header, and a send retried after a timeout posts nothing twice (test).
  - done: impl-1415 · 2026-10-29T07:36:23.637Z
  - verified: rev-31 [reviewer] · run rev-20261029-1415-final1 · 2026-10-29T07:58:04.172Z · commit 01edfde09bd0e7ce49e976bcd2555b9b2d301039
  - verified: rev-31 [reviewer] · run rev-20261029-1415-final2 · 2026-10-29T08:59:11.411Z · commit 556c8740fa750e966bf2174d0d6253649aea41b0
- [x] C2. Twelve artifacts totalling 30 MiB arrive in several messages of at most 10 files and 25 MiB each, every artifact exactly once (test).
  - done: impl-1415 · 2026-10-29T07:26:57.172Z
  - verified: rev-31 [reviewer] · run rev-20261029-1415-final1 · 2026-10-29T07:58:04.172Z · commit 01edfde09bd0e7ce49e976bcd2555b9b2d301039
  - verified: rev-31 [reviewer] · run rev-20261029-1415-final2 · 2026-10-29T08:59:11.411Z · commit 556c8740fa750e966bf2174d0d6253649aea41b0
- [x] C3. A 21 MiB artifact arrives as one line naming it and its path (test).
  - done: impl-1415 · 2026-10-29T07:26:57.270Z
  - verified: rev-31 [reviewer] · run rev-20261029-1415-final1 · 2026-10-29T07:58:04.172Z · commit 01edfde09bd0e7ce49e976bcd2555b9b2d301039
  - verified: rev-31 [reviewer] · run rev-20261029-1415-final2 · 2026-10-29T08:59:11.411Z · commit 556c8740fa750e966bf2174d0d6253649aea41b0
- [x] C4. A photo sent from Telegram reaches the channel exactly once, captioned "you (Telegram)" (test).
  - done: impl-1415 · 2026-10-29T07:26:57.501Z
  - verified: rev-31 [reviewer] · run rev-20261029-1415-final1 · 2026-10-29T07:58:04.172Z · commit 01edfde09bd0e7ce49e976bcd2555b9b2d301039
  - verified: rev-31 [reviewer] · run rev-20261029-1415-final2 · 2026-10-29T08:59:11.411Z · commit 556c8740fa750e966bf2174d0d6253649aea41b0

## Notes

Shared files: discord-api.ts (multipart), discord-outbox.ts, discord.ts (General out)

## Comments

### coord · 2026-10-28T05:05:33.665Z

The human accepted the Coordinator's recommendation in ask 62b8d32f (2026-10-28 05:04Z, 'Да, все три рекомендации'). The pending note at the top of this item is resolved: build the behaviour as written; the hold is lifted and the ticket launches with its stage.

### impl-1415 · 2026-10-29T07:18:39.608Z

Consumer inventory before changes (rule 20): artifact-plan.ts is used by TelegramRemote/TelegramOutbox and telegram-artifacts tests; reuse unchanged limits interface, add Discord limits only. DiscordApi.createMessage callers: DiscordOutbox, DiscordRemote test/pairing notices, discord-api/messenger tests and fake exchange owner; add optional files/reference fields, retain JSON path for old callers. DiscordOutbox consumers: DiscordRemote, DiscordCards, discord-render/messages/cards tests; optional files provider preserves existing constructors and historical payloads. messengerFactory persistence.files is already used for Telegram; forward same provider to Discord. Persisted outbox readers in state/outbox/discord-outbox and tests retain old shapes; new optional file ids only. Frame clients (web/nvim/CLI), startup probes, shipped skills/QA briefs and T3/T4 consumers use unchanged frames and JSON create path, unaffected. New regression exercises existing JSON messages alongside multipart. Frozen skill changes will be proposed, not edited.

### impl-1415 · 2026-10-29T07:33:08.663Z

Source review corrections in progress: M1 per-test index omission reproduced with unchanged guard then fixed; M2 second-hub lifecycle now pre-owned through existing pacingOwner, raw result waiter owned/joined, omitted/aborted setup and omitted result controls added; M3 partial read failure reproduced then fixed using actual native attachment metadata for confirmed artifact ids, fallback settlement remains fenced and never claims sent above. Added independent 10-file boundary control. Local macOS targeted file now 12/12; no browser; all-workspace typecheck green on implementation corrections (before final extra test/docs). Holding replacement source request until reviewer consolidation.

### rev-31 · 2026-10-29T07:33:25.547Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1415-source1
commit: 2379a0f91e334c8c11c376d3256c0a59089d67d5
scope: full
findings: [{"severity":"medium","text":"M1: new discord-artifacts guide absent from owning index. Preserve test-docs guards and add exact Notes row with red/green evidence.","file":"docs/agents/tests/index.md"},{"severity":"medium","text":"M2: second projectHub acquisition and photo result waiter outside exchange acquisition/cancellation/join barrier; stop registered only afterwards. Pre-own late acquisition/result drainage before Store/root cleanup and add omitted/aborted controls. WaitFor already has default5000ms bound; unbounded claim withdrawn.","file":"hub/test/discord-artifacts.test.ts","line":117},{"severity":"medium","text":"M3: partial/text-only fallback marks job sent while all planned artifact ids remain reserved; repeats falsely claim '(sent above)' for unread file. Preserve once/nonce fences but record actual per-file delivery, with partial-read failure/repeat regression.","file":"hub/src/remote/discord-outbox.ts","line":237}]
finding_counts: {"high":0,"medium":3,"low":0}

A-13622 consolidated full source1 not clear: Standards2medium/Spec1medium,M1–M3 only. Existing descriptor/transaction/group/nonce paths otherwise sound; C2–C4 runtime-unverified. Reported local fixes and red/green remain outside reviewed head. Corrected M2 bound wording: frameClient.waitFor has5000ms, only owner/join gap remains. No Reviewer workload/Linux result/full task run/per-itemQA. Same-base fresh source before verification.

Criteria: C1 failed (A file omitted from native upload after read failure is later falsely reported as sent above.).

### rev-31 · 2026-10-29T07:36:14.977Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1415-source2
commit: 7d582af00c4b0c2a363995be0de351004626cedc
scope: full
findings: [{"severity":"medium","text":"M4: prepared artifact/name catalog is overwritten per delivery; accepted-uncertain multipart followed by missing file and same-nonce recovery loses original identity mapping, falsely recording delivered[]/not uploaded. Retain attempted identities across recovery; add native accepted-unknown stop/reopen changed-file control preserving nonce/once fence.","file":"hub/src/remote/discord-outbox.ts"}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13624 source2 not clear; M4 only. M1 guide index and M2 pre-owned second-hub/result cancellation/join corrected. Ordinary partial fallback per-file receipts and ten-file control added. Standards0/Spec1medium; source-identified recovery gap, no Reviewer red/workload/Linux claim. Local reported12/12/typecheck remain macOS. Same-base focused correction/fresh source before verify.

Criteria: C1 failed (Nonce reconciliation can forget an original accepted upload when retry overwrites its prepared-file catalog.).

### rev-31 · 2026-10-29T07:38:52.719Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1415-source3
commit: 01edfde09bd0e7ce49e976bcd2555b9b2d301039
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13627 source3 clear. M1–M4 resolved: immutable union of attempted artifact/name pairs survives missing-file nonce recovery; returned native attachments establish delivered ids, fallback remains fenced/not uploaded. Native sending snapshot control stops/joins old writer and observes handler drainage before unlink; recovered Store/outbox owned. Same base/no merge; original constraints/assertions retained. Local reported13/13/typecheck remain macOS, not Linux. C1–C4 runtime-unverified. No Reviewer workloads/full task run/per-itemQA requested.

### impl-1415 · 2026-10-29T07:55:05.204Z

Verification original receipt ac02a391-6517-46fc-b628-2030baf669de at exact 01edfde09bd0e7ce49e976bcd2555b9b2d301039: droplet Linux x64 (c-8 lon1), Node24.21.0, Neovim0.12.5, Chrome Headless Shell156.0.8078.4/v1248. T0/T1/T2/Web completed exit0; 4104 pass, 0 failures/skips/cancelled. Configured fallback all T2; T3/T4 not run. Original log A-13628 contains all 13 new case passes and each case's 5/5 load repetitions (65 passes). Highest individual new-case time, including repetitions:1.686801507 s; no new test reaches the 3 s allowance threshold. File aggregate4.278 s has missing baseline, not an individual test. Lint/duration gates report-only, with existing unrelated warnings; no enforce/timing-clear claim. Droplet lifetime848 s cost$0.0589. Final evidence review requested from Reviewer.

### rev-31 · 2026-10-29T07:58:04.172Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1415-final1
commit: 01edfde09bd0e7ce49e976bcd2555b9b2d301039
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear; C1–C4 verified at unchanged source3 head. A-13631 records original A-13628/ac02a391 audit: 4104 ordinary passes plus 105 separate load passes; all 13 new Discord artifact identities base+5/5 (65 task load samples), worst 1.686801507s, no allowance needed. T0/all T1/fallback all hub+Neovim T2/Web complete; T3/T4 absent. Native fake multipart/nonce/reopen/limit/fallback and real gateway artifact.upload assertions support the criteria within their recorded seam boundaries; no live platform or OS-crash claim. Linux c-8 lon1 Node24.21/Nvim0.12.5, pinned Headless Shell156/v1248; task workers2/Web4, reused host typecheck and report-only budget/lint limitations retained. Coordinator sequencing holds ready until T-1414 lands; this verdict does not cover the future dev merge/resolved head, which requires fresh delta source and mode-free runtime evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-31 · 2026-10-29T08:43:31.123Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1415-delta1
commit: 556c8740fa750e966bf2174d0d6253649aea41b0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13635 delta source clear, Standards0/Spec0. Coordinator-authorized merge of reviewed 01edfde09 and dev35108669 (T-1414 cd613880 plus tracker). Examined both-parent/combined diffs: multipart/nonce/mentions and inbound metadata/getMessage retained; media CDN/speech and outbound files both wired; fake preserves CDN plus multipart receipts/bytes. Outbox and artifact tests match prior source3 byte for byte, retaining M1–M4 corrections, unknown fence and batch priority. Docs/index/tiers retain both features. Confirmed T3 telegram-polling-restart→discord-cards-fixture→messengerFactory consumer. Reported203 local macOS passes/typecheck remain local, not Reviewer/Linux evidence. C1–C4 runtime marks await fresh merged-head configured evidence; previous A-13628/A-13631 remain historical. New mode-free verify may proceed unchanged; Coordinator owns required separate full-all before enqueue.

### rev-31 · 2026-10-29T08:59:11.411Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1415-final2
commit: 556c8740fa750e966bf2174d0d6253649aea41b0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13637 final merged-head evidence clear; C1–C4 verified. Independent original A-13636/ba79e138 typed audit: 4118 ordinary passes plus105 separate load passes, no nonpass/duplicates. All13 artifact identities each base+5/5 (65 task load samples), worst1.531372652s; incoming14 media cases and API/cards/messages/messenger/render/commands/pairing consumers all pass ordinarily. T0/allT1/fallbackallhub+NeovimT2/Web complete; T3/T4 absent. Linux c-8lon1 Node24.21/Nvim0.12.5, HeadlessShell156/v1248, taskworkers2/Web4. Reused host typecheck, report-only lint/durations, two missing baselines and original gateway/fake/snapshot seam limits retained. Prior01edfde09 evidence remains historical. Ready report may follow fresh conflict check; Coordinator owns separate full-all including T3 reachability before enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-29T09:45:35.866Z

Merged c99702b1adb1f873d79c6afb76ce5735eca74acb onto dev.
