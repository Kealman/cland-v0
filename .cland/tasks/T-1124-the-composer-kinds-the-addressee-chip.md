---
id: T-1124
kind: task
title: "The composer: kinds, the addressee chip, keys and drafts"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1117
  - T-1119
topic: topic-892
branch: t/T-1124-the-composer-kinds-the-addressee-chip
created: 2026-10-22T15:16:13.780Z
updated: 2026-10-23T05:04:28.137Z
closed: 2026-10-23T05:04:28.137Z
---

## Summary

A composer at the foot of every thread chooses Message, Decision or Question and the addressee as a chip, attaches an artifact with `~`, sends with Enter or `⌘Enter`, keeps a draft per topic in the browser and disables Send while the hub is offline.

## Parent

E-417 (§3.4 the composer; v0.1.2 §3.8 addressing; P16; tracer step 4).

## What to build

The kind is a segmented control (P16) sent as the hub's kind. The addressee is a chip: the Coordinator by default in an item's topic; typing `@` picks a session to address instead (the palette's session results); with no chip the hub's own addressing applies, as in Neovim (v0.1.2 §3.8). `~` picks an artifact the message carries as its chip. Enter sends a one-line message, Shift+Enter breaks the line, and `⌘Enter` always sends; in a draft of more than one line Enter breaks the line too. `⌘K` in the composer still opens the palette and keeps the draft. These keys are the composer context's bindings in the one key map. The draft is kept per topic in the browser and survives a disconnection and a reload; Send and the send keys are disabled while the hub is offline, and nothing is queued in the browser. A sent message is shown pending until the hub's receipt; a refusal puts the text back. Writing marks the topic read up to the sent message.

## Acceptance criteria

- [x] C1. The composer sends a Message, a Decision and a Question, and both the thread and a frame client read each with its kind (Web test).
  - done: impl-1124 · 2026-10-23T04:46:38.988Z
  - verified: rev-23 [reviewer] · run rev-20261023-1124-final · 2026-10-23T04:59:47.446Z · commit e4a66b9650181ced03c9246ac92ed0f30d99fca2
- [x] C2. In an item's topic the chip names the Coordinator and the fake Coordinator receives the message; `@` replaces the chip with a chosen session, which receives the next one (Web test).
  - done: impl-1124 · 2026-10-23T04:46:39.092Z
  - verified: rev-23 [reviewer] · run rev-20261023-1124-final · 2026-10-23T04:59:47.447Z · commit e4a66b9650181ced03c9246ac92ed0f30d99fca2
- [x] C3. Enter sends a one-line draft, Shift+Enter breaks the line, `⌘Enter` sends a multi-line draft, and `⌘K` opens the palette with the draft kept (Web test).
  - done: impl-1124 · 2026-10-23T04:46:39.171Z
  - verified: rev-23 [reviewer] · run rev-20261023-1124-final · 2026-10-23T04:59:47.447Z · commit e4a66b9650181ced03c9246ac92ed0f30d99fca2
- [x] C4. `~` attaches a chosen artifact, and the received message carries it (Web test).
  - done: impl-1124 · 2026-10-23T04:46:39.250Z
  - verified: rev-23 [reviewer] · run rev-20261023-1124-final · 2026-10-23T04:59:47.447Z · commit e4a66b9650181ced03c9246ac92ed0f30d99fca2
- [x] C5. A draft survives a reload and a hub disconnection per topic, Send is disabled while the hub is offline, and writing marks the topic read up to the sent message (Web test).
  - done: impl-1124 · 2026-10-23T04:46:39.426Z
  - verified: rev-23 [reviewer] · run rev-20261023-1124-final · 2026-10-23T04:59:47.447Z · commit e4a66b9650181ced03c9246ac92ed0f30d99fca2

## Comments

### impl-1124 · 2026-10-23T04:45:49.515Z

Implemented TDD slices at the sealed Web/peer-frame seam: three human kinds; default Coordinator role chip and @ session selection/removal; physical Enter/newline/command Enter/palette focus; same-topic available artifact chips and older inventory pages; per-topic reload/offline drafts with no replay; pending success/refusal and newer-typing preservation. T-1123 was observed on origin/dev at ac6f75a8 before code. Latest origin/dev merged before first source review; no source review requested yet. Initial macOS/local eight composer scenarios and the 41-test required/broader regression set passed on the implementation tree; exact final-head check and targeted runs are running. No passing composer identity sample has reached 4 s, so no allowance added. Rule proposal and design evidence in A-9829/topic.

### rev-23 · 2026-10-23T04:49:21.075Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1124-source
commit: e4a66b9650181ced03c9246ac92ed0f30d99fca2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, no findings. A-9834 records Standards/Spec audits of shared Thread composer, kinds and role/session chips, physical keys/palette/native button behavior, bounded available-artifact picker, per-topic pending/reload/offline drafts and real receipt/refusal tests. Offline/pending guards and existing hub read-through-sent-message semantics preserved; docs/skill provenance/tier match shipped behavior. A-9833 local check/28-target summary supports source only, not configured evidence; earlier41 is pre-final-tree. C1–C5 runtime remains unverified. Proceed with exact-head mode-free verification, retaining original raw check/targeted receipts and actual new-Web timing samples. No source change without fresh review; after-stage affected QA separate.

### impl-1124 · 2026-10-23T04:59:35.173Z

Exact reviewed-head mode-free verify fdcc1532 passed at e4a66b9650181ced03c9246ac92ed0f30d99fca2 (A-9838): Linux x64 droplet c-8 lon1, T1 + fallback all hub/Neovim T2 + Web; 2665 ordinary tests passed, 0 failures/skips/cancellations. Host gate reused at canonical tree 5ac7f218 (not repeated); generic duration and test-lint gates report-only. Eight composer timing samples max 2.58403134 s, none ≥4 s, no allowance needed. T3 deferred to periodic dev/integrated occasions and T4 absent. Droplet lifetime 528 s, cost $0.0366; phase durations in raw receipt are not substituted for overall wall. Fresh origin/dev b4640424 merge-tree conflict check clean, reviewed HEAD and working tree unchanged. Original exact-head local command stdout/exits preserved in A-9835. Final Reviewer evidence verdict pending; affected after-stage QA remains with E-417.

### rev-23 · 2026-10-23T04:59:47.447Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1124-final
commit: e4a66b9650181ced03c9246ac92ed0f30d99fca2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear C1–C5, no findings. A-9839: exact-head Linux A-9838/fdcc1532 passes2665 ordinary tests,397 files,0 fail/skip/cancel; T1 + all-T2 fallback both packages + Web. All eight composer cases pass, max2.584031340s below4s allowance trigger. Routing/kinds/physical keys/artifact/readSeq/draft/offline and held receipt/refusal assertions establish criteria. Host check reused, generic budgets/lint/ratchet report-only; missing baselines retained, no T3/T4 or load repetitions. A-9835 original macOS check/28 targets supports source, explicitly overlapping commands/not quiet-machine timing. Source A-9834 stands; after-stage affected QA separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-23T05:04:28.137Z

Merged aecd057df49faf219b856f9309581675fa5af040 onto dev.
