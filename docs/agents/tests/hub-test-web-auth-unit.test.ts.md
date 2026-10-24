# hub/test/web-auth-unit.test.ts

`web-auth-unit.test.ts` covers digest storage, one-time spending and expiry with
an injected clock at T1. It also reads the explicit acceptance row to verify
cookie hash-only persistence and last-use updates across store reopenings.
`web-auth.test.ts` restarts an in-process hub twice on one disposable project to
prove cookie persistence; no process lifecycle assertion requires a daemon.
Its executable `web --sessions`/`--revoke` tests count sockets, arm close observers
before revoking, assert the server `web-session-socket-closed` receipts by CLI
return, and separately bound client closure plus cookie refusal. It also
covers HTTP upgrade checks, client/spoke admission and secret leakage at T2
with an in-process project hub. Its standalone prerequisite uses the shared
web-build helper to build a missing or stale bundle once before tests; the leak
scan requests every file of the actual installed bundle. Suite shards containing
any `installedBundleReaders` entry in `hub/test/run-suite.ts` build before workers,
even without a Web phase or an available browser. That list includes this file
and all real-doctor bundle readers, including `doctor-cli.test.ts`; targeted
standalone doctor CLI runs require a current build.
Doctor component fixtures inject the installation bundle check; the separate
`web-bundle.test.ts` retains missing/stale/current diagnosis on scratch files.
The tests use scratch HOME/XDG/Git configuration
and filtered environments through the shared fixtures. Both `open` and
`xdg-open` are stubbed on scratch PATH even for `--no-open`, so a regression
cannot launch the human's browser or touch its keychain. Real browser checks
belong to the dedicated headless web phase (T-991/T-992).
