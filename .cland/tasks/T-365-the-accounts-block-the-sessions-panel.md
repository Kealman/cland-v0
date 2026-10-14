---
id: T-365
kind: task
title: "The accounts block: the sessions panel opens with one line per account showing the windows its source sent, with the used share, the reset time and the reading's age, and each session's meta line names its account"
state: closed
status: done
size: M
criterion_seq: 8
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-272
blocked_by:
  - T-363
topic: topic-239
branch: t/T-365-the-accounts-block-the-sessions-panel
created: 2026-10-13T23:42:54.607Z
updated: 2026-10-14T10:19:38.470Z
closed: 2026-10-14T10:19:38.470Z
---

## Summary

The workbench's sessions panel starts with an accounts block. Each account gets one line with the windows its source sent: the used share, the reset time and how old the reading is. OpenCode accounts read "no limit data". A session's expanded row names its account in the meta line, for example "Codex · gpt-6.1-sol · codex-b". The block follows `account` events, with no timer and no re-read.

## Parent

E-272: Accounts and limits, tracer bullet 5 of 6. Spec: `docs/spec/v0.1.2.md` §3.13 ("The panel"): an accounts block at the top of the sessions panel, showing per account the windows the source sent (5-hour, weekly, per-model weekly) with the used share and the reset time. The epic's choices put the account name in the expanded row's meta line. Research: `docs/research/account-limits.md` section 5.4, option A and its sample lines, which says to render what the source sends, with the colour from the source's own grading where it exists. Ticket T-363 supplies `account.list` and the `account` event, and ticket T-361 the row's `account`.

## What to build

**State.** `nvim/lua/cland/state.lua` keeps the accounts:

- from `account.list`, read on connect alongside `session.list`;
- from each `account` event, which replaces the account by name.

Add the read to the snapshot that `nvim/lua/cland/init.lua` waits for, as `session.list` is.

**The block.** In `render_sessions` (`nvim/lua/cland/panels.lua`), the block comes first, above the verification summary.

- A header line reads `Accounts`.
- Then one line per account, in the registry's order with `default:<harness>` entries last. For example:
  - `claude-a  5h 42% ↻14:20 · wk 18% ↻Thu 17:00 · Fable 2% · 3m`
  - `codex-b   wk 19% ↻Sun 04:03 · 1m`
  - `oc-b      no limit data`
- A window shows its label, its share rounded to a whole percent, and `↻` with its reset.
- Reset times: `HH:MM` today, `Ddd HH:MM` within a week, and the date beyond that, all in local time.
- The reading's age comes last. A reading older than 30 minutes is dimmed.
- An account with no reading shows `no reading yet`. One with `signedOut` (ticket T-364) shows `signed out`.
- Windows that do not fit wrap onto indented continuation lines within the panel's width. The block never overflows and never hard-codes two windows.

**Colour.**

- The source's `severity` when it sent one: Claude's `warning` and `critical` map to `ClandAmber` and `ClandRed`.
- Otherwise the share: 75% and over is amber, 90% and over is red. These are the points where Codex's own TUI polls faster.
- The limited highlight comes with ticket T-366.

**The fold.** With the cursor on the block's header, `za` folds the block to `Accounts (N)` and unfolds it. The key goes through the action registry (`nvim/lua/cland/actions.lua`) and is kept in `.cland/ui.json` with the other folds. Add a footer hint if room allows.

**The meta line.** `M.session_meta_parts` adds the account after the model, so `Codex · gpt-6.1-sol · codex-b`. A default-account session shows none.

**Docs.** `nvim/README.md`'s sessions-panel section covers the block, its lines, colours and fold, and the meta line's account.

**Demo** (the epic's words, without the limited part). The headless workbench shows a Codex account's weekly window with its share and its reset.

**Out of scope.** The limited highlight and its reset (ticket T-366). Triggering polls: ticket T-364 sends `account.poll` when the panel opens. An account picker in the launcher.

**Constraints.**

- Tests run the Neovim UI headless against a real hub with the fake harnesses (`nvim/test/harness.ts`, as `nvim/test/sessions.test.ts` does). Keys are sent with `nvim_input`, the screen is read with `screenstring()`, and highlights are read from extmarks.
- A scratch registry lives under the test's `XDG_CONFIG_HOME`.
- A panel test waits on state, never on a sleep. Every key goes through the action registry.
- No helpers are added to `hub/test/harness.ts`. Classify new test files in `hub/test/shards.json`.
- Suites run through `cland verify` after a clear review at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. A headless workbench against a real hub, with a fake Codex session on codex-b that reported a weekly window, shows the accounts block as the panel's first lines, with `codex-b`, its weekly share and its reset, read by `screenstring()`.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-5 · 2026-10-14T10:18:58.121Z · commit 4a6f7fe88def6a97279c38dc1296cba939f2dd36
  - done: impl-365 · 2026-10-14T10:19:16.009Z
- [x] C2. Windows render as the source sent them. A Claude account with 5-hour, weekly and per-model weekly windows shows three, and a Codex account with one weekly window shows one.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-5 · 2026-10-14T10:18:58.121Z · commit 4a6f7fe88def6a97279c38dc1296cba939f2dd36
  - done: impl-365 · 2026-10-14T10:19:17.137Z
- [x] C3. An OpenCode account shows `no limit data`, and an account with no reading `no reading yet`. A reading older than 30 minutes shows its age, dimmed.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-5 · 2026-10-14T10:18:58.121Z · commit 4a6f7fe88def6a97279c38dc1296cba939f2dd36
  - done: impl-365 · 2026-10-14T10:19:17.942Z
- [x] C4. A window is coloured by the source's severity when it sent one, and otherwise amber from 75% and red from 90%, as the extmarks show.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-5 · 2026-10-14T10:18:58.121Z · commit 4a6f7fe88def6a97279c38dc1296cba939f2dd36
  - done: impl-365 · 2026-10-14T10:19:18.659Z
- [x] C5. A new `account` event updates the line without a timer or a re-read. `za` on the header folds the block to `Accounts (N)` and back, through the action registry, and the fold survives a restart through `ui.json`.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-5 · 2026-10-14T10:18:58.121Z · commit 4a6f7fe88def6a97279c38dc1296cba939f2dd36
  - done: impl-365 · 2026-10-14T10:19:19.484Z
- [x] C6. The expanded row of a session on codex-b reads `Codex · gpt-6.1-sol · codex-b`, and a default-account session's row names no account.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-5 · 2026-10-14T10:18:58.121Z · commit 4a6f7fe88def6a97279c38dc1296cba939f2dd36
  - done: impl-365 · 2026-10-14T10:19:20.034Z
- [x] C7. At a panel width of 30 columns, every block line fits, with windows wrapped onto continuation lines.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-5 · 2026-10-14T10:18:58.122Z · commit 4a6f7fe88def6a97279c38dc1296cba939f2dd36
  - done: impl-365 · 2026-10-14T10:19:21.001Z
- [x] C8. `nvim/README.md` describes the block, its colours, its fold and the meta line's account.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-1 · 2026-10-14T07:17:09.354Z · commit c91124c077a74a492b4ec99aeb976187374dd142
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-2 · 2026-10-14T08:28:15.272Z · commit a17d66a68594428bcc961c7fa8d6a5f086199bc4
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-4 · 2026-10-14T09:48:02.918Z · commit 4a6f7fe88def6a97279c38dc1296cba939f2dd36
  - verified: rev-23 [reviewer] · run rev-2026-10-14-365-5 · 2026-10-14T10:18:58.122Z · commit 4a6f7fe88def6a97279c38dc1296cba939f2dd36
  - done: impl-365 · 2026-10-14T10:19:21.730Z

## Comments

### impl-365 · 2026-10-14T07:13:32.181Z

Implementation and headless seam coverage added: real hub + scratch XDG registry + fake Codex weekly push, named session account meta, source-shaped Claude 3-window readings, source severity vs share colors through extmarks, stale dimming, local reset formats under Asia/Kolkata, 30-column wrapping, action-registry fold and ui.json restart persistence. Targeted account cases pass; npm run typecheck passes. Tests extend existing nvim/test/sessions.test.ts, so no new hub shard entry is required.

### rev-23 · 2026-10-14T07:17:09.354Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-365-1
commit: c91124c077a74a492b4ec99aeb976187374dd142
scope: full

No high/medium findings across nine files. Snapshot/event replay, source-window shape/order, severity/threshold/stale/local-reset rendering, width wrapping, registry fold persistence and named/default metadata match C1–C8. Real-hub fake-harness tests/readiness and existing assertions retained, no timer/poll/provider or hub seam. C8 docs verified; C1–C7/full pending. Adopt Coordinator's landed T-375/T-376 fixes and request changed-head delta review before ordinary full verification. A-2282: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2282-t-365-complete-account-panel-source-review-clear.md.

Criteria: C8 verified.

### impl-365 · 2026-10-14T08:24:46.461Z

Coordinator named both shared merged fixes (08:24Z). Cherry-picked 3c79acbe as 3a293b8b and fc0fabf9 as a17d66a6; both applied cleanly. Pushed exact head a17d66a68594428bcc961c7fa8d6a5f086199bc4 and requested delta review before one full queued verify. T-365 source unchanged from clear c91124c0.

### rev-23 · 2026-10-14T08:28:15.272Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-365-2
commit: a17d66a68594428bcc961c7fa8d6a5f086199bc4
scope: delta

No high or medium findings. Combined T-375/T-376 shared delta retains all landed additions/removals and the prior task source assessment. All five shared files are byte-identical to the landed references. Accounts rendering, event handling, fold persistence and its two new tests are unchanged. C8 refreshed. C1–C7 await exact-head full verification. One full cland verify may now run at this exact head through the queue. A-2295: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2295-t-365-combined-shared-fix-delta-source-clear.md.

Criteria: C8 verified.

### impl-365 · 2026-10-14T09:47:15.018Z

Full verify 1dcec9e9 at a17d66a6: 1983/1985, with two verification tests assuming row 1 was verify:. Both failures reproduce in targeted file runs. Fixed only navigation in those existing tests to select ^verify: visibly before Enter, retaining every original assertion; both targeted files now pass. Pushed 4a6f7fe8 and requested corrected-head source review before another full run. Red/green evidence A-2316.

### rev-23 · 2026-10-14T09:47:28.985Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-365-3
commit: a17d66a68594428bcc961c7fa8d6a5f086199bc4
scope: evidence

Medium — nvim/test/verification-queue.test.ts:36 and nvim/test/verification-view.test.ts:40: gg selects the new Accounts header instead of verify:, so Enter never opens the queue; both failure screens remain General. Full 1dcec9e9/A-2314 is red: 1983/1985, zero skips/cancellations. This is T-365 layout-related test navigation, confirmed in isolated reproduction; retain all queue assertions and select the actual verification row. No individual feature criterion failed from these navigation errors; C1–C7 remain unverified, C8 source assessment retained. Corrected-head source review required before another full. A-2315: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2315-t-365-full-evidence-not-clear-verification-row-selection.md.

### rev-23 · 2026-10-14T09:48:02.918Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-365-4
commit: 4a6f7fe88def6a97279c38dc1296cba939f2dd36
scope: delta

No high or medium findings. verification-queue.test.ts:37/43/52 and verification-view.test.ts:41 select the observable ^verify: row before Enter after existing summary readiness barriers. All original queue/ETA/order/refresh/palette/clock/action-audit assertions and deadlines retained; only test navigation changes. A-2315 findings resolved; A-2282/A-2295 source reviews remain applicable. C8 refreshed; C1–C7 await one new exact-head full verify. Failed A-2314 supplies no clearance. A-2317: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2317-t-365-verification-row-correction-source-clear.md.

Criteria: C8 verified.

### impl-365 · 2026-10-14T10:18:11.862Z

Replacement full verification 8faa2906-94a2-4efb-81cc-370b07b46932 passed at exact reviewed 4a6f7fe88def6a97279c38dc1296cba939f2dd36: 1985/1985, zero failed/skipped/cancelled. Local darwin arm64, Node v24.21.0, Neovim v0.12.5; typecheck included. Durable full log A-2323. Awaiting Reviewer final same-head evidence verdict; claim retained for merge.

### rev-23 · 2026-10-14T10:18:58.122Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-365-5
commit: 4a6f7fe88def6a97279c38dc1296cba939f2dd36
scope: evidence

No high or medium findings. Clean unchanged source-reviewed head. A-2323 full 8faa2906 passes typecheck/all phases: 1985/1985, zero failures/cancellations/skips/todo. Both account UI cases establish source windows, severity, reset/age formatting, push-only update, persistent fold, named/default meta and 30-column wrapping; both former verification navigation cases pass. Prior A-2282/A-2295/A-2317 source reviews remain applicable. C1–C8 verified; Implementer done marks still required for readiness. A-2324: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2324-t-365-final-exact-head-evidence-clear.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-14T10:19:38.470Z

Merged 68ee5f2d7a44decb28b4f6d8edf86d38cb4c7210 onto dev.
