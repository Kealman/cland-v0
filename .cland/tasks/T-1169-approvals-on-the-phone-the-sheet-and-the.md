---
id: T-1169
kind: task
title: "Approvals on the phone: the sheet and the TUI mark"
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1168
  - T-1129
topic: topic-913
branch: t/T-1169-approvals-on-the-phone-the-sheet-and-the
created: 2026-10-23T07:00:02.795Z
updated: 2026-10-23T17:44:07.439Z
---

## Summary

At phone width a relayed approval opens in the ask's bottom sheet with its command in full, Approve once, Always for this command and Deny with a note on the label row; an approval that stays in a harness's TUI shows marked "answer in Neovim" and never opens a sheet.

## Parent

E-419 (§3.6 what stays on the desktop; §3.8; P41's marked row; tracer step 2, approvals). Reuses the approval card of T-1129.

## What to build

- **Relayed approvals** (Codex, OpenCode): a tap on the row opens the sheet of the ask ticket with the session, the harness, the command or file change in full and since when, then Approve once and Always for this command as full-width buttons at least 44 px tall. Deny sits on the note field's label row and sends with or without a note (E-414's decision on ask 9a81a158: the deny note is optional, as T-1129 C2 was amended). The same closing rules hold: Escape, the scrim, the close button and a swipe never answer.
- **The outcome.** The answer goes through the hub's gate as T-1129's card sends it; the sheet closes and the row folds to its outcome, including the winner's outcome when another client or the TUI answered first.
- **TUI-bound approvals** (Claude Code): the row shows the command marked "answer in Neovim", has no buttons and opens no sheet.

## Acceptance criteria

- [x] C1. At 390x844 a fake Codex approval row opens a sheet with its command in full and Approve once, Always for this command and Deny, each at least 44 px tall, and Approve once folds the row to its outcome as a frame client reads it (Web test).
  - done: impl-1169 · 2026-10-23T17:30:00.459Z
  - verified: rev-26 [reviewer] · run rev-20261023-1169-final-1 · 2026-10-23T17:44:07.343Z · commit 2cb931c780289191d0dac21db554eee5ef50e04d
- [x] C2. Deny on the label row sends with or without a typed note and a typed note reaches the record, and Escape, the scrim and a swipe leave the approval pending (Web test).
  - done: impl-1169 · 2026-10-23T17:27:28.157Z
  - verified: rev-26 [reviewer] · run rev-20261023-1169-final-1 · 2026-10-23T17:44:07.343Z · commit 2cb931c780289191d0dac21db554eee5ef50e04d
- [x] C3. A fake Claude Code approval row shows marked "answer in Neovim" with no buttons and opens no sheet at 390x844 (Web test).
  - done: impl-1169 · 2026-10-23T17:27:28.230Z
  - verified: rev-26 [reviewer] · run rev-20261023-1169-final-1 · 2026-10-23T17:44:07.343Z · commit 2cb931c780289191d0dac21db554eee5ef50e04d

## Comments

### coord · 2026-10-23T17:17:37.847Z

Coordinator, 2026-10-23 17:18Z: amended the body and C2 to E-414's decision on ask 9a81a158 (stand-in under D24, 2026-10-22): the deny note is optional. T-1129 C2 was amended the same way, and the desktop card sends Deny with or without a note. The earlier text required a note.

### impl-1169 · 2026-10-23T17:19:51.714Z

Read T-1169, E-419 and E-414 approval contract, implementation/TDD guidance and phone/native Web seam. Waiting for T-1168 to appear in origin/dev before edits. Planned coverage: complete phone subject + once/always receipts, optional deny notes, non-answer dismissals, TUI-only rows and peer/native winner folding; reuse ApprovalCard submission/recovery and BottomSheet.

### impl-1169 · 2026-10-23T17:27:28.409Z

Implemented at 925b3344 (pushed task branch). Reuses ApprovalCard's approval.answer/recovery and T-1168 BottomSheet. Phone choice/optional-note layout, TUI/fallback row marks, no-answer dismissals, full subjects and native/peer winner folding covered in six new Web tests. Built first; 60/60 requested targeted Web tests passed on local macOS (phone*.test.ts, inbox, session-drawer, key-contexts), plus web typecheck/colour/contrast/hooks, tier manifest and report-mode test lint (0 refusals). New passing identities all <1.1 s across local samples; no >=4 s allowance trigger. QA is affected/after-stage with no per-item brief, so source review only before mode-free task verification. origin/dev merged before edits and rechecked/merged up to date before this review.

### rev-26 · 2026-10-23T17:29:14.204Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261023-1169-source-1
commit: 925b3344bb9719f42c650a9f3778980ab8eed126
scope: full
findings: [{"severity":"medium","text":"M1: The peer-winner retention case advances fake time and asserts visibility without observing the exact Inbox departure/removal frame. A row that disappears on the delayed push can pass before delivery. Arm the exact-id observer before the peer answer, bound its receipt after clock advance, and retain both retention and post-leave assertions (rule 9).","file":"web/test/phone-approvals.test.ts","line":143}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at 925b3344/tree a03ec725. One medium Standards finding M1, phone-approvals.test.ts:143: fake clock advance/focus is not receipt of the approval's Inbox departure. Arm exact-id departure/removal observation before the peer answer; await it with a bound, then assert retained winner and preserve the final leave/remount disappearance. No product source findings: shared sheet and existing gate/recovery/optional denial note correctly reused; TUI/fallback no-controls path and docs/manifest match. Coordinator's optional-note amendment honored. Full audit complete, C1–C3 runtime unverified. Preserve original command/exit/source/check receipts without transcription reruns; A-10141 is supporting local stdout, not configured proof. Fresh review at corrected head before verify. A-10142: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10142-t-1169-source-review-at-925b3344.md.

Criteria: C1 failed (Outcome retention is checked before the exact approval Inbox departure/removal receipt, so the visit lifecycle regression can pass before the relevant frame arrives.).

### impl-1169 · 2026-10-23T17:30:12.944Z

Source review M1 corrected at 2cb931c780289191d0dac21db554eee5ef50e04d: arm exact approval inbox.departures observer before the peer answer; await bounded receipt and keep final true, visible-winner and leave/remount-disappearance assertions. C1 re-marked done and corrected-head review requested from reviewer. Product source unchanged. Targeted phone-approvals: 6/6, exit 0 on corrected source, local macOS; web typecheck/contrast/hooks and git diff --check exit 0. Stdout A-10143; original A-10141 and tool command/exit/check/source receipts preserved. No dev merge after first source review.

### rev-26 · 2026-10-23T17:30:52.821Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1169-source-2
commit: 2cb931c780289191d0dac21db554eee5ef50e04d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at 2cb931c7/tree ac52e0a6. Standards and Spec: no findings. M1 resolved: exact approval-id Inbox departure observer installed before navigation/peer answer; bounded receipt wait and final true assertion precede winner retention and unchanged leave/remount disappearance assertions. Only test changes, all six cases retained; full product review A-10142 carries forward. C1–C3 await same-head mode-free verification and actual new duration audit. A-10143 6/6 local macOS stdout inspected as supporting targeted evidence; command/exit/source/check attribution remains lead-reported/session-local, not configured proof. Preserve original receipts without transcription reruns. No Reviewer runtime; after-stage QA separate. A-10145: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10145-t-1169-corrected-source-review-at-2cb931c7.md.

### impl-1169 · 2026-10-23T17:43:42.874Z

Mode-free verify 8591914f-0dad-4deb-bedc-b69a9229ce1a passed at exact source-reviewed 2cb931c780289191d0dac21db554eee5ef50e04d: 2747 passed, 0 failed/cancelled/skipped. A-10148. Linux x64 6.8.0-142-generic droplet c-8 lon1, workers 2; T1 + fallback all T2 across hub/Neovim + Web completed. T3 deferred to periodic dev/integrated occasions (not in configured batch tiers); no T3 pass claimed. Duration budgets and test lint report-only. New phone-approvals identities all <4 s; worst passing sample 3.078801244 s, no allowance required. Executor lifetime 685 s, cost $0.0475. Post-run origin/dev dd2aab60; read-only merge-tree exit 0, head unchanged and clean. Awaiting Reviewer final evidence verdict; do not merge.

### rev-26 · 2026-10-23T17:44:07.343Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1169-final-1
commit: 2cb931c780289191d0dac21db554eee5ef50e04d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged 2cb931c7/tree ac52e0a6, C1–C3 verified; no findings. A-10148/run 8591914f exits 0: independently counted 2747 ordinary test passes and 408 file passes, zero fail/cancel/skip. T1, fallback all T2 hub/Neovim and actual Web pass on Linux x64 c-8 lon1 (Node24.21/Neovim0.12.5; machine workers2/Web4). Host root check passes with zero lint refusals; gate977d5623 not repeated remotely. Six phone approval cases pass at 3.079/1.412/1.911/1.710/1.533/2.060 seconds, all below4s; exact departure retention correction, optional notes, TUI fallback and native/peer winner assertions execute. Source A-10142/A-10145 carries forward. Generic budgets/lint/ratchet report-only, two missing baselines; measured Web wall151s exceeds report-only40s. No T3/T4, repetition, enforcing phase-budget or after-stage QA claim; local stdout provenance retained. No Reviewer runtime. A-10149: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10149-t-1169-final-evidence-review-at-2cb931c7.md.

Criteria: C1 verified, C2 verified, C3 verified.
