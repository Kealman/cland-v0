---
id: T-43
kind: task
title: "cland inbox and cland topic answer: answer an ask from the CLI"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: impl-43b
parent: E-19
blocked_by: []
topic: topic-1
branch: t/T-43-cland-inbox-topic-answer
created: 2026-10-08T18:56:39.124Z
updated: 2026-10-10T00:58:17.503Z
closed: 2026-10-08T19:47:17.340Z
---

## Parent

Part of T-19. The open point of T-33 (#33): "no `cland topic answer` CLI". Found while preparing T-42 (dogfooding): the human can answer an ask only from the Neovim inbox; a terminal without the workbench, a script or an agent acting for the human cannot.

## What to build

Two CLI commands in `hub/src/cli/` over the hub's existing UI frames (`inbox.list`, `topic.answer`, see `hub/README.md`, "Asks and the inbox"), wired into `hub/bin/cland.ts` and its usage text like `cland role` (`hub/src/cli/role.ts` is the pattern: `readDiscovery`, `askHubFrame`, `--json`):

- `cland inbox [--json]`: prints the open asks, one block each: the ask id, the topic title (and its bound item when there is one), the asker's label, then the question and the numbered options (`1. …`); then one line per approval, waiting topic and notification; last, `needs you: <n>`. `--json` prints the `Inbox` value as the hub returns it.
- `cland topic answer <ask id> <option number>` or `cland topic answer <ask id> --text "<free answer>"`: sends `topic.answer` and prints `answered <ask id> in <topic title>: <the answer text>`. The hub's refusals (an ask that is not open, an option out of range, a free answer to an options-only ask) are printed as `cland: <error>` with exit code 1.

No hub change: both frames exist.

## Acceptance criteria

- [ ] `cland inbox` lists an open ask with its id, topic, asker, question and numbered options, and `needs you`; `--json` prints the hub's `Inbox`
- [ ] `cland topic answer <ask> 2` answers with option 2; the Coordinator's spoke receives the answer with `answer_to`, and the ask leaves `cland inbox`
- [ ] `cland topic answer <ask> --text "…"` sends a free answer; refusals from the hub exit 1 with the hub's message
- [ ] A test in `hub/test/` starts a real hub (`cland hub start` in a temporary project, as `daemon.test.ts` does), has a Coordinator spoke ask, and runs both commands as child processes
- [ ] `hub/README.md` documents both commands (the CLI table of "Asks and the inbox"), and its "Not here yet" line about `cland topic answer` is removed
- [ ] `npm run typecheck && npm test` pass

## Comments

### coord · 2026-10-08T19:03:49.307Z

Handed to impl-43 (Implementer, OpenCode, model opencode/exo-free), launched 2026-10-08 19:03Z in the worktree `.cland/worktrees/T-43` on branch `t/T-43-cland-inbox-topic-answer`. The brief is in topic-1. Next: review and QA through the Reviewer and QA roles (Codex), then one ask to the human before the merge; the human merges.

### coord · 2026-10-08T19:10:45.586Z

impl-43 never produced a turn: its model `opencode/exo-free` is deprecated upstream and every turn failed without a report (T-46, filed by the human). The human stopped it and pinned the Implementer to `opencode/big-pickle`. Relaunched 2026-10-08 19:10Z as impl-43b, same worktree and branch, same brief in topic-1; assignee moved to impl-43b.

### impl-43b · 2026-10-08T19:12:56.809Z

impl-43b took over: claimed T-43 (assignee moved from impl-43 to impl-43b). Reading hub/README.md (Asks and the inbox), src/cli/role.ts and the test harness; building the two commands next.

### impl-43b · 2026-10-08T19:21:47.226Z

Done, commit 47e9359 on t/T-43-cland-inbox-topic-answer (unpushed). hub/src/cli/inbox.ts: `cland inbox [--json]` (ask blocks + approval/waiting/notification lines + `needs you`, --json = the raw Inbox) and `cland topic answer <ask> <n> | --text "…"` (confirmation with the topic title; hub refusals print as `cland: <error>`, exit 1), both over inbox.list/topic.answer like `cland role`. Wired into bin/cland.ts + usage text; hub/README.md CLI table added, its 'Not here yet' line about topic answer removed. Tests: hub/test/asks-cli.test.ts (4 tests: a real daemon in a temp project, a Coordinator spoke asks, both commands as child processes; option answer, free answer, refusals, no-hub, --json). npm run typecheck clean; npm test: 235 pass, 0 fail.

### rev-43 · 2026-10-08T19:24:55.644Z

verdict: review
result: not clear
by: rev-43 [reviewer]
run: rev-2026-10-08-43-1

Reviewed commit 47e9359 against merge-base 31057a3, read-only.

## Standards

No documented-standard violations or material baseline smells found. The discovery/socket/JSON/no-hub and top-level error patterns match cland role; only the four requested paths changed, with nothing committed under .cland/tasks.

## Spec

- medium: hub/src/cli/inbox.ts:77 rejects integer options 0 and -1 locally via `n < 1`, replacing the required hub refusal with `cland: the option is a number…`; for an open two-option ask, `cland topic answer <ask> 0` must instead print `cland: option 0 is not one of 1-2` and exit 1. T-43 requires refusals to exit 1 with the hub's message. Let integer range validation reach topic.answer and add lower-bound refusal coverage (the current test covers only option 3).

The remaining command behavior, frame shapes, inbox order/fields, README table/removal, and real-hub/Coordinator-spoke/child-process test setup match the item. No scope creep found. Tests were not run; QA owns execution.

Standards: 0 findings. Spec: 1 medium finding.

### impl-43b · 2026-10-08T19:27:31.520Z

Review fix (rev-2026-10-08-43-1): commit 699f031 — `cland topic answer` no longer rejects option 0/negatives locally; any integer reaches topic.answer and the hub's refusal prints `cland: option 0 is not one of 1-2` (exit 1). Non-numeric options stay a CLI usage error. Test added next to the option-3 case; typecheck clean, npm test 235 pass, 0 fail.

### rev-43 · 2026-10-08T19:28:29.999Z

verdict: review
result: clear
by: rev-43 [reviewer]
run: rev-2026-10-08-43-2

Reviewed fix 699f031 and cumulative diff 31057a3...699f031, read-only, against T-43 and the previous verdict.

## Standards

No findings. The fix preserves the CLI discovery, socket, JSON, no-hub and error patterns. Only the four requested files changed; nothing under .cland/tasks was committed.

## Spec

No remaining findings or regressions found. The previous medium finding is closed: hub/src/cli/inbox.ts:79 keeps integer validation but passes option 0 and negative integers to topic.answer, whose refusal reaches the existing `cland: <error>`/exit-1 path. hub/test/asks-cli.test.ts:95 adds the child-process option-0 case with the exact hub refusal and exit code. The rest of the cumulative implementation remains consistent with the item.

Standards: 0 findings. Spec: 0 findings. Tests were not run; QA owns execution.

### qa-43 · 2026-10-08T19:44:24.284Z

verdict: qa
result: clear
by: qa-43 [qa]
run: qa-2026-10-08-43-1

Checked branch t/T-43-cland-inbox-topic-answer at 699f031 (including 47e9359). Working tree clean before and after; no source edits, commits, merges or pushes.

Ran and observed:
- Read T-43 with task.view and its six acceptance criteria. `node hub/bin/cland.ts task list --json` and `task view T-43 --json` from the worktree both exited 1 with the known no-hub discovery message (T-44). Used task.list and task.view successfully as the role's permitted fallback.
- `npm run typecheck && npm test`: typecheck passed. Initial sandbox run failed on local socket permissions (`listen EPERM: operation not permitted 127.0.0.1`); reran with socket access. Final command exited 0: hub 235 passed / 0 failed; Neovim 57 passed / 0 failed; 292 total, no skips or cancellations. Test output retained at /tmp/qa-2026-10-08-43-tests.log. The Neovim suite uses the project's real headless client harness with nvim_input and screenstring().
- All FOUR tests in hub/test/asks-cli.test.ts passed: inbox listing and JSON; option 2 confirmation, answer_to delivery and ask removal; free answer plus hub refusals (including options 3 and 0, options-only free answer, already-answered and unknown ask) and malformed usage; no-hub note. These tests start real hubs in temporary projects and invoke the commands as child processes. Happy-path answering was exercised only there, not on the project's real asks.
- From /Users/evgeniyivanov/Projects/cland/v0, ran branch script `node .cland/worktrees/T-43/hub/bin/cland.ts inbox` and `inbox --json`. Initial socket access was sandbox-blocked (connect EPERM); the rerun succeeded, exit 0. JSON Inbox matched text: asks=[], approvals=[], waiting=[], nine notification entries in the same order and with matching text, needsYou=0 / `needs you: 0`; no ask block.
- Same script from repo root: `topic answer no-such-ask 1` exited 1 with `cland: no ask "no-such-ask"`; `topic answer` exited 1 with `cland: usage: cland topic answer <ask id> <option number> | --text "<free answer>"`.
- From the worktree: `node hub/bin/cland.ts inbox` exited 1 with `cland: no hub runs for this project — run `cland hub start`` (known T-44, fails cleanly). Missing-argument topic answer there also reaches no-hub discovery before usage validation; repo-root usage check above passed.
- `node hub/bin/cland.ts --help` exited 0 and documented inbox plus both topic-answer forms. hub/README.md:138-140 agrees; its Not here yet section (line 321 onward) no longer lists topic answer.

Findings by severity:
- High: none.
- Medium: none in T-43's requested scope. Known T-44 worktree hub discovery reproduced as requested; not a new finding or a blocker for this pass.
- Low: none. The brief's five-test count was corrected to four; all requested behaviors are covered.

No real ask was answered or raised, and no real notification was dismissed. T-45 and T-46 were not exercised.

### coord-2 · 2026-10-08T19:47:17.337Z

Merged into main by the human at 2026-10-08 19:46:30Z as ba8b5b8 (merge of 699f031 onto 8c6a2e5; the branch's two commits 47e9359 and 699f031). Verdicts on this item: review clear (rev-43, rev-2026-10-08-43-2) and qa clear (qa-43, qa-2026-10-08-43-1), after one review loop (rev-2026-10-08-43-1 not clear, fixed in 699f031). Pushing is the human's choice. The worktree .cland/worktrees/T-43 and the branch t/T-43-cland-inbox-topic-answer remain for the human to remove.
