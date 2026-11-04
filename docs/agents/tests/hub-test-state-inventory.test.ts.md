# hub/test/state-inventory.test.ts

`hub/test/state-inventory.test.ts` is T2: an embedded project hub, fake harness
and scripted DigitalOcean API/lease transport. It observes promise-based and synchronous file
creation, stream opens, lock and atomic rename destinations during the serving
window. The injected `openDatabase` seam captures native SQLite opens and fences
their possible WAL/SHM/journal destinations, including transient companions.
Companion destinations are conservative coverage, not claims that each file was
created. Disposable escape controls prove the observer detects an actual SQLite
row/WAL and a drained stream outside both HOME and the project. The observer attributes writes with a test-owned async context, including hub
startup, requests and shutdown. A concurrent writer in a sibling allocation under
the shared suite TMPDIR runs outside that context; its persisted bytes and
observation prove it ran during the window. A second case injects a synchronous
stray write from the hub's database-open callback into that same sibling and
requires the inventory assertion to reject it. SQLite/stream escape controls and
the ledger/lock controls remain active in both cases.

Socket runtime exceptions use the production `layout` paths registered by
`state-paths-inventory.ts`, with no blanket TMPDIR exemption. Only a successful
observed rename from a same-directory `.h<hex>` staging name into this hub's
chosen socket allows those exact paths and the parent mkdir. Other writes in
that directory remain subject to ownership and HOME/project checks. The test then
joins the executor and hub before checking every observed write. Lease acquisition
and release use the shared fake-clock driver; the case has a 30-second native
bound so a requested product delay cannot strand the test. It does not
claim native harness or real cloud coverage. Positive controls require ledger
and transient lock writes outside the project under the same scratch HOME/XDG
root. `projectHub`'s `userState: true` removes the executor override through the
shared environment builder and sets XDG state to that sealed worker HOME.

`state-paths.test.ts` (T1) checks precedence and legacy discovery.
It also checks the host Claude account-root resolver's command config override,
command HOME and agent HOME precedence; no filesystem or account is opened.
The host agent's account-root HOME expressions are recorded in the inventory
with their owner and login/job-record reason. The shared resolver owns these
reads; the unchanged full-source assertion still rejects ad hoc reads elsewhere.
The resolver lives inside the Node-only agent module tree and the hub re-exports
the identical function; the unit case checks that identity. The unedited agent
boundary guard still rejects imports from the agent into hub-owned modules.
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

T-1636 C3 carries a seven-day, 13-second allowance for the full-source T1 AST scan,
owned by C-216, expiring 2026-11-09. The Linux stage sample in A-15910 was 8.459 s;
other same-day samples reported by the Coordinator were 1.1–2.2 s. This bounds
platform I/O variance while preserving the scan and all planted controls; T-1638
owns the optimization and allowance removal.

Codex registers tmpdir() and '/tmp' only under the exact local-versus-host
conditional. Remote missing-runDirectory policy refuses before consulting paths;
only the local Host uses hub tmpdir. The remote /tmp entry names the host temp
root because HostLaunchLayout has no temp field; Host.realpath follows its
symlink on the host. The allowed expression and rejected sibling controls in
state-paths-lint preserve the guard. See ADR0008 and the remote frame policy scan.
