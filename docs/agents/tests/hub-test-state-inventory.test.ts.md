# hub/test/state-inventory.test.ts

`hub/test/state-inventory.test.ts` is T2: an embedded project hub, fake harness
and scripted DigitalOcean API/lease transport. It observes promise-based and synchronous file
creation, stream opens, lock and atomic rename destinations during the serving
window. The injected `openDatabase` seam captures native SQLite opens and fences
their possible WAL/SHM/journal destinations, including transient companions.
Companion destinations are conservative coverage, not claims that each file was
created. Disposable escape controls prove the observer detects an actual SQLite
row/WAL and a drained stream outside both HOME and the project. The test then
joins the executor and hub before checking every observed write. Lease acquisition
and release use the shared fake-clock driver; the case has a 30-second native
bound so a requested product delay cannot strand the test. It does not
claim native harness or real cloud coverage. Positive controls require ledger
and transient lock writes outside the project under the same scratch HOME/XDG
root. `projectHub`'s `userState: true` removes the executor override through the
shared environment builder and sets XDG state to that sealed worker HOME.

`state-paths.test.ts` (T1) checks precedence and legacy discovery.
`executor-spend.test.ts` must pass unchanged for reconciliation and migration.
`state-paths-lint.test.ts` (T1) scans hub TypeScript and shell source, with planted path and
platform violations, including shell HOME expansions, launcher aliases and
command constants, and split Library path components. Exact expression/context exceptions and reasons live in
`state-paths-inventory.ts`; no file-wide runtime exception is accepted. The
resolver itself owns HOME resolution. Shell executor recipes register their exact machine `/tmp` lines in the same
inventory.

For each later E-1532 socket fallback, register each flagged node in
`state-paths-inventory.ts` in the same item that introduces it. `file` is relative
to `hub/src/`; `expression` is the exact flagged node text and `context` is its
immediate parent expression. Keep the exception's `reason` specific to the
machine path and its bound. For example, `host/records.ts` registers `tmpdir()`
inside `join(tmpdir(), name)` and `'/tmp'` inside `join('/tmp', name)`: the per-host
socket directory needs the same short-path fallback as `layout().socket` for
macOS's 104-byte Unix socket limit. Host secrets and retained records remain in
the project's host directory. Never exempt a whole file or add retained state
to a runtime exception. Add an allowed-expression control and a rejected sibling
expression control, then run `state-paths-lint.test.ts` and `state-paths.test.ts`.
