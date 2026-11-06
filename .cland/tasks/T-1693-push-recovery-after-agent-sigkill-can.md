---
id: T-1693
kind: task
title: Push recovery after agent SIGKILL can find the producer ended with no completed receipt under load
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1609
topic: topic-1397
branch: t/T-1693-push-recovery-after-agent-sigkill-can
created: 2026-11-05T17:56:03.123Z
updated: 2026-11-06T00:47:33.024Z
closed: 2026-11-06T00:47:33.024Z
---

## Summary

`hub/test/host-push-on-ref-move.test.ts` "interrupted admitted native push survives agent SIGKILL and recovery publishes only the current head" failed in impl-1692's loaded macOS batch (T-1692 evidence, macOS arm64 Node 24.21.0, about 17 of load, repetition 5 of 5). The error was `watch …/worktrees/crash: producer result missing; native cleanup retained` after 5.99 s. That cause comes from ref-push `observe` (hub/src/host/agent/ref-push.ts): no completed receipt was found while the producer's root had ended or its identity had changed. The earlier Linux failures (T-1684, T-1613's diagnostic runs) showed the bare-unknown form of this case. T-1684 fixed the ESRCH /proc race, and this is a different branch.

## What to build

Determine whether, after an agent SIGKILL, the push producer (`ref-push-worker`) can end before writing its completed receipt, or its receipt write can lose a race with recovery's first observation. Name the cause with a reproduction, for example a held receipt write or a delayed worker exit. Fix it in the product: a producer that completes must leave a durable completed receipt before it ends, or recovery must wait for that receipt. A truly missing result stays fenced and named. Never weaken the fence or the assertion.

## Acceptance criteria

- [x] C1. The failing order (producer end versus receipt write versus recovery observation) is named with a deterministic reproduction (test, red before the fix).
  - done: impl-1693 · 2026-11-05T23:09:16.006Z
  - verified: rev-35 [reviewer] · run rev-35-1693-final-1 · 2026-11-05T23:57:11.381Z · commit bc98117b218019e558402459311f10754fc2d44c
- [x] C2. After the fix, host-push-on-ref-move passes 10/10 under heavy CPU load on macOS and in a Linux container run with `docker run --init`, with fences and assertions unchanged (evidence).
  - done: impl-1693 · 2026-11-05T23:27:11.074Z
  - verified: rev-35 [reviewer] · run rev-35-1693-final-1 · 2026-11-05T23:57:11.381Z · commit bc98117b218019e558402459311f10754fc2d44c

## Comments

### coord · 2026-11-05T23:06:44.918Z

Promoted to E-1532 stage 6 (coord, 2026-11-06). The hub flagged it as a shared defect: it now reds item verifies on unrelated items. T-1614's verify c0f68bd2 at 8370003e (A-16963, Linux x64) had 4900 passed and its only failure was this case, "killed producer without result stays named and fenced…", with `producer result missing; native cleanup retained`. Earlier hits: T-1613's 6380ee28 (A-16761), dev-t3 A-16807, and the macOS load proof A-16903. It is the remaining branch after T-1684 fixed the ESRCH race.

### impl-1693 · 2026-11-05T23:08:03.167Z

Rule 20 consumer sweep before changes: checkpoint callers are agent bootstrap, server, supervisor.sh, entry, claude, prepared, processes, ref-push-worker and watch (claude-stop's parameter is an unrelated callback). Receipt producer ref-push-worker -> reader ref-pushOwner -> RefWatches settlement/fence/cleanup -> server watch-status/events -> AgentClient/readRefWatchStatus -> transport status. Tests/readers: host-push-on-ref-move, host-ref-watch-recovery, host-ref-watch-compat (previous wire shape), host-push-facts(+test), transport-status, host agent/flush/restart and three remote harness preservation files. Docs: per-user-state, host-agent and host-ref-watch-recovery test guide. Searched production, all test tiers, docs, qa and shipped skills by function/type/receipt/path/diagnostic names. Proposed observation-only fix leaves receipt/checkpoint schema and writer unchanged; all checkpoint callers unaffected; consumers retain completed-result validation and named missing-result fence. closure.json regenerated for source hash.

### rev-35 · 2026-11-05T23:10:57.809Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1693-source-1
commit: 6a18b97e65bc8af405b7e6d8855bc0644937350e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-16966: full source clear. Receipt read now follows native census, ordering it after the producer's existing checkpoint-before-exit boundary; every exact admission/completion/identity and genuine-missing-result fence remains. Two T2 scripted cases cover exit and replacement ordering without native children/timers. Existing tests unedited; owning guide updated; all32 closure hashes independently match pinned source, diff check clean. C1 red/green receipt and C2 ten-per-platform loaded/preservation/configured evidence remain unverified pending final inspection. No Reviewer execution.

### rev-35 · 2026-11-05T23:15:27.657Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1693-delta-source-1
commit: bc98117b218019e558402459311f10754fc2d44c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-16967: sole delta completes the scripted Observation identity/ended fields with null/false, preserving all predicates/assertions and deterministic ordering. Product/closure/required native file unchanged. No findings; C1/C2 remain unverified pending evidence. Native loaded receipts keep actual execution-head lineage with explicit source equivalence, not a fabricated new-head rerun. No Reviewer execution.

### impl-1693 · 2026-11-05T23:54:00.907Z

Final configured receipt A-16984: mode-free d34b05fd at reviewed bc98117b218019e558402459311f10754fc2d44c/tree c1ecf229756cc1838be87d564dfa35f642f52536, droplet Linux x64 6.8.0-142-generic Node24.21.0,5162pass/0fail/0cancel/0skip; T0/T1/T2/Web exit0. Browser isolated Chrome Headless Shell Google Chrome for Testing156.0.8078.4. Budgets/lint report-only. T3 unexecuted here, assigned merge batch; no T4 selection. c-8 sfo2 lifetime1402s cost$0.0974. Local macOS/Linux native10/10 each and all7preservation complete; full localT2 raw node summaries3012+380pass, tier census separately3316/359files. Evidence/provenance A-16979/A-16983, logs A-16965/68/69/70/73/74/78, drivers A-16980/81/82. No new allowance needed (newcases11ms). Clean pushed head unchanged; awaiting Reviewer's final same-head settlement.

### rev-35 · 2026-11-05T23:57:11.381Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1693-final-1
commit: bc98117b218019e558402459311f10754fc2d44c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-16985: final same-head evidence clear; C1/C2 verified. Independently checked both deterministic ordering cases (base plus 5/5 load finishes), all23 recovery controls and previous-wire/status guards in exact-head d34b05fd/A-16984: exit0, hub5162pass/zero fail/cancel/skip; T0/T1/fallback allT2/Web complete. Head and independently reconstructed execution tree match. C1 original red/green tool-observation transcription remains labelled, corroborated by reviewed ordering and current raw green cases. C2 raw loaded whole-file10/10 macOS +10/10 docker--init Linux, allfour exact cases and native Node0/null each; genuine missing-result assertion unchanged. Qualified lineage/outer-exit/burner limits A-16983 retained; Mac pre-ceiling high loads explicitly accepted, Linux raw startmax6.02 corrects summary typo. Preservation initial flush AdmissionTimeout remains history with4/4 retry; localT2 Node3392 and tier3316 counts remain distinct. Local npm numeric exit unavailable, independent configuredT0 green. T3/T4 configured execution not claimed; batch/integrated coverage and full after-stage QA remain separate. No new allowance/source change, no Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-06T00:47:33.024Z

Merged df397e2e7fcc4a638f76d81dab30793e06031896 onto dev.
