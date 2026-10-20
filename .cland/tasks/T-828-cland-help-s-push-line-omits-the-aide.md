---
id: T-828
kind: task
title: cland --help's push line omits the Aide after T-630
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
regression_of: T-630
topic: topic-696
branch: t/T-828-cland-help-s-push-line-omits-the-aide
created: 2026-10-19T05:57:33.676Z
updated: 2026-10-20T06:10:34.072Z
---

## Summary

`cland --help`'s push line (`PUSH_USAGE` in `hub/src/cli/usage.ts`) still says the push runs from the "Coordinator’s shell or human". T-630 let the Aide publish `dev` with `cland push`. Found while drafting E-611's QA brief.

## Acceptance criteria

- [x] C1. The push usage line names who may run `cland push` as the hub actually allows it (Coordinator, Aide, human), and a usage test pins the text.
  - done: impl-828 · 2026-10-20T06:08:49.243Z

## Comments

### impl-828 · 2026-10-20T06:08:49.965Z

Updated PUSH_USAGE to name the Coordinator, Aide and human. Added a pure T1 usage test; confirmed red on old text and green after the correction (0.069s file wall). Typecheck passes; origin/dev was already current before first review. QA policy is none and no QA criteria are listed.

### rev-31 · 2026-10-20T06:10:34.072Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-828-source
commit: 6e6a43adee8aee7567e25572d10a5fb858084f62
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-7129 confirms help wording matches dispatcher permission policy: Coordinator/Aide from CLI shell or human. Pure T1 exact-line test and tier registration meet the requested usage contract; no permission changes. C1 implementation established; final verification remains pending configured same-head mode-free gate and actual new identity 5/5 receipts.
