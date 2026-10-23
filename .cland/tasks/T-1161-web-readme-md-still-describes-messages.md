---
id: T-1161
kind: task
title: web/README.md still describes messages, inline artifacts and the Inbox as stand-ins
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
topic: topic-890
branch: t/T-1161-web-readme-md-still-describes-messages
created: 2026-10-23T02:32:53.561Z
updated: 2026-10-23T03:32:06.424Z
closed: 2026-10-23T03:32:06.424Z
---

## Summary

Writing the E-417 stage-2 QA brief at 269ea26f found stale statements in web/README.md after T-1119–T-1122 landed: line ~155 says HTML artifacts are chips "until the inline-artifact slice"; line ~214 says "Messages are plain sender/time/text blocks … in this slice"; line ~248 says "Inbox and Events keep their existing stand-ins"; and no key table lists Toggle agent run or the ask keys.

## What to build

web/README.md describes the landed message block, folded runs, inline HTML artifacts and ask cards as they are, with their keys in the key tables, and keeps any still-pending area (Events, until E-417 stage 4) named as such.

## Acceptance criteria

- [x] C1. web/README.md has no sentence describing messages, inline HTML artifacts or ask cards as future or stand-in work (docs).
  - done: impl-1161 · 2026-10-23T03:30:29.562Z
  - verified: rev-26 [reviewer] · run rev-20261023-1161-source-1 · 2026-10-23T03:31:58.205Z · commit ed7cf73dd159422b037131db3dec8709e7bc37c2
- [x] C2. web/README.md's key tables list Toggle agent run and the ask keys (`1`–`9`, free answer, `d` decline) with their contexts (docs).
  - done: impl-1161 · 2026-10-23T03:30:29.654Z
  - verified: rev-26 [reviewer] · run rev-20261023-1161-source-1 · 2026-10-23T03:31:58.205Z · commit ed7cf73dd159422b037131db3dec8709e7bc37c2

## Comments

### impl-1161 · 2026-10-23T03:29:28.391Z

Updating only stale web/README.md descriptions and key tables against landed T-1119–T-1122 and src/keymap.ts. Required npm run check and source review; no suite per launch brief.

### impl-1161 · 2026-10-23T03:30:59.800Z

Committed/pushed ed7cf73dd159422b037131db3dec8709e7bc37c2; only web/README.md changed. npm run check passed on this source tree locally on macOS: typecheck/guards, bundle build and static/test lint (test lint report-only, 132 findings, 0 refusals). No tier/Web suite executed per docs-only launch instruction. C1–C2 done; full source review routed to Reviewer. Evidence A-9795: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9795-t-1161-readme-corrections-and-check-evidence.md

### rev-26 · 2026-10-23T03:31:58.205Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1161-source-1
commit: ed7cf73dd159422b037131db3dec8709e7bc37c2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full docs source review clear at ed7cf73d/tree c1618be9. Standards and Spec: no findings. Only README changes. C1 stale future/stand-in messages, inline HTML and ask wording removed; replacement matches MessageBlock/InlineArtifact/InboxArea and names remaining pending Inbox/Events work. C2 context table matches keymap/Thread/AskCard: Enter/za Toggle agent run, 1–9 options, i/r free answer, d decline/restore, native input/control exceptions and digit precedence. Both docs criteria verified by source; no suite required under the launch brief. A-9795 local check is requester-attributed summary (report-only lint, zero refusals), not original runtime or suite evidence; no QA claim. A-9798: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9798-t-1161-readme-source-review-at-ed7cf73d.md.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-23T03:32:06.424Z

Merged 930712edf752fd7a066abef9ecca1a67179f0c0a onto dev.
