---
id: T-1026
kind: task
title: Reduce the CPU of T-1003's 20,000-line incremental parse proof to fit the T2 budget
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: topic-943
branch: t/T-1026-reduce-the-cpu-of-t-1003-s-20-000-line
created: 2026-10-20T19:23:30.653Z
updated: 2026-10-24T08:38:26.585Z
---

## Summary

The 20,000-line incremental-parse proof added by T-1003 takes about 6 s on a Linux droplet (5.7-6.3 s over five load runs), past the 5 s budget for a new T2 case; T-1003 carries a dated 8 s allowance owned by E-880 through 2026-10-27. Reduce its total CPU while keeping the deterministic caps and semantics it proves.

## Acceptance criteria

- [ ] C1. The case runs under its 5 s T2 budget in the task's mode-free verify on a Linux droplet and in five sequential local runs (timings in the ready report), with every deterministic cap assertion unchanged, its name unchanged, and the T-1003 allowance removed (test and receipts named in the item).

## Comments

### impl-1026 · 2026-10-24T08:37:36.849Z

Source ready at cfb1481e. Test identity unchanged: nvim/test/artifact-render.test.ts::a 20,000-line artifact yields to keys, bounds render work and caches the settled projection. Five sequential local macOS arm64 executions of that case alone passed: 2.154896583, 2.120323208, 2.675758292, 2.028385292, 2.083597958 s. These are actual top-level test durations, not Linux or load-gate evidence; all original cap assertions stayed unchanged (128 root extension rows, 64 injection regions, 256 work, 128 projected rows, 256 decorations). All samples create 6 parsers vs 201 in the pre-fix red control. Full artifact-render file: 14/14 pass. npm run check: pass; test lint in report mode, zero refusals. The exact T-1003 E-880 allowance is removed; no other allowance changed. Linux mode-free verification and C1 verification remain pending source review.

### rev-26 · 2026-10-24T08:38:26.585Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1026-source-1
commit: cfb1481e501951bcd912f324f80e1cddb365dbae
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; both axes/no findings in A-10550. Original identity, 20,000 lines and every deterministic cap/final semantic assertion retained. Per-language parser reuse clears snapshotted prior descendants before each <=64-region batch; normalized input shared, fresh shallow option copies preserved. New <=6 creation guard and 65-fence differential text/style/link oracle cover reuse. Only exact T-1003 allowance removed; baseline unchanged. Coordinator amended criterion requires ordinary Linux T2 timing under5s plus five standalone local samples, no re-triggered Linux load gate. Local check14/14/five timings are reported, originals pending final audit. Proceed with exact-head mode-free verify; C1 stays unverified until Linux receipt and local raw provenance reviewed. Preserve original stdout/exits/timings/source identity durably without transcription reruns. No Reviewer runtime/edits/delegation.
