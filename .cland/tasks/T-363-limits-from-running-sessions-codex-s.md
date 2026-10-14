---
id: T-363
kind: task
title: "Limits from running sessions: Codex's rate-limit events and Claude Code's status-line windows, forwarded by the cland mod, are kept per account with their age, and cland account list and an account event show them"
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-272
blocked_by:
  - T-361
topic: topic-229
branch: t/T-363-limits-from-running-sessions-codex-s
created: 2026-10-13T23:42:53.883Z
updated: 2026-10-14T07:07:18.592Z
closed: 2026-10-14T07:07:18.592Z
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

- [x] C1. A fake Codex session on codex-b whose app-server sends `account/rateLimits/updated` shows in `cland account list --json` under codex-b with each window's label, `usedPercent`, `resetsAt` and `windowMins`, the reading's `at`, and `source` naming the session.
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-1 · 2026-10-14T05:53:30.994Z · commit ecc1888d38c4225dd78f67e4de8e486a96e55bc5
  - done: impl-363 · 2026-10-14T06:24:19.931Z
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-2 · 2026-10-14T07:07:02.725Z · commit eb628201af0cc0afa6d0edaf3ef6d8ce977b7e80
- [x] C2. A Codex bucket in `rateLimitsByLimitId` appears as its own window labelled by its limit name. A sparse update merges into the last read. A null `secondary` is absent and never shown as 0%.
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-1 · 2026-10-14T05:53:30.995Z · commit ecc1888d38c4225dd78f67e4de8e486a96e55bc5
  - done: impl-363 · 2026-10-14T06:24:20.342Z
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-2 · 2026-10-14T07:07:02.725Z · commit eb628201af0cc0afa6d0edaf3ef6d8ce977b7e80
- [x] C3. A fake Claude Code session, whose mod receives `session.measure` with `rateLimits` changed, posts `mod-measure`, and `cland account list --json` shows its `5h` and `wk` windows with their resets. A measure whose `changed` omits `rateLimits` posts nothing.
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-1 · 2026-10-14T05:53:30.995Z · commit ecc1888d38c4225dd78f67e4de8e486a96e55bc5
  - done: impl-363 · 2026-10-14T06:24:20.749Z
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-2 · 2026-10-14T07:07:02.725Z · commit eb628201af0cc0afa6d0edaf3ef6d8ce977b7e80
- [x] C4. With two sessions on one account, the newest reading by `at` wins. After a hub restart, `cland account list` shows the last reading with its original `at`.
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-1 · 2026-10-14T05:53:30.995Z · commit ecc1888d38c4225dd78f67e4de8e486a96e55bc5
  - done: impl-363 · 2026-10-14T06:24:21.252Z
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-2 · 2026-10-14T07:07:02.725Z · commit eb628201af0cc0afa6d0edaf3ef6d8ce977b7e80
- [x] C5. An OpenCode account shows `no limit data` in text, and `windows: []` with `source: null` in JSON. A registered account that never reported shows `no reading yet`. A session with no account reports under `default:<harness>`.
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-1 · 2026-10-14T05:53:30.995Z · commit ecc1888d38c4225dd78f67e4de8e486a96e55bc5
  - done: impl-363 · 2026-10-14T06:24:22.343Z
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-2 · 2026-10-14T07:07:02.726Z · commit eb628201af0cc0afa6d0edaf3ef6d8ce977b7e80
- [x] C6. A UI client receives one `account` event per changed reading, at most one per account per second, and none for an equal reading. After the `flushLogs` barrier, the journal holds one `account-limits` record per change.
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-1 · 2026-10-14T05:53:30.995Z · commit ecc1888d38c4225dd78f67e4de8e486a96e55bc5
  - done: impl-363 · 2026-10-14T06:24:22.756Z
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-2 · 2026-10-14T07:07:02.726Z · commit eb628201af0cc0afa6d0edaf3ef6d8ce977b7e80
- [x] C7. `hub/README.md` describes the sources, the window's shape, the store, `cland account list`, the `account` event and the `account-limits` record.
  - verified: rev-26 [reviewer] · run rev-20261014-363-source-2 · 2026-10-14T01:53:45.962Z · commit d7f3a670a7ae5b9a6254cebacc8087dc4bff554b
  - verified: rev-26 [reviewer] · run rev-20261014-363-source-3 · 2026-10-14T02:28:21.488Z · commit ecc1888d38c4225dd78f67e4de8e486a96e55bc5
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-1 · 2026-10-14T05:53:30.995Z · commit ecc1888d38c4225dd78f67e4de8e486a96e55bc5
  - done: impl-363 · 2026-10-14T06:24:23.171Z
  - verified: rev-26 [reviewer] · run rev-20261014-363-source-4 · 2026-10-14T06:27:31.460Z · commit eb628201af0cc0afa6d0edaf3ef6d8ce977b7e80
  - verified: rev-26 [reviewer] · run rev-20261014-363-final-2 · 2026-10-14T07:07:02.726Z · commit eb628201af0cc0afa6d0edaf3ef6d8ce977b7e80

## Comments

### impl-363 · 2026-10-14T01:40:31.572Z

Implementing limits.ts, the Codex sparse merge, Claude mod-measure bridge, durable account listing/events and journal records on the existing usage timer. The referenced docs/research/account-limits.md is absent from this checkout and root; checked the installed Claude mods API types instead (SessionRateLimit resetsAt is ISO). Protocol-first regression coverage is being added.

### rev-26 · 2026-10-14T01:50:55.217Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261014-363-source-1
commit: 9a0337b8a3f6cbd8bfc4b069f5c6ce8b9707e86e
scope: full

Medium — hub/src/accounts/limits.ts:39: A compatibility rateLimits snapshot with limitId=review is rendered as codex:primary, then rendered again from rateLimitsByLimitId.review; this duplicates the source pool and gives its first copy the wrong label. Respect its actual id/name and deduplicate, with a fake/frame regression. Full source review at the named head; no full suite run. Standards: no high/medium finding. Spec: one medium. The serialized publication refinement is sound; execution criteria remain pending. Evidence artifact records the remaining checks.

Criteria: C2 failed (A non-codex compatibility rateLimits bucket is rendered as an invented codex window and duplicated when also present in rateLimitsByLimitId.).

### rev-26 · 2026-10-14T01:53:45.962Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-363-source-2
commit: d7f3a670a7ae5b9a6254cebacc8087dc4bff554b
scope: full

No remaining high/medium findings. hub/src/accounts/limits.ts:39 now respects compatibility limitId and deduplicates matching by-id buckets; hub/src/adapters/codex.ts:564 retains that identity for id-omitting sparse updates. The real daemon/fake regression covers both response forms and the sparse push. Standards and Spec clear. Source C7 verified; C1–C6 execution and final C2 settlement remain pending accepted same-head full verification. Evidence A-2172: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2172-t-363-source-clear-at-d7f3a670-compatibility-bucket-identity-preserved.md.

Criteria: C7 verified.

### rev-26 · 2026-10-14T02:28:21.488Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-363-source-3
commit: ecc1888d38c4225dd78f67e4de8e486a96e55bc5
scope: delta

No high/medium findings. The only delta is the byte-identical standalone shared T-371 patch 8fe4c02d, restricted to 16 hub/test files. Exact-session PID discovery preserves original lifecycle/replacement/cleanup assertions and intentional null-PID coverage; T-363 implementation and docs are unchanged from A-2172. Standards and Spec clear. C7 source verification renewed; C1–C6 and final settlement await accepted same-head full verification. Evidence A-2195: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2195-t-363-source-delta-clear-at-ecc1888d-exact-shared-pid-discovery-test-fix.md.

Criteria: C7 verified.

### rev-26 · 2026-10-14T05:53:30.995Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-363-final-1
commit: ecc1888d38c4225dd78f67e4de8e486a96e55bc5
scope: evidence

No remaining high/medium findings. Accepted 55285baf/A-2251 matches the exact source-reviewed and current branch head. Both typechecks and 1943/1943 tests pass (37 free + 1555 hub + 351 Neovim), zero fail/cancel/skip/todo. All account-limit integration cases pass, including corrected compatibility bucket identity, sparse updates, real Claude mod filtering, newest/restart/default/OpenCode behavior, event spacing and silent equal/journal checks. C1–C7 verified across source A-2172/A-2195 and this receipt; earlier C2 failure superseded by verified execution. Standards and Spec clear; QA scope none. Evidence A-2253: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2253-t-363-final-review-clear-at-ecc1888d-all-criteria-and-1943-1943-checked.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### rev-26 · 2026-10-14T06:27:31.461Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-363-source-4
commit: eb628201af0cc0afa6d0edaf3ef6d8ce977b7e80
scope: delta

No high/medium findings. hub/test/shards.json preserves the full dev manifest plus only account-limits.test.ts=machine; all 19 T-363 task deltas retain identical changed lines against the new dev base. T-362 directory/account environment integration retains the mod-measure path and recorded-account limits grouping. Prior source and final checks retained; old-head A-2251 does not verify this merge head. Standards and Spec clear. C7 source renewed; C1–C6 await accepted same-head full verification. Evidence A-2264: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2264-t-363-merged-source-clear-at-eb628201-task-hunks-and-shard-union-preserved.md.

Criteria: C7 verified.

### rev-26 · 2026-10-14T07:07:02.726Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-363-final-2
commit: eb628201af0cc0afa6d0edaf3ef6d8ce977b7e80
scope: evidence

No remaining high/medium findings. Accepted d84c47b5/A-2278 matches source-clear A-2264 and current branch head. Both typechecks and 1982/1982 tests pass (37 free + 1579 hub + 366 Neovim), zero fail/cancel/skip/todo. All account-limit protocol/fake/CLI cases pass at the merged head; reviewed assertions and C7 docs establish all C1–C7. Standards and Spec clear; QA scope none. Final evidence A-2279: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2279-t-363-final-merged-head-review-clear-at-eb628201-full-1982-1982.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-14T07:07:18.592Z

Merged 2ddbefb2a9659e2a3efeae19ec3437110ffca635 onto dev.
