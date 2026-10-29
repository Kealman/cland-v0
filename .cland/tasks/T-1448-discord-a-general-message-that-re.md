---
id: T-1448
kind: task
title: "Discord: a General message that re-attaches an already-sent artifact loses its own text"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1202
branch: t/T-1448-discord-a-general-message-that-re
created: 2026-10-29T17:29:53.831Z
updated: 2026-10-29T18:10:31.079Z
---

## Summary

Found aside by impl-1447 while building T-1447 (topic-1201, A-13859). When a General message re-attaches an artifact already sent to Discord, the once-per-remote reference path posts only the header and the `▣ A-n … (sent above)` line. The message's own text or short caption is dropped whenever `artifactPlan` coalesces the caption. Telegram's behaviour should be checked the same way.

## What to build

The previous-artifact branch of Discord's publication renders the message text, then the sent-above reference line. Check Telegram's equivalent path too, and fix it if it drops text.

## Acceptance criteria

- [x] C1. On the fake Discord, a General message with text plus an already-sent artifact posts the text and one sent-above reference line; the test fails before the fix.
  - done: impl-1448 · 2026-10-29T17:42:18.901Z
- [x] C2. Telegram's equivalent case is covered by a test, fixed if it also drops the text.
  - done: impl-1448 · 2026-10-29T17:42:19.346Z

## Comments

### impl-1448 · 2026-10-29T17:40:14.136Z

Plan: production-frame/fake Discord regression for one short-caption artifact first sent, then attached again; Telegram equivalent regression. Production target is hub/src/remote/discord-outbox.ts (previous-artifact branch). No frame/schema/admission change anticipated; preserve stored payload shapes and once-per-remote delivery. Read E-1444, v0.3 §§3.4/3.6, remote/artifact glossary and both artifact test guides. T-1447 lands first; merge before first source review.

### impl-1448 · 2026-10-29T18:07:31.229Z

Merged origin/dev (includes landed T-1446/T-1447) into 319933e251b3e8979344349b23eccfe7f363225e. Shared previous-artifact conflict resolved retaining T-1447 explicit reply target precedence, including unmapped fallback; inspected Telegram file replyRequested/options and caption retention. At merged head, macOS local T2 discord-artifacts 14/14 and telegram-artifacts 15/15 passed sequentially. Only production delta versus dev: hub/src/remote/discord-outbox.ts. C1 prior red and green recorded in A-13878; C2 Telegram required no production fix. No SKILL.md edits, added dependencies, frames/schema or admission changes.

### rev-34 · 2026-10-29T18:10:31.079Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1448-source1
commit: 319933e251b3e8979344349b23eccfe7f363225e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13911: Standards/Spec source clear. Coalesced caption text retained exactly once before reference, bounded render/group/once fence and T-1447 explicit-reply precedence preserved. Native Discord red/green and Telegram unchanged compatibility controls retained with existing owners. C1/C2 runtime unverified; local macOS receipts only.
