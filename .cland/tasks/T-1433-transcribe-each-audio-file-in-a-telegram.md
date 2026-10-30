---
id: T-1433
kind: task
title: Transcribe each audio file in a Telegram album, not only standalone voice notes
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1246
branch: t/T-1433-transcribe-each-audio-file-in-a-telegram
created: 2026-10-28T19:24:36.417Z
updated: 2026-10-30T15:25:00.819Z
closed: 2026-10-30T15:25:00.819Z
---

## Summary

A Telegram album of audio files arrives as one message with every file attached (T-1386), but no file is transcribed. T-1389 transcribes standalone audio files and video notes only, because the spec defines no text for several transcripts in one album. This item decides and builds multi-transcript albums: one combined transcript message with per-file sections, or one transcript per file under the album message.

## Acceptance criteria

- [x] C1. A two-audio album produces one General message with both files and a transcript for each file, in album order, labelled by file, in the format the human chooses (test with a fake speech provider).
  - done: impl-1433 · 2026-10-30T14:55:29.182Z
  - verified: rev-32 [reviewer] · run rev-20261030-1433-evidence1 · 2026-10-30T15:15:10.112Z · commit e011847b1a34b951a055ac0d8a0ecf66a4ff0ad7

## Notes

Spec gap found by impl-1389 (topic-1160, 2026-10-28). T-1389 pins today's behaviour: album audio is attached, not transcribed.

## Comments

### impl-1433 · 2026-10-30T14:42:32.554Z

Scope decision: one General album message, ordered 🎤 <filename> sections, per-file failure lines; retain single-file format. Established seam: production factory/public frames with fake Telegram + fake speech in telegram-voice.test.ts. Consumer audit: voiceNote callers telegram.ts and discord.ts; transcribes callers same; voice result fields internal only, no wire changes. MediaInput/queue and inbound receipt shape unchanged, so polling/inbound album restart fixtures and legacy clients unaffected. Existing two-audio regression will migrate; standalone voice/admission tests remain controls. Remote docs, spec note and test guide will update.

### impl-1433 · 2026-10-30T14:43:50.688Z

Local red receipt (Node 24.21.0, macOS, fake-only T2): updated two-audio case expected labelled transcripts but got ['album caption']; assertion at telegram-voice.test.ts:225. Green: complete touched telegram-voice.test.ts, 20/20 including first-member quota followed by successful second member. No full local suites or browser runs. Additive voiceNote.failure is consumed by Telegram only; Discord's existing result field access remains compatible. Broader searches found historical E-1311/E-1312 QA briefs and duration census: historical scope remains valid for their original builds, not current contract evidence; no shared wire/persistence field changed.

### rev-31 · 2026-10-30T14:48:22.709Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261030-1433-source1
commit: 6cbe092159767c2ed87b3cdd7bf5557a9c366c70
scope: full
findings: [{"severity":"medium","text":"M1: new album prefix is misread by web/src/provenance.ts and nvim/lua/cland/provenance.lua as standalone voice; first section marker moves into header and filename beginning `not transcribed: ` is consumed as failure sentinel. Migrate these text-contract consumers and actual native workbench album regressions while retaining standalone/typed-caption/legacy controls.","file":"hub/src/remote/telegram.ts","line":536}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated source1 A-14453: one distinct medium M1, Standards consumer inventory and Spec rendering consequences recorded separately. Exact hub launch format verified98192200. Ordered upload/bytes/quota isolation otherwise match scope; local fake-only A-14446 remains summary, no configured evidence. Fix same base, preserve red/green, refresh C1 done and request exact-head source review before verification. No Reviewer workload or full task-head run requested.

Criteria: C1 failed (Both workbench presentation consumers strip or misclassify the first required filename-labelled album section.).

### impl-1433 · 2026-10-30T14:49:45.173Z

M1 consumer audit correction: web/src/provenance.ts -> MessageBlock.tsx, nvim/lua/cland/provenance.lua -> thread.lua (body and header); remote source labels also serve AskCard/ApprovalCard and inbox but remain unchanged. Native telegram-marks fixture and both workbench tests exercise the changed text contract; Discord workbench consumers share these parsers but standalone and non-recording inputs remain unchanged. No wire field added. Red receipts: Neovim rendered first filename as failure-header plus body 'track-1.mp3'; Chromium body likewise lost '🎤 not transcribed: '. Native regression uses that literal filename and independent full body assertions, with original standalone/typed controls retained.

### rev-31 · 2026-10-30T14:52:55.543Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261030-1433-source2
commit: a6ec762daf03565a3d250eeaec27da4c9d1b6f7f
scope: full
findings: [{"severity":"medium","text":"M1 incomplete: attachment count is not album identity. Producer labels input.items even if another member is size/download-refused, leaving one accepted audio; both web and Lua >1 guards fall through and strip/misclassify its heading, including sentinel-like filename. Preserve labelled album body after filtering and cover native surviving-member case without changing standalone/typed controls.","file":"web/src/provenance.ts","line":17}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated source2 A-14466: one remaining medium M1; two-attachment literal-body/filename correction and independent native assertions otherwise sound. A-14462 local summaries retain exact scope; no configured or Reviewer execution. Correct same base, retain red/green, refresh C1 done, request exact-head successor source review before verification.

Criteria: C1 failed (A partially accepted album with one recording still loses or misclassifies its required filename heading in both workbenches.).

### rev-32 · 2026-10-30T14:57:04.553Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1433-source3
commit: e011847b1a34b951a055ac0d8a0ecf66a4ff0ad7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear A-14475 after prior rev31 A14453/A14466. Both parsers recognize exact attached filename heading before standalone sentinels, including surviving member and legacy singular artifact. Native refusal/speech census and actual Neovim/Chromium literal bodies preserve sentinel-like first filename; original standalone/typed/approval controls retained. Ordered producer bytes/provider isolation/one upload unchanged. Full19-file branch static review; no dev merge, no Reviewer workloads. A14472 local macOS summaries not configured runtime; C1 done, runtime-unverified. One unchanged-head mode-free verify then original-record evidence request.

### rev-32 · 2026-10-30T15:15:10.112Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1433-evidence1
commit: e011847b1a34b951a055ac0d8a0ecf66a4ff0ad7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear A-14492, rawA14491/run a8ced613 unchanged head. Parsed4265 ordinary/514file pass plus115 separate load test/115load file pass, zero adverse outcomes. All20 voice cases pass; both album C1 identities ordinary+5/5 load (max.414/.501s). Native Neovim parent+child once1.124/.479s, Chromium existing identity once3.418s below4sWeb budget; exact body/refusal/speech census/standalone/typed/approval controls retained. T0/T1/allfallbackT2/changedNeovimT3once/Web complete; remainingT3/T4 unexecuted. Host gate reused; Webshard4workers,0newfiles/0reps. Lint/budget/ratchet report-only limits retained; no Reviewer reruns. C1 verified.

Criteria: C1 verified.

### coord · 2026-10-30T15:25:00.819Z

Merged aeb432bd240737dc4a6c9d56d86d51e8daab49f6 onto dev.
