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
topic: null
branch: null
created: 2026-10-31T18:22:04.289Z
updated: 2026-10-31T18:22:55.935Z
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
