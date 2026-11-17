---
id: T-1927
kind: task
title: cland verify still exits 75 at 15 s while the hub admits the run, after T-1907 landed and the hub restarted onto it
state: open
status: ready
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1907
topic: topic-1573
branch: t/T-1927-cland-verify-still-exits-75-at-15-s
created: 2026-11-16T23:30:57.204Z
updated: 2026-11-17T00:22:01.390Z
---

## Summary

`cland verify` still exits 75 with "submission sent; no reply within 15 s; check cland verify queue before resubmitting" while the hub admits the run, after T-1907 (4c4fe3f98) landed and the hub restarted onto it (restart #79, pid 1948, dev e824406ae, 2026-11-16 22:12Z). Both occurrences below came from task worktrees whose base contains T-1907.

## Evidence

- impl-1922, 23:05Z, head b980d46cf: CLI exit 75 at 15 s; one queue check showed no row; the hub's admission event for run 2933ff09 arrived at 23:05:24.990Z (topic-1568).
- impl-1864, 23:30Z, head c1e8f014c: CLI exit 75 after the missing 15 s reply; run cea6eda4 admission arrived afterwards (topic-1571).
- Earlier today, before T-1907 landed, the same symptom recurred three times (T-1907's own evidence).

## Acceptance criteria

- [x] C1. Name why the reply still misses 15 s with T-1907 live: whether the client deadline, the hub's admission path or the reply framing is involved. Quote the CLI and hub log lines for runs 2933ff09 and cea6eda4.
  - done: impl-1927 · 2026-11-16T23:38:24.046Z
  - verified: rev-35 [reviewer] · run rev-35-1927-source-2 · 2026-11-16T23:48:18.335Z · commit 6b2bff549a2c32d716e203d10b172ad6014f1d80
  - verified: rev-35 [reviewer] · run rev-35-1927-delta-1 · 2026-11-16T23:50:17.323Z · commit a6e2aba4126d1b454090bbc17c46a5f45a4316c6
  - verified: rev-35 [reviewer] · run rev-35-1927-final-1 · 2026-11-17T00:18:15.672Z · commit a6e2aba4126d1b454090bbc17c46a5f45a4316c6
- [x] C2. A submission the hub admits returns its run id to the CLI before the CLI's deadline under the same load (test, red before the fix), or the CLI waits on the admission event instead of a fixed 15 s timer.
  - done: impl-1927 · 2026-11-16T23:45:37.134Z
  - verified: rev-35 [reviewer] · run rev-35-1927-final-1 · 2026-11-17T00:18:15.672Z · commit a6e2aba4126d1b454090bbc17c46a5f45a4316c6

## Comments

### impl-1927 · 2026-11-16T23:34:19.775Z

C1 evidence captured before code in artifact in topic-1573: exact exit75 output for both runs and hub audit/admission log excerpts. Admission exceeds local15s deadline before durable checkpoint; T-1907 only detaches post-checkpoint scheduler. Individual candidate substep timings unknown. Plan: fake-clock held candidate inspection reproduces symptom; use same90s admission budget already used by remote CLI, retaining bounded exit75/no retry and old reply shape.

### impl-1927 · 2026-11-16T23:35:35.882Z

C1 pre-admission work: suiteCandidate.inspect in hub/src/hub/suite-candidate.ts awaits head/branch/selectPackageSuite, candidateTree, lintSuiteCandidate (immutable HEAD AND executing worktree shard/test-policy lint), planTierReport and durationBase; Suites.#start also validates commands/limits, final HEAD/authority, cache eligibility and persists before onAdmitted. These are hub-side operations the CLI cannot shorten; client preflight does not remove hub revalidation. Log evidence bounds the whole admission envelope (~15s deadline plus25.279s until submission log for2933ff09), not individual substeps; no exact native timestamps were captured. Longer90s client budget fixes premature abandonment while preserving validation/authority. Potential avoidable duplicate immutable/worktree lint/plan cost is a separate Tech debt/S follow-up for profiling/caching without weakening revalidation; not changed in this item. C2 fake-clock test injects45s pre-checkpoint work, observed red exit75 then green exit0 matching persisted id; no claim of live-load benchmark.

### rev-35 · 2026-11-16T23:43:13.602Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1927-source-1
commit: 7683d3a02853aa49fcdc3194f22d17a3181d74f3
scope: full
findings: [{"severity":"medium","text":"The new candidate-delay callback starts fixture acquisition before any whole-sequence owner; its later finally and per-resource cleanup do not fence/join pending setup or adopt late roots/resources before directory disposal (rule 12). Use the existing fixtureWork owner before first acquisition and retain the durable-id/exactly-one-send assertions.","file":"hub/test/verify-submission.test.ts","line":143},{"severity":"medium","text":"Current diagnostics guidance still states a 15-second default admission deadline, contradicting the new CLI 90-second default. Correct the CLI guidance and distinguish unchanged MCP normal 15s/diagnostics 120s at spoke.ts:198 (rule 16).","file":"docs/agents/tests.md","line":762}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear, A-20474. Two medium findings recorded: new regression lifetime ownership and stale current diagnostics guidance. Coordinator 8d5cf098/2af11f28 approves the CLI 90s scope; actual production delta preserves diagnostics 120s, wire fields, request-sent distinction, timeout 75 and no automatic retry. Frozen help bytes match by independent source comparison. A-20468 establishes retained CLI failures/later hub receipts; source enumerates pre-checkpoint work without proving exact live substep timing. A-20469/A-20472 precommit red/green, failed TS/clause attempts and native completion/provenance limits retained; no immutable-head or configured runtime pass claimed. Original six-hit search omitted tests; independent current consumer sweep found the stale guide and labels T2/T3 unexecuted consumers. C2 failed; C1 evidence established but no criterion formally verified on this not-clear pass. Hold released for consolidated correction and fresh source review; no configured verify or post-review dev merge authorized. Reviewer performed read-only inspection only.

Criteria: C2 failed (The new admission regression lacks whole-callback acquisition/work ownership during cancellation; current default-deadline guidance also remains stale.).

### rev-35 · 2026-11-16T23:48:18.335Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1927-source-2
commit: 6b2bff549a2c32d716e203d10b172ad6014f1d80
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear A-20476. Both A-20474 findings resolved: fixtureWork is created before acquisition, release registered before run, root/steps/late hub/UI/spoke/server adopted through the shared scope, and the entire callback plus pending/scheduler joins remain owned before root removal. Durable-id and exactly-one-submission assertions retained. Current diagnostics guidance now distinguishes CLI 90s from unchanged MCP 15s; diagnostics remains 120s. No production delta or dev merge after first review. Coordinator-approved deadline scope, safe timeout 75/no automatic retry and unchanged wire/persistence/authority behavior retained. C1 verified from A-20468 original CLI failures/later hub receipts and source; exact live substep timing remains unknown. C2 source/test design established but runtime verification pending. Original A-20469/A-20472 and repair local 8/8/typecheck/lint excerpts retain precommit/raw/hash/signal limits; no immutable-head configured pass or browser/Linux proof claimed. No findings. Hold released; obtain Coordinator window for one mode-free verify at this head, then same-head final evidence. Reviewer performed read-only review only.

Criteria: C1 verified.

### rev-35 · 2026-11-16T23:50:17.323Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1927-delta-1
commit: a6e2aba4126d1b454090bbc17c46a5f45a4316c6
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Shared-fix delta clear A-20477. Coordinator 9f3af230 explicitly authorizes only the separate unmodified 15757e4d4 cherry-pick; independent complete diff equality and matching stable patch ids ca1055f0... confirm exactly the three priority-test/guide/index paths changed. Clean head matches retained origin branch ref. Native identity capture precedes environment sealing; doctor/local-holder and priority warning assertions remain, with the explicit native exception documented and default synthetic fixture unchanged. T-1927 budget, safe timeout/retry/wire behavior and fixtureWork correction remain unchanged from A-20476. C1 verified at the new head; C2 runtime evidence remains pending. Request's immutable-head local Mac priority 1/1/exit0 and typecheck exit0 retained with absent raw/hash/signal limits; no configured/Linux/browser result inferred. No findings; hold released. Obtain Coordinator window for one mode-free same-head verify, then final evidence settlement. No Reviewer runtime or dev merge.

Criteria: C1 verified.

### rev-35 · 2026-11-17T00:18:15.672Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1927-final-1
commit: a6e2aba4126d1b454090bbc17c46a5f45a4316c6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear A-20496. Independent A-20494 parsing: 6,527 ordinary passes/708 file passes, no fail/cancel/skip; separate260 load passes. Required candidate-delay case31698 plus five load31745/31797/31835/31890/31939 all pass. All other seven verify-submission cases pass, including held scheduler, withheld result/timeout75/no-auto-retry, unwritten request, dry-run and deduplication. Positive frozen help/full help, admission cost/admission, Implementer clause reserve/wording and role-template records checked independently. T0,224T1,428fallbackT2,selected rolesT3 four identities once and55Web complete;268T3/17T4 unexecuted, including suite-preflight/cli-usage-merge. Exact head and normalized runner tree checked; uncached Linuxx64 Node24.21/Nvim0.12.5, actual isolated HeadlessShell1248/CfT156.0.8078.4. Report-only advisories and original precommit/raw/hash/signal limits retained. C1 diagnosis and C2 approved45s fake-delay model established; no measured live CLI wall or exact substep profile inferred. C1/C2verified, no findings; hold released. No Reviewer runtime or further run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T00:22:01.390Z

Third post-restart occurrence, for the record (pre-fix CLI): impl-1925 submitted at 1ef31bd95 at about 00:19Z. The CLI exited 75 with no reply, and the admission event for run 8fc8c91b followed; no retry was made. impl-1927's own submission (run 76b011ca at 23:51Z), from the branch with this fix, returned exit 0 with the run id. impl-1769's (run 6aed7951 at 00:16Z, also pre-fix) happened to return exit 0 too. So the failure is intermittent on the old client, as expected for a latency race against the 15 s deadline.
