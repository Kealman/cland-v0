---
id: T-1390
kind: task
title: A voice reply to a card, or a voice note after "Other answer…" or "Decline…", answers the ask
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1388
topic: topic-1159
branch: t/T-1390-a-voice-reply-to-a-card-or-a-voice-note
created: 2026-10-27T23:37:28.501Z
updated: 2026-10-28T19:49:04.750Z
---

> Pending: the voice-reply behaviour below is the Coordinator's recommendation awaiting the human's answer to ask 62b8d32f; do not launch before it is answered.

## Summary

A voice note that replies to an open ask's card, or that comes while E-1310's prompt waits, answers the ask with its transcript under the rules for a typed reply, with `via = "telegram"`. When it cannot answer, the ask stays open and the chat gets one line.

## What to build

When a voice note targets a card or a waiting prompt, the pipeline runs as in ticket 08, but the transcript goes through the same path as text: `TelegramPrompts`'s answer, never a General message.
- A free-answer ask takes the transcript as its text, and a decline prompt takes it as the reason.
- An options-only card accepts an option's number or an option's text, matched ignoring case and trailing punctuation. Anything else gets E-1310's note.
- The echo replies to the note with the transcript and "answered", and the card's outcome edit follows as for any answer.

When the note cannot answer (no key, off, a failure, nothing recognised or no match), the ask stays open and the chat gets one line. The audio follows the recommended reading in the assumptions (open): an answering note keeps no artifact, and a note that cannot answer goes to General as an ordinary 🎤 message. A late note never answers (E-1310 ticket 05's rule). Spec §3.6 ("a voice reply to a card answers its ask") and §3.5.

## Acceptance criteria

- [x] C1. A voice reply to a free-answer card answers the ask with the transcript "via Telegram", the card is edited to its outcome, and the transcript is not posted to General (test).
  - done: impl-1390 · 2026-10-28T19:24:47.000Z
- [x] C2. A voice note after "Decline…" records the decline with the transcript as the reason, and a voice reply "Second." to an options-only card whose second option is "second" answers option 2 (test).
  - done: impl-1390 · 2026-10-28T19:32:06.874Z
- [x] C3. A voice reply to a card while the fake provider fails leaves the ask open with its buttons, the chat gets one line, and the audio reaches General as a "🎤 not transcribed" message (test).
  - done: impl-1390 · 2026-10-28T19:24:48.532Z

## Notes

Shared files: hub/src/remote/telegram-prompts.ts, hub/src/remote/telegram.ts, hub/src/remote/voice.ts

## Comments

### coord · 2026-10-28T05:05:33.221Z

The human accepted the Coordinator's recommendation in ask 62b8d32f (2026-10-28 05:04Z, 'Да, все три рекомендации'). The pending note at the top of this item is resolved: build the behaviour as written; the hold is lifted and the ticket launches with its stage.

### impl-1390 · 2026-10-28T19:22:03.363Z

Consumer search before changes: telegram-prompts.ts is constructed only by telegram.ts; its handler is consumed in that update chain, TelegramCards uses prepare/publish/cancel. VoiceNote is called only by telegram.ts; tests use production factory via telegram-voice-fixture.ts and telegram-voice.test.ts/telegram-voice-command.test.ts. Related coverage: telegram-cards.test.ts (typed answers/prompts/late/replay), telegram-inbound.test.ts (receipt recovery), media queue/telegram albums; Discord uses separate prompts/media. No public wire shape or authority change: preserve topic.answer, RemoteIngress, legacy receipts and optional factories. New voice outcome/target persistence is private additive metadata, old records remain readable. Docs consumers: hub README voice/prompts, docs/agents/tests voice guide, remote command help, GLOSSARY Transcript. Shipped skills/QA briefs/startup probes do not consume private prompt routing or voiceNote result. TDD seam: production factory, frame ask/history/artifact listing and fake native card/echo/provider receipts.

### rev-34 · 2026-10-28T19:31:02.101Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1390-source1
commit: 425b4a78223dae2b8cc3aad59398eb51afee5410
scope: full
findings: [{"severity":"medium","text":"M1: The new per-test guide is absent from docs/agents/tests/index.md. The unchanged test-docs membership guard requires a Notes row for every document and rejects this head. Add the owning index row; preserve the guard.","file":"docs/agents/tests/hub-test-telegram-voice-answers.test.ts.md","line":1},{"severity":"medium","text":"M2: captureVoice excludes late input only when it has no explicit reply. A late voice reply to an open card still calls topic.answer, contrary to the task's 'A late note never answers' rule. Refuse every late voice target, retain the typed-reply policy, update the voice README wording and add a native late-card regression.","file":"hub/src/remote/telegram-prompts.ts","line":81},{"severity":"medium","text":"M3: Voice target/absence is captured only when #mediaInput reaches the queued row. With earlier media held, a voice admitted while prompt A waits can be retargeted to prompt B after a later Other/Decline press. Freeze target or absence synchronously at update admission and cover the held-media/two-prompt ordering.","file":"hub/src/remote/telegram.ts","line":338},{"severity":"medium","text":"M4: Voice numeric options are parsed before trailing-punctuation normalization. Transcript '2.' with options ['first', 'second'] fails the number regex and then compares only against option text, so it falls back to General. Normalize voice number and text matching consistently and add the numeric-punctuation case, preserving typed parsing.","file":"hub/src/remote/telegram-prompts.ts","line":113}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source review is not clear. A-13426 records Standards M1 (missing guide index row) and Spec M2–M4 (late explicit voice answers, target captured after media queue delay, numeric punctuation mismatch). Trusted gateway.answer receipt recovery was traced and is not an additional finding. C1/C3 remain unverified; no configured run or Reviewer-executed tests. Correct these findings and request fresh source review before verification.

Criteria: C2 failed (Queued waiting-prompt voice may answer a later ask; voice numeric options with trailing punctuation are not accepted.).

### rev-34 · 2026-10-28T19:33:07.351Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1390-source2
commit: 0e15cf5004430a5853e4df255970a3f422cd0fe2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source is clear. A-13427 closes M1–M4: exact Notes row, all-late voice refusal, target/absence persisted synchronously at admission, voice numeric/text punctuation normalization. Original typed behavior and seven cases retained; four new native controls cover late/numeric/FIFO/absence. No configured runtime evidence yet; C1–C3 remain unverified. Preserve original correction outputs and request final evidence audit after one same-head mode-free run. T-1389 merge/head changes require fresh review.

### rev-34 · 2026-10-28T19:49:04.750Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1390-evidence1
commit: 0e15cf5004430a5853e4df255970a3f422cd0fe2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Current-head configured evidence clear, not final ready. A-13435 independently audits A-13434: 3991 ordinary/503 file passes, 55 task-owned load passes (all 11 identities 5/5) plus 25 unrelated site load passes. T0/T1/all fallback T2/Web complete, no T3/T4; host prepared-tree typecheck reused, runtime trees match. C1–C3 assertion evidence is present at this head, but verification/ready marks are intentionally deferred because Coordinator 5cbd1ba5 requires the semantic T-1389 merge, delta source review and a new-head run. No new findings. Parent evidence cannot cover that future resolution.
