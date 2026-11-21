---
id: T-2035
kind: task
title: Durable exact-head Linux timing receipts, and the enqueue refusal of unallowed new identities of 4 s or more (split from T-1901 C2)
state: open
status: in progress
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1689
branch: t/T-2035-durable-exact-head-linux-timing-receipts
created: 2026-11-20T17:39:51.105Z
updated: 2026-11-21T01:31:32.141Z
---

## Summary

T-1901's allowance check (its former C2) needs the passing per-identity timings of an exact-head Linux run as a durable structured receipt. Today they exist only as `suite timing` log lines or temporary duration-reporter side files that run-suite deletes. RunStatus and worker /done carry platform and tier receipts but no timing samples. Split from T-1901 on 2026-11-20, because it needs a runner to worker to RunStatus to Suites contract and a prepared-executor capability (rule 19) before enforcement.

Kind: product. Part of E-1888 (approved in triage A-19813, ask 8e3dd5ab); carries T-1901's original C2.

## Acceptance criteria

- [x] C1. A local and a droplet run each record a durable structured timing receipt (identity, seconds, outcome, platform, head, tree) that Suites exposes after the run and after a hub restart, with no log parsing (test).
  - done: impl-2035 · 2026-11-21T01:31:31.917Z
- [x] C2. A new identity measured at 4 s or more on Linux with no allowance is refused before enqueue, with the allowance stanza (test).
  - done: impl-2035 · 2026-11-21T01:31:32.141Z

## Comments

### impl-2035 · 2026-11-21T01:06:04.580Z

Consumer audit (rules20/41): duration-reporter/run-suite produce samples; local suite-worker result and LocalExecutor.status, droplet env/runStatusProgram/status, Suites #readResult/#poll completion/recovery persistence and list/card projections, executor test fakes, suite-importer-ready and verification-tier-receipts controls, worker admission and droplet run/status tests, protocol/wire conformance, CLI/Web/nvim summaries, duration budgets/load-gate consumers and docs/skills/QA briefs were searched by TestTiming, suite timing, timingReceipts, tierReceipts, RunStatus, /done, result.json. New timingReceipts is optional; old worker/status/job shapes remain valid and unknown. Existing log timing consumers remain reporting only. T-1901 seam will consume exact task-head receipt, not merged synthetic candidate head. First red: suite-timing-receipts.test.ts exits1 ERR_MODULE_NOT_FOUND for new contract module (macOS arm64 Node24.21); no native/configured run.

### impl-2035 · 2026-11-21T01:20:35.620Z

Checkpoint: stacked source-clear T-1901 895ad0152 with Coordinator authorization (9897b0a7), preserving current dev sharding/importer changes in conflicts. C1 local/droplet semantic completion and real fixture SQLite/Suites restart controls green; uploaded droplet status VM covers previous shape and damaged metadata. C2 pure policy red-first, then public merge-queue file 49/49 green (macOS Node24.21, no provider/native launch). Full lint second run exit0/refusals0, 764 report-only advisories retained; first lint attempt failed because my tiers additions were unsorted, now corrected. Full typecheck integration draft exit0. All242 T1 files running serially; no current configured/Linux/Web/native verification claimed. Contract follow-up census: SuiteStatus timingSummary is mirrored shared/wire, conformance typechecks; Store summary SQL and read/list paths omit timing samples; older status/result shapes remain supported. Pending before review: finish current draft checks, T-1901 squash landing + merge origin/dev, publish evidence, fresh full lint/typecheck and review.
