---
id: T-1565
kind: task
title: "Invites: `cland user add` and the one-time invite link"
state: open
status: in progress
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1558
topic: topic-1310
branch: t/T-1565-invites-cland-user-add-and-the-one-time
created: 2026-10-31T23:47:51.739Z
updated: 2026-11-01T19:54:57.454Z
---

## Summary

`cland user add <name> [--display <name>]` creates an admin user in state `invited` and prints a one-time invite link valid for 24 hours. `cland user invite <name>` mints a fresh link for an existing user (assumed, A16), and the switch to users mode prints one for the first user. Invites are stored as digests only, and a used or expired invite is refused when it is checked.

Hot files: new `hub/src/hub/invites.ts` (or within `users.ts`), `hub/src/hub/dispatch.ts` [Host], `hub/src/protocol.ts` [Host], `hub/src/hub/web-authority.ts` [Host], `hub/src/cli/user.ts`.

## Acceptance criteria

- [ ] C1. `cland user add <name>` creates a user with role `admin` and state `invited` and prints an invite URL on the web edge's address.
- [ ] C2. Names are lowercase slugs, unique, and never `human`, `hub`, `all`, a role name or a current session name, and each refusal names the rule.
- [ ] C3. The invite token is stored only as a SHA-256 digest with its expiry, and appears in no log line, frame other than the minting result, or journal record.
- [ ] C4. The invite check accepts an invite once within 24 hours (by the hub clock), and refuses a used, an expired or an unknown token with distinct reasons.
- [ ] C5. `cland user invite <name>` replaces any open invite of that user, and the switch to users mode prints the first user's invite.
- [ ] C6. `cland auth reset` revokes every open invite through T-1558's reset step, proven by a test that resets with an open invite and then refuses its token.

## Comments

### impl-1565 · 2026-11-01T19:54:57.454Z

Contract consumer inventory before implementation: Users firstAdmin/reset callers (daemon, users/auth-mode tests); auth.mode result CLI auth.ts and auth-mode tests, stage-1 QA brief (existing user result retained, invite URL additive/optional on older hubs); user.list consumers web accounts test and QA brief unchanged. New user.add/user.invite frames require protocol validator, session-CLI classification, web explicit CLI-only authority and gateway exclusion; audit summarizer must omit tokens/results. Searched field/frame/function names across hub/src, hub/test (all tiers), web/test, nvim/test, qa and .agents. New invite check is a Store API for the subsequent sign-in item, not a token-bearing client frame. Approved seams: existing public Users Store T1 and disposable projectHub/CLI T2 from T-1558.
