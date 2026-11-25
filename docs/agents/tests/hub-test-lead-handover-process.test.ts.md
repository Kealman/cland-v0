# hub/test/lead-handover-process.test.ts

Supplemental Lead spokes explicitly carry their recorded native launch identity via `claudeLaunchIdentity`. Keep the real crash-at-committed boundary, recovered node claim, other Lead identity, note and one-handover assertions.

Run `node --test hub/test/lead-handover-process.test.ts` singly. This T3 file uses
disposable roots and sealed native fixtures; it does not open a browser.

Crash observation is armed before handover and accepts either a native zombie
exit receipt or ESRCH. It does not require PID collection by an orphan's parent.
Supplemental spokes close through the fixture resource owner before directory
disposal. `CLAND_TEST_HANDOVER_FAILURE=after-crash` injects an assertion before
restart solely for the bounded child regression in lead-handover-failure.

`handoverCase` installs the shared stage owner before setup. Named setup steps
retain late acquisitions and register required closes before launching. Closing
fences admission, cancels the crash observer and starts known resource stops
before joining the original callback; the restart step cannot cross that fence.
Required native closes and harness writer drainage guard root disposal.
