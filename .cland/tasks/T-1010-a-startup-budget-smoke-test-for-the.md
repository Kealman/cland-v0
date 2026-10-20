---
id: T-1010
kind: task
title: A startup budget smoke test for the Neovim workbench on a 1,000-item tracker
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by:
  - T-1007
  - T-1008
topic: topic-762
branch: t/T-1010-a-startup-budget-smoke-test-for-the
created: 2026-10-20T17:01:25.275Z
updated: 2026-10-20T19:11:01.290Z
closed: 2026-10-20T19:11:01.290Z
---

## Summary

A Neovim smoke test guards the workbench's startup against a 1,000-item tracker, with a time budget and a byte budget. This keeps the P1 slow start from coming back.

## What to build

- A fixture tracker of 1,000 items, generated rather than committed, with realistic bodies and about 80 % of the items closed.
- A smoke test in the Neovim smoke set starts the workbench against a scratch hub holding that tracker. It measures:
  - the time from the hub connection until the explorer shows the open items, the header shows the Coordinator, and the sessions panel shows the sessions;
  - the bytes of the first item payload.
- It fails above either budget. Set the budgets from measured values with headroom, and record them in `docs/agents/tests.md`.
- A live measurement on the human's Mac against a copy of the live tracker becomes the epic's C1 evidence.

## Acceptance criteria

- [x] C1. The smoke test starts the workbench against a 1,000-item fixture tracker and fails when startup exceeds its time budget (test, plus a fixture that slows `task.list` to prove the failure).
  - done: impl-1010 · 2026-10-20T18:42:43.082Z
  - verified: rev-23 [reviewer] · run rev-20261020-1010-final · 2026-10-20T18:52:28.922Z · commit fbca23241842fad4a3bff7746c4e2d7e76ecec41
- [x] C2. The test fails when the first item payload exceeds its byte budget (test with a fixture that adds bodies to the payload).
  - done: impl-1010 · 2026-10-20T18:42:43.715Z
  - verified: rev-23 [reviewer] · run rev-20261020-1010-final · 2026-10-20T18:52:28.922Z · commit fbca23241842fad4a3bff7746c4e2d7e76ecec41
- [x] C3. The test is in the Neovim smoke set that `web-only` and `hub-only` selections also run, and its tier is recorded in `hub/test/tiers.json`.
  - done: impl-1010 · 2026-10-20T18:42:44.239Z
  - verified: rev-23 [reviewer] · run rev-20261020-1010-source · 2026-10-20T18:44:53.112Z · commit fbca23241842fad4a3bff7746c4e2d7e76ecec41
  - verified: rev-23 [reviewer] · run rev-20261020-1010-final · 2026-10-20T18:52:28.922Z · commit fbca23241842fad4a3bff7746c4e2d7e76ecec41
- [x] C4. A local run against a copy of the live tracker on macOS records the startup time and payload, posted in the item topic (local evidence).
  - done: impl-1010 · 2026-10-20T18:42:44.888Z
  - verified: rev-23 [reviewer] · run rev-20261020-1010-final · 2026-10-20T18:52:28.922Z · commit fbca23241842fad4a3bff7746c4e2d7e76ecec41
- [x] C5. `docs/agents/tests.md` records the budgets and how they were measured.
  - done: impl-1010 · 2026-10-20T18:42:45.407Z
  - verified: rev-23 [reviewer] · run rev-20261020-1010-source · 2026-10-20T18:44:53.112Z · commit fbca23241842fad4a3bff7746c4e2d7e76ecec41
  - verified: rev-23 [reviewer] · run rev-20261020-1010-final · 2026-10-20T18:52:28.922Z · commit fbca23241842fad4a3bff7746c4e2d7e76ecec41

## Comments

### impl-1010 · 2026-10-20T18:40:42.955Z

Implemented T3 real-headless-Neovim startup guard and generated 1,000-item / 200-open tracker. The transparent socket relay measures the first response frame (UTF-8 envelope+newline), preserves welcome/event order, and clocks only welcome-to-anchored explorer/header/session render. Hard limits 3,000 ms / 128 KiB; delayed task.list and restored-body negative fixtures exercise the same checker. Added NVIM_SMOKE membership, tier registration, selection regression coverage, docs, and scratch-only C4 copy probe. Merged fetched origin/dev 3f74bc05 before first review. Final head 91af84a2; exact source-match local checks and C4 evidence being published.

### rev-23 · 2026-10-20T18:44:53.112Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1010-source
commit: fbca23241842fad4a3bff7746c4e2d7e76ecec41
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7948 audits8-file diff at fixedbase3f74bc05. Generated1000/200open fixture, actual first task.list UTF-8 envelope/newline accounting, exact payload/installed ids, observer-before-welcome, anchored explorer/Coordinator/count/session render receipt and separately bounded setup reviewed. Explicit3000ms/128KiB checker and completed-render negative controls retained. C3 smoke/tier integration and C5 matching measurement docs verified. A-7939 exact-head local Mac3/3 records intended delayed3116.5ms and restored-body415880byte budget failures; A-7941 copied1021/107 tracker48.513ms/42759bytes. These are supplemental local T3 evidence, not production crew-load/Linux/full-suite claims. A-7938 prior render-matcher failure retained; source-identical prior-head selection96/96 and report-only lint qualified in audit. C1/C2/C4 final marks await normal exact-head mode-free task gate, which defersT3. After-stage affected QA separate; no Reviewer execution/edits.

Criteria: C3 verified, C5 verified.

### rev-23 · 2026-10-20T18:52:28.922Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1010-final
commit: fbca23241842fad4a3bff7746c4e2d7e76ecec41
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7958 audits same-headA-7955/run9c933907:2110 ordinary tests/332files pass, Linux droplet allT1/fallback allT2 across hub/Neovim exit0,364s/$0.0253. Startup-budget and suite-selection files are T3 and did not execute in this task gate; no load repetition receipts. C1/C2 use separately inspected exact-head local MacA-7939:3/3, generated25.274ms/67588bytes; delayed3116.5ms and restored-body415880bytes trigger their intended enforcing checker failures after rendered completion. C4 exact-head local scratch-copyA-7941:1021/107open,48.513ms/42759bytes, excluding setup and real crew/indexer load. C3/C5 sourceA-7948 retained; C1-C5 review verified. Source-identical prior-head local selection96/96 qualified separately. Host79c45d6c not repeated remotely; lint/duration/missing-baseline/ratchet report-only. OlderA-7938 matcher failure retained. Periodic/integratedT3/T4 and E-1006 affected after-stageQA separate. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-20T19:11:01.290Z

Merged 21b91c1e02513daf3da4a7d3261956b691a84257 onto dev.
