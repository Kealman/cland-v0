---
id: T-567
kind: task
title: Remote run.sh writes its done marker before the timestamp, so a poll can read code 0 with an empty finished time and the run never enters the cache
state: open
status: review
size: S
criterion_seq: 2
labels:
  - bug
  - hub
  - executor
  - v0.1.3
assignee: null
parent: E-425
blocked_by: []
topic: topic-355
branch: t/T-567-remote-run-sh-writes-its-done-marker
created: 2026-10-16T03:27:02.619Z
updated: 2026-10-16T04:15:30.851Z
---

## Summary
Found by impl-562 on 2026-10-16 (evidence A-3644), reproducible on dev 58696d94 and on T-562's 0f42e138. The droplet's run.sh creates `done` with `date >done`, so the file exists before the timestamp is written. A status poll in that window reads done with code 0 and finished ''. DropletRun.status then reports the run (reported=true) but leaves job.finished unset, and `#cached` rejects the run that just completed. That is the cause of T-562's Linux failure at verification-workers.test.ts:73 (`cached.cached?.run` undefined). Holding the fake machine's `date` reproduces it in about 8 s.

## Acceptance criteria
- [x] C1. run.sh writes the done marker atomically (write to a temporary file, then rename), and DropletRun.status treats a done marker without a finished time as still running instead of finished.
  - done: impl-567 · 2026-10-16T04:14:35.652Z
  - verified: rev-30 [reviewer] · run rev-20261016-567-source · 2026-10-16T04:15:30.851Z · commit a0a568b5762e054512efb4fae2bfc1fe736cd63e
- [x] C2. A test holds the fake machine's date at the done boundary and shows the run is reported only once finished is set, and that a same-head relaunch then hits the cache.
  - done: impl-567 · 2026-10-16T04:14:35.873Z

## Comments

### coord · 2026-10-16T03:47:16.505Z

Second signature of the same race, in T-548's droplet run f4fb4357 (A-3657, lines 4195–4210). verification-workers.test.ts:71 failed with lease costUsd undefined against an expected NaN, because lease.lifetimeMs was absent. That is the assertion two lines above T-562's :73 cache miss, in the same test, right after the same `result()` wait. It fits the same window: the run is reported while `finished` is still empty, so the lease's lifetime and cost aren't settled yet. C2's test should also check that lifetimeMs and costUsd are set when the run is reported.

### impl-567 · 2026-10-16T04:12:06.341Z

Implementing C2 first at the requested verify/report/cache seam with the fake machine date held at completion. Test also covers DropletRun.status on an older empty marker and observes date completion before waiting for the final report; final report must have the timestamp and settled lease cost/lifetime, then same-head launch must reuse it.

### rev-30 · 2026-10-16T04:15:30.851Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-567-source
commit: a0a568b5762e054512efb4fae2bfc1fe736cd63e
scope: full

# T-567 source review clear at a0a568b5

Head a0a568b5762e054512efb4fae2bfc1fe736cd63e; branch t/T-567-remote-run-sh-writes-its-done-marker.
Fixed point 0724d034b515d60577e9f798d7fc7042ab4f6159, pre-review merged dev. One implementation commit a0a568b5; three-file diff only run.sh, run.ts and verification-workers.test.ts. Origin task ref matches. Direct Standards/Spec review; no Reviewer execution.

## Standards
No high, medium or low findings (0).
run.sh:18 follows the existing same-directory temporary-file/rename publication pattern already used for platform metadata at24–25. The writer closes the timestamp output before mv publishes done; unsuccessful date cannot publish it. Exit code and final log precede publication under the existing exclusive shell admission lock. Reader adjustment stays in DropletRun.status at95, with no provider/accounting/cache redesign.
The regression uses the actual delivered shell through the fake-machine boundary and public verify/report/cache interfaces. It holds a specific date milestone rather than sleeping to hope for the race. Release is in finally; downstream report waits start only after the date completion observation, then the renamed final marker is observed separately. Existing fixture ownership cleanup covers shell, watchdog and directories. AGENTS.md, lifecycle rules and docs/agents/tests.md apply; no new smell finding in this narrow change.

## Spec
No findings (0). C1 source-verified: done is published with date >done.tmp && mv done.tmp done, within one directory; status trims a visible done marker and returns running if empty. A nonempty timestamp retains ordinary code/platform completion behavior; pending, missing-group, lifetime, lost-machine and SSH-unreachable paths remain unchanged. This deliberately handles older runners that expose an empty marker rather than reporting partial completion.
C2 regression is implemented at the requested seam but final verification remains pending exact-head actual Linux suite evidence. While date is held, it requires running, no final report and no published final marker. It then temporarily introduces an older empty marker and independently checks running/no report. Thus writer-only and reader-only fixes cannot each satisfy the entire test. After release and marker publication it checks a parseable timestamp, exact job.finished equality, reported success, released lease, finite positive lifetime/cost, same-head cache reuse and exactly one original report.
Coordinator's existing task comment expands C2 to the accounting signature (undefined cost/lifetime as well as cache miss); those assertions are present. No weakened preexisting verification-workers assertions or changes to droplet.ts.

## Evidence and disposition
A-3689 records old-source red at status done versus running (3.855s), corrected whole verification-workers file5/5 (19.238s), new case4.261s, typecheck and whitespace green. This is the Implementer's durable reported targeted evidence, not a claim of Reviewer execution or a substitute Linux suite. Immutable diff whitespace check independently clean.
Source verdict clear, C1 verified. C2 final/runtime mark awaits one fresh exact-head --executor droplet --fresh verification at this SHA. No per-item QA. Changed head requires delta review. Existing proposed project rule951bda5f already says publish completion only after its data is written and reject incomplete reader data; no duplicate proposal is needed.
Totals: Standards0, Spec0 findings. No tests, compiler execution, edits, signals, installs, merges, provider actions or subagents performed by Reviewer.

Artifact A-3690 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3690-t-567-source-clear-atomic-completion-and-held-date-report-cache-proof.md

Criteria: C1 verified.
