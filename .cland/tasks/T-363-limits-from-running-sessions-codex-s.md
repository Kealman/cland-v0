---
id: T-363
kind: task
title: "Limits from running sessions: Codex's rate-limit events and Claude Code's status-line windows, forwarded by the cland mod, are kept per account with their age, and cland account list and an account event show them"
state: open
status: backlog
size: M
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-272
blocked_by:
  - T-361
topic: null
branch: null
created: 2026-10-13T23:42:53.883Z
updated: 2026-10-13T23:42:59.811Z
---

## Summary

The hub keeps each account's limit windows from its running sessions at no extra cost. Codex supplies them through `account/rateLimits/read` and `account/rateLimits/updated`, which the adapter reads today. Claude Code supplies them through the cland mod, which forwards `session.measure`'s `rateLimits`. Each window is kept as the source sent it, with the time of its reading, and is shown by `cland account list` and pushed to the workbench as an `account` event. OpenCode shows no limit data.

## Parent

E-272: Accounts and limits, tracer bullet 3 of 6. Spec: `docs/spec/v0.1.2.md` §3.13 ("Limits data comes from running sessions first"). Research: `docs/research/account-limits.md`:

- sections 1.3 and 2.3: the shapes;
- section 5.3: push first, pull rarely;
- section 6: "A view must not hard-code two windows".

Prior work: T-334, the `session-usage` records, which already carry Codex's `rateLimits`. Ticket T-361 records the session's account.

## What to build

**The window.** A new module, `hub/src/accounts/limits.ts`, defines the window and the account's reading.

- A window is `{id, label, usedPercent, resetsAt, windowMins?, severity?, scope?}`. `resetsAt` is an ISO time, and `scope` is a per-model window's model or limit name.
- An account's reading is `{account, harness, windows, at, source: {kind: "session", session} | {kind: "poll"}}`.
- A window the source did not send is absent, never 0%.

**Codex** (`hub/src/adapters/codex.ts`).

- Keep `rateLimitsByLimitId` as well as `rateLimits` from `account/rateLimits/read`.
- Merge each sparse `account/rateLimits/updated` into the last read, as the protocol says ("Clients should merge available values into the most recent `account/rateLimits/read` response").
- Label `primary` and `secondary` by `windowDurationMins`: 300 is `5h`, 10080 is `wk`, any other value is `<n>h` or `<n>d`.
- A bucket of `rateLimitsByLimitId` other than `codex` is its own window, labelled by `limitName`.
- `resetsAt` arrives in epoch seconds.

**Claude Code.**

- The mod (`hub/mod/cland/hooks/register.ts`) handles `session.measure`. When `e.changed` includes `rateLimits`, it posts `cland hook mod-measure` with `{at, rateLimits}`, where each window is `{kind, percentUsed, resetsAt}` (the mods API's `SessionRateLimit`). It posts nothing else from the measure: no context and no cost.
- `interpret` in `hub/src/adapters/claude-code.ts` maps `mod-measure` to a new `Interpretation.rateLimits`.
- `five_hour` becomes `5h` and `seven_day` becomes `wk`. Other kinds keep their names.
- The status line carries no per-model weekly window (research 1.3). Ticket T-364's `/usage` poll supplies those.

**OpenCode.** It sends nothing. Its accounts read `windows: []` and `source: null`, shown as `no limit data`.

**The store.**

- Keys: the account's name, or `default:<harness>` for sessions launched with no account.
- The newest reading by `at` wins, whichever session sent it.
- Readings persist in `hub.db` meta under `account-limits`, so a restarted hub shows the last reading with its original `at`.
- Updates ride the existing usage coalescing (`#usageChanged` in `hub/src/adapters/sessions.ts`, once a second per session). They add no new timer.

**Frames and events.**

- `account.list` (ticket T-361) adds `windows`, `at` and `source` to each account, plus the `default:<harness>` entries that have a reading.
- An `account` event `{type: "account", account: <the view>}` goes to UI clients when an account's reading changes, at most once a second per account, and never for an equal reading.
- Add the event to `hub/src/protocol.ts`, and to `nvim/lua/cland/hub.lua`'s event list so the workbench receives it. Ticket T-365 renders it.

**The text form of `cland account list`.** For example `codex-b  Codex  wk 19% ↻Sun 04:03 · 2m ago (session rev-x)`. An account with no reading yet shows `no reading yet`, and OpenCode shows `no limit data`.

**The journal.** An `account-limits` record `{account, harness, windows, source}` when a reading changes, added to `JOURNALLED` (`hub/src/hub/journal.ts`). The epic's Dogfooding reads the build's own weekly spend from it.

**Fakes.**

- `fake-codex.ts`: the rate limits of a server come from a `rate-limits.json` keyed by its `CODEX_HOME` under `FAKE_CODEX_HOME`, including `rateLimitsByLimitId`. Without one, the server sends today's constant.
- `fake-claude.ts`: its `$` raises `session.measure` after a turn, with the `rateLimits` from a `rate-limits.json` under the session's config directory, and with `changed` naming `rateLimits` only when they moved.

**Docs.** The Accounts section of `hub/README.md` covers the sources, the window's shape, the store and its persistence, `cland account list`, the `account` event and the `account-limits` record.

**Demo** (the epic's words). A fake Codex session's `account/rateLimits/updated` shows in `cland account list --json` with its windows and resets.

**Out of scope.** Idle polls (ticket T-364). The block in the workbench (ticket T-365). Limit-hit signals and the limited mark (ticket T-366). No colour grading in the hub: severity is kept only where the source sends it.

**Constraints.**

- Tests go through the frame protocol first, then the fake harnesses.
- A scratch registry lives under the test's `XDG_CONFIG_HOME`.
- Any recompute driven by hub events is coalesced once per tick (T-293), and nothing hydrates the tracker per event (the T-321 lesson).
- Read `hub.log` and `journal.jsonl` only after the `flushLogs` barrier.
- No new seams inside the hub, and no helpers added to `hub/test/harness.ts`. Classify new test files in `hub/test/shards.json`.
- Suites run through `cland verify` after a clear review at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. A fake Codex session on codex-b whose app-server sends `account/rateLimits/updated` shows in `cland account list --json` under codex-b with each window's label, `usedPercent`, `resetsAt` and `windowMins`, the reading's `at`, and `source` naming the session.
- [ ] C2. A Codex bucket in `rateLimitsByLimitId` appears as its own window labelled by its limit name. A sparse update merges into the last read. A null `secondary` is absent and never shown as 0%.
- [ ] C3. A fake Claude Code session, whose mod receives `session.measure` with `rateLimits` changed, posts `mod-measure`, and `cland account list --json` shows its `5h` and `wk` windows with their resets. A measure whose `changed` omits `rateLimits` posts nothing.
- [ ] C4. With two sessions on one account, the newest reading by `at` wins. After a hub restart, `cland account list` shows the last reading with its original `at`.
- [ ] C5. An OpenCode account shows `no limit data` in text, and `windows: []` with `source: null` in JSON. A registered account that never reported shows `no reading yet`. A session with no account reports under `default:<harness>`.
- [ ] C6. A UI client receives one `account` event per changed reading, at most one per account per second, and none for an equal reading. After the `flushLogs` barrier, the journal holds one `account-limits` record per change.
- [ ] C7. `hub/README.md` describes the sources, the window's shape, the store, `cland account list`, the `account` event and the `account-limits` record.
