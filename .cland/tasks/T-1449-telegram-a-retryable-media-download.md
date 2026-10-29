---
id: T-1449
kind: task
title: "Telegram: a retryable media download shows 'could not be stored; retrying' even when the retry succeeds"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1203
branch: t/T-1449-telegram-a-retryable-media-download
created: 2026-10-29T17:47:47.016Z
updated: 2026-10-29T18:10:32.227Z
---

## Summary

Found in the v0.3.0 live run (E-1314, QA qa-677, step L6, topic-1195, A-13884), on the real @cland_app_bot. The human sent a photo and saw «photo-142.jpg could not be stored; retrying». The retry then succeeded: exactly one A-2/photo-142.jpg in General, `artifact.upload` ok, and the image opens. The human's words: «в целом отправилось и координатор получил, но какое-то сообщение о том что запроцессить не смогло, возможно не важное». The warning comes from the retryable getFile/download error path (telegram.ts:513–524 at 189d5100). The actual error code wasn't captured.

## What to build

Don't alarm the human about a transient failure that recovers: send the "could not be stored" line only after the retries are exhausted. If an early notice is kept on purpose, edit it into the outcome once the retry succeeds. Record the retryable error's class and code in the hub log, with no token or URL, so the next one can be diagnosed.

## Acceptance criteria

- [x] C1. On the fake Bot API, a first `getFile` or download failure followed by success sends no failure line to the chat and stores the artifact once; the test fails before the fix.
  - done: impl-1449 · 2026-10-29T17:58:13.957Z
- [x] C2. Exhausted retries still send one clear failure line naming the file.
  - done: impl-1449 · 2026-10-29T17:58:14.075Z
- [x] C3. The hub log records the retryable error's class and code without token-bearing URLs.
  - done: impl-1449 · 2026-10-29T17:58:15.583Z

## Comments

### impl-1449 · 2026-10-29T17:54:18.828Z

Consumer search before retry-policy change: MediaQueue's process callback is used by TelegramRemote and DiscordRemote; no callback/wire/schema changes planned. Telegram #media catch and per-chat FIFO own this path; native API getFile/download retain their existing TelegramError shape. Consumers inspected: telegram-inbound/voice/albums, cards/polling restart/notices fixtures and guides, fake Bot API faults, telegram media README/spec sections, gateway upload recovery; no client/probe/skill examples consume transient media warning text (rg across hub, web, nvim, docs, .agents). Preserve queue input and legacy receipt shapes. Plan: persist per-file transient attempt count in Telegram state, maximum three attempts (two retries), log only static class/numeric code, terminal filename warning. No Discord change.

### impl-1449 · 2026-10-29T17:58:13.865Z

Local evidence and original red outputs summarized in A-13896 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13896-t-1449-implementation-and-local-evidence.md). One initial uncommitted full-file run: 43/44, aborted-setup clock.pending 1 !== 0. Unreproduced: identity alone 5/5 green each baseline/changed; full-file 3/3 green each baseline(41)/changed(44). Coordinator permits continuation; if same identity fails mode-free verification, stop/report shared-defect. Typecheck passed. Implementation committed a269a4f0e; awaiting T-1447 landing for pre-source-review dev merge.

### impl-1449 · 2026-10-29T17:59:06.224Z

Consumer inventory correction: production MediaQueue constructor is TelegramRemote only (plus the inbound test's queue handoff control); Discord media has its own implementation and is unaffected. Earlier note named DiscordRemote as a direct callback consumer incorrectly. rg confirms new telegram.media-failures state is adapter-private and read only by the generated test timing observer.

### rev-34 · 2026-10-29T18:08:50.776Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1449-source1
commit: 01bfc374a8e837f164c2a4a742092a1140c8522f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13910: Standards/Spec source clear. Persisted per-member three-failure bound suppresses recovered transient warnings, retains terminal command fence and queue progression; log emits fixed class/numeric code only. Fatal/cap/pairing/recovery paths and original assertions retained. Local 43/44 timer failure remains unreproduced with permitted differential evidence; Coordinator stop/report on repeat retained. C1–C3 runtime verification pending exact-head configured evidence, no Reviewer execution.

### rev-34 · 2026-10-29T18:10:32.227Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1449-source2
commit: 8dd1974869fc9b5972521b2f86dc6c16c5c31793
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13912: One retired duration baseline removed only; source1 behavior remains clear. Admission refusal executed no tiers and is retained separately. No fabricated replacement samples or changed allowances. C1–C3 runtime unverified; exact-head configured result and Coordinator repeat-failure stop/report condition remain.
