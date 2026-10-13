---
id: T-47
kind: task
title: "Session usage: a running total per session, the same meaning for every
  adapter"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: impl-47
parent: E-19
blocked_by: []
topic: topic-6
branch: t/T-47-session-usage-totals
created: 2026-10-08T19:48:52.597Z
updated: 2026-10-10T00:58:17.535Z
closed: 2026-10-09T07:26:20.132Z
---

## Parent

Part of T-19. Found in the T-42 dogfooding run on 2026-10-08, collecting the token numbers for the record.

## Problem

`hub.status` `harnesses[].usage` (and the sessions panel's `12.3k tok`, the item view's cost) mean different things per adapter:

- Codex: `tokens.total` is the thread's running total (rev-43: 1,556,962 tokens, 1,481,344 of them cached input).
- Claude Code: the mod's `turn.complete` usage of the **latest turn only** (coord-2: 36 input, 658 output, 305,891 cache read), so a long Coordinator session shows a few hundred tokens.
- OpenCode: `session.step.ended` of the **latest step only** (impl-43b: 55,282 input, 124 output, cost 0), so the panel showed `351 tok` for a session that did the whole item.

Nobody can read a session's cost from cland today, which the item view's cost field promises.

## What to build

- The hub keeps a running total per launched session (input, output, cache read, cache write, cost where reported) besides the latest turn, adding each Claude Code turn and each OpenCode step, and taking Codex's own total as it is.
- `HarnessProcess.usage` gains `total` (same shape for every adapter) and `last`; the sessions panel and the item view's cost show the total.

## Acceptance criteria

- [ ] Two turns of the fake Claude Code and two steps of the fake OpenCode sum into `usage.total`; Codex's total passes through
- [ ] The sessions panel shows the total (nvim test against the stub hub)
- [ ] `hub/README.md` documents `usage.total` and `usage.last`
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:48:56.312Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/46 (filed during the T-42 run; the numbers differ, the item is the source of truth).

### impl-47 · 2026-10-09T06:56:28.670Z

Claimed T-47. Existing usage is adapter-owned latest-only for Claude Code and OpenCode; Codex exposes raw thread totals. Implementing a typed common total/last shape and verifying through fake-adapter hub.status plus the nvim stub-hub UI. The test seams are specified by the acceptance criteria.

### impl-47 · 2026-10-09T07:09:26.883Z

Implemented common usage.total/usage.last token and cost counts. Claude accepts its real snake_case API fields and camelCase reports; OpenCode sums each step; Codex replaces its total from the thread, subtracting cache reads from inputTokens to match uncached input semantics. The Coordinator confirmed adapter-memory totals (hub restart resets Claude/OpenCode). Both UI consumers now read total; README documents semantics, reporting gaps and reset behavior. Red/green tests passed for Claude and OpenCode; Codex and nvim red tests failed on missing totals as expected, and the four touched test files are now running together.

### impl-47 · 2026-10-09T07:11:16.334Z

Self-review against base 66f1353 via code-review skill:

## Standards
No documented-standard breaches or actionable baseline smells found. Adapter observation and Neovim presentation responsibilities remain intact; tests use the agreed public seams.

## Spec
No concrete findings. Shared total/last counts, per-turn/step summation, authoritative Codex totals, both UI consumers and README cover the requested behavior. Full-suite acceptance remains pending.

Standards: 0 findings. Spec: 0 findings. This is implementation self-review, not a Reviewer verdict. The fixtures were tightened to omit unreported Claude cost and verify positive OpenCode cost, cache-write and reasoning counts.

### impl-47 · 2026-10-09T07:13:35.861Z

Final validation passed on Node v24.21.0: npm run typecheck && npm test; hub 250/250 and nvim 61/61 passed, zero failures/skips. Full-suite output: /tmp/T-47-full-tests.log. New assertions cover two Claude turns using the real snake_case counts, two OpenCode steps including cache-write/reasoning/cost, Codex authoritative totals and cache normalization, and total tokens/cost in the sessions panel plus the item view. Code-review self-check: Standards 0 findings, Spec 0 findings. Implementation and documentation are ready for the final branch commit.

### impl-47 · 2026-10-09T07:14:18.320Z

Committed as 3e1bb6e on t/T-47-session-usage-totals; working tree clean. Files: hub/src/adapters/usage.ts (shared normalization/accumulation), three adapters plus contract and hub/src/protocol.ts, nvim/lua/cland/{panels,item_view}.lua, hub/README.md, adapter fakes/tests and nvim/test/shell.test.ts. Typecheck and full suite passed (250 hub + 61 nvim; no failures/skips). Durable Claude/OpenCode totals across hub restart are intentionally excluded, as confirmed by Coordinator, and documented in README. Ready for Reviewer/QA.

### rev-2 · 2026-10-09T07:17:23.925Z

verdict: review
result: clear
by: rev-2 [reviewer]
run: rev-20261009-47-3e1bb6e

Reviewed 3e1bb6e85bbcb2f090c1e411a151152e56a080cb against merge-base 66f135365d7c48a02874215028b8bc604a9248b2, T-47 acceptance criteria and Coordinator decisions at 06:56Z.

Standards: 0 findings. Shared normalization remains at the adapter boundary; protocol typing and Lua presentation follow the documented responsibilities. No actionable baseline smells or ADR conflicts.

Spec: 0 findings. Claude turns and OpenCode steps accumulate by session id with normalized input/cache/output counts; Codex replaces total/last from its thread report and keeps raw tokens/rate limits. hub.status exposes the adapter usage; both nvim consumers read total and guard absent usage. Fakes match Claude's installed snake_case TurnUsage contract. Tests cover the two turns/steps and Codex pass-through; README documents semantics and restart limits. Nothing under .cland/tasks is in the reviewed diff.

Read-only verification: git diff --check passed; inspected /tmp/T-47-full-tests.log (250 hub and 61 nvim passed, zero failures/skips, including the new total/cost rendering test). Did not independently rerun tests or edit files.

No high, medium or low findings.

### qa-1 · 2026-10-09T07:22:34.056Z

verdict: qa
result: clear
by: qa-1 [qa]
run: qa-2026-10-09-T47-1

Checked t/T-47-session-usage-totals at 3e1bb6e85bbcb2f090c1e411a151152e56a080cb against the item and Coordinator's 06:56Z usage/reset decisions. All commands used Node v24.21.0, with its bin directory first on PATH. No product changes; worktree clean.

What I ran and saw:
- task.view T-47 and topic history; CLI task view T-47 --json and task list --json succeeded. Evidence /tmp/qa-T47-task-view.json and /tmp/qa-T47-task-list.json.
- npm run typecheck && npm test in the T-47 worktree: exit 0, 250/250 hub and 61/61 Neovim tests passed, no skips. This includes npm run test:nvim and the actual headless Neovim input/screen harness. Log /tmp/qa-T47-full.log.
- Afterwards, node --test hub/test/claude-code-adapter.test.ts hub/test/opencode-adapter.test.ts hub/test/codex-adapter.test.ts: 14/14 passed, no skips. Log /tmp/qa-T47-adapters.log. Read the assertions: Claude total 38 tokens vs last 19 after two turns, with real snake_case input/cache fields and no invented cost (claude-code-adapter.test.ts:123); OpenCode total 38 tokens/$0.50 vs last 19/$0.25, including cache-write and reasoning counts after two steps (opencode-adapter.test.ts:172); Codex total 24 vs last 12, normalized uncached input and cached input separate, original token report and rate limits retained (codex-adapter.test.ts:151).
- Read and independently ran via the suite nvim/test/shell.test.ts:945: the stub uses total 12,300 vs last 12 tokens and total $1.80 vs last $0.25. The screen asserts 12.3k tok and $1.80, explicitly rejects 12 tok/$0.25, then checks the item view also shows total $1.80. Passed.
- Real branch hub in a fresh temporary git project: init, hub start, task list, session launch u1 --role reviewer --harness codex; waited for its clause turn to become idle, then read session list --json and hub status --json. Removed CLAND_HUB_FILE for every temporary-project command while preserving session identity; no follow-up message sent. Both views had identical usage.total/last. Observed total: 116752 tokens = 19941 uncached input + 96512 cache read + 299 output; last: 32427 = 886 + 31488 + 53. Both include cacheWriteTokens:0 and reasoningTokens:47; cost absent. Asserted totals equal Codex's original totalTokens, uncached input equals original input minus cached input, and other fields match. Original usage.tokens and rate limits remain present. Session stop and hub stop both exited 0. Script /tmp/qa-T47-live.mjs; evidence /tmp/qa-T47-live.log; temporary root /private/var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T/qa-T47-live-LMsCVF. No start/stop/topic answer/role set against the project's own hub.
- hub/README.md:585-600 matches observed normalized fields, total-based presentation, absent unreported cost, authoritative Codex totals, and the agreed in-memory Claude/OpenCode reset on hub restart. Durability is out of scope.

Findings by severity: high none; medium none; low none.
Acceptance criteria satisfied.

### coord · 2026-10-09T07:26:20.130Z

Merged into main as 3306beb (`git merge --no-ff`, by the Coordinator) at 07:23Z; on main after the merge: typecheck clean, 250 hub + 61 Neovim tests pass. Verdicts: review clear rev-20261009-47-3e1bb6e (rev-2, 07:17:23Z), qa clear qa-2026-10-09-T47-1 (qa-1, 07:22:34Z: full suite on Node 24, the adapter files, the nvim panel test asserting totals, and a real Codex session on the branch's temporary hub showing the normalised total and last in `session list --json` and `hub status --json`, with raw totals and rate limits kept and no invented cost). Timeline: launched 06:55:05Z, claimed 06:55Z, implemented 07:14Z (19 min, with several waits on sandbox approvals), review 07:14Z to 07:17Z, QA 07:17Z to 07:22Z, merged 07:23Z: about 28 minutes from launch to merge. Not pushed. Merged ahead of T-48 (still in its fix round) although their branches conflict: T-48's re-review covers its merge of main.
