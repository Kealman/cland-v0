---
id: Q-1527
kind: question
title: "Web sign-in modes and users: single-user as today or multi-user with admin accounts"
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1511
blocked_by: []
topic: null
branch: null
created: 2026-10-31T17:17:21.936Z
updated: 2026-10-31T17:24:25.687Z
closed: 2026-10-31T17:24:25.687Z
---

## Question

Which sign-in system does the web workbench get in 0.4 (the human, 2026-10-31): at setup the project chooses between the single-user mode of today (one human identity, one-time web links, pairing of remotes to that one human) and a multi-user mode with user accounts, all with the same admin rights for now, built so that role-based access can be added later? What a user is in the hub (identity on messages, asks, approvals, remote pairings, artifacts), how users are created and signed in (invite links, passwords, passkeys, OIDC), where they are stored, what single-user mode keeps unchanged, what the Neovim workbench and the CLI do with users, and what is deferred (RBAC itself, per-user notifications, audit). Grilling with the human.

## Comments

### human · 2026-10-31T17:24:25.558Z

## Resolution (round 7, 2026-10-31, all accepted by the human)

1. **Mode at setup and in config.** `[auth] mode = "single" | "users"`, default `single`. Switching single → users creates the first user from the current identity (name from git user.name); the way back is only `cland auth reset`. Single mode is unchanged: one-time link, cookie, one identity.
2. **A user.** A `users` table in hub.db (id, name, display name, role `admin` as the only role for now, state, created). Everything that says "human" today gets a `user_id`: the human's messages, ask answers and approvals (the outcome records who answered), Telegram and Discord pairings (a pairing = user + chat), web sessions (cookie → user), artifacts created by a human. Agents see the author's name in deliveries so the Coordinator can tell people apart.
3. **Sign-in and creation.** An admin creates a user with `cland user add <name>` (and from the web) and gets a one-time invite link; the user registers a passkey (WebAuthn) as the primary method, a password as the fallback for devices without passkeys; OIDC (Google, GitHub) and SSO deferred to 0.4.x. Neovim and the CLI stay local trust (the hub socket); in users mode the CLI acts as the first user by default and the admin gets `--as <user>`.
4. **Remotes in users mode.** A Telegram or Discord pairing is made by a specific user (code after /start, approved by an admin from the inbox as today), one chat = one user; General is mirrored to every paired user, Coordinator asks reach everyone, first answer wins, the outcome shows who answered; several people in one Discord channel are told apart by Discord user id, unpaired ones ignored.
5. **Room for RBAC.** A `roles` table with the single `admin`, permission checks in one place (the web edge's authority table gains a user-role column) so `viewer`/`operator` later are rows, not a refactor; all actions open to every user for now; the hub journal records `user_id` on every human action (audit for free).
6. **Deferred.** Roles other than admin, per-user notifications and inbox (one inbox for all), personal settings, OIDC/SSO, user deletion with pairing transfer, user management from Telegram.
7. **Place in the cut.** Its own epic "Users and sign-in modes", independent of hosts, built in parallel in 0.4.0: shape B is pointless without it (a web behind an Ingress must admit more than one person), shape A can live without it.
