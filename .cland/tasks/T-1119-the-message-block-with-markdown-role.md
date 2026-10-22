---
id: T-1119
kind: task
title: The message block with Markdown, role colours, verdicts and chips
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1118
  - T-1116
topic: topic-871
branch: t/T-1119-the-message-block-with-markdown-role
created: 2026-10-22T15:16:12.897Z
updated: 2026-10-22T23:26:31.014Z
---

## Summary

Every message in the thread becomes the message block of P12: a header over a Markdown body, the role colour in its own gutter, the human's band, dimmed watch messages, verdicts with their criteria marks and artifact chips.

## Parent

E-417 (§3.4 and v0.1 §3.14; P12; tracer step 1).

## What to build

The header carries the sender, the role in its colour, the addressees, the kind (an agent's send kind and the human's Message, Decision or Question once the hub carries it), the time and the delivery stage or waiting state at the right. The role colour is a 3 px bar in its own gutter running down the whole message; the human's and an Aide's messages sit on a band spanning the row (an Aide's bar dashed); no message is a boxed card. Watch-layer messages (the Coordinator's reports, a clear verdict) are dimmed. A verdict shows its result in red or green with the criteria it marked and a failed criterion's note; a clear verdict takes one row. A date line appears when the day changes. The body renders the Markdown parser's tokens as React elements: code blocks inset in the band with their language label, lists aligned, links underlined and opening outside the page (`target="_blank"`, `rel="noopener noreferrer"`), item ids as links that open the item and never break at the hyphen. An artifact posted with a message, and a file or folder artifact, shows as a chip naming its id, kind and title; an HTML artifact also shows as a chip until the inline ticket. Role colours are the build's (`hl.lua`) through tokens in `tokens.css`, and secondary text keeps 4.5:1.

## Acceptance criteria

- [x] C1. A message shows the P12 header (sender, role in its colour, addressees, kind, time, delivery stage) over its body, with the role colour as a 3 px bar in its own gutter (Web test).
  - done: impl-1119 · 2026-10-22T23:18:48.301Z
- [x] C2. The human's messages sit on a band, a watch-layer message is dimmed, and a not-clear verdict shows its result with its criteria marks and the failed criterion's note (Web test).
  - done: impl-1119 · 2026-10-22T23:18:48.392Z
- [x] C3. Markdown in a message renders headings, lists, code blocks and links, links open outside the page, and HTML in a message shows as text with no element from it in the DOM (Web test).
  - done: impl-1119 · 2026-10-22T23:18:48.585Z
- [x] C4. Item ids in a body are links that open the item and stay on one line at the hyphen, and artifact, file and folder posts show as chips (Web test).
  - done: impl-1119 · 2026-10-22T23:23:48.198Z

## Comments

### impl-1119 · 2026-10-22T23:18:48.762Z

Implemented P12 at 3d3479f5837ddd499e60bf274429ef666e80a390; pushed branch t/T-1119-the-message-block-with-markdown-role to local origin after merging origin/dev 52657840. C1–C4 have test-first Web evidence; latest targeted macOS checks: messages 4/4 (2.413s file process), topics 9/9 (5.771s), parser T1 7/7 (0.080s), typecheck/build and report-only test lint (0 refusals) passed. Full verification waits for source review. One intermittent Retry visibility failure was reported to lead T-1119 with preserved trace; isolated/full reruns passed unchanged bounds.

### rev-31 · 2026-10-22T23:21:36.174Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261023-1119-source
commit: 3d3479f5837ddd499e60bf274429ef666e80a390
scope: full
findings: [{"severity":"medium","text":"M1: Normal agent `review clear T-123` reports lack detail.item; clear rendering suppresses the body and therefore drops T-123 and its navigation link. Retain the target in the one-row summary and cover public agent-send navigation.","file":"web/src/MessageBlock.tsx","line":33}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-9500. Standards0 findings; Spec M1medium at MessageBlock.tsx:33/37: recognized agent clear reports lose their only target item when body is hidden. Preserve one-row layout and whole-item navigation, add public agent-send regression. Structured hub verdict case currently masks gap. Other criteria await corrected source and same-head configured runtime; no test/browser execution by Reviewer. Preserve original command/stdout/exit/timing/source receipts without transcription reruns.

Criteria: C4 failed (Compact agent clear reports suppress their body while reading target only from absent detail.item, losing item ID and navigation.).

### impl-1119 · 2026-10-22T23:23:48.296Z

Corrected source finding M1 at 96e3d2b558c212ae67f6002bb0bb5e3237777214 (tree 92dbc055ea939a2830b549805ac951caa3668e0a): compact agent clear verdicts retain their first-line summary, whole target id and item navigation. Public Reviewer→Coordinator send Web regression observed red (target count 0 vs 1), then all 5 message cases green. Original fix-loop stdout/stderr/exit/timing/source-diff files preserved as an artifact; macOS local targeted messages 5/5 (2.782s subprocess), Web typecheck and build passed. No dev merge after first review; no verification submitted before corrected source review.

### rev-31 · 2026-10-22T23:26:31.014Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261023-1119-source2
commit: 96e3d2b558c212ae67f6002bb0bb5e3237777214
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-9518. Standards0/Spec0; M1 closed by retaining agent clear first-line ItemText in compact header with real send→render→item navigation regression, structured verdict/criteria coverage unchanged. A-9510 raw product red and5/5 green/commands/exits/timings/source patch audited, initial permission setup failure excluded. All C1-C4 are Web-run-dependent and remain unverified until exact-head configured mode-free result. No dev merge after review, no merge enqueue.
