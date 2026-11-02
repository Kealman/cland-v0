# web/test/signin.test.ts

`web/test/signin.test.ts` uses the shared isolated Headless Shell fixture, a
prepared disposable project config and a real users-mode invite. It observes the
registration POST response and the authenticated Profile's exact display name,
then checks captured WebSocket frames exclude the password. Build web/dist first;
the fixture observes browser process drainage before deleting its root. No GUI,
real authenticator or account is involved.

The password form case clears its context cookies and navigates to the root,
observes the sign-in view, then signs in and signs out from Profile. A sibling
tab must render sign-in after socket revocation, while a second isolated context
retains its own cookie and authenticated Profile after reload. No real browser.
