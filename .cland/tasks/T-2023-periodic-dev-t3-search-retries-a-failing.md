---
id: T-2023
kind: task
title: Periodic dev T3 search retries a failing tip probe every few seconds forever, leaving an empty run directory each time (~39,000 a day)
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1805
branch: t/T-2023-periodic-dev-t3-search-retries-a-failing
created: 2026-11-20T01:11:20.200Z
updated: 2026-11-27T07:34:44.091Z
---

## Summary

Since about 2026-11-16, periodic dev T3 search eab7b75d has retried its tip-revalidation probe about every 4 seconds, and every attempt leaves an empty run directory in `.cland/run/suites`. That's roughly 39,000 a day, about 110,000 entries in all, and a likely cause of the repeated fseventsd load. The probe fails with `Error: dirty worktree cannot be bundled for droplet` (the blocked notice of 2026-11-16 22:33Z).
- `DevT3Search` ticks every 1,000 ms (`dev-t3-search.ts:45`). Its tip-revalidation branch (`:81`) awaits `boundary.probe` with no try/catch, whereas the history branch (`:110`) has one and marks the file inconclusive. So the search stays unreported, and every tick clones the `dev-t3-…` checkout again and retries.
- `Suites.#start` writes `suite.log` (`suites.ts:767–768`, directory from `:649`) before several later throws: dirty worktree, a non-capacity spend error, head changed, hub closing. No throw removes the directory.
- The blocked notice is deduplicated by run id, so it reached the Coordinator once and the loop stayed invisible. hub.log has no line per attempt.
Found by cland-impl's suites-growth census on 2026-11-20 (the samples are in its T-1998 comment).

## What to build

- The tip-revalidation probe failure ends the search as inconclusive, or backs off with a cap, the same way the history branch does. It never retries every second indefinitely.
- A suite submission that throws before admission removes its run directory, or writes the log only after the last refusal point.
- Find why the dev-t3 checkout is dirty at clone time, and fix that at its owner.
- The blocked state stays visible: the heartbeat shows a blocked dev T3 search with its age and attempt count.

## Acceptance criteria

- [ ] C1. A tip-revalidation probe that throws ends or backs off the search, with a bounded number of attempts and a visible blocked state (test).
- [ ] C2. A suite submission refused after the log is written leaves no run directory behind (test).
- [ ] C3. The cause of the dirty dev-t3 checkout is named and fixed, shown by a probe that bundles cleanly at a fresh dev tip (test).

## Comments

### human · 2026-11-20T01:12:13.799Z

Source answers by cland-impl (running hub code 5e3a2005c; nothing changed, cancelled or removed). (1) Stopping the search without code: the source has no supported way. DevT3Search keeps its list in the store meta 'dev-t3-searches' and exposes only accept, start, tick and close (hub/src/hub/dev-t3-search.ts:38-59, 159). A search ends only when #advance reaches boundary.report and sets reported (:145-146), which needs a tip receipt for each candidate file. There is no CLI or tool that cancels a search or marks a file inconclusive, and dispatch.ts wires no config hook into it: the reload receipt's applied keys (hub/src/hub/configuration.ts:239) concern verification commands and the executor, and dev_t3_every only decides when new periodic runs start, not the ticks of an accepted search. The timer starts once at hub start (dispatch.ts:403) and the list is durable, so a restart on the same code resumes the loop. Ways out are a code fix that the hub then loads (try/catch or a terminal inconclusive on the :81 branch), or the probe succeeding. (2) Why the checkout is dirty: the probe checkout is a separate clone, not a linked worktree (dev-t3-probe.ts: git clone --shared --no-checkout, then checkout --detach), and its checkout() ends with prepareBatchDependencies, which symlinks <checkout>/node_modules to the root's node_modules (hub/src/host/agent/worktree-install.ts:13-15). candidateTree returns null when git status --porcelain=v1 --untracked-files=all over the candidate pathspec prints anything (hub/src/verification-tree.ts:30), and null becomes 'dirty worktree cannot be bundled for droplet' (suites.ts:737/789). In this repository the symlink is ignored only by .git/info/exclude line 20 ('/node_modules'): .gitignore has 'node_modules/', whose trailing slash matches directories and not a symlink. Checked on a linked worktree that has the same symlink: git check-ignore -v node_modules names .git/info/exclude:20 as the only matching rule. Linked worktrees share the root's info/exclude, so merge batches pass; a clone gets its own empty info/exclude, so the symlink shows as untracked '?? node_modules' and every probe submission is refused. I derived this from source plus that one check-ignore; I did not run git status inside the live probe checkout. Fix candidates: add the exclude to the clone's own info/exclude (or use a linked worktree), or ignore 'node_modules' without the trailing slash in .gitignore. The tasks/RULES exclusion is not the cause: both paths are already excluded from the pathspec.

### coord · 2026-11-20T03:09:39.234Z

2026-11-20 03:09Z: T-2024 landed (488bfb016), and the next probe at the dev tip bundled cleanly. Search eab7b75d then completed: `hub-priority.test.ts` is "already fixed on dev at 5307ed43c" (green reruns 8865ce0d at 488bfb0 and 7a30c464 at 5307ed4, logs A-22059/A-22060), and the loop ended. This item still covers the code fix: no unbounded retry on a tip probe failure, and no leaked run directory on a refused submission. About 122k empty directories from the loop remain in `.cland/run/suites`.

### impl-2023 · 2026-11-27T07:34:44.091Z

Consumer inventory: DevT3Search checkpoints are read by the search owner and dev-t3-search tests; dispatch constructs SearchBoundary; dev-t3-report consumes SearchReport; heartbeat will read an exported blocked-search projection. ProbeReceipt/wire shape unchanged. Suites.start callers (dispatch, dev-t3-probe, merge-batch verifier, suite self-rerun) keep existing admission shape; cleanup applies only before an indexed job owns the generated directory. C3 root cause/fix already landed in T-2024 (.gitignore ignores dependency symlink); retaining fresh-probe coverage.
