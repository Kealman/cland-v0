# hub/test/lead-routing-process.test.ts

Explicit idle hooks use the generation from each recorded native launch via `claudeLaunchIdentity`. Preserve virtual idle receipts, native PID death and item/epic/release routing assertions; all original target counts and inherited routing remain.

Run `node --test hub/test/lead-routing-process.test.ts` singly. This T3 file uses
disposable roots and sealed native fixtures; it does not open a browser.

Claude bare-PID polling uses the local Host existence-only probe. Adding a native
identity subprocess before each bare-PID observation delays the dead worker
until after a batched FakeClock advance and shifts its re-exec grace deadline.
Keep the original clock advance, death frame and inherited routing assertions
unchanged; host-local-liveness.test.ts guards the zero-subprocess boundary.
