---
id: T-1838
kind: task
title: The users and sign-in modes page, the multi-user section and the CLI reference for `cland user` and `cland auth`
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1834
  - T-1835
  - T-1836
topic: topic-1518
branch: t/T-1838-the-users-and-sign-in-modes-page-the
created: 2026-11-12T10:07:23.227Z
updated: 2026-11-15T06:37:33.458Z
---

## Summary

A new docs page, "Users and sign-in modes", describes the two modes as built. The web-and-phone page gains a multi-user section, and the CLI reference lists `cland user` and `cland auth`. A reader can switch a project to users mode and invite a user from the page alone.

## What to build

Spec §3.8 and §3.9, written from the build of E-1536 and this stage. The page goes under Features in the sidebar and is linked from the features overview. It covers:
- **The modes.** Single and users; `cland auth mode users` and what switching does (the first user from git's `user.name`, browser sessions signed out); `cland auth reset` as the only way back.
- **Users.** `cland user add`, `list` and `invite`; the invite page with a passkey or a password; `--as <user>`; who wrote, answered and approved.
- **Remotes.** Pairings per user, General mirrored to every paired user, the first answer winning.
- **Setup and doctor.** Setup's sign-in mode step and doctor's mode line.
- **Deferred.** What waits for 0.4.x.

The multi-user section of web-and-phone covers signing in with a passkey or a password, the admin's users list and invites in the web, the author names on messages and outcomes, and one inbox for everyone. It links to the users page. The command blocks a reader runs are marked.

## Acceptance criteria

- [ ] C1. The page is in the docs sidebar under Features, is linked from the features overview, and has sections on the two modes, switching and reset, users and invites, passkeys and passwords, `--as`, remotes in users mode, setup's sign-in step and doctor's mode line (test).
- [ ] C2. Every `cland` command and config key on the page and in web-and-phone's multi-user section exists in the CLI help and the config keys (test).
- [ ] C3. The page's marked command blocks, run in order in a scratch single-mode project, switch it to users mode and print a one-time invite for a second user (test).
- [ ] C4. web-and-phone has a multi-user section on passkey and password sign-in, the users list and invites in the web, author names and the one inbox, linked from the users page (test).
- [ ] C5. The CLI reference lists each `cland user` and `cland auth` subcommand that their usage text names, and no other, and the closed-item wording lint passes on the changed pages (test).

## Blocked by

- T-1834 (the CLI reference)
- T-1835
- T-1836

## Notes

- Hot files: `site/src/content/docs/docs/users.md` (new), `site/src/content/docs/docs/web-and-phone.mdx`, `site/src/content/docs/docs/cli.md`, `site/astro.config.mjs`, `site/src/content/docs/docs/features.md`, `site/test/`.
- Tests: new `site/test/users-docs.test.ts` (T1); new `hub/test/users-docs-invite.test.ts` (T2, runs the marked blocks on `projectHub` with the web edge).
- Serves epic C7.
