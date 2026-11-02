# web/test/passkeys.test.ts

Build web/dist before this standalone Web file. It uses the shared disposable
projectHub and isolated Chrome Headless Shell fixture, with CDP WebAuthn virtual
authenticators only. No GUI, real authenticator, account or new dependency.

The first case registers an invited user, observes the authenticated Profile and
consumed invite, exports the synthetic credential through CDP, and imports it in
a fresh browser context to prove sign-in. It checks exact replay, failed-attempt
challenge reuse, another user's credential and two-minute expiry through HTTP
receipts without cookies. The same test checks default local invite redirect headers,
localhost resolution by browser and native fetch, and cross-host Origin refusals
in both directions. A shared FakeClock drives hub and enrolled browser Date;
native timers remain running. The database's exact public-only table columns,
public key and advanced counter are checked. Response-byte sentinels are checked
against captured frames, logs and the events journal. The second case removes
WebAuthn availability before navigation and proves tooltip plus working password
fallback. Fixtures observe browser process exit and drain writers before removal.

Unedited preservation files: web/test/signin.test.ts and hub/test/web-signin.test.ts
(password flows), hub/test/web-auth.test.ts (one-time link/cookie contract).
