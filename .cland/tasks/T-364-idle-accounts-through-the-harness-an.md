---
id: T-364
kind: task
title: "Idle accounts through the harness: an account with no running session is polled at most every 15 minutes through claude -p /usage or a short-lived codex app-server, never through a provider's endpoint"
state: open
status: planned
size: L
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-272
blocked_by:
  - T-362
  - T-363
topic: null
branch: null
created: 2026-10-13T23:42:54.330Z
updated: 2026-10-14T07:07:20.748Z
---

## Summary

An account with no running cland session gets its limits from its own harness, and rarely. A poll runs at hub start, when the human opens the sessions panel, and after a limit-hit signal, and otherwise at most every 15 minutes per account, backing off after a failure. The Claude poll runs `claude -p "/usage"` under the account's directory. The Codex poll runs a short-lived `codex app-server` under its home. OpenCode is never polled. cland reads no token and calls no provider endpoint itself, and a test proves it.

## Parent

E-272: Accounts and limits, tracer bullet 4 of 6. Spec: `docs/spec/v0.1.2.md` §3.13: idle accounts are polled at most every 15 minutes, only through the harness itself, and cland never calls a provider's endpoint with a token it reads. The epic's choices name the triggers (hub start, the human opening the accounts block, a limit-hit signal, otherwise at most every 15 minutes) and say to back off on a 429 as the harness does. Research, `docs/research/account-limits.md`:

- section 5.3 gives the poller and its cost;
- section 1.3: `/usage` in print mode costs one CLI start and one GET, and Claude Code shares one read per machine per minute;
- section 2.3: `account/rateLimits/read` with `excludeResetCreditDetails`;
- section 5.6: Anthropic forbids a third party holding Claude.ai tokens.

The probes in `docs/research/account-limits/` show the commands: `claude-usage.sh live` and `codex-rate-limits.mjs`. Upstream: claude-code#95822. A `-p "/usage"` call waits for the token refresh it starts, while `agents --json` and `auth status` do not.

## What to build

**The poller.** A new module, `hub/src/accounts/poller.ts`.

- An account is idle when no running cland session is on it, by registry name or `default:<harness>`.
- A poll's reading enters ticket T-363's store with `source: {kind: "poll"}`. A newer push reading always wins over it.
- Triggers:
  - Hub start: each idle account whose last poll is older than the 15-minute floor. The last poll time persists in `hub.db` meta, so frequent hub restarts do not poll more often.
  - The timer: each idle account once its floor has passed.
  - `account.poll`, a new frame, sent by the workbench when the sessions panel opens and by `cland account list --refresh`: idle accounts whose last poll is older than 5 minutes. A younger reading is returned as it is.
  - `poll(account)`, the entry point ticket T-366 calls after a limit-hit signal, under the same 5-minute minimum.
- At most one poll in flight per account, and at most two across the hub. Each poll is bounded at 30 s, after which its process group is killed.
- Backoff: a failed poll doubles that account's floor, from 15 to 30 to 60 minutes at most. A failure is a non-zero exit, a 429 or "rate limited" line, a timeout or an unparsable answer. A success resets the floor to 15 minutes.
- A signed-out answer sets `signedOut: true` on the account's view and polls no faster. For Claude that is not logged in; for Codex, `-32600` "authentication required".

**The Claude poll.**

- The command is `claude -p "/usage" --output-format stream-json --verbose`, run with the account's overlay. Ticket T-362's environment applies: the auth variables are removed and no `CLAND_*` variable is passed.
- It runs in a scratch working directory under `.cland/run/accounts/`, not in the project.
- Read `usage_report.rate_limits.limits[]`: `session` becomes `5h`, `weekly_all` becomes `wk`, and `weekly_scoped` becomes `wk <group>` with `scope` set. Keep `severity` as sent.
- It never runs `agents --json`, `auth status` or `doctor`.

**The Codex poll.**

- Start `codex app-server` with the account's `CODEX_HOME`, over stdio or on a temporary socket under `.cland/run/accounts/`, reusing `hub/src/adapters/codex/app-server.ts`.
- Send `initialize` and `account/rateLimits/read` with `excludeResetCreditDetails: true`, then end the process.
- Map the answer as ticket T-363 does.

**OpenCode.** Never polled. Its view stays `no limit data`.

**The journal.** `account-polled` `{account, harness, ms, ok}` and `account-poll-failed` `{account, reason}`, where the reason is one line and never the process's output. Add both to `JOURNALLED`.

**The workbench.** When the sessions panel opens, `nvim/lua/cland/` sends `account.poll` once per opening, through the existing hub client. Ticket T-365 renders the result.

**Proof that no endpoint is called.**

- A source test scans `hub/src`, and asserts it holds none of the following:
  - the hosts and paths `api.anthropic.com`, `oauth/usage`, `chatgpt.com`, `wham/usage` and `opencode.ai`;
  - any read of `auth.json`, `.credentials.json` or `opencode.db`;
  - any `security find-generic-password`.

  E-271's DigitalOcean client is allowed by name.
- A runtime test starts the daemon with `NODE_OPTIONS=--import <a test preload>` that records every non-loopback `net` or `tls` connection to a file. After a poll cycle of a Claude account and a Codex account, the file is empty. The preload lives in the test directory and is passed through the environment; the hub gains no seam.

**Fakes.**

- `fake-claude.ts` answers `-p "/usage" --output-format stream-json` with a `usage_report` read from `usage-report.json` under the config directory, logs the call, and can fail with exit 1 and a 429 line, or hang past the bound.
- `fake-codex.ts` serves the short-lived poll: `initialize`, then `account/rateLimits/read` from its `rate-limits.json`. It can answer `-32600` for a signed-out home.

**Docs.** The Accounts section of `hub/README.md` covers the triggers, the floor and its persistence, the 5-minute minimum, the backoff, the two commands it runs, and the commands it never runs.

**Demo** (the epic's words). An idle fake account is polled once through its fake harness, and the test proves that no HTTP request left cland for a provider's endpoint.

**Out of scope.** The block that shows the reading (ticket T-365). The limited mark (ticket T-366). Polling an account that has a running session: its sessions push. The hit trigger is the one exception, and ticket T-366 owns it.

**Constraints.**

- Tests go through the frame protocol first, then the fakes, with no real `claude` or `codex` and no real directory.
- The floor, the minimum and the bound are shortened with `CLAND_TEST_*` overrides.
- Read `hub.log` and `journal.jsonl` only after the `flushLogs` barrier.
- No new seams inside the hub, and no helpers added to `hub/test/harness.ts`. Classify new test files in `hub/test/shards.json`.
- Suites run through `cland verify` after a clear review at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. At hub start, an idle fake Claude account and an idle fake Codex account are each polled once, under their own directory: the invocation logs show `-p /usage` with `CLAUDE_CONFIG_DIR` and `app-server` with `CODEX_HOME`. `cland account list --json` then shows their windows with `source: poll`, the Claude per-model weekly window included.
- [ ] C2. An account with a running session is not polled. An OpenCode account is never polled and shows `no limit data`.
- [ ] C3. A hub restart within the floor of the last poll polls nothing. With the floor shortened, the timer polls each idle account once per floor and never runs two polls at once for one account.
- [ ] C4. `account.poll`, from the workbench opening the sessions panel or from `cland account list --refresh`, polls an idle account whose last poll is older than the minimum, and returns the cached reading otherwise.
- [ ] C5. A failed poll (the fake exits 1 with a 429 line, or hangs past the bound and is killed) doubles that account's floor up to 60 minutes and journals `account-poll-failed` with one line. A later success restores the floor. A signed-out answer shows `signedOut` on the account and polls no faster.
- [ ] C6. The source scan finds no provider host, no usage path and no read of a credential store in `hub/src`. The runtime recorder sees no non-loopback connection during a poll cycle. No poll runs `agents --json`, `auth status` or `doctor`.
- [ ] C7. A poll process runs with the account's overlay, without the removed auth variables and without any `CLAND_*` variable, in a scratch directory under `.cland/run/accounts/`.
- [ ] C8. `hub/README.md` describes the triggers, the floor, the minimum, the backoff, the commands it runs and the commands it never runs.
