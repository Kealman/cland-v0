# hub/test/web-cookie-secure.test.ts

T2 HTTP checks use a disposable `tempProject` and `projectHub`; no browser or TLS
front is needed to inspect Set-Cookie. All network traffic stays on loopback,
with an explicit Host to simulate the configured HTTPS tunnel. The production
configuration parser restricts `[web] origin` to HTTPS.

The navigation test is the red-first regression for a top-level `/auth` GET with
no Origin. Forwarded-header cases run with and without configured origin and
retain foreign-Host 403/no-cookie checks. Invite/password requests use managed
config and the Unix auth-mode frame; authenticated upload and invite/sign-in API
requests retain exact-Origin 403 checks. The shared policy matrix in
`web-auth-unit.test.ts` covers local, LAN, foreign, missing and wrong-port Hosts.
Passkey finish handlers call the same cookie helper; their ceremony regressions
remain in `web-signin.test.ts` and the isolated browser sign-in tests.
