# hub/test/fake-harness-login.test.ts

T3: fake CLI process and detached-holder lifecycle seam for T-1774. No hub is
started. All profiles, Git configuration, calls and login files belong to fresh
sealed disposable roots. No browser or real credential is involved.

Run `node --test hub/test/fake-harness-login.test.ts` with supported Node 24 and
local `CLAND_*` variables stripped. Observe cover-quiet admission and the release preservation slot for native runs. The shared
[fixture contract](../fake-harness-logins.md) documents the downstream API.

Generated cases for each `claude-code`, `codex`, `opencode` prefix:

- `sign-in writes generation zero in its harness home` proves C1 initialization.
- `turns rotate and dead logins recover only after sign-in` proves C1/C2.
- `records CLI logout and slash logout` proves C4.
- `sign-in leaves one observed detached holder with an open home file` proves
  C5: persisted open-file inode receipt, live PID, reuse, then observed OS exit.

`Codex refuses a live login without changing bytes and replaces a dead login`
proves C3. `Codex native app-server turns retain the last twenty rotations and
report revocation` drives actual stdio RPC turns, waits for correlated terminal
turn receipts, checks the persisted history, and asserts the native error frame.

Setup and cleanup use `testWaitMs`/`until` bounds. No guessed sleep proves a
boundary. Child exit, JSON files and completed RPC frames are the receipts.
The standalone headless forms cover shared login semantics; stage QA exercises
the integrated login volume and card workflows on dev.

Review regressions also cover empty Claude input, stale/forged holder receipts,
crash/replacement, receipt corruption, failed sign-in after holder readiness,
and disabled-mode CLI refusal parity. Holder cleanup is registered before launch
and uses the private live control socket, never a PID signal from a disk receipt.
The planted failure setting `FAKE_LOGIN_HOLDER_FAIL_AFTER_READY=1` aborts before
the ownership commit and waits for the uncommitted child native exit.
