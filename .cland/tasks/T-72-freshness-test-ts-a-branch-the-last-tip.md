---
id: T-72
kind: task
title: freshness.test.ts "a branch the last tip read did not hold" races the 2 s
  tip timer and fails under load
state: closed
status: done
labels:
  - ready-for-agent
  - tests
assignee: impl-72
parent: E-20
blocked_by: []
topic: topic-22
branch: t/T-72-freshness-test-seam
created: 2026-10-09T11:55:08.930Z
updated: 2026-10-10T00:58:17.807Z
closed: 2026-10-09T12:51:01.270Z
---

## Parent

Part of T-20; a test added by T-67 (main 8bf458c).

## What happened

hub/test/freshness.test.ts:164 ("a branch the last tip read did not hold …") expects `verdict.current` to be `undefined` right after a branch is created, and the run got `true`. It failed twice on 2026-10-09 under load:
- impl-69's default-concurrency baseline for T-69 at about 11:50Z: 332/333, the one failure this assertion.
- qa-12's full run on T-58 cbce35e at 11:54Z: 340/341, same test.
The test passes alone. The likely cause is that the test reads `current` on a wall-clock window, while the tip read, the 2 s timer or the 50 ms poke after a tracker change, can complete in between under load. It then legitimately reports `true`.

## What to build

- Make the test deterministic. Either stop the tip timer and the change poke in the test, through an injected scheduler or clock, and drive the reads by hand; or assert the sequence instead of a moment: unknown, or already settled, then true once a read that started after the question has finished.
- Look for other tests in freshness.test.ts and verdict-commit.test.ts that depend on the 2 s timer or fixed sleeps, and give them the same seam. rev-cc2 and rev-65 noted the 500 ms sleep in verdict-commit.test.ts:129.

## Acceptance criteria

- [ ] The test passes 50 times in a row under an artificial load: run it in a loop while a CPU hog runs, and record the command on the item
- [ ] No fixed sleeps remain in the freshness tests where a seam can drive the reads
- [ ] `npm run typecheck && npm test` pass

## Notes

Size XS. Implementer: Codex gpt-6.1-sol.

## Comments

### coord · 2026-10-09T12:01:44.705Z

A second test with the same cause, from impl-52's locked full run on T-52 at 12:01Z. hub/test/worktree-cli.test.ts:16 expected `verdictBase` to be `main` across CLI reads and got `null`. T-67 caches `verdictBase` from the async tip read, so a read before the first tip read lands reports null. The run had 2 failures out of 330: this one and freshness.test.ts:152, a sibling of :164 with the same pattern. Include worktree-cli.test.ts here: wait for the cache with the same seam rather than reading on a wall-clock window. Also check whether a null `verdictBase` right after a hub start matters to users; if it does, read the tips once synchronously at startup only, before the socket opens.

### impl-72 · 2026-10-09T12:08:18.403Z

Claimed. Inspecting the freshness cache scheduler, unit-test callbacks, and daemon/CLI polling seams. Will keep request paths cached and validate all three affected files 50 times under CPU load before one locked full suite.

### impl-72 · 2026-10-09T12:11:37.258Z

Added an injectable tip schedule (default keeps the same initial read, 2 s interval and 50 ms poke). Unit tests now drive reads and wait on tracker changes; selected CLI tests use real socket/CLI calls against an in-process daemon with the same manual schedule. Removed the 100/200/300 ms unit waits and both 500 ms verdict waits. Startup null verdictBase is shown as `verdict base -` by hub/src/cli/task.ts:149; no user action or control path depends on it, so retaining the existing unknown-until-read contract. Typecheck passed; targeted run in progress.

### impl-72 · 2026-10-09T12:14:54.436Z

Committed implementation 4d07511. Initial targeted validation: 16/16 passed; typecheck passed; code review: Standards 0 / Spec 0 (artifact A-24). Coordinator clarified CPU hogs require /tmp/cland-suite.lock too; stopped the unlocked loop and discarded its 3 iterations. Restarting 50 iterations plus the single full suite under one lock hold using `zsh /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-25-t-72-locked-validation-script.txt`. A-25 contains the exact command, four hogs, test-name filter, cleanup traps, and full-suite command.

### impl-72 · 2026-10-09T12:22:44.775Z

Guarded stress proof acquired /tmp/cland-suite.lock and reached 10/50 consecutive passing iterations (7 changed tests per iteration, four CPU hogs throughout). No failures. Continuing under the same lock before the single full suite.

### impl-72 · 2026-10-09T12:26:34.061Z

Guarded proof milestone: 21/50 consecutive iterations passed (147 executions of the 7 changed tests), with four CPU hogs and /tmp/cland-suite.lock held throughout. No failures; full suite has not yet been run.

### impl-72 · 2026-10-09T12:29:26.068Z

Guarded proof milestone: 30/50 consecutive iterations passed (210 executions of the 7 changed tests). Four CPU hogs remain active and the suite lock remains held. No failures; full suite still pending.

### impl-72 · 2026-10-09T12:33:15.945Z

Guarded proof milestone: 40/50 consecutive passing iterations, 280 executions of the 7 changed tests. Four CPU hogs and /tmp/cland-suite.lock remain active. No failures; ten iterations and the single full suite remain.

### impl-72 · 2026-10-09T12:37:14.972Z

Load proof complete: 50/50 consecutive iterations passed under four CPU hogs, each executing all 7 changed tests (350 passing test executions). Lock held throughout; hogs stopped after iteration 50. Exact command is artifact A-25 (`zsh /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-25-t-72-locked-validation-script.txt`); count log and final iteration output uploaded as artifacts. Typecheck passed again. The single full `npm test` is now running in the same lock hold.

### rev-65 · 2026-10-09T12:39:32.467Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-72-1
commit: 4d0751111e2955ed659957c31f826e0dab97518a

No high, medium or low findings. Standards: clear, 0. Spec: clear, 0.

The manual schedule explicitly warms and advances the tip cache for freshness.test.ts:144/:164, worktree-cli.test.ts:17 and the verdict rebase cases. Both 500ms tip waits and the other fixed freshness waits are removed. The remaining verdict-commit.test.ts:24 conditional retry waits for asynchronous comparison completion, not a wall-clock tip-read window.

The default scheduler retains the initial asynchronous read, 2s interval, coalesced 50ms poke, unref and stop behavior; request-path caching and comparison-worker scheduling remain unchanged. The startup note is accurate: hub/src/cli/task.ts:149 displays null verdictBase as “verdict base -”, with no product control-path consumer found.

Read A-23/A-25 and stress evidence A-33/A-34: 50 consecutive passing iterations, seven tests each, four CPU hogs under the suite lock; final iteration 7 passed, 0 failed/cancelled/skipped. Item records typecheck success. The single full suite remains in progress and must be completed before final acceptance. Reviewer ran no suite and made no repository edits; git diff --check passes.

Full review: A-35, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-35-t-72-review-deterministic-tip-reads-and-unchanged-default-scheduler.md

### impl-72 · 2026-10-09T12:40:41.594Z

Completed at 4d0751111e2955ed659957c31f826e0dab97518a; worktree clean. Typecheck passed. Exactly one full `npm test` passed under the same lock hold: hub 341/341 + Neovim 91/91, zero failures. Durable full-suite log A-36: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-36-t-72-full-suite-results.log; typecheck A-37. Stress proof: 50/50 consecutive iterations, 7 changed tests each (350 passing executions), four `yes > /dev/null` hogs throughout, with /tmp/cland-suite.lock held before hogs through suite and cleaned on exit. Repeated command: `node --test --test-name-pattern='task.list and task.view|a verdict on the branch tip|a read that finds a new question|a branch the last tip read|latest verdicts go stale|text verdicts retain|CLI commands from linked' hub/test/freshness.test.ts hub/test/verdict-commit.test.ts hub/test/worktree-cli.test.ts`. Exact loop + lock/cleanup commands are A-25; count log A-33 and final iteration A-34. Code review Standards 0 / Spec 0 (A-24). Completion report artifact records implementation and evidence; no push or merge.

### qa-12 · 2026-10-09T12:46:05.702Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-72-1
commit: 4d0751111e2955ed659957c31f826e0dab97518a

Checked isolated git archive 4d0751111e2955ed659957c31f826e0dab97518a with node_modules linked from T-72 and explicit Node v24.21.0 PATH. Read the item and stress/full evidence. No product source changes.

Ran independently:
- npm run typecheck passed.
- Ten sequential runs of node --test hub/test/freshness.test.ts hub/test/worktree-cli.test.ts hub/test/verdict-commit.test.ts. Each passed 16/16, zero failures, skips or cancellations: 160 passing executions. All ten complete logs retained. No hogs and no lock for these targeted checks, as requested.
- cland task list --json and cland task view T-72 --json passed.
- Final process scan found no QA-export processes. Evidence copy hash verified, QA staging/export removed, working tree clean.

Audited impl-72's evidence rather than duplicating its stress/full runs:
- A-25 exact script acquires /tmp/cland-suite.lock before starting four yes hogs. Every filtered iteration must exit zero before appending its pass line. Hogs remain active through all 50 iterations and stop before typecheck/full suite; normal and signal cleanup kill/wait hogs before releasing the lock.
- A-33 contains exactly 50 ordered success lines, iterations 1 through 50. A-34 final iteration reports all 7 changed tests passing, zero failures/skips. Recorded guarded proof is 350 passing changed-test executions; earlier discarded unlocked attempts are not counted.
- Read final item comment and A-36 raw full log: hub 341/341 and Neovim 91/91, zero failures/skips. Matched all seven changed test names from A-34 to passing lines in A-36, including the formerly flaky unknown-branch and linked-worktree CLI tests. QA ran neither hogs nor a full suite.

Findings by severity:
- High: none.
- Medium: none.
- Low: none in requested scope.

Durable QA evidence: A-41, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-41-t-72-qa-4d07511-ten-repetitions-and-stress-full-evidence-audit.zip. Includes ten run logs, typecheck/CLI output, repetition audit, SHA256-linked audits of A-25/A-33/A-34/A-36 and cleanup checks. External evidence remains separately attributable to impl-72.

### coord · 2026-10-09T12:51:01.268Z

Merged into main as c04bcf6 (`git merge --no-ff`, by the Coordinator) at 12:46Z. Suite on main 65ac1a1: typecheck clean, hub 343/343, Neovim 91/91, 0 skipped. This is the first full run since T-67 in which the freshness tests passed without a rerun.
Verdicts: review rev-65-72-1 clear and QA qa-12-72-1 clear, both on 4d07511. The proof was 50/50 iterations of the 7 changed tests under four CPU hogs, inside the suite lock (A-25, A-33, A-34). QA added 10 quiet repetitions of the three files, 160 executions.
What it does: the freshness, worktree-cli and verdict-commit tests drive the tip reads through an injected scheduler, in hub/test/freshness-harness.ts. They no longer race the 2 s timer or the 50 ms change poke. The product's default scheduler is unchanged. A null `verdictBase` at hub start shows only as `verdict base -` in `cland task view`.
Implementer: impl-72 (Codex), launched 12:07Z.
