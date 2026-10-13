---
id: T-365
kind: task
title: "The accounts block: the sessions panel opens with one line per account showing the windows its source sent, with the used share, the reset time and the reading's age, and each session's meta line names its account"
state: open
status: backlog
size: M
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-272
blocked_by:
  - T-363
topic: null
branch: null
created: 2026-10-13T23:42:54.607Z
updated: 2026-10-13T23:43:00.602Z
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

- [ ] C1. A headless workbench against a real hub, with a fake Codex session on codex-b that reported a weekly window, shows the accounts block as the panel's first lines, with `codex-b`, its weekly share and its reset, read by `screenstring()`.
- [ ] C2. Windows render as the source sent them. A Claude account with 5-hour, weekly and per-model weekly windows shows three, and a Codex account with one weekly window shows one.
- [ ] C3. An OpenCode account shows `no limit data`, and an account with no reading `no reading yet`. A reading older than 30 minutes shows its age, dimmed.
- [ ] C4. A window is coloured by the source's severity when it sent one, and otherwise amber from 75% and red from 90%, as the extmarks show.
- [ ] C5. A new `account` event updates the line without a timer or a re-read. `za` on the header folds the block to `Accounts (N)` and back, through the action registry, and the fold survives a restart through `ui.json`.
- [ ] C6. The expanded row of a session on codex-b reads `Codex · gpt-6.1-sol · codex-b`, and a default-account session's row names no account.
- [ ] C7. At a panel width of 30 columns, every block line fits, with windows wrapped onto continuation lines.
- [ ] C8. `nvim/README.md` describes the block, its colours, its fold and the meta line's account.
