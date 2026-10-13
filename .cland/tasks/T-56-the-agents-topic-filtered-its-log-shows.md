---
id: T-56
kind: task
title: "the Agents topic, filtered: its log shows one item's or one session's traffic"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-2
assignee: impl-56
parent: E-20
blocked_by: []
topic: topic-13
branch: t/T-56-agents-topic-filters
created: 2026-10-09T08:33:53.682Z
updated: 2026-10-10T00:58:17.651Z
closed: 2026-10-09T09:47:05.397Z
---

## Parent

Part of T-20 (slice 2, ticket 9 of 12). Spec section 7(d).

## What to build

`topic.history` on Agents takes `item` and `session` filters, applied in the hub over the whole record, so entries older than the loaded window are found. An entry concerns an item when its detail names the item or the item's bound topic (claims, releases, worktrees, merges, agent-message notices). It concerns a session when the session sent it, is among its addressees, or a notice's detail names it. In the Agents log, `f` asks for an item id or a session name, with completion from both; the header shows the filter (`AGENTS · T-12`); new entries that do not match stay out; `F` clears. `L` in an item view or on a session row opens the log filtered to it. The spoke's `history` on Agents takes the same filters, so the Coordinator can pull one item's agent traffic.

## Acceptance criteria

- [ ] `topic.history {topic:"agents", item:"T-12"}` returns T-12's entries only, including ones older than the latest 200; `session:"impl-12"` returns those from, to or about impl-12; both together return the intersection.
- [ ] In the Agents log, `f` with `T-12` shows only T-12's entries, with the filter in the header; a new entry about T-11 stays out and one about T-12 shows; `F` shows everything again.
- [ ] `L` in T-12's item view, or on impl-12's row in the sessions panel, opens the log filtered.
- [ ] The spoke's `history` honours both filters.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` and `nvim/README.md` document the filters.

## Notes

Test seam: frames and spokes against a real hub with scripted traffic; a headless Neovim against the hub. Size M. Implementer: Codex gpt-6.1-sol. Can start immediately.

## Comments

### impl-56 · 2026-10-09T08:37:56.554Z

Starting hub/spoke Agents history filters and Neovim filtered log navigation. Will verify history across the full record, live updates, and item/session shortcuts with focused integration tests, then run required checks.

### coord · 2026-10-09T08:39:13.122Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/51 (a sub-issue of #20; the item is the source of truth).

### impl-56 · 2026-10-09T08:44:18.485Z

Hub/spoke integration tests pass: predicates run before LIMIT, item notices include bound-topic traffic, session matching is exact across sender/addressees/notice details, and combined filters intersect. Implementing and testing f/F/L in headless Neovim against a real hub next.

### impl-56 · 2026-10-09T08:47:45.352Z

Committed implementation and docs as 698ec9c on t/T-56-agents-topic-filters. Focused hub/spoke tests (2) and headless Neovim test (1) passed before final verification. Required full suite and typecheck are running; standards/spec self-review is comparing against assigned baseline b8368b3.

### impl-56 · 2026-10-09T08:52:11.647Z

Self-review: Standards found no documented violations and one minor duplicated lookup, fixed in ae8c78e. Spec caught metadata false matches (e.g. session loop matching an unrelated mute's rule), fixed in 348d46b with a regression observed red then green through live Neovim, hub frames and spoke history. Final focused run: 4 passed, 0 failed. Full suite is still running under the Coordinator's reported high machine load; timing failures will be rerun alone.

### impl-56 · 2026-10-09T08:52:17.859Z

Correction to the preceding comment: the metadata collision fix is commit 44ac3f8 (not 348d46b). Spec re-review confirms the issue is resolved and reports no material remaining issue.

### impl-56 · 2026-10-09T08:58:03.741Z

Verification so far: final typecheck passes. Full hub suite: 271 tests, 262 passed, 7 documented sandbox skips, 2 existing Claude timing failures; both failed cases pass when rerun alone (2/2). npm test stopped before Neovim, so its full test:nvim phase is now running separately. Feature tests remain 4/4 passing.

### impl-56 · 2026-10-09T09:00:34.921Z

Implementation complete on t/T-56-agents-topic-filters: 698ec9c (feature), ae8c78e (reuse existing item-topic lookup), 44ac3f8 (session metadata collision fix). Files: hub/src/protocol.ts, hub/src/hub/{core,dispatch,store}.ts, hub/src/spoke/spoke.ts; nvim/lua/cland/{agents_log,bars,item_view,panels}.lua; hub/README.md, nvim/README.md; new real-hub integration tests in hub/test/agents-filters.test.ts and nvim/test/agents-filters.test.ts.

Standards review: 0 documented violations; 1 low-priority duplicated lookup, resolved by reusing state.topic_of_item.
Spec review: 1 P2 false-positive session match in arbitrary notice metadata, resolved by matching session-bearing facts; red/green regression verifies an unrelated mute's rule:loop does not match the valid session loop. Re-review: no material remaining issue. No feature omissions.

Validation: final npm run typecheck passed; focused tests 4/4; full hub run 271 tests, 262 pass, 7 documented sandbox skips, 2 existing Claude timing failures under heavy machine load. Both failed cases passed in isolated rerun (2/2). Since npm test stopped at those failures, npm run test:nvim was run separately: 64/64 pass, 0 skips. No retries or timeout changes were added. Working tree clean; nothing pushed or merged.

### rev-3 · 2026-10-09T09:04:16.837Z

verdict: review
result: clear
by: rev-3 [reviewer]
run: rev-20261009-56-44ac3f8

Reviewed pinned head 44ac3f8 against b8368b3, T-56 and the Coordinator's topic-13 brief, in this main thread only. No high, medium or low findings.

Standards: 0 documented-standard violations or actionable heuristic findings. Scope stays within history filters, the Agents view/navigation, integration tests and docs.

Spec: 0 findings. Store predicates apply before LIMIT over the retained record, use exact identifiers, include the current bound topic for items, and intersect item/session filters. Session-bearing metadata excludes unrelated harness/rule values. Frame and spoke validators, forwarding and non-Agents refusal are consistent. Neovim f/F completion and headers, L shortcuts, live predicates, reply-composer closure and request generation checks match the brief. Both READMEs document the filters.

Read the real-hub frame/spoke tests: matching entries beyond the latest 200, item claims/releases/topic references, sender/addressee/detail session matches, exact names and intersections. Read headless Neovim tests for f/F/L, live inclusion/exclusion and the loop metadata collision. git diff --check passed; no .cland/tasks diff. No edits or suite rerun.

Validation limit: Implementer reports final typecheck/focused 4/4 and Neovim 64/64 pass; full hub run has 262 passes, 7 sandbox skips and two unchanged Claude timing failures that passed alone. That full run is not a clean suite pass; review found no connection between those unchanged timing cases and this diff.

One rg lookup named test paths absent in this main checkout and exited 2; the added branch tests were already read through git diff. Other reads succeeded with the documented nonfatal Xcode cache warnings. Hub tools worked.

### qa-7 · 2026-10-09T09:12:31.789Z

verdict: qa
result: clear
by: qa-7 [qa]
run: qa-2026-10-09-T56-qa7

Checked branch t/T-56-agents-topic-filters at 44ac3f89468442b746a01bcfcce055679e5ed345 (698ec9c, ae8c78e, 44ac3f8). Worktree clean before and after; no product changes made.

Ran:
- task.view T-56 and the Coordinator's topic-13 brief; project CLI `node hub/bin/cland.ts task list --state open --json` and `task view T-56 --json`: succeeded (20 open items; T-56 returned).
- `npm run typecheck && npm test`: typecheck passed. Full hub run: 269 tests, 261 passed, 7 documented sandbox skips, 1 timing failure. npm therefore did not enter its Neovim phase.
- Isolated rerun: `node --test --test-name-pattern='late Claude start and StopFailure hooks keep failure notes with their own turn sender' hub/test/claude-code-sessions.test.ts`: passed 3/3 including its two nested cases (which the failed setup never reached in the full run).
- `npm run test:nvim`: 64/64 passed, no skips.
- `node --test hub/test/agents-filters.test.ts nvim/test/agents-filters.test.ts`: 4/4 passed, no skips. Read the assertions: whole-record search before LIMIT with 205 newer unrelated entries; exact sender/addressee/notice session matching; item/session intersection; matching spoke history; real headless Neovim driven with nvim_input and read with screenstring for f/Tab, headers, live admission/exclusion, F, and L from item/session rows; metadata collision regression.
- Independent scratch script `/tmp/qa-T56-scratch.mts`: temporary git project, CLI init/start, two assigned items, fake Claude session launch, two live test spokes, CLI claim of each item, list/view, then Unix-socket topic.history queries. T-1 returned exactly its claim; qa-alpha returned its role and claim notices; both returned exactly the same claim; T-1 + qa-beta returned []; qa-fake returned its launch notice. CLI calls unset CLAND_HUB_FILE, CLAND_SESSION_ID and CLAND_SESSION_NAME. Initial fixture omitted assignees and was correctly refused; corrected the scratch fixture and repeated successfully. Both scratch hubs stopped successfully with `hub stop`; fake processes/spokes cleaned up. No stop/start/role changes against the project hub.
- Docs checked: hub/README.md:103 and nvim/README.md:36, including key table: match the behavior exercised.

Findings by severity:
- High: none.
- Medium: none.
- Low / evidence limit: full npm test was not green in one uninterrupted run. hub/test/claude-code-sessions.test.ts:125 timed out waiting 15000ms for the fake Claude clause turn's busy/idle setup under the reported high load; isolated rerun passed, including both nested cases. Seven existing ps-dependent checks skipped under the documented sandbox restriction. No T-56 failure reproduced.

Evidence: /tmp/qa-T56-full.log, /tmp/qa-T56-isolated.log, /tmp/qa-T56-nvim.log, /tmp/qa-T56-focused.log, /tmp/qa-T56-scratch-retry.log; scratch script /tmp/qa-T56-scratch.mts. QA clear for the requested T-56 scope.

### coord · 2026-10-09T09:47:05.395Z

Merged into main as 687b030 (`git merge --no-ff`, by the Coordinator) at 09:12Z; on main after the merge: typecheck clean, 271 hub + 64 Neovim tests pass (the suite ran in the background and finished at 09:46Z). Verdicts: review clear rev-20261009-56-44ac3f8 (rev-3, 09:04Z), qa clear qa-2026-10-09-T56-qa7 (qa-7, 09:12Z: the full suite with two load timeouts passing alone, the changed tests, a scratch hub with two items, a fake launch and the item, session and intersection filters over the socket, the docs). Timeline: launched 08:37Z, implemented 09:00Z (three commits by impl-56, Codex), review 09:01Z to 09:04Z, QA 09:02Z to 09:12Z, merged 09:12Z. The first slice 2 ticket in main. GitHub mirror #51. Not pushed.
