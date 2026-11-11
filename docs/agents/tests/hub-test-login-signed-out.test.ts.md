# hub/test/login-signed-out.test.ts

`hub/test/login-signed-out.test.ts` is T2. It uses in-process adapters,
SQLite, `projectHub`, recording Hosts and a FakeClock; it starts no harness
process and needs no browser, provider account or network.

Run `node --test hub/test/login-signed-out.test.ts` under the repository's
supported Node version. The default project fixture owns and removes its
scratch directory after hub shutdown.

- `hub login-dead callback persists sign-out and routes the next launch away
  without stopping existing sessions` proves the production session callback,
  retained binding and subsequent pool placement through public frames.
- `project startup recovers an episode committed before card and notice publication`
  restarts embedded hubs around the real store receipt and keeps the same card.
- The indexed `signedOutRows` work-budget test is in login-records.test.ts; it
  proves only two active records decode across twelve mixed-state records and
  asserts SEARCH on login_ready_launch, with no table scan or temporary sort.
- `sign-in card for <name> is once per sign-out, survives reconstruction, and folds on
  ready` proves active metadata deduplication and withdrawal, including a new
  sign-out episode after recovery, including the valid login name `constructor`.
- `rapid same-clock sign-outs replace the old card and keep distinct notice
  receipts` uses two durable episode IDs at one timestamp before a ready observer
  runs.
- The generated `signed-out reconstruction repairs publication <fault>` cases
  close and reopen SQLite after failures before the card, after the card and
  after the notice receipt. Recovery reuses the existing card and notice.
- The Not now reconstruction case keeps the answered card folded for its episode;
  a missing episode identity refuses explicitly.
- `reader reports sign out the bound login once and local or unrelated reports
  do nothing` proves binding identity and the Coordinator lifecycle notice.
- `Claude remote hooks report login death; local hooks retain their signed-out
  latch` exercises the real hook interpreter with all four signals.
- `OpenCode stream classifies provider.auth only for the owning session`
  exercises the native stream state tracker.
- The generated `<harness> classifies dead login <reason>` cases enumerate all
  eight signals; the ordinary-failure case rejects unrelated errors and output.

The three generated `Codex remote native error reports dead login <reason>
without stopping` cases live in `hub/test/codex-host.test.ts`. They use the real
Codex adapter with scripted native RPC and a recording Host, with no child.

These are component receipts. They do not claim live harness or native-host
coverage. Stage QA runs on integrated dev; native fake-binary evidence and the
Linux mode-free verification receipt are recorded separately by the item lead.
