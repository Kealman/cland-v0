---
id: T-46
kind: task
title: "OpenCode: a deprecated default free model fails every turn, and the
  failure is silent"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: impl-46
parent: E-19
blocked_by: []
topic: topic-5
branch: t/T-46-opencode-failed-turn-and-default-model
created: 2026-10-08T19:09:47.340Z
updated: 2026-10-10T00:58:17.526Z
---

## Parent

Part of T-19. Found in the T-42 dogfooding run on 2026-10-08: the Implementer `impl-43` was launched for T-43 with no model, and the OpenCode adapter picked `opencode/exo-free`, the first free OpenCode Zen model `GET /api/model` listed (`status: active`). Every turn failed upstream (`Upstream request failed: Endpoint is unavailable`; `opencode run -m opencode/exo-free` says `Model exo-free has been deprecated`). The session went `idle` after the failed turn, and nothing told the Coordinator or the human: the Coordinator waited for a report that never came.

Workaround in this repo: `.cland/roles.toml` pins the Implementer to `opencode/big-pickle`.

## What to build

- **A failed turn is not silent.** When OpenCode reports `session.execution.failed` (or a turn ends with an error), the hub records an Agents notice and an inbox notification naming the session and the error's first line (`impl-43 [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable`), and the session that sent the turn's message (the Coordinator here) gets a hub note. Same shape for Codex (`turn/completed` with an error) and Claude Code (`StopFailure`) where the adapter sees it.
- **The default free model is one that answers.** `pickFreeModel` (`hub/src/adapters/opencode/client.ts`) prefers a known-good list (`opencode/big-pickle` first) before the first listed one, or the launch probes the picked model with one cheap request and falls back to the next on failure. Pick one; say which in `hub/README.md`.

## Acceptance criteria

- [ ] A fake OpenCode whose turn fails produces the Agents notice, the inbox notification and the hub note to the sender (test in `hub/test/opencode-adapter.test.ts`)
- [ ] A launch without a model does not pick a model the server lists but that fails (test against the fake server)
- [ ] `hub/README.md` documents both
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:14:43.628Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/45 (filed during the T-42 run; the numbers differ, the item is the source of truth).

### impl-46 · 2026-10-09T06:55:39.883Z

Starting implementation on t/T-46-opencode-failed-turn-and-default-model. Plan: regression tests for failed-turn notices/sender delivery, prefer known-good free models, document behavior, run typecheck/full suite and review.

### impl-46 · 2026-10-09T07:05:16.106Z

Model selection regression reproduced exo-free being chosen; now passes with big-pickle. Failed OpenCode regression reproduced silent idle; implemented shared journalled turn-failed Agents/inbox reporting and sender hub notes, checking the adapter test next. Codex and Claude error paths follow.

### impl-46 · 2026-10-09T07:10:59.128Z

All three adapter files pass: 18 tests, 18 pass, 0 fail. Fake failures now exercise OpenCode SSE, Codex turn/completed (after idle), and real Claude StopFailure hook CLI. README documents reporting and deterministic big-pickle preference/fallback without probe. Reviewing before the full suite.

### impl-46 · 2026-10-09T07:16:08.590Z

Review complete: Standards 0 findings, Spec 0 remaining findings after fixing queued OpenCode admissions and late Claude hook attribution. Four adapter/hook files now pass 29/29. Required full npm run typecheck && npm test is running on Node 24.21.0; output /tmp/cland-T46-full-tests.log. Files changed are hub adapters, hook CLI, Agents/inbox/journal protocol, fake-harness tests and hub/README.md; no tracker files in this branch.

### impl-46 · 2026-10-09T07:18:56.929Z

Implemented and committed e877fac (feat(hub): report failed turns and prefer big-pickle for OpenCode) on t/T-46-opencode-failed-turn-and-default-model. Unified journalled Agents/inbox failed-turn notices and sender hub notes for OpenCode, Codex, Claude; queued OpenCode and delayed Claude attribution regressions; deterministic known-good free model preference and README docs. Validation: Node 24.21.0 npm run typecheck && npm test passed: 256 hub + 60 Neovim tests, 0 failures; log /tmp/cland-T46-full-tests.log. Standards/Spec review clear after fixes. No .cland/tasks files committed. Real OpenCode verification remains QA's as assigned.

### coord · 2026-10-09T07:19:20.022Z

Implementer report (impl-46, Codex gpt-6.1-sol, 07:18:56Z): one commit e877fac on `t/T-46-opencode-failed-turn-and-default-model` (merge-base 66f1353): the adapters report failed turns to Agents, the inbox and the turn's sender (OpenCode ties delivered inbox ids to each execution; Claude Code uses timestamped turn starts so a late hook notifies the right sender), `pickFreeModel` prefers `opencode/big-pickle`, README and fake-harness regressions. `npm run typecheck && npm test` on Node 24: 256 hub + 60 Neovim, 0 failures. Launched 06:55:04Z, claimed 06:55Z, report 07:18Z: about 24 minutes, with several waits on sandbox approvals. Review requested from rev-2 at 07:20Z in topic-5; the real OpenCode check is QA's.

### rev-2 · 2026-10-09T07:22:26.036Z

verdict: review
result: not clear
by: rev-2 [reviewer]
run: rev-20261009-46-e877fac

Reviewed e877fac against merge-base 66f1353, T-46 and the Coordinator brief. Findings ranked by severity (Spec unless stated):

Medium — hub/src/adapters/sessions.ts:366: If a failed Claude turn's asynchronous start signals arrive after its StopFailure, the timestamp lookup selects the preceding turn's sender and never reconciles the later start. This violates the sender hub-note requirement. A read-only in-memory evaluation of the branch confirmed: A start at 100 arrives, B failure at 300 arrives, B start at 200 arrives last; sender-a receives "B failed" and sender-b receives nothing. Buffer/reconcile attribution rather than choosing the prior known turn. The new regression covers reordered starts before the failure, not this ordering.

Medium — hub/src/adapters/codex.ts:418: The steering message is added to the old turn's attribution set before turn/steer accepts it. If that turn completes failed while the RPC is pending, the sender is notified before a subsequent stale-turn rejection removes the message. The note describes a failed turn this sender's input never entered. Reconcile completion with admission before notifying; cover failure-before-rejected-steer-response.

Medium — hub/src/adapters/opencode.ts:282: An SSE disconnect retains w.turnMessages. If A finishes during the outage, neither forget(), reset() nor the next execution.started clears A's ids; B's later failure notifies A as well as B. The documented missed-event limitation does not permit cross-execution attribution. Clear uncertain execution attribution on disconnect or reconcile it by execution identity; cover completion missed during disconnect followed by another failed execution.

Low — hub/src/adapters/sessions.ts:358: Every Claude hook/mod start remains in #turnMessages until vacation/shutdown; successful turn completions never prune it. Long-running sessions retain all start records and every failure filters/sorts the full history. Bound the retained attribution history while preserving delayed-hook handling.

Standards: no hard documented-standard breaches; a low judgment-call concern is Claude-specific raw-event bookkeeping in shared Sessions rather than neutral adapter metadata (sessions.ts:356). Spec: 3 medium and 1 low finding; sender attribution prevents clear.

Model preference, first-line error extraction, Agents/inbox wiring, documentation and ordinary fake-harness acceptance coverage otherwise match the brief. No .cland/tasks changes or usage/launch-policy changes in the diff. Read-only verification: git diff --check passed; recorded /tmp/cland-T46-full-tests.log shows 256 hub + 60 nvim pass, zero failures/skips. No file edits or independent full-suite rerun.

### impl-46 · 2026-10-09T07:22:53.993Z

Addressing rev-20261009-46-e877fac: reconcile Claude attribution when failure beats start and bound its history; reconcile Codex failed completion with pending steer admission; clear OpenCode execution attribution across SSE disconnect. Adding ordering regressions, then one full check and follow-up commit.

### impl-46 · 2026-10-09T07:59:05.093Z

Completed four rev-2 fixes and regressions in 127ce02; main59043fa (T-47 usage totals + T-48 launch policy) merged as 9a73ec4, retaining both sides. Node24 npm run typecheck && npm test PASS: 264 hub +62 Neovim tests. Worktree clean; tracker files match main exactly. Adapter code, hook payloads, fake-harness tests and hub/README.md updated. Ready for rev-2 re-review. Earlier reports were blocked by MCP 'this spoke was replaced'.

### coord · 2026-10-09T08:01:16.755Z

Fix round (impl-46, report 07:59Z after a relaunch; its earlier reports failed on "this spoke was replaced", T-51): 127ce02 fixes the four findings of rev-20261009-46-e877fac with regressions (Claude Code reconciles by the native `prompt_id` with a bounded history; Codex attributes only accepted admissions, including acknowledgements after completion; OpenCode clears uncertain attribution on an SSE loss); 9a73ec4 merges main 59043fa keeping T-47's usage totals and T-48's launch policy; head 9a73ec4. `npm run typecheck && npm test` on Node 24: 264 hub + 62 Neovim pass. Second-round review requested from rev-2 at 07:59Z; QA from qa-4 (the new policy) at 08:00Z, including the real OpenCode check within its sandbox's limits.

### qa-4 · 2026-10-09T08:04:16.089Z

verdict: qa
result: clear
by: qa-4 [qa]
run: qa-20261009-46-9a73ec4

Checked branch t/T-46-opencode-failed-turn-and-default-model at 9a73ec4 with Node 24.21.0. No source changes; final git status clean and git diff --check passed.

Ran:
- task.view T-46 and topic-5 brief/decisions; node hub/bin/cland.ts task list --state open --json and task view T-46 --json both succeeded.
- npm run typecheck && npm test once: typecheck passed (test command ran); full output reports 264 hub tests: 258 pass, 0 fail, 6 skips (five ps identity checks and one macOS sandbox-exec check); 62 Neovim tests: 62 pass, 0 fail/skips. Neovim harness drives nvim_input and reads screenstring(). Log: /tmp/cland-qa4-T46-full.log. The final tool poll surfaced a sandbox network denial to opencode.ai rather than an exit result; complete suite totals were already written.
- node --test hub/test/opencode-adapter.test.ts hub/test/codex-adapter.test.ts hub/test/claude-code-adapter.test.ts hub/test/claude-code-sessions.test.ts: exit 0; 35 tests, 32 pass, 3 ps-related skips, 0 fail. Read assertions verifying first-line Agents/inbox notices and sender hub notes for all three harnesses, Claude prompt_id reconciliation including failure-before-start and bounded history, accepted/rejected Codex steers, OpenCode SSE outage and queued-turn attribution. Log: /tmp/cland-qa4-T46-adapters.log.
- Fake no-model launch prefers big-pickle over deprecated exo-free and answers. The fallback launch assertion at opencode-adapter.test.ts:107 belongs to a skipped ps-dependent test, so I additionally ran direct branch pickFreeModel assertions: big-pickle preference, first free Zen fallback, first free other-provider fallback all pass.
- Real OpenCode through this branch's hub in /private/var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T/cland-qa4-T46.SdFU8V. Every scratch command unset CLAND_HUB_FILE; kept session variables. git init, cland init, hub start, session launch/list/inbox exercised. Initial launch hit EPERM writing the normal OpenCode log; restarted only scratch hub with XDG data/cache/state/config paths under scratch. Explicit o2 --model opencode/exo-free failed with 'Model unavailable: opencode/exo-free'; no-model o3 selected opencode/big-pickle and failed with 'Provider request failed with HTTP 403: Domain not in allowlist.' Both failures have matching named first-line inbox notifications and journal turn-failed records with agentsNotice ids. /tmp/cland-qa4-T46-inbox.txt, /tmp/cland-qa4-T46-failures.jsonl and /tmp/cland-qa4-T46-sessions-final.json preserve evidence.
- README lines 487 and 543 describe the implemented failure reporting, attribution limits, deterministic big-pickle preference and fallback without a probe.

Findings / evidence limits, ranked:
- Low, unconfirmed cold-catalog observation: first no-model o1 in fresh XDG dirs selected openrouter/inclusionai/ling-3.1-flash. A later GET /api/model had 438 models including free/active/tools-enabled big-pickle; pickFreeModel on that later catalog returned big-pickle, and the next no-model launch o3 selected it. opencode.ts:150-156 returns on the first nonempty catalog. I did not capture the catalog at o1 selection time, so this does not establish a picker violation; a partially loaded catalog is a hypothesis. Evidence: /tmp/cland-qa4-T46-o1-retry.log, /tmp/cland-qa4-T46-o3-launch.log, /tmp/cland-qa4-T46-models-summary.json.
- Evidence limit: the network sandbox prevents confirming that real big-pickle answers; its actual failure was correctly surfaced. No confirmed T-46 blocker in the exercised behavior.
- Cleanup environment limit: session stop o1/o2/o3 reported stopped and scratch hub stop succeeded (hub PID 57342 exited), but their OpenCode HTTP endpoints still answered. kill -TERM 57623 59888 64341 was denied EPERM. Sent those exact scratch-only PIDs to Coordinator for cleanup. Project hub was never started/stopped or reconfigured.

### rev-3 · 2026-10-09T08:07:00.337Z

verdict: review
result: clear
by: rev-3 [reviewer]
run: rev-20261009-46-9a73ec4

Reviewed pinned head 9a73ec4 against merge-base 59043fa, including the 127ce02 fixes, both merge resolutions, T-46 and the Coordinator's topic-5 decisions. No high, medium or low findings remain.

Standards: 0 documented-standard violations and 0 actionable heuristic findings. Harness-specific attribution stays in the adapters; reporting reuses the journal → Agents → inbox path.

Spec: 0 findings. All four previous findings are closed: Claude matches native prompt_id even when failure precedes start and bounds history to 64; Codex records attribution after RPC acceptance and reconciles acceptance after completion without notifying rejected steers; OpenCode clears both execution inputs and queued inbox attribution on SSE loss. Fake-seam regressions cover these orders. All three adapters preserve named first-line Agents/inbox notices and sender hub notes. The deprecated-first fake launch selects big-pickle and answers; fallback and README match the decision.

The merge preserves T-47 usage totals, T-48 launch-policy plumbing, contract/protocol types and fake behavior. No net .cland/tasks changes. Read-only git diff --check passed. Read QA logs: hub 258 pass/6 skips, Neovim 62 pass; focused adapters 32 pass/3 skips. No test rerun or file edits. Git reads succeeded despite the documented nonfatal Xcode cache warnings. Real model answering remains QA's network-limited evidence; T-50/T-51/T-52 excluded.

### coord · 2026-10-09T08:09:28.065Z

Merged into main as 18dce79 (`git merge --no-ff`, by the Coordinator) at 08:07Z; on main after the merge: typecheck clean, 269 hub + 62 Neovim tests pass. Verdicts: review not clear rev-20261009-46-e877fac (rev-2, 07:22Z: three medium attribution races, one low), fix 127ce02 and the merge of main 9a73ec4, review clear rev-20261009-46-9a73ec4 (rev-3, 08:07:10Z; rev-2 stopped answering after the second-round request and was replaced); qa clear qa-20261009-46-9a73ec4 (qa-4, 08:04Z, under the new policy: the suite in the worktree with the documented skips, the adapter tests, and the real OpenCode on a scratch hub: a launch on the deprecated `opencode/exo-free` and a launch whose provider call was refused by the sandbox both produced the inbox notification and the Agents notice; a no-model launch on a warm catalog selected big-pickle; evidence limits: whether big-pickle answers was not observable without internet, and a cold-catalog first launch picked an OpenRouter model, filed as T-52). Cleanup after QA: three scratch `opencode serve` processes survived `session stop` under the sandboxed hub and were terminated by the Coordinator. Timeline: launched 06:55:04Z, implemented 07:18Z (24 min, with approval waits), review loop 07:20Z to 08:07Z (one fix round; the Implementer's reports were blocked by a replaced spoke, T-51, until a relaunch), QA 08:00Z to 08:04Z, merged 08:07Z: about 72 minutes from launch to merge. Not pushed.
