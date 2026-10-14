---
id: T-367
kind: task
title: "Accounts in the clauses and docs: the Coordinator's clause turns a refused launch into an ask listing the harness's other accounts, cland init's roles.toml describes account, and the READMEs and GLOSSARY describe accounts, limits and the limited mark"
state: open
status: planned
size: S
criterion_seq: 7
labels:
  - v0.1.2
  - hub
  - docs
  - ready-for-agent
assignee: null
parent: E-272
blocked_by:
  - T-366
topic: null
branch: null
created: 2026-10-13T23:42:55.063Z
updated: 2026-10-14T10:19:40.821Z
---

## Summary

The crew learns accounts where it reads its rules. The Coordinator's clause says what to do with an `account-limited` refusal. It never retries on another account by itself: it asks the human, naming the limited account, its reset and the harness's other accounts, and pins the account the human picks for that launch or for the role. A Lead's clause sends such a refusal to the Coordinator. `cland init`'s `roles.toml` documents `account`. One consolidated section in `hub/README.md`, `nvim/README.md` and `GLOSSARY.md` describe accounts, limits and the limited mark.

## Parent

E-272: Accounts and limits, definition-of-done checkbox 7: `hub/README.md`, `nvim/README.md`, the Coordinator's clause and `cland init`'s defaults describe accounts, limits and the limited mark. The epic's choices say:

- a refused launch names the account and its reset;
- the Coordinator's clause turns it into an ask listing the other accounts of that harness;
- the human's answer pins the account for the launch or the role;
- the hub asks nothing itself, since only the Coordinator asks the human.

Spec: `docs/spec/v0.1.2.md` §3.13 ("Routing without rotation"). Research: `docs/research/account-limits.md` section 5.6, the terms.

## What to build

**The Coordinator's clause.** Add to the clause in `hub/src/roles/default-roles.ts`, and to this project's `.cland/roles.toml`, which `cland update` does not rewrite:

- On a launch refused with `account-limited`, never launch the work on another account by your own choice.
- Read `cland account list` and `ask` the human. The ask names the limited account, its reset and the harness's other accounts with their windows, and offers three answers: this launch on account X, the role pinned to account X in `roles.toml`, or waiting for the reset.
- Carry out the answer:
  - `--account X` for this launch;
  - or an edit of `[<role>.launch] account` committed on `dev`, then `cland push`;
  - or a wait.
- Under D24, the stand-in answers such an ask, as any other.
- `cland account clear` is for an OpenCode account after the human says its limit has passed, or when the human asks for it.
- Never tell a session to switch accounts. A running session stays on its account.

**The Lead's clause.** A launch refused with `account-limited` is reported to `lead T-<n>`, which climbs to the Coordinator. The Lead never asks the human and never names another account itself.

**`cland init`'s defaults.** The `roles.toml` header comment in `default-roles.ts` documents `account = "<name>"` under `[<role>.launch]`: a name from `~/.config/cland/accounts.toml`, one name and never a list, `""` or absent meaning the harness default. Each role's launch table gets a commented-out `# account = ""` line. Init writes no `accounts.toml`, because the registry is the human's own, at user level.

**`hub/README.md`.** Consolidate tickets T-361 to 06 into one "Accounts and limits" section:

- the registry and its path;
- naming an account;
- the environment of each adapter's processes;
- the polling rules: per-directory `agents --json`, the idle floor and backoff, and the commands never run;
- the sources and the window;
- `cland account list` and `account clear`;
- the signals and the mark;
- the refusal;
- the terms: why cland reads no token, calls no usage endpoint and never rotates.

Link it from the adapter sections.

**`nvim/README.md`.** The accounts block and the limited highlight, in one place.

**`GLOSSARY.md`.** Two entries:

- **Account**: a harness login a session runs under, named in the user-level registry by its directory, never by a secret.
- **Limited account**: an account marked after a limit-hit signal, refusing new launches until its reset or `cland account clear`.

**Tests.** A clause test (beside `hub/test/roles.test.ts`) reads the Coordinator's delivered clause and finds the `account-limited` instruction. A Lead's clause carries the report-up instruction. A freshly initialised project's `roles.toml` carries the `account` documentation.

**Out of scope.** Behaviour changes. The human's own registry and the crew's pins, which are the Dogfooding steps below.

**Coordinator steps after the merge.** Relaunch the role sessions, because clauses and tool lists are fixed at launch. With the human, write `~/.config/cland/accounts.toml` and pin the roles in `.cland/roles.toml`, as the epic's Dogfooding says.

**Constraints.**

- Tests go through the frame protocol, as the existing role clause tests do.
- No new seams inside the hub, and no helpers added to `hub/test/harness.ts`.
- Suites run through `cland verify` after a clear review at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. The Coordinator's clause, in `default-roles.ts` and in this project's `.cland/roles.toml`, says to answer an `account-limited` refusal with an ask that names the account, its reset and the harness's other accounts, never to relaunch on another account unasked, and how to apply the answer, and a test finds it in the delivered clause.
- [ ] C2. The Lead's clause says to report an `account-limited` refusal to `lead T-<n>` and never to ask the human or pick another account, and a test finds it.
- [ ] C3. A project freshly made by `cland init` has a `roles.toml` whose header documents `account` and whose launch tables carry the commented-out key, and init writes no `accounts.toml`.
- [ ] C4. `hub/README.md` has one "Accounts and limits" section covering the registry, the environment per adapter, the polling rules, the sources, `cland account list` and `clear`, the signals, the mark, the refusal and the terms, and the adapter sections link to it.
- [ ] C5. `nvim/README.md` describes the accounts block and the limited highlight in one place, and `GLOSSARY.md` defines Account and Limited account.
- [ ] C6. hub/README.md has one section listing cland's per-user state: the executor spend ledger (~/.cland/executor/spend.json, T-346) and the accounts registry (~/.config/cland/accounts.toml), with their paths, owners and what each holds (stand-in, D24, 2026-10-13).
- [ ] C7. The ask the Coordinator's clause makes from an account-limited refusal names the limited account and its reset time, and lists the harness's other accounts with their current used share, so the human picks without opening anything (stand-in, D24, 2026-10-13).
