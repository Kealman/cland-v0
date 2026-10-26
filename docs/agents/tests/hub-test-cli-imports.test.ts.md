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
