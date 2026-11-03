# hub/test/remote-publications.test.ts

T1 uses an in-memory Store and verifies single-mode enumeration, per-user
AsyncLocalStorage scope across awaits and one copy per shared Discord channel.
No socket, subprocess or browser is involved.

Gap-owner regressions use the real Telegram/shared gap planner with in-memory
state: fresh, saved and old-shape checkpoints after reassignment, plus a held
native send that completes after its admitted owner loses the pairing. They
retain the final missed-job assertions.
