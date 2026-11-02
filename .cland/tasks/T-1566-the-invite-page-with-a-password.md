---
id: T-1566
kind: task
title: The invite page with a password
state: open
status: review
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
  - T-1565
topic: topic-1321
branch: t/T-1566-the-invite-page-with-a-password
created: 2026-10-31T23:47:51.938Z
updated: 2026-11-02T05:41:23.778Z
---

## Summary

In users mode an invite link opens the invite page, where the user sets a password. The edge stores it as a scrypt hash, consumes the invite, marks the user active and sets a cookie bound to that user. Cookie issuance moves into one helper shared with `/auth`, so E-1538's `Secure` rule applies to every cookie. ADR 0003 gains an amendment for the users-mode admission paths.

Hot files: `hub/src/hub/web-edge.ts` [E-1538], `hub/src/hub/web-auth.ts` [E-1538], new `hub/src/hub/web-signin.ts` (HTTP handlers), new `hub/src/hub/passwords.ts`, `web/src/` new sign-in views (`SignIn.tsx`, `SignIn.module.css`, an entry route), `docs/adr/0003-*.md` (amendment).

## Acceptance criteria

- [x] C1. Opening a valid invite shows the invite page with the user's name, and setting a password there signs the browser in as that user.
  - done: impl-1566 · 2026-11-02T05:38:07.554Z
- [x] C2. The password is stored only as a scrypt hash with a per-user salt, and travels only in an HTTP POST body to the edge, never in a WebSocket frame, a log line or the journal.
  - done: impl-1566 · 2026-11-02T05:38:07.715Z
- [x] C3. A used, expired or unknown invite shows a refusal page naming which, and sets no cookie.
  - done: impl-1566 · 2026-11-02T05:38:08.256Z
- [x] C4. The invite and registration endpoints check Host and exact Origin as `/upload` does, and refuse a foreign Origin with 403.
  - done: impl-1566 · 2026-11-02T05:38:08.778Z
- [x] C5. Every cookie the edge sets, from `/auth` and from the invite, comes from one helper with the existing flags.
  - done: impl-1566 · 2026-11-02T05:38:09.302Z
  - verified: rev-36 [reviewer] · run rev-36-1566-source-1 · 2026-11-02T05:41:23.778Z · commit 45b833d7fb48666ce8dcfe69e68e7224822c1d14
- [x] C6. In single mode the invite paths answer 404 and the link flow is unchanged.
  - done: impl-1566 · 2026-11-02T05:38:09.814Z
- [x] C7. ADR 0003 has an amendment describing users-mode admission: invites, password and passkey sign-in, cookies bound to users.
  - done: impl-1566 · 2026-11-02T05:38:10.336Z
  - verified: rev-36 [reviewer] · run rev-36-1566-source-1 · 2026-11-02T05:41:23.778Z · commit 45b833d7fb48666ce8dcfe69e68e7224822c1d14

## Comments

### impl-1566 · 2026-11-02T05:29:58.961Z

Contract inventory (rule 20): searched Set-Cookie, WEB_SESSION_SECONDS, checkInvite, consumeInvite, /invite, createWebSession across hub/web/shared/nvim/docs/skills/QA, all tiers. Production consumers: web-edge.ts (/auth and new invite routes), web-auth.ts, store.ts, users.ts; web Accounts mints URLs only. Tests: web-auth, web-authority, invites, user-invites, web/accounts. QA E-412 stages 1–3, E-415 s2, E-419 s2 and E-1536 s2 use existing links/cookies and remain compatible. No frame or prior wire shape changes. New shared cookie interface: webSessionCookie(auth, sessionToken, request, configuredOrigin): string, used by every edge cookie setter; preserves existing flags/conditional Secure, ready for T-1624. Public HTTP registration seam and Users credential commit seam cover atomic invite spend and persisted hash; single-mode /auth and web-authority remain preservation controls.

### impl-1566 · 2026-11-02T05:35:30.766Z

Expanded contract search also covered WebAuth/web-auth imports, web_sessions persisted readers, /auth query users and cookie headers: production dispatch.ts (unchanged transport user lookup), web-artifacts.ts (unchanged capability/session checks), webauthn.ts (pure byte validator, unaffected), Store schema/session readers (unchanged rows; new separate user_passwords table). Consumers in web connection/phone-install, web-auth-unit, web-artifacts[-unit], web-authority[-unit], web-network-unit, auth-mode/users/answer-users/artifact-user, web-upload, gateway/gateway-state and Telegram card fixtures retain their existing APIs. Startup/suite readers run-suite/web-phase/suite-runner and skills/QA/readme/capture policy tests retain prior /auth behavior. QA E-413/414/415/417/418/419, E-1308/E-1311 and E-1536 stage1 use unchanged link/cookie shape. No migration needed: existing signatures and wire payloads kept, new table/routes only. Existing web-auth.test.ts is the unedited link-flow preservation regression (29 passing local macOS tests).

### rev-36 · 2026-11-02T05:41:23.778Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1566-source-1
commit: 45b833d7fb48666ce8dcfe69e68e7224822c1d14
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards/Spec no findings. Reviewed end-to-end invite HTTP/form, salted scrypt, commit-time invite/mode/admission checks and atomic hash/activation/spend/session savepoint; shutdown owns and joins input/hash work. Password remains bounded HTTP JSON outside frames/log paths. Shared cookie helper preserves previous /auth flags; Host/exact Origin admission and single-mode404 inspected. Consumer inventory, tiers, docs/help/skill/change record and dated ADR amendment reviewed. C5/C7 source verified; C1–C4/C6 await exact-head post-source mode-free verify and named password/HTTP/browser/unchanged link-auth evidence. A-15582 preliminary local summaries pin earlier implementation plus reported help-only tip checks,not a post-source suite. No Reviewer tests/browser/edits;QA after-stage separate.

Criteria: C5 verified, C7 verified.
