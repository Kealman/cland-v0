---
id: T-1448
kind: task
title: "Discord: a General message that re-attaches an already-sent artifact loses its own text"
state: closed
status: done
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
updated: 2026-10-29T18:41:00.427Z
closed: 2026-10-29T18:41:00.427Z
---

## Summary

Found aside by impl-1447 while building T-1447 (topic-1201, A-13859). When a General message re-attaches an artifact already sent to Discord, the once-per-remote reference path posts only the header and the `▣ A-n … (sent above)` line. The message's own text or short caption is dropped whenever `artifactPlan` coalesces the caption. Telegram's behaviour should be checked the same way.

## What to build

The previous-artifact branch of Discord's publication renders the message text, then the sent-above reference line. Check Telegram's equivalent path too, and fix it if it drops text.

## Acceptance criteria

- [x] C1. On the fake Discord, a General message with text plus an already-sent artifact posts the text and one sent-above reference line; the test fails before the fix.
  - done: impl-1448 · 2026-10-29T17:42:18.901Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1448-final · 2026-10-29T18:29:48.679Z · commit 319933e251b3e8979344349b23eccfe7f363225e
- [x] C2. Telegram's equivalent case is covered by a test, fixed if it also drops the text.
  - done: impl-1448 · 2026-10-29T17:42:19.346Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1448-final · 2026-10-29T18:29:48.679Z · commit 319933e251b3e8979344349b23eccfe7f363225e

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

### impl-1448 · 2026-10-29T18:27:56.292Z

Original mode-free verification c838c879 passed at unchanged source-reviewed 319933e25. A-13941: Linux droplet, T0/T1/T2/Web completed, 4190 pass, 0 fail; fallback all T2, T3 deferred by configured policy (no changed T3/T4). Chrome Headless Shell 156.0.8078.4 v1248. Lint/duration gates report-only. C1 exact test 'Discord repeated single artifact preserves the new short caption before one sent-above reference' pass 0.1564s; C2 Telegram equivalent pass 0.2801s; five load repetitions each all pass, maximum 0.5196s, so no new >=3s test allowance needed. Executor lifetime 932s/cost $0.0647. Final evidence review requested/queued against original log; no head changes.

### rev-34 · 2026-10-29T18:29:48.679Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1448-final
commit: 319933e251b3e8979344349b23eccfe7f363225e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13947: Original A-13941 independently confirms 4190 ordinary passes plus 10 item-owned/75 site load passes. Discord/Telegram caption-reference cases each ordinary+5/5 load, exact text/reference/no-reupload assertions retained. C1/C2 verified; host reuse, platform/browser limits, report-only diagnostics and unrun T3/T4 retained. Coordinator owns integration/enqueue.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T18:41:00.427Z

Merged 93b2333ce7fad1514dff3f173ef74eab950abb44 onto dev.
