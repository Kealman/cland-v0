---
id: T-1433
kind: task
title: Transcribe each audio file in a Telegram album, not only standalone voice notes
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: null
branch: t/T-1433-transcribe-each-audio-file-in-a-telegram
created: 2026-10-28T19:24:36.417Z
updated: 2026-10-30T14:41:28.844Z
---

## Summary

A Telegram album of audio files arrives as one message with every file attached (T-1386), but no file is transcribed. T-1389 transcribes standalone audio files and video notes only, because the spec defines no text for several transcripts in one album. This item decides and builds multi-transcript albums: one combined transcript message with per-file sections, or one transcript per file under the album message.

## Acceptance criteria

- [ ] C1. A two-audio album produces one General message with both files and a transcript for each file, in album order, labelled by file, in the format the human chooses (test with a fake speech provider).

## Notes

Spec gap found by impl-1389 (topic-1160, 2026-10-28). T-1389 pins today's behaviour: album audio is attached, not transcribed.
