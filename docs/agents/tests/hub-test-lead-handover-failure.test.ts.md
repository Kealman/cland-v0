# hub/test/lead-handover-failure.test.ts

T3 lifecycle regressions. Run singly with `node --test
hub/test/lead-handover-failure.test.ts` under the native-slot procedure.

The first case runs lead-handover-process with a forced assertion after crash,
before restart. It requires code 1, no signal, the planted assertion diagnostic
and the final one-failure TAP summary within load-scaled setup headroom.
Incomplete runs include native exit/signal and a bounded diagnostic tail.
Cleanup stops captured workers and discovers detached fixture descendants before
the disposable root is removed.

The Linux-only case stops a fixture parent before terminating its captured child.
It proves kill(pid, 0) still succeeds while the native adapter reports zombie
exit, and observes parent close in teardown. macOS explicitly skips this case;
Linux proof comes from the configured droplet T3 verification.

All callbacks use `handoverCase` before acquisition, composing the existing stage
owner. `handoverChild` registers its close fence before spawn and retains native
capture and late results inside the producer. Diagnostic tails keep at most
12,000 bytes while reading. Stops start before joining an observing callback;
required native close and detached descendant drainage precede root removal.

The partial-acquisition case throws after native capture but before returning
the child, then rejects the required close. It exercises real guarded directory
removal and restoration refusal, checks the retained root independently, repairs
close, and requires the root's ENOENT receipt after guarded removal. This is the
ownership rejection control for the actual child acquisition boundary.
