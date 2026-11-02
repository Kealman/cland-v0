# hub/test/web-signin.test.ts

`hub/test/web-signin.test.ts` uses a disposable projectHub and sealed CLI with a
fixture-local verification lock. It checks invite identity, atomic registration,
digest-backed session binding, used/unknown/revoked refusals, foreign/missing Origin,
Host, password length and single-mode 404. Build the bundle before standalone
runs (`npm run build`); navigation needs the invite entry view. Native HTTP Host
controls use node:http because fetch may discard a Host override. No real account.

Password sign-in controls cover common credential refusals, foreign-Origin denial,
user-bound cookies and browser-scoped sign-out via durable web_sessions rows.
