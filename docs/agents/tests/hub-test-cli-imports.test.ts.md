# hub/test/cli-imports.test.ts

T3 real-CLI import observation uses disposable roots, sealed runner environments
and synchronous child completion before root removal. The resolver counter has
a positive observed-module control; database-free cases explicitly observe
SQLite before checking its absence from commands that do not need it.

Secret storage must stay out of shared `project.ts` imports. The T-1328 control
failed with 22 modules against the unchanged `hub status` budget of 21;
importing the resolver only inside daemon startup restores the existing closure.
Keep the budget and dispatch-module assertions. The [T2 secret startup
cases](hub-test-secrets.test.ts.md) separately prove that deferred loading still
tightens/refuses credentials before serving and releases the lock on refusal.

The auth/user commands share one pure help module, and login adds its own pure
help module (38 total). Keep the
non-help implementation budgets unchanged. Native no-hub auth/user calls remain
database-free, and both dispatch paths preserve their import-failure stderr/exit.

Task patch streaming loads only inside `Git.patchId`. `cland task list --json`
imports the callable verdict reader without its streaming transport: the
native counter records 55 total modules, including 38 pure help modules,
within the existing 17-module implementation budget. The transport still
checks cancellation before native launch after its deferred import; the
merge-queue cases retain the large-patch and held-close behavior proof.

Hub lifecycle readers load dynamically only when their operation needs a lock. Empty-project status and stop avoid importing lock/host-identity/process probes; keep the existing module budgets and full command-closure assertions. Foreign-lock behavior remains covered by the reader tests.

Paid-term wire shape validation lives in dependency-free
host/paid-terms-input.ts. Protocol decoding must not import the captured-config
projection owner, which imports pool parsing and duration/transport modules.
T-1858's native regression observed 60 total modules for hub status (22 non-help,
over budget 21); the narrow input guard restores 57 total/19 non-help without
changing budgets, help counts, dispatch assertions or the validation grammar.
