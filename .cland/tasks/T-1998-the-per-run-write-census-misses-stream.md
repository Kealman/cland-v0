---
id: T-1998
kind: task
title: The per-run write census misses stream writes and renames, such as suite provenance's temp file
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-19T06:03:42.675Z
updated: 2026-11-20T01:10:32.350Z
---

## Summary

T-1957's per-run write census intercepts `writeFile`, `appendFile` and `open`, but not stream writes or renames. Suite provenance finalization (`suite-provenance.ts`) writes `suite.log.provenance.tmp` with `createWriteStream` and then renames it, so the census misses it. The census is scoped API evidence, not a complete per-run file inventory, as found at T-1957's final evidence review on 2026-11-19.

## What to build

Extend the run-directory write census to cover stream writes (`createWriteStream`), renames and temp files, and to distinguish a final inventory (what remains in the run directory) from the write calls observed. The aim is a complete per-run file census that later retention and watcher-scope changes can rely on.

## Acceptance criteria

- [ ] C1. A suite run's census records every file created in its run directory, including stream-written temp files and their renames, checked against a directory listing taken after the run (test with a positive control that adds a stream write).
- [ ] C2. The census output separates observed write calls from the final file inventory (test).

## Comments

### human · 2026-11-20T01:09:15.204Z

Measurement by cland-impl, 2026-11-19 13:03Z to 2026-11-20 01:08Z (names, sizes and mtimes only; no file was opened). (1) Rate: 360 samples every 2 minutes, 97,087 -> 118,844 entries. Entries per minute by remote runs in flight (local none throughout): 0 runs 27.3 (26 min in total), 1 run 28.5 (171 min), 2 runs 30.6 (386 min), 3 runs 31.0 (121 min), 4 runs 33.1 (18 min). About 27 a minute, roughly 39,000 a day, do not come from verify or batch runs. (2) Shape: of the newest 400 directories, 398 hold exactly one file, suite.log, of exactly 779 bytes, in a bare-UUID directory (no -shard-N suffix), mode drwx------; the other 2 are real runs (suite.log 3.1 MB and 7.8 MB, plus tree.bundle, temp.sh, selection.json, run.sh, health.ts, env, delivery.log). (3) Cadence: three consecutive newest directories were created at 01:08:45Z, 01:08:49Z and 01:08:53Z, one about every 4 seconds; the directory and its suite.log carry the same mtime. (4) Cross-checks for three sampled UUIDs: 0 hits in cland verify queue, 0 in cland merge queue, 0 artifact file names under .cland/artifacts, and no hub.log line naming them. The file name alone does not identify the writer; an identical 779-byte log every 4 s suggests one caller repeating the same short-lived suite job. Raw samples: /Users/evgeniyivanov/.claude/jobs/92748b6f/tmp/suites-vs-runs.log.

### human · 2026-11-20T01:10:32.350Z

Source reading by cland-impl (running hub code 5e3a2005c, compared with dev c352aade5; no file under suites opened). Writer: Suites.#start writes job.log at hub/src/hub/suites.ts:767 ('Persist the complete request before acknowledging it') and appends the 'Historical probe:' line at :768; the run directory comes from :649. Several throws come after that write (dirty worktree cannot be bundled for droplet; a non-capacity checkSpend error; head changed during submission; hub is closing), and none removes the directory, so every failed submission leaves one directory with a short suite.log. Caller: DevT3Probes.probe (hub/src/hub/dev-t3-probe.ts) calls suites.start with devT3Probe; on a throw with no job it removes its merge-batches checkout and rethrows. Loop: DevT3Search.start ticks every 1,000 ms (dev-t3-search.ts:45). In #advance the tip-revalidation branch ('stale', dev-t3-search.ts:81) awaits boundary.probe with no try/catch, unlike the history branch at :110 which marks the file inconclusive. The rejection reaches tick()'s catch, which stores meta dev-t3-search-error and sends the notice dev-t3-search-blocked:<run> ('Periodic dev T3 search <run> blocked: <reason>') to the coordinator; the search stays unreported, so the next tick repeats: clone --shared plus checkout, a new suite id and log, the throw, the checkout removed. That matches one directory about every 4 s and the dev-t3-2888c52b checkout's mtime moving (02:10:12 local at my look). hub.log carries no line for these attempts. The actual refusal reason is in that blocked notice in the agents topic; I have not read it. Forward build: dev-t3-search.ts is unchanged between 5e3a2005c and c352aade5 (line 81 identical) and suites.ts still writes the log before the late throws (line 766-768), so the same loop exists on the dev tip; dev-t3-probe.ts changed (+75/-8) and I did not analyse whether its new code avoids the throw. Whether hub/test/hub-priority.test.ts is really red at c352aade5 is not answered here: the probe never gets as far as running it.
