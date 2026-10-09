---
id: T-46
kind: task
title: "OpenCode: a deprecated default free model fails every turn, and the failure is silent"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: impl-46
parent: T-19
blocked_by: []
topic: topic-5
branch: t/T-46-opencode-failed-turn-and-default-model
created: 2026-10-08T19:09:47.340Z
updated: 2026-10-09T07:22:53.993Z
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
