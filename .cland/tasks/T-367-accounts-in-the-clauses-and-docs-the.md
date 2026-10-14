---
id: T-367
kind: task
title: "Accounts in the clauses and docs: the Coordinator's clause turns a refused launch into an ask listing the harness's other accounts, cland init's roles.toml describes account, and the READMEs and GLOSSARY describe accounts, limits and the limited mark"
state: closed
status: done
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
topic: topic-250
branch: t/T-367-accounts-in-the-clauses-and-docs-the
created: 2026-10-13T23:42:55.063Z
updated: 2026-10-14T15:39:16.640Z
closed: 2026-10-14T15:39:16.640Z
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

- [x] C1. The Coordinator's clause, in `default-roles.ts` and in this project's `.cland/roles.toml`, says to answer an `account-limited` refusal with an ask that names the account, its reset and the harness's other accounts, never to relaunch on another account unasked, and how to apply the answer, and a test finds it in the delivered clause.
  - done: impl-367 · 2026-10-14T13:08:30.543Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-4 · 2026-10-14T15:38:50.404Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b
- [x] C2. The Lead's clause says to report an `account-limited` refusal to `lead T-<n>` and never to ask the human or pick another account, and a test finds it.
  - done: impl-367 · 2026-10-14T13:08:31.558Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-4 · 2026-10-14T15:38:50.404Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b
- [x] C3. A project freshly made by `cland init` has a `roles.toml` whose header documents `account` and whose launch tables carry the commented-out key, and init writes no `accounts.toml`.
  - done: impl-367 · 2026-10-14T13:08:32.894Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-4 · 2026-10-14T15:38:50.404Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b
- [x] C4. `hub/README.md` has one "Accounts and limits" section covering the registry, the environment per adapter, the polling rules, the sources, `cland account list` and `clear`, the signals, the mark, the refusal and the terms, and the adapter sections link to it.
  - done: impl-367 · 2026-10-14T13:08:34.458Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-1 · 2026-10-14T13:12:14.320Z · commit 4f64eb0b794d677aa3a050ee67e4a473bf0fddab
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-3 · 2026-10-14T13:47:12.350Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-4 · 2026-10-14T15:38:50.404Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b
- [x] C5. `nvim/README.md` describes the accounts block and the limited highlight in one place, and `GLOSSARY.md` defines Account and Limited account.
  - done: impl-367 · 2026-10-14T13:08:35.787Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-1 · 2026-10-14T13:12:14.320Z · commit 4f64eb0b794d677aa3a050ee67e4a473bf0fddab
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-3 · 2026-10-14T13:47:12.350Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-4 · 2026-10-14T15:38:50.404Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b
- [x] C6. hub/README.md has one section listing cland's per-user state: the executor spend ledger (~/.cland/executor/spend.json, T-346) and the accounts registry (~/.config/cland/accounts.toml), with their paths, owners and what each holds (stand-in, D24, 2026-10-13).
  - done: impl-367 · 2026-10-14T13:08:38.465Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-1 · 2026-10-14T13:12:14.320Z · commit 4f64eb0b794d677aa3a050ee67e4a473bf0fddab
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-3 · 2026-10-14T13:47:12.350Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-4 · 2026-10-14T15:38:50.405Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b
- [x] C7. The ask the Coordinator's clause makes from an account-limited refusal names the limited account and its reset time, and lists the harness's other accounts with their current used share, so the human picks without opening anything (stand-in, D24, 2026-10-13).
  - done: impl-367 · 2026-10-14T13:08:39.738Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-1 · 2026-10-14T13:12:14.322Z · commit 4f64eb0b794d677aa3a050ee67e4a473bf0fddab
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-3 · 2026-10-14T13:47:12.350Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b
  - verified: rev-23 [reviewer] · run rev-2026-10-14-367-4 · 2026-10-14T15:38:50.405Z · commit fda5858eb2083463a481983145ea4f0c08a0a16b

## Comments

### impl-367 · 2026-10-14T13:06:34.517Z

Implemented account-limited routing in the default and project Coordinator/Lead clauses, the init account documentation, consolidated Accounts and limits sections and per-user state inventory, plus Account/Limited account glossary entries. Clause tests passed for both default and project snapshots; the first red run also caught clause size, so existing Coordinator wording was condensed without changing its instructions to retain the 512-byte reply reserve. Fresh-init coverage exercises scratch XDG_CONFIG_HOME and all six launch tables. Running the complete touched test files sequentially before review.

### rev-23 · 2026-10-14T13:12:14.322Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-367-1
commit: 4f64eb0b794d677aa3a050ee67e4a473bf0fddab
scope: full

Source clear; no high or medium findings. Both commits/all seven files reviewed. Coordinator asks with limited account/reset and other same-harness accounts' used windows, applies only the human/stand-in choice and never moves running sessions; Lead reports upward without replacement choice. Consolidated hub/nvim/glossary and per-user-state docs match shipped behavior. Coordinator condensation retains obligations and project D18/D19; existing reply cap/512-byte headroom and prior test assertions remain. C4–C7 source-verified. C1–C3 await exact-head diff-selected cland verify with no mode under D29. A-2382: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2382-t-367-full-source-clear-at-4f64eb0b.md.

Criteria: C4 verified, C5 verified, C6 verified, C7 verified.

### rev-23 · 2026-10-14T13:45:30.450Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-367-2
commit: 4f64eb0b794d677aa3a050ee67e4a473bf0fddab
scope: evidence

Medium — hub/test/review-qa.test.ts:104–105 / default Coordinator clause: A-2393 fails the pre-existing explicit item-lead review/QA/not-clear/retry statement; the unclaimed-item fallback phrase at :105 was also replaced. The source pass missed these exact checks. Restore both tested obligations in default/project clauses while preserving the 512-byte headroom and existing tests, then request corrected source review. 8616bb37 is red: typecheck and 1643/1644 hub tests, no Neovim phase. This reads changed clauses and is deterministic, so the untouched-test flake rule does not apply. C1–C3 final verification remains pending; C4–C7 source marks otherwise stand. A-2396: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2396-t-367-red-verification-coordinator-clause-contract-mismatch.md.

### impl-367 · 2026-10-14T13:46:21.030Z

Corrected at fda5858eb2083463a481983145ea4f0c08a0a16b (pushed): restored both original Coordinator contract sentences in default/project clauses after 8616bb37's deterministic review-qa failure. Sequential targeted tests pass: review-qa.test.ts 3/3 and roles.test.ts 8/8, including unchanged 512-byte reply reserve. No assertions were weakened; no runtime behavior changes. Evidence A-2397. Requesting fresh source clearance before new verification.

### rev-23 · 2026-10-14T13:47:12.350Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-367-3
commit: fda5858eb2083463a481983145ea4f0c08a0a16b
scope: full

Corrected source clear; no high or medium findings. Both existing Coordinator statements are restored verbatim in default/project clauses, with no test/cap/headroom change. A-2397's sequential review-qa 3/3 and roles 8/8 include unchanged 512-byte reply reserve. Account instructions, init comments, docs/glossary/user-state and project release decisions remain as fully reviewed in A-2382. C4–C7 refreshed; C1–C3 await new exact-head no-mode verification. Earlier 8616bb37/A-2393 remains red evidence of this corrected mismatch, not gate clearance. A-2402: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2402-t-367-corrected-clause-source-clear-at-fda5858e.md.

Criteria: C4 verified, C5 verified, C6 verified, C7 verified.

### rev-23 · 2026-10-14T15:38:50.405Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-367-4
commit: fda5858eb2083463a481983145ea4f0c08a0a16b
scope: evidence

Final clear; no high or medium findings. Exact-head auto full c67edfef/A-2430 passes root typecheck and 2023/2023 (37 free, 1607 hub machine, 379 Neovim), zero failures/cancellations/skips/todo. Reviewed clean head/worktree unchanged. C1–C3 delivered Coordinator/Lead account clauses and fresh-init behavior now verified; C4–C7 docs/glossary/user-state/ask content retained from source A-2382/A-2402. Restored existing review/QA wording and unchanged reply headroom pass. Earlier red 8616bb37/A-2393 was corrected source mismatch, not unchanged retry. A-2431: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2431-t-367-final-exact-head-account-clauses-and-docs-verification.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-14T15:39:16.640Z

Merged cfedbbdc5f3d10579d6622cf8abf1d0f8578228d onto dev.
