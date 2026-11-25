---
id: T-1998
kind: task
title: The per-run write census misses stream writes and renames, such as suite provenance's temp file
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1771
branch: t/T-1998-the-per-run-write-census-misses-stream
created: 2026-11-19T06:03:42.675Z
updated: 2026-11-25T04:59:07.508Z
closed: 2026-11-25T04:59:07.508Z
---

## Summary

T-1957's per-run write census intercepts `writeFile`, `appendFile` and `open`, but not stream writes or renames. Suite provenance finalization (`suite-provenance.ts`) writes `suite.log.provenance.tmp` with `createWriteStream` and then renames it, so the census misses it. The census is scoped API evidence, not a complete per-run file inventory, as found at T-1957's final evidence review on 2026-11-19.

## What to build

Extend the run-directory write census to cover stream writes (`createWriteStream`), renames and temp files, and to distinguish a final inventory (what remains in the run directory) from the write calls observed. The aim is a complete per-run file census that later retention and watcher-scope changes can rely on.

## Acceptance criteria

- [x] C1. A suite run's census records every file created in its run directory, including stream-written temp files and their renames, checked against a directory listing taken after the run (test with a positive control that adds a stream write).
  - done: impl-1998 · 2026-11-25T02:50:59.930Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-1998-final · 2026-11-25T03:32:14.109Z · commit 359d42d6fe41eb2f48e8f9e31714a356b967a291
- [x] C2. The census output separates observed write calls from the final file inventory (test).
  - done: impl-1998 · 2026-11-25T02:39:12.240Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-1998-final · 2026-11-25T03:32:14.109Z · commit 359d42d6fe41eb2f48e8f9e31714a356b967a291

## Comments

### human · 2026-11-20T01:09:15.204Z

Measurement by cland-impl, 2026-11-19 13:03Z to 2026-11-20 01:08Z (names, sizes and mtimes only; no file was opened). (1) Rate: 360 samples every 2 minutes, 97,087 -> 118,844 entries. Entries per minute by remote runs in flight (local none throughout): 0 runs 27.3 (26 min in total), 1 run 28.5 (171 min), 2 runs 30.6 (386 min), 3 runs 31.0 (121 min), 4 runs 33.1 (18 min). About 27 a minute, roughly 39,000 a day, do not come from verify or batch runs. (2) Shape: of the newest 400 directories, 398 hold exactly one file, suite.log, of exactly 779 bytes, in a bare-UUID directory (no -shard-N suffix), mode drwx------; the other 2 are real runs (suite.log 3.1 MB and 7.8 MB, plus tree.bundle, temp.sh, selection.json, run.sh, health.ts, env, delivery.log). (3) Cadence: three consecutive newest directories were created at 01:08:45Z, 01:08:49Z and 01:08:53Z, one about every 4 seconds; the directory and its suite.log carry the same mtime. (4) Cross-checks for three sampled UUIDs: 0 hits in cland verify queue, 0 in cland merge queue, 0 artifact file names under .cland/artifacts, and no hub.log line naming them. The file name alone does not identify the writer; an identical 779-byte log every 4 s suggests one caller repeating the same short-lived suite job. Raw samples: /Users/evgeniyivanov/.claude/jobs/92748b6f/tmp/suites-vs-runs.log.

### human · 2026-11-20T01:10:32.350Z

Source reading by cland-impl (running hub code 5e3a2005c, compared with dev c352aade5; no file under suites opened). Writer: Suites.#start writes job.log at hub/src/hub/suites.ts:767 ('Persist the complete request before acknowledging it') and appends the 'Historical probe:' line at :768; the run directory comes from :649. Several throws come after that write (dirty worktree cannot be bundled for droplet; a non-capacity checkSpend error; head changed during submission; hub is closing), and none removes the directory, so every failed submission leaves one directory with a short suite.log. Caller: DevT3Probes.probe (hub/src/hub/dev-t3-probe.ts) calls suites.start with devT3Probe; on a throw with no job it removes its merge-batches checkout and rethrows. Loop: DevT3Search.start ticks every 1,000 ms (dev-t3-search.ts:45). In #advance the tip-revalidation branch ('stale', dev-t3-search.ts:81) awaits boundary.probe with no try/catch, unlike the history branch at :110 which marks the file inconclusive. The rejection reaches tick()'s catch, which stores meta dev-t3-search-error and sends the notice dev-t3-search-blocked:<run> ('Periodic dev T3 search <run> blocked: <reason>') to the coordinator; the search stays unreported, so the next tick repeats: clone --shared plus checkout, a new suite id and log, the throw, the checkout removed. That matches one directory about every 4 s and the dev-t3-2888c52b checkout's mtime moving (02:10:12 local at my look). hub.log carries no line for these attempts. The actual refusal reason is in that blocked notice in the agents topic; I have not read it. Forward build: dev-t3-search.ts is unchanged between 5e3a2005c and c352aade5 (line 81 identical) and suites.ts still writes the log before the late throws (line 766-768), so the same loop exists on the dev tip; dev-t3-probe.ts changed (+75/-8) and I did not analyse whether its new code avoids the throw. Whether hub/test/hub-priority.test.ts is really red at c352aade5 is not answered here: the probe never gets as far as running it.

### impl-1998 · 2026-11-25T02:38:32.008Z

Red: stream positive control is observed assertion failed before interception changes. Green: focused T2 fake-scheduler test passes on macOS/Node 24.21.0; stream, copy and rename calls include temp paths, with independent final listing. Scope remains fake local scheduler; no worker or remote execution. No production contract changes or reachable T1 changes. Full lints in progress.

### rev-35 · 2026-11-25T02:44:56.832Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1998-source-1
commit: a1c0790ad31dcc8ebd427dd811a477d1efea260f
scope: full
findings: [{"severity":"medium","text":"Source-only root/run filtering excludes incoming copy/rename destinations and mis-slices cross-run endpoints; same-run controls do not establish complete per-run census.","file":"hub/test/suite-retention-writes.test.ts","line":20},{"severity":"medium","text":"No separate named setup/action observation deadlines cover unit acquisition, new stream pipeline, scheduler settlement and final listing; run/step ownership and teardown join do not supply those bounds.","file":"hub/test/suite-retention-writes.test.ts","line":38}]
finding_counts: {"high":0,"medium":2,"low":0}

A-23196: both gaps confirmed from retained source. C2 diagnostic separation is source-supported but not finally verified. Hold positively released for destination-aware recording/controls and independently bounded original-owned setup/action; retain current positive stream/provenance rename/final listing assertions. Fresh corrected committed source review before verify.

Criteria: C1 failed (Incoming/cross-run copy and rename destinations are omitted or misattributed, and new census setup/action observations lack separate named bounds.).

### impl-1998 · 2026-11-25T02:46:49.908Z

Review A-23196 corrections: incoming/cross-run copy and rename controls shown red (incoming copyFile incoming-copy is observed); endpoint-aware recording and per-run membership now pass. Separate named setup/action scope.wait observations use testDeadlineMs headroom and retain original work. Evidence A-23199 supersedes earlier control scope; typecheck exit 0, full lint pending.

### rev-41 · 2026-11-25T02:50:50.236Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-1998-source2
commit: 359d42d6fe41eb2f48e8f9e31714a356b967a291
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. Prior M1/M2 resolved: either-endpoint recording and independent per-run path membership, four incoming/cross-run controls plus exact second-run paths, separate named load-scaled setup/action waits retaining original work. Existing stream/provenance/publication temp rename controls and independent post-settlement listing remain. Observed write operations/paths and final inventory diagnostics stay distinct and explicitly fake-scheduler scoped. Retention/native seam ownership inspected; no Reviewer execution. Standards/Spec A-23206: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23206-t-1998-source-correction-clear-at-359d42d6f.md. A-23199 authored local macOS T2 red/green and reported static checks are not configured proof; C1/C2 remain unverified pending exact-head configured receipts. Task readback still has C1 failed/unchecked; lead should restore done for implemented correction. Follow Coordinator window; changed head needs source review.

### rev-41 · 2026-11-25T03:32:14.109Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-1998-final
commit: 359d42d6fe41eb2f48e8f9e31714a356b967a291
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Rund5b30b67/A-23227 finished/passed at unchanged reviewed head and source-matching tree34e9c9b8. Exact census identity has paired test pass and file finish including cleanup. Diagnostic33738 independently matches14 calls/10 paths/7 final files; all final paths accounted for, three temps retained in history, incoming/cross-run endpoints and second-run exclusion assertions pass. C1/C2 verified for fake local scheduler scope, explicitly excluding unexecuted worker/remote-delivery writes. One base execution; no load repetitions claimed for the unchanged identity. T0/T1/fallback all T2/7 selected T3/Web exit0; selected T3 once, remaining T3 batch/integrated evidence, T4 unexecuted. Linux x64 droplet c-8 fra1, Node24.21, Neovim0.12.5, Chrome for Testing156.0.8078.4 Headless Shell1248 for Web, two workers;one prerequisite skip, cache unknown, advisories report-only. A-23228: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23228-t-1998-final-review-clear-at-359d42d6f.md. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T04:59:07.508Z

Merged a64d45fed56b8156231727b82df5b9a64cb598bb onto dev.
