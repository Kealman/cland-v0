# web/test/setup-signin.test.ts

Build the worktree's ignored web/dist with `npm run build`, then run
`node --test web/test/setup-signin.test.ts` (Web). No preservation slot required;
run one file at a time with load under 20, recording /private/tmp hc-/ct-/cland-h-
inventories before and after. Keep pre-existing entries.

Case: `C3 setup completes after the first user registers a passkey on the invite page`.
Uses webFixture's isolated Chrome Headless Shell and scratch profile with a fresh
context (no pre-authenticated shell and no trace capture), CDP's
virtual authenticator, the real auth.mode switch and invite page. Setup must
report done after the persisted passkey; ordinary user.list must show the first
user active. Reader cancellation is joined before cleanup. Readiness waits use
testWaitMs; a failed ceremony aborts and joins setup before fixture disposal.

The prior pageCase fixture could redirect its revoked single-mode shell while
the test navigated to the invite. The fresh context prevents that competing
writer. A planted-error positive control proves the native reporter serializer
receives a redacted Error with no credential-bearing cause or assertion fields.
Never publish the invite, browser trace or screenshots of the invite page.
Only sanitized TAP and credential-free receipt summaries may be exported after
a secret scan with a positive control. Stage QA runs this case on dev; it needs
no real user credential or network provider.
