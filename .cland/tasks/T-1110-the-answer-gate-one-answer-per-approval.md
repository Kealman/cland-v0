---
id: T-1110
kind: task
title: "The answer gate: one answer per approval, and the first wins"
state: open
status: ready
size: M
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1109
topic: topic-856
branch: t/T-1110-the-answer-gate-one-answer-per-approval
created: 2026-10-22T15:16:11.165Z
updated: 2026-10-22T16:46:56.117Z
---

## Summary

Add the human's answer to an approval, `approval.answer`, behind one gate in the hub. The first answer from any client wins, a later one is refused naming who answered and when, and nothing answers by default.

## Parent

E-414 (§3.4 "One gate for answers"; the choices, "No answer by default" and "Losing the race"; split from tracer steps 2 and 4).

## What to build

A human client, Neovim or the browser through the web edge, sends `approval.answer` with the record, a choice and an optional note. The choice is Approve once, Always for this command, or Deny with a note. The hub accepts the answer only for a pending record answered in the hub, and only with a choice the record offers. In the same turn it marks the record `answering` with who answered, from where and when, so any later answer is refused with those facts. The hub then hands the answer to the adapter through a new optional contract method, which answers one request with a choice and a note.

When the adapter confirms, the record closes with the outcome, and every client receives the closed record. When the adapter cannot deliver the answer, the record returns to `pending`, the answering client is refused with the reason, and a warn-level event is journaled. A Deny is never turned into an approval. Where the adapter's protocol carries a note, the note goes with the answer. Otherwise the hub posts the note into the session's topic (its item's topic, else General) as the human's message to that session.

A record answered in the TUI refuses answers and says where to answer. An agent session's answer is refused: only the human answers a command approval. The web edge's authority table lists the frame as allowed. Nothing answers on a timer or by default: a record waits until a client or the harness answers it, or the harness withdraws it.

The in-process fake adapter gets a scripted answer path (accept, fail, hold), so the gate is proven without a harness. Splitting the gate out of the relays gives the Codex and OpenCode relays one gate to plug into, so they can run in parallel.

## Acceptance criteria

- [x] C1. A frame client's Approve once on a fake adapter's request reaches the adapter once. Both that client and a second frame client read the record closed as "once", by the human, with where and when (test).
  - done: impl-1110 · 2026-10-22T16:35:15.428Z
  - verified: rev-23 [reviewer] · run rev-20261022-1110-final-2 · 2026-10-22T16:46:55.762Z · commit fd6434b588a1938c5dd70b049ff3a426d6d21ce7
- [x] C2. When two frame clients answer the same request in one tick, the adapter gets one answer and one outcome is recorded. The second client is refused with who answered and when (test).
  - done: impl-1110 · 2026-10-22T16:35:15.508Z
  - verified: rev-23 [reviewer] · run rev-20261022-1110-final-2 · 2026-10-22T16:46:55.762Z · commit fd6434b588a1938c5dd70b049ff3a426d6d21ce7
- [x] C3. An answer is refused, and the record left unchanged, when its choice is not offered, when the record is closed, or when the record is answered in the TUI (test).
  - done: impl-1110 · 2026-10-22T16:35:15.587Z
  - verified: rev-23 [reviewer] · run rev-20261022-1110-final-2 · 2026-10-22T16:46:55.762Z · commit fd6434b588a1938c5dd70b049ff3a426d6d21ce7
- [x] C4. An agent session's `approval.answer` is refused, and a browser client holding the cookie answers through the web edge (test).
  - done: impl-1110 · 2026-10-22T16:35:15.668Z
  - verified: rev-23 [reviewer] · run rev-20261022-1110-final-2 · 2026-10-22T16:46:55.762Z · commit fd6434b588a1938c5dd70b049ff3a426d6d21ce7
- [x] C5. When the adapter fails to deliver an answer, the record returns to pending, the client is refused with the reason, and a warn-level event is journaled (test).
  - done: impl-1110 · 2026-10-22T16:35:15.847Z
  - verified: rev-23 [reviewer] · run rev-20261022-1110-final-2 · 2026-10-22T16:46:55.762Z · commit fd6434b588a1938c5dd70b049ff3a426d6d21ce7
- [x] C6. Deny with a note, to an adapter whose protocol carries no note, delivers a deny to the adapter and posts the note into the session's topic as the human's message to that session (test).
  - done: impl-1110 · 2026-10-22T16:35:15.930Z
  - verified: rev-23 [reviewer] · run rev-20261022-1110-final-2 · 2026-10-22T16:46:55.762Z · commit fd6434b588a1938c5dd70b049ff3a426d6d21ce7
- [x] C7. A pending request stays pending with no answer sent to the adapter after the fake clock advances 24 hours (test).
  - done: impl-1110 · 2026-10-22T16:35:16.005Z
  - verified: rev-23 [reviewer] · run rev-20261022-1110-final-2 · 2026-10-22T16:46:55.762Z · commit fd6434b588a1938c5dd70b049ff3a426d6d21ce7
- [x] C8. `hub/README.md` describes `approval.answer`, the gate, the refusal naming the winner and the rule that nothing answers by default (docs).
  - done: impl-1110 · 2026-10-22T16:09:13.913Z
  - verified: rev-23 [reviewer] · run rev-20261022-1110-source-2 · 2026-10-22T16:15:28.281Z · commit 48e798b0b99412920361c454069475768308d5fe
  - verified: rev-23 [reviewer] · run rev-20261022-1110-final · 2026-10-22T16:23:11.489Z · commit 48e798b0b99412920361c454069475768308d5fe
  - verified: rev-23 [reviewer] · run rev-20261022-1110-source-3 · 2026-10-22T16:26:05.529Z · commit b0df2398e60b11878f43b6044c85576bca26b33f
  - verified: rev-23 [reviewer] · run rev-20261022-1110-source-4 · 2026-10-22T16:35:50.260Z · commit fd6434b588a1938c5dd70b049ff3a426d6d21ce7
  - verified: rev-23 [reviewer] · run rev-20261022-1110-final-2 · 2026-10-22T16:46:55.762Z · commit fd6434b588a1938c5dd70b049ff3a426d6d21ce7

## Comments

### impl-1110 · 2026-10-22T16:08:30.642Z

Implemented test-first on the pre-agreed sealed frame/fake-adapter seam. Human approval.answer reserves answering synchronously, refuses later answers with winner attribution, confirms once through the optional adapter contract, returns failed delivery to pending with a warn journal event, and routes unsupported native notes as human messages to the item topic or General. All agent roles including Aides remain refused; authenticated web-cookie coverage added. No default/timer answer, native close confirmation idempotence, and session-scoped native ids covered. Local macOS targeted approval-records (16 tests), clock (12), web-authority (33) passed on the work-in-progress tree; root npm run check passed (test lint remains report-only). Source review and queued task verification still pending.

### rev-23 · 2026-10-22T16:13:19.430Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1110-source
commit: 6fe5e26cf1d902113d78f5f1e18521126256da54
scope: full
findings: [{"severity":"medium","text":"M1/C6: fallback human-message size validation can throw only after adapter confirmation and record closure, losing the note and reporting failure after an irreversible answer. Preflight before delivery or robustly preserve successful answer/fallback semantics; cover over-cap note.","file":"hub/src/hub/inbox.ts","line":403}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear at6fe5e26c (baseefb73153). Standards0; Spec M1medium at inbox.ts:403: arbitrary-length note accepted, then optional fallback sendFromHuman executes after confirmed adapter answer/#closeApproval; configured cap(default8192UTF-8bytes) can throw, losing note and returning refusal for already-closed deny. Preflight applicable constraints or preserve successful answer/fallback semantics and add regression. Implementer accepted M1. Other human-only/common Web gate, synchronous reservation, race attribution, conditional failure reset/warn journal, session-scoped native identity, no defaults and documented seams inspected without further findings. Shared FakeClock overdue-interval correction and pure regression inspected;24 targeted importer checks reported local macOS supporting evidence, not queued suite. C1–C7 runtime evidence and C8 source mark await corrected-head clear; no Reviewer execution. Fresh source review before verification.

Criteria: C6 failed (Fallback note above human-message cap is refused after adapter answer/closure, leaving no note and no retry.).

### rev-23 · 2026-10-22T16:15:28.281Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1110-source-2
commit: 48e798b0b99412920361c454069475768308d5fe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at48e798b0/treec26a7716, continuation of full audit6fe5e26c/A-9284; no dev merge. M1 resolved: existing configured UTF-8 Hygiene size preflight runs before outcome/reservation/native delivery. Regression default8192/custom1024 caps checks multibyte cap+4bytes refusal, no adapter invocation, unchanged pending record and successful corrected deny/human note retry. TS-narrowing-only followup preserves assertions. C8 matching README/fixtures docs verified; original authority/race/failure/default/shared FakeClock scope unchanged. Standards0/Spec0 remaining findings; no Reviewer execution. C1–C7 await exact-head mode-free receipt/load proofs. A-9283 local24file importer summary and A-9286 implementation-candidate narrative remain qualified supporting evidence, not queued suite or native-harness proof.

Criteria: C8 verified.

### rev-23 · 2026-10-22T16:23:11.489Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1110-final
commit: 48e798b0b99412920361c454069475768308d5fe
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear from A-9296/96a904f7 plus corrected source A-9288. Parsed2480ordinary test passes/378file passes,0fail/cancel/skip. Thirteen new identities each5 distinct load passes+explicit5/5 (65 total), max0.689352167s. Approval-records18/18 covers two-client winner/late refusal/TUI/unoffered/all-agent refusal/fail-pending-warn/note fallback/default+custom cap corrected retry/24virtual-hour no default/native-close attribution. Authenticated-cookie gate33/33file and authority-unit4/4, clock12/12/project-clock4/4 inspected; C8 docs refreshed. Actual local Darwin arm64 Node24.21.0/Neovim0.12.5 after automatic c-8 capacity fallback; local host check/allT1/fallback allT2 both packages/actualWeb exit0, T2workers4/Web2. Report-only lint/duration/ratchet/5missing baselines retained; no Linux,T3/T4,Web repetition,native relay,QA/full-cover or enforcing-budget claim. Standards0/Spec0 remaining; C1–C8 verified; after-stage QA/landing Coordinator-owned.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### rev-23 · 2026-10-22T16:26:05.529Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1110-source-3
commit: b0df2398e60b11878f43b6044c85576bca26b33f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear atb0df2398/tree2739475d over accepted48e798b0+incoming31bd45bc. Conflict resolutions preserve every skill provenance entry and both guidance paragraphs; web-authority tests retain approval cookie/late-attribution and incoming decision/withdrawal cases. Authority keeps approval.answer plus topic.send/withdraw and original own-as/unknown/prototype/CLI-only refusals. Inbox approval gate/preflight/contract/approval tests/FakeClock files byte-unchanged; incoming human-message kind/busy/withdrawal fences inspected at fallback note intersection without issue. Standards0/Spec0. C8 refreshed; C1–C7 final marks await exact-head new mode-free receipt. Old A-9296 is historical head evidence, local merged-head targeted claims qualified; no Reviewer execution or new QA/suite claim.

Criteria: C8 verified.

### rev-23 · 2026-10-22T16:34:57.033Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1110-duration-evidence
commit: b0df2398e60b11878f43b6044c85576bca26b33f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head8d77765b/A-9318 not clear: actual item-summary-scale enforced whole-test gates `planned startup batches...6.002s>5s` and `planned hub serves...6.606s>5s` (12058–12059). No assertion failures;2088ordinary passes/324file passes plus65load passes,13identities each5unique; approval18/18 retained. T1exit0/incompleteT2exit1/noWeb, not a completed all-T2/Neovim run. Linuxx64 c-8blr1 workers2; host9d1b3d7acheck reused/not repeated; otherdiagnosticsreport-only. Source/C8A-9307 stand; C1–C7 await accepted merged-head evidence. OldA-9296 green applies only48e798b0. Shared candidate routed to lead; no flakiness/cause classification, retry or branch fix authorized. No new source findings/Reviewer execution/T3/T4/QA claim.

Criteria: C1 failed (A-9318 incomplete T2 exits1 on enforced startup whole-test duration gates; Web unexecuted, merged-head final evidence incomplete.), C2 failed (A-9318 incomplete T2 exits1 on enforced startup whole-test duration gates; Web unexecuted, merged-head final evidence incomplete.), C3 failed (A-9318 incomplete T2 exits1 on enforced startup whole-test duration gates; Web unexecuted, merged-head final evidence incomplete.), C4 failed (A-9318 incomplete T2 exits1 on enforced startup whole-test duration gates; Web unexecuted, merged-head final evidence incomplete.), C5 failed (A-9318 incomplete T2 exits1 on enforced startup whole-test duration gates; Web unexecuted, merged-head final evidence incomplete.), C6 failed (A-9318 incomplete T2 exits1 on enforced startup whole-test duration gates; Web unexecuted, merged-head final evidence incomplete.), C7 failed (A-9318 incomplete T2 exits1 on enforced startup whole-test duration gates; Web unexecuted, merged-head final evidence incomplete.).

### rev-23 · 2026-10-22T16:35:50.260Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1110-source-4
commit: fd6434b588a1938c5dd70b049ff3a426d6d21ce7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Shared-fix delta clear: only14durations.json additions from source-clearb0df2398/Coordinator26e74e4d. Exact two T-1104 startup identities get seconds11, ownerE-880, dated2026-10-22/expires2026-10-29, actual LinuxA-9316 samples7.025/7.413s and rationale. No production/test assertion/authority/skill change;2s serving-gap assertion and report-only tier budget remain. Standards0/Spec0. C8 unchanged docs refreshed; C1–C7 require new mode-free receipt atfd6434b5. A-9318 remains historicalfailedpartial, no Reviewer execution or new passing evidence/QA claim.

Criteria: C8 verified.

### rev-23 · 2026-10-22T16:46:55.762Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1110-final-2
commit: fd6434b588a1938c5dd70b049ff3a426d6d21ce7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head clear from 68fb5b00/A-9332 plus source A-9323. Parsed 2491 ordinary tests/379 files passed; zero fail/cancel/skip. Approval18/18, clock12/project-clock4, web-authority34/unit4 and withdrawal6 file receipts inspected. Thirteen new identities each five unique load passes+explicit5/5,65total,max0.377776975s. Actual Linuxx64 c-8blr1,Node24.21.0/Neovim0.12.5,T2workers2/Web4; allT1/fallback allT2 both packages/actualWeb exit0. Host2d055f26check reused, not repeated remotely. General lint/duration/ratchet/6missing baselines remain report-only; Web48.28s>40s report budget, not an enforcing-budget pass. Reviewed startup11s allowances retain behavior assertions. C1–C8 verified, no remaining Standards/Spec findings. Historical old-head failures retained; no Reviewer execution, Web repetitions, native relay,T3/T4/QA/full-cover claim; after-stage QA/landing Coordinator-owned.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.
