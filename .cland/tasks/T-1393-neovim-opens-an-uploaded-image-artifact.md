---
id: T-1393
kind: task
title: Neovim opens an uploaded image artifact in the system viewer
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1382
topic: topic-1133
branch: t/T-1393-neovim-opens-an-uploaded-image-artifact
created: 2026-10-27T23:37:29.021Z
updated: 2026-10-28T01:36:11.922Z
closed: 2026-10-28T01:36:11.922Z
---

## Summary

An image artifact made by `artifact.upload`, a PNG and a JPEG whose upload name lacked an extension, opens through the system viewer's command from Neovim's artifact list. The test fakes that command.

## What to build

A headless-Neovim test uploads the two images through the hub's frame, opens each from the artifacts view, and checks the faked `CLAND_OPENER` received each artifact's path. If the test exposes a gap (for example an extension from the MIME rule that `browser_ext` lacks), fix it in `artifacts.lua`. Every other type keeps opening as today. Spec §3.6 and §3.11.

## Acceptance criteria

- [x] C1. In headless Neovim, opening an uploaded PNG and an uploaded JPEG runs the faked system viewer once each with the artifact's `.png` and `.jpg` path, while a note artifact still opens in a buffer (test).
  - done: impl-1393 · 2026-10-28T01:10:03.734Z
  - verified: rev-26 [reviewer] · run rev-20261028-1393-evidence-1 · 2026-10-28T01:29:19.416Z · commit ed5919f1e94d0b4bee4ae4f2a20913be855ee108

## Notes

Shared files: nvim/lua/cland/artifacts.lua, nvim/test/artifacts.test.ts

## Comments

### impl-1393 · 2026-10-28T01:09:26.917Z

C1 regression added at nvim/test/artifact-upload.test.ts (T3; one in-process hub, one headless Neovim, scratch-only viewer stub). Existing T2 artifacts screens remain untouched. Red control: temporarily disabling png in browser_ext caused `Error: viewer received exact uploaded path: not within 15000 ms`; restored routing before green. No shared contract changes; test consumes existing artifact.upload result/artifact events and Neovim list/open. No production consumers require migration.

### rev-26 · 2026-10-28T01:10:56.418Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1393-source-1
commit: 67410e156acc55ed436cdda492a9df56dbe7eadc
scope: full
findings: [{"severity":"medium","text":"M1 Standards: descriptive H1 fails unchanged test-docs exact test-file heading contract; use # nvim/test/artifact-upload.test.ts and retain guard red/green.","file":"docs/agents/tests/nvim-test-artifact-upload.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source1 A-13014: Standards1 medium M1, Spec0. Native T3 upload/MIME-path/real Enter/scratch-viewer exact count plus note-buffer control and shared sealed ownership inspected; no production changes. Local macOS1/1/typecheck evidence distinct from configured/Linux proof; reported A-13013 guard correction is outside reviewed head. C1 runtime pending. Push heading correction and request fresh source review before mode-free verify; no further dev merge unless Coordinator directs. QA none.

### rev-26 · 2026-10-28T01:11:20.800Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1393-source-2
commit: ed5919f1e94d0b4bee4ae4f2a20913be855ee108
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source2 clear, A-13015. Only H1 changed after audited source1; exact path fixes M1, unchanged guard local red2/3->green3/3 A-13013/topic. Native upload/Enter/viewer/count/note assertions and ownership unchanged, no Spec findings. C1 runtime pending; prior local macOS1/1 .8649s is not configured/Linux proof. One mode-free run at unchanged corrected head then original-record review of changed T3 identity/platform/duration; no further dev merge unless Coordinator directs. QA none.

### rev-26 · 2026-10-28T01:29:19.416Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1393-evidence-1
commit: ed5919f1e94d0b4bee4ae4f2a20913be855ee108
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Original evidence clear, A-13021. Exact-head bfcded73/A-13019 exit0:3810 ordinary passes plus25 separate other-identity load passes; C1 exact PNG/extensionlessJPEG/viewer/note identity19411 passes .727458205s once as changedT3, no repetitions and no >=3s allowance. Actual upload/Enter/path/count/note assertions retained. T0/allT1/fallback allT2/changedT3/Web complete Linux droplet with headless Neovim0.12.5; remainingT3/T4 unexecuted. Host typecheck reused, budgets/lint/T3growth report-only. Source2 unchanged, QA none. Coordinator owns landing after fresh conflict check.

Criteria: C1 verified.

### coord · 2026-10-28T01:36:11.922Z

Merged 0dd721431260e656f4a3cfc464afcd5de3d3e555 onto dev.
