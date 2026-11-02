---
id: T-1568
kind: task
title: Passkeys on the invite and sign-in pages
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1559
  - T-1567
topic: null
branch: null
created: 2026-10-31T23:47:52.450Z
updated: 2026-11-02T05:28:35.883Z
---

## Summary

The invite page offers a passkey first and a password as the fallback. The sign-in page offers passkey sign-in. Challenges are single-use and short-lived, and the hub checks them with L02's module. Only public keys and counters are stored. Tests drive headless Chromium with Chromium's virtual authenticator, so no new dependency is needed.

Hot files: `hub/src/hub/web-signin.ts`, `hub/src/hub/store.ts` [Host] or `users.ts` (a `passkeys` table: user id, credential id, public key, counter), `web/src/SignIn.tsx`, web tests with a CDP virtual authenticator.

## Acceptance criteria

- [ ] C1. In headless Chromium with a virtual authenticator, an invited user registers a passkey on the invite page and is signed in, and the invite is consumed.
- [ ] C2. That user signs in again with the passkey from a fresh browser context on the sign-in page.
- [ ] C3. A replayed assertion, a challenge used twice or past its lifetime, and an assertion for another user's credential are refused.
- [ ] C4. `hub.db` holds only the credential id, public key and counter of a passkey, and no frame, log line or journal record carries a challenge response.
- [ ] C5. Where WebAuthn is unavailable, the invite page offers only the password and says so in a tooltip.
- [ ] C6. `package.json` and the lockfiles are unchanged.
