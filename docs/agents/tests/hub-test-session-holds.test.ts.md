# hub/test/session-holds.test.ts

Supplemental verifier spokes read the exact native launch identity via `claudeLaunchIdentity`, including reconnect after restart and the later dying launch. Keep durable pending requests, hold/verdict/stop/death clearance and native lifecycle assertions.

Run `node --test hub/test/session-holds.test.ts` singly. This T3 file uses
disposable roots and sealed native fixtures; it does not open a browser.
