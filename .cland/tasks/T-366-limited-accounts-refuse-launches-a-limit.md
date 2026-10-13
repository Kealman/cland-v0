---
id: T-366
kind: task
title: "Limited accounts refuse launches: a limit-hit signal from Claude Code, Codex or OpenCode marks the account limited until its reset, a launch on it is refused naming the reset, and cland account clear lifts the mark"
state: open
status: backlog
size: L
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-272
blocked_by:
  - T-364
  - T-365
topic: null
branch: null
created: 2026-10-13T23:42:54.826Z
updated: 2026-10-13T23:43:01.017Z
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

- [ ] C1. A fake Codex `usageLimitExceeded` on a codex-a session marks codex-a limited with its window's reset. `cland account list --json` shows the mark, the journal holds `account-limited`, and one warn notice reaches the Agents topic.
- [ ] C2. The next launch on codex-a, by `--account` and by a role pinned to it, is refused with `code: "account-limited"` naming codex-a and its reset. The fakes' records show no process started on codex-b or any other account, and the running codex-a session keeps running.
- [ ] C3. A Claude `StopFailure` with `error: "rate_limit"` marks claude-b with the reset of its full window, and an OpenCode `provider.quota` marks oc-b `until cleared`. A Codex `rateLimitExceeded`, an OpenCode `provider.rate-limit` and a Claude `overloaded` mark nothing.
- [ ] C4. A mark lifts at its reset and survives a hub restart that comes before the reset. `cland account clear codex-a` lifts it at once for the human and the Coordinator and is refused for an Implementer, a Reviewer and a QA session. Both lifts journal `account-limit-lifted` with `by`.
- [ ] C5. A relaunch and a retained pool handoff onto a limited account are refused the same way, while a hub-restart re-find of a live session on it succeeds.
- [ ] C6. A hit makes exactly one after-hit poll of its account, and a second hit while the mark holds adds no poll and no notice.
- [ ] C7. The headless workbench shows codex-a in `ClandRed` with `limited` and its reset, and oc-b with `until cleared`. The highlight goes after `cland account clear`.
- [ ] C8. `hub/README.md` and `nvim/README.md` describe the signals, the mark, the refusal and its code, what is never done, `cland account clear` and the highlight.
