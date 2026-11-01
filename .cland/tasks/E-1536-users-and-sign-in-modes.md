---
id: E-1536
kind: epic
title: Users and sign-in modes
state: open
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1294
branch: null
created: 2026-10-31T18:22:04.289Z
updated: 2026-11-01T07:19:22.163Z
---

## Goal

A project chooses how the web admits people. The single mode is today's: one human, one-time links, one cookie identity. The new users mode gives each person a user with a passkey or a password, created by invitation. Everything a person does through cland records who did it: messages, ask answers, approvals, pairings, web sessions and artifacts. Agents see the author's name, so the Coordinator can tell people apart. The users mode has one role, admin, and the permission checks live in one table so that more roles later are rows, not a refactor. This epic is independent of hosts and runs in parallel from the start of the build. Shape B needs it, because a web behind an Ingress must admit more than one person, while shape A can live without it (Q-1527).

## Contents

- **The sign-in mode** (spec §3.8). `[auth] mode = "single" | "users"` in `.cland/config.toml`, default `single`, written by `cland init` and added by `cland update`. Single mode is unchanged. Switching to users creates the first user from the current identity, named from git's `user.name`; the way back is only `cland auth reset`. Demo: a project switched to users keeps its history, now attributed to the first user, and `cland auth reset` returns it to single.
- **Users and roles in `hub.db`** (§3.8). A `users` table (id, name, display name, role, state, created) and a `roles` table holding `admin` only. Demo: `cland user add` creates a row with the admin role.
- **`user_id` on everything human** (§3.8). The human's messages, ask answers and approvals (outcomes record who answered), Telegram and Discord pairings, web sessions (a cookie maps to a user) and artifacts a human created; the hub journal records the `user_id` of every human action. Deliveries to agents carry the author's name. Demo: two users write in General and answer one ask each; the Coordinator's deliveries name them, the outcomes name who answered, and the journal holds both ids.
- **Invites, passkeys and passwords** (§3.8). An admin creates a user with `cland user add <name>` or from the web and gets a one-time invite link (24 hours, assumed in the spec); the invite page registers a passkey (WebAuthn) as the primary method, or a password as the fallback; sign-in by either. Built on `node:crypto` with no new dependency (scrypt for passwords; WebAuthn's attestation-free registration and assertion checked by hand, assumed in the spec). Demo: in headless Chromium with a virtual authenticator, an invited user registers a passkey and signs in; another sets a password and signs in; a used or expired invite is refused.
- **The web in users mode** (§3.8). The sign-in page in place of the link-only flow, the cookie bound to the user, sign-out, the admin's users list with invite creation, and the user shown on the human's messages, answers and approvals in both workbenches. Single mode keeps today's link flow. Demo: two browsers as two users see each other's messages attributed.
- **The authority seam** (§3.8). The web edge's authority table (`hub/src/hub/web-authority.ts`) gains a user-role column; every check reads the user's role from one place; all requests are open to `admin`. Demo: a test role with one request removed is refused that request through the same table, and the refusal names the role (a test-only row; no second role ships).
- **Neovim and the CLI** (§3.8). Local trust through the hub socket; in users mode the CLI acts as the first user, and an admin may pass `--as <user>`. `cland topic answer` and `topic create` already take `--as <stand-in name>`; in users mode that value must name a user, and in single mode it keeps today's meaning (assumed). Demo: `cland topic answer <ask> 1 --as <user>` records that user as the answerer.
- **Remotes in users mode** (§3.8). A pairing belongs to one user: the code from `/start` or `/cland pair`, approved by an admin from Neovim or the CLI as today; one chat is one user. General is mirrored to every paired user; asks reach everyone; the first answer wins and shows who answered. In one Discord channel, people are told apart by Discord user id; unpaired members are ignored. Demo: on the test messengers, two users paired, an ask answered by one folds the other's card with the answerer's name.

Not in this epic: roles other than admin, per-user notifications and inboxes, personal settings, OIDC and SSO, deleting a user with a transfer of pairings, user management from Telegram (deferred, spec §3.8); setup's sign-in step, doctor's lines and the docs pages ("Workbenches, doctor, setup and docs for hosts", its users stage).

## Order

1. **The mode and the first user.** Config, the tables, the switch and the reset. Demo: a switched project attributes its history to the first user.
2. **`user_id` everywhere.** Messages, answers, approvals, artifacts, the journal, deliveries with names. Demo: two users in General, as above.
3. **Invites and sign-in on the web.** Invite links, passkey and password, the sign-in page, cookies per user. Demo: the virtual authenticator registration and sign-in.
4. **The authority seam and the CLI.** The user-role column, `--as`. Demo: the test role's refusal; a CLI answer as another user.
5. **Remotes per user.** Pairings per user, mirror to all, first answer wins with the answerer shown. Demo: two paired users on the test messengers.

## Definition of done

QA runs the demo below on `dev` through the hub's frame protocol, the `cland` CLI, headless Chromium and a headless Neovim workbench, with the test messengers of the v0.3 suite, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

In a scratch project in single mode QA checks the web link flow is unchanged. It switches to users and reads the first user named from git's `user.name`, with earlier messages attributed to it. It creates a second user with `cland user add`, opens the invite in headless Chromium with a virtual authenticator and registers a passkey, creates a third user who sets a password, and reuses an invite to read the refusal. Two browser contexts as two users write in General and answer one ask each; QA reads the attribution in both workbenches, the names in the Coordinator's deliveries, the answerer in each outcome and the user ids in the journal. It pairs two users on the test messengers, has the Coordinator ask, answers from one remote and reads the other's card fold with the answerer's name. It answers an ask from the CLI with `--as` and reads the attribution. It reads the authority table's user-role column and the test role's refusal. Finally it runs `cland auth reset` and reads single mode back.

- [ ] C1. `[auth] mode` is `single` by default with today's behaviour unchanged, switching to `users` creates the first user from the current identity, and `cland auth reset` is the only way back.
- [ ] C2. Users and the `admin` role live in `hub.db`, and an admin creates a user with `cland user add` or from the web and gets a one-time invite link.
- [ ] C3. An invited user registers a passkey or a password and signs in with it, and a used or expired invite is refused.
- [ ] C4. Messages, ask answers, approvals, pairings, web sessions and artifacts from a person carry their user, outcomes show who answered, deliveries to agents name the author, and the journal records the user of every human action.
- [ ] C5. The web edge's authority table has a user-role column through which every check passes.
- [ ] C6. In users mode the CLI acts as the first user and an admin may act `--as` another.
- [ ] C7. Each remote pairing belongs to one user, General reaches every paired user, and the first answer to an ask wins with the answerer shown on every copy.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub. Commit on the task branch, push to `origin`, reach `dev` only through `cland merge`; only `cland release` pushes to GitHub. Suites run through `cland verify`. Items through `cland task` only.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig. No new runtime dependency without the human's approval: WebAuthn and password hashing on `node:crypto`. If a hand-written WebAuthn check proves unsafe, the Coordinator asks the human about a dependency rather than weakening the check.
- **The web.** `web/` rules hold: CSS Modules and `var(--token)` from `web/src/tokens.css`, structure copied from `web/src/Shell.tsx`, secondary text at 4.5:1, no UI library, key bindings only through `web/src/keymap.ts`. Names and counts in the interface, explanations in tooltips and docs.
- **Single mode unchanged.** No migration changes what a single-mode project's human sees or does; every existing web, CLI and remote test passes untouched in single mode.
- **Secrets.** Passwords are stored only as scrypt hashes, passkeys as public keys; invite links and cookies only as digests, as `web.link` does today. None appears in a log, a frame or the journal.
- **ADRs.** 0003 (the web edge and its admission, the gateway's narrow authority, which does not grow); 0001 (the identity `human` becomes a user, never a role of a session).
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** Parallel from the start: no blocking edge. The users stage of "Workbenches, doctor, setup and docs for hosts" waits for this epic.

## References

- Spec: `docs/spec/v0.4.md` §3.8 (users and sign-in modes), §3.12 and §4; `docs/spec/v0.3.md` §3.1 and §3.2 (the gateway's authority, pairing); `docs/spec/v0.2.md` §3.7 (the web edge).
- Items: R-1530; the map M-1511; Q-1527 §1 to §7; Q-1521 (why shape B needs it).
- Code: `hub/src/hub/web-auth.ts`, `web-authority.ts`, `web-edge.ts`, `hub/src/hub/store.ts`, `asks.ts`, `inbox.ts`, `journal.ts`, `topics.ts`, `artifacts.ts`, `hub/src/remote/`, `hub/src/cli/web.ts`, `hub/src/init/config.ts`; `web/src/`; `docs/adr/0003-*.md` (the 2026-10-20 and 2026-10-21 amendments).
- GLOSSARY: User, Sign-in mode (added for v0.4); Pairing, Remote, General (amended); Ask, Approval, Web workbench.

## Plan

```yaml
stages:
  - name: mode and identity
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1558
        - T-1560
      - - T-1559
  - name: attribution and invites
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1561
        - T-1564
      - - T-1562
        - T-1571
      - - T-1563
      - - T-1570
      - - T-1565
        - T-1569
  - name: sign-in and pairing
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1566
        - T-1567
        - T-1568
      - - T-1572
  - name: remotes for every user
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-1573
      - - T-1574
```

## Comments

### qa-678 · 2026-11-01T07:19:22.163Z

verdict: qa
result: not clear
by: qa-678 [qa]
run: qa-s1-2026-11-01-qa678-1
commit: cbe02fc648f6418622cd9a31207e0dde25297dee
stage: mode and identity
stage_hash: ece23045aee4b9f5e2186f5b979a5aec3c501497354804b421512643e459ab48
findings: [{"severity":"medium","text":"E1536S1-03/-05/-07/-10 INCONCLUSIVE: brief expects web welcome/audit client `web`; actual `human` follows dispatch.ts:1537 normalization. Coordinator confirmed brief error; no product defect observed.","file":"qa/briefs/E-1536-stage-1.md"}]
finding_counts: {"high":0,"medium":1,"low":0}

| Case | Result | Evidence |
| --- | --- | --- |
| S0 | PASS | S0.txt |
| E1536S1-00 | PASS | E1536S1-00.txt |
| E1536S1-01 | PASS | E1536S1-01.txt |
| E1536S1-02 | PASS | E1536S1-02.txt |
| E1536S1-03 | INCONCLUSIVE | E1536S1-03.txt |
| E1536S1-04 | PASS | E1536S1-04.txt |
| E1536S1-05 | INCONCLUSIVE | E1536S1-05.txt |
| E1536S1-06 | PASS | E1536S1-06.txt |
| E1536S1-07 | INCONCLUSIVE | E1536S1-07.txt |
| E1536S1-08 | PASS | E1536S1-08.txt |
| E1536S1-09 | PASS | E1536S1-09.txt |
| E1536S1-10 | INCONCLUSIVE | E1536S1-10.txt |
| E1536S1-11 | PASS | E1536S1-11.log |
| E1536S1-12 | PASS | E1536S1-12.log |
| E1536S1-13 | PASS | E1536S1-13.log |
| E1536S1-14 | PASS | E1536S1-14.log |
| E1536S1-15 | PASS | E1536S1-15.log |
| E1536S1-16 | PASS | E1536S1-16.log |
| E1536S1-17 | PASS | E1536S1-17.txt |
| E1536S1-18 | PASS | E1536S1-18.txt |
| SHELL-001 | PASS | SHELL-001.screen.txt, SHELL-001.state.json |

Verdict: not clear. Stage: mode and identity. Epic: E-1536.
Tested HEAD and final dev: cbe02fc648f6418622cd9a31207e0dde25297dee. Run: qa-s1-2026-11-01-qa678-1. Detached build clean before and after; all three stage members have landing receipts. No epic criterion marks.

Medium — brief expectation error, qa/briefs/E-1536-stage-1.md, cases E1536S1-03, -05, -07, -10. Commands: committed functions m03, m05, m07 and m10. The actual single-mode web welcome is `human`; web audit client is `human`. The brief expects `web`. hub/src/hub/dispatch.ts:1537 normalizes the web connection to HUMAN_SESSION, and line 1540 emits humanUser()?.name ?? client. All other checked facts in these rows match: cookie-derived identity, user ids in users mode, absence in single mode, impersonation refusal, session/link revocation and retained user. The Coordinator confirmed the expectation error in message 36510c18-0c8e-469e-b870-d09ce5bbcedd and requested INCONCLUSIVE plus a not-clear verdict. No product defect found; no code fixed.

All 179 tests across the six brief groups passed, with zero failures, cancellations, skips or todos: 11=21, 12=7, 13=10, 14=7, 15=123, 16=11. Required literal and generated case names were checked in TAP, including both WebAuthn algorithms and auth reset/failed-transition permutations. Full T0–T4 suites and stage covers were not run by this QA pass; the Coordinator supplied the separate stage cover receipts. SHELL-001 passed and its capture shows the typed message queued. Its recorder session reads `rescue` because the brief explicitly seals away CLAND session identity; execution was performed by qa-678 in this session.

Platform: local macOS, Darwin arm64, Node 24.21.0. Browser: pinned Chrome Headless Shell 156.0.8078.4, Playwright revision 1248; exact binary in platform.txt. No GUI or real browser. Web prerequisite gate reports only. Served and built bundle source stamps both 1d2a126853ca42545b5be161a00a50b3c42b54c88018a07c66015756fe8c08e7, HTTP 200. Profile screenshot E1536S1-08.png shows Jane Q. Doe. All seven Accounts test browser censuses end after 0; scratch hub stopped. Manual browser group after 0. The fixture-owned census found no surviving processes after m18.

Quiet admission temporarily timed out before case 16, then recovered under the brief retry loop. Cases 16 and SHELL-001 started only after quiet admission. This is not a product failure or a performance measurement. No timing claim, no droplet lifetime or cost for this local pass.

Evidence contains only declared outputs, with no environment export, cookies, one-time links or HOME. Publication scan uses the shared assertPublishable policy with a successful positive control, plus visual inspection of the Profile screenshot. Source/provenance reads and served/built stamps retained. Commands followed the brief; the independent source-boundary and scratch cleanup checks ran while the regression group finished, without altering its fixtures.

Evidence: A-15215 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15215-e-1536-stage-mode-and-identity-qa-evidence-cbe02fc6/report.md
