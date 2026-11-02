# web/test/accounts.test.ts

T-1560: the users-mode Profile test switches through auth.mode before page admission and waits for the authenticated display name rendered in Profile. Existing single-mode cases retain the prior web.session shape.

Run `node --test web/test/accounts.test.ts` after building the web bundle.
Use the sealed Headless Shell fixture. The Users case switches a disposable managed
project to users mode before minting its browser sign-in. Wait for each named cell
before checking the whole row and count. It creates an invited admin, reads the
one-time invite, dismisses it, checks duplicate refusal and reloads to prove the
invite was not saved. The single-mode Profile case keeps Users absent. Existing
account-reading cases remain separate from user identities.

The same-mounted reconnect case arms a socket observer before auth reset, redeems
a new single-mode link in another tab sharing the cookie, then waits for the exact
web.session result without user on the original tab. It keeps a same-document
marker and final absent-Users/invite assertions. The creation case stubs only the
clipboard boundary, testing missing API and rejected writes with the selectable
invite retained.
