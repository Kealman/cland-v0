---
id: T-366
kind: task
title: "Limited accounts refuse launches: a limit-hit signal from Claude Code, Codex or OpenCode marks the account limited until its reset, a launch on it is refused naming the reset, and cland account clear lifts the mark"
state: closed
status: done
size: L
criterion_seq: 9
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-272
blocked_by:
  - T-364
  - T-365
topic: topic-243
branch: t/T-366-limited-accounts-refuse-launches-a-limit
created: 2026-10-13T23:42:54.826Z
updated: 2026-10-14T13:00:21.245Z
closed: 2026-10-14T13:00:21.245Z
---

## Summary

Each of the three adapters reports a hard limit from the harness's machine-readable signal. The hub then marks the account limited until the reset the signal names, refuses every new launch on it with a typed refusal that names the account and its reset, and highlights it in the accounts block. Nothing fails over, rotates or picks another account. Running sessions keep running, the human picks another account through the Coordinator, and `cland account clear` lifts a mark by hand.

## Parent

E-272: Accounts and limits, tracer bullet 6 of 6. Spec: `docs/spec/v0.1.2.md` §3.13 ("Routing without rotation"): on a limit-hit signal the hub marks the account limited, refuses new launches on it and asks the human to pick another, with no automatic failover or round-robin. The epic's choices set the rest:

- a mark lasts until the reset the signal names;
- `cland account clear` lifts it, which an OpenCode account needs;
- a refused launch names the account and its reset;
- the hub asks nothing itself.

Research, `docs/research/account-limits.md`:

- sections 1.4, 2.4 and 3.4 give the signals;
- section 5.5 says to classify by the machine-readable fields, never by text, and never to retry a hard limit in a loop;
- section 5.6 gives the terms.

Ticket T-364's `poll(account)` is the after-hit trigger, and ticket T-365's block shows the mark.

## What to build

**The signals.** Each adapter reports a hit through a new host callback, `limitHit(sessionId, {reason, resetsAt?})`.

- **Claude Code.** A `StopFailure` hook whose payload's `error` is `rate_limit`. `interpret` keys on that field and never on the text. `overloaded` and `server_error` mark nothing.
- **Codex.** `codexErrorInfo: "usageLimitExceeded"`, from the app-server's `error` notification or from the failed turn's `error` on `turn/completed`. `rateLimitExceeded` is a retryable throttle and marks nothing. The adapter keeps only the message today (`turnError`), so it now also reads `codexErrorInfo`.
- **OpenCode.** `session.execution.failed` whose `error.type` is `provider.quota`, in `hub/src/adapters/opencode/state.ts`. `provider.rate-limit` is retried by OpenCode and marks nothing.

**The reset.**

- Codex: the `resetsAt` of the window at 100% in the account's latest reading. The `account/rateLimits/updated` that arrives before the error sets it.
- Claude: the `resetsAt` of the window at 100% in the latest reading. When there is none, the after-hit poll's.
- OpenCode: none. The mark stays until it is cleared by hand.
- If no reset is known, the mark reads `until cleared`.

**The mark.**

- A mark is `{since, reason, session, resetsAt | null}` on the account in ticket T-363's store, persisted in `hub.db` meta, so a restart keeps it.
- It lifts at `resetsAt`: a timer, and a check at each launch.
- On a new mark, the hub:
  - journals `account-limited`;
  - posts one warn notice in the Agents topic, which reaches the inbox and the Coordinator, for example `account codex-a hit its limit (usageLimitExceeded); launches on it are refused until Sun 04:03`;
  - calls `poll(account)` once to learn or confirm the reset. For a Codex account with a live session, that is the live app-server's `account/rateLimits/read`, not a new process.
- A second hit while the mark holds adds no notice and no poll.
- The account's view in `account.list` and the `account` event carry `limited`.

**The refusal.**

- `session.launch` on a limited account is refused before any process starts, whether the account is named by `--account` or by the role's `account`.
- The refusal is a typed result `code: "account-limited"` with `{account, resetsAt}` and the text `account codex-a is limited until <local time> (<ISO>); launch on another account with --account`.
- A relaunch (`session.resume --relaunch`) and a retained pool handoff onto a limited account are refused the same way.
- A hub-restart re-find of a live session is not a launch and is allowed.
- Running sessions on the account are neither stopped nor moved.
- No code path picks another account. The effective account stays the request's, else the role's, else the default (ticket T-361).

**`cland account clear <name>`.** An `account.clear` frame, allowed for the human and the Coordinator. Implementer, Reviewer, QA, Lead and Aide sessions get the inline `ToolForbidden` refusal that `crew.set` gives. It lifts the mark and journals `account-limit-lifted` with `by: "hand"`. A mark that lifts at its reset journals `by: "reset"`.

**The workbench.** In the accounts block, a limited account's line is `ClandRed` and reads `✗ limited · ↻<reset>`, or `✗ limited · until cleared`. The highlight goes when an `account` event lifts the mark.

**Fakes.**

- `fake-codex.ts`: a prompt containing "hit the usage limit" sends `account/rateLimits/updated` at 100% with a reset, then `error` with `codexErrorInfo: "usageLimitExceeded"` and `willRetry: false`, then a failed `turn/completed`. One containing "hit a rate limit" sends `rateLimitExceeded` instead.
- `fake-claude.ts`: a prompt containing "hit the usage limit" ends the turn with `StopFailure`, `error: "rate_limit"` and `error_details: "429 Too Many Requests"`.
- `fake-opencode.ts`: a prompt containing "hit the usage limit" fails with `session.execution.failed` and `error.type: "provider.quota"`. One containing "hit a rate limit" uses `provider.rate-limit`.

**Docs.** The Accounts section of `hub/README.md` covers the three signals, the mark and how long it lasts, the refusal and its code, what is never done (failover, rotation, moving a session), and `cland account clear`. `nvim/README.md` covers the highlight.

**Demo** (the epic's words). A fake Codex `usageLimitExceeded` marks codex-a limited. The next launch on it is refused, and `cland account clear codex-a` lifts the mark.

**Out of scope.** The Coordinator's clause that turns a refusal into an ask (ticket T-367). Waiting out a limit inside a session, such as `CLAUDE_CODE_RETRY_WATCHDOG`. Marking an account that is near its limit: only a hit marks one.

**Constraints.**

- Tests go through the frame protocol first, then the fakes.
- A scratch registry lives under the test's `XDG_CONFIG_HOME`.
- Reset times are shortened by writing near-future resets into the fakes' readings.
- Read `hub.log` and `journal.jsonl` only after the `flushLogs` barrier.
- Panel tests wait on state, never on a sleep.
- No new seams inside the hub, and no helpers added to `hub/test/harness.ts`. Classify new test files in `hub/test/shards.json`.
- Suites run through `cland verify` after a clear review at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. A fake Codex `usageLimitExceeded` on a codex-a session marks codex-a limited with its window's reset. `cland account list --json` shows the mark, the journal holds `account-limited`, and one warn notice reaches the Agents topic.
  - done: impl-366 · 2026-10-14T10:41:16.672Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-3 · 2026-10-14T12:59:45.598Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb
- [x] C2. The next launch on codex-a, by `--account` and by a role pinned to it, is refused with `code: "account-limited"` naming codex-a and its reset. The fakes' records show no process started on codex-b or any other account, and the running codex-a session keeps running.
  - done: impl-366 · 2026-10-14T10:41:17.481Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-3 · 2026-10-14T12:59:45.598Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb
- [x] C3. A Claude `StopFailure` with `error: "rate_limit"` marks claude-b with the reset of its full window, and an OpenCode `provider.quota` marks oc-b `until cleared`. A Codex `rateLimitExceeded`, an OpenCode `provider.rate-limit` and a Claude `overloaded` mark nothing.
  - done: impl-366 · 2026-10-14T10:54:13.830Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-3 · 2026-10-14T12:59:45.598Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb
- [x] C4. A mark lifts at its reset and survives a hub restart that comes before the reset. `cland account clear codex-a` lifts it at once for the human and the Coordinator and is refused for an Implementer, a Reviewer and a QA session. Both lifts journal `account-limit-lifted` with `by`.
  - done: impl-366 · 2026-10-14T10:41:19.353Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-3 · 2026-10-14T12:59:45.598Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb
- [x] C5. A relaunch and a retained pool handoff onto a limited account are refused the same way, while a hub-restart re-find of a live session on it succeeds.
  - done: impl-366 · 2026-10-14T10:41:20.385Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-3 · 2026-10-14T12:59:45.598Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb
- [x] C6. A hit makes exactly one after-hit poll of its account, and a second hit while the mark holds adds no poll and no notice.
  - done: impl-366 · 2026-10-14T10:54:15.904Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-3 · 2026-10-14T12:59:45.598Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb
- [x] C7. The headless workbench shows codex-a in `ClandRed` with `limited` and its reset, and oc-b with `until cleared`. The highlight goes after `cland account clear`.
  - done: impl-366 · 2026-10-14T10:41:23.047Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-3 · 2026-10-14T12:59:45.599Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb
- [x] C8. `hub/README.md` and `nvim/README.md` describe the signals, the mark, the refusal and its code, what is never done, `cland account clear` and the highlight.
  - done: impl-366 · 2026-10-14T10:41:24.567Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-2 · 2026-10-14T10:55:50.408Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-3 · 2026-10-14T12:59:45.599Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb
- [x] C9. The account-limited refusal carries the account name and the reset time (or until cleared) as structured fields and in its text, for T-367's ask (stand-in, D24, 2026-10-13).
  - done: impl-366 · 2026-10-14T10:41:25.343Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-2 · 2026-10-14T10:55:50.408Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb
  - verified: rev-23 [reviewer] · run rev-2026-10-14-366-3 · 2026-10-14T12:59:45.599Z · commit 5aad58e50a09212adda305d33ffdeee412155eeb

## Comments

### impl-366 · 2026-10-14T10:37:21.691Z

Implemented persisted limited marks, machine-readable hard-hit classification for all three harnesses, reset timers and launch checks (including relaunch and retained pools), typed account-limited results, human/Coordinator-only account.clear, and the red workbench line. Seven protocol/fake scenarios and the new headless workbench scenario have passed in targeted runs; checking the existing polling/reading cases before review. Source-only review comes next, then exact-head cland verify. Scope-none QA policy requires no per-item brief.

### rev-23 · 2026-10-14T10:50:03.848Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-366-1
commit: 00861ebf97406fe55772456542b4f81adef97fa2
scope: full

Medium — hub/src/accounts/poller.ts:98: ready() false drops the sole after-hit trigger; held duplicate hits cannot restore it, so a recent prior poll can prevent learning the reset.
Medium — hub/src/accounts/limits.ts:9; hub/src/hub/core.ts:794: an expired cached full-window reset immediately clears a new hard-hit mark through the timer/launch check, allowing launches before the current reset is learned.
All 26 changed files reviewed; no additional standards finding. Evidence and required frame regressions: A-2330, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2330-t-366-source-review-deferred-polls-and-expired-cached-resets.md. No full run yet; corrected source review is required before verification.

Criteria: C6 failed (After-hit polling is discarded when the existing minimum/backoff is not yet eligible, without scheduling an eligible retry.), C3 failed (A new Claude hit can inherit an expired cached full-window reset and be cleared before its after-hit poll learns the current reset.).

### rev-23 · 2026-10-14T10:55:50.408Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-366-2
commit: 5aad58e50a09212adda305d33ffdeee412155eeb
scope: full

Source clear; no remaining high or medium findings. Both A-2330 blockers are corrected: durable deferred after-hit reads retain the existing minimum/backoff and recover after restart; expired cached/signal resets cannot immediately lift a new hard-hit mark. Reviewed all five correction files and the three added frame regressions, carrying forward the original complete source review. C8 documentation and C9 structured/text refusals are established by source. C1–C7 remain unverified until full exact-head evidence. Evidence A-2334: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2334-t-366-corrected-source-clear-at-5aad58e5.md.

Criteria: C8 verified, C9 verified.

### impl-366 · 2026-10-14T12:58:37.861Z

Exact-reviewed-head full verification 49871ae0-f1eb-435b-9444-a903c4fb0f1b passed at 5aad58e50a09212adda305d33ffdeee412155eeb: 2017/2017 tests, zero failures/skips, local darwin arm64, Node v24.21.0 and Neovim v0.12.5. Durable log A-2375. Requested final Reviewer verdict for C1–C7; C8/C9 were already source-verified. No head change or rerun was needed.

### rev-23 · 2026-10-14T12:59:45.599Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-366-3
commit: 5aad58e50a09212adda305d33ffdeee412155eeb
scope: evidence

Final clear; no high or medium findings. Exact-head 49871ae0/A-2375 passes typecheck and all phases, 2017/2017 with zero fail/cancelled/skipped/todo (37 hub-free, 1601 hub-machine, 379 Neovim). Classifiers, one notice/read, typed launch/role/relaunch/pool refusal, no failover/running-session disruption, clear permissions/journals, restart/refind/reset and headless red/clear paths pass. Both A-2330 fixes pass their recent-poll/minimum/backoff/restart and expired-reset/delayed-answer regressions. C1–C9 verified, refreshing source C8/C9 at this unchanged head. Local darwin arm64, Node v24.21.0, Neovim v0.12.5; grandfathered pre-D29 full run. A-2376: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2376-t-366-final-clear-exact-head-account-limit-verification.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.

### coord · 2026-10-14T13:00:21.245Z

Merged 6ae9b8edb7aa791a198bda9deae08f4096c9b15d onto dev.
