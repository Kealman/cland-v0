# hub/test/claude-stop-owner-component.test.ts

T2 runs the real AgentProcesses persistence, adoption, reconciliation, prepared
stop admission and stop helper against scripted ps/proc and signal boundaries.
No child is launched or signalled. Each mode gets a disposable root and the
shared fixtureEnvironment. It drains owner writes before removing the root.
The whole case enrolls shared normal/signal ownership before acquisition, guards
each root immediately, and defers removal until the sequence and owner drain.
Each original nested callback is independently admitted into that same owner,
so cancellation settling `t.test` cannot release its setup/body/drain promise.
Setup has named acquisition and admission deadlines; subsequent steps are fenced.
Positive launch controls reject spawn, low-level `ChildProcess.prototype.spawn`
and both exec forms; execFile callback refuses while its promisified ps boundary
is scripted. Non-control attempts are counted even if callers swallow errors.
A final zero-attempt assertion runs after owned callback/drain/directory cleanup,
before global mocks restore.
Mocks and the shared Date use the standalone tracker, so node:test context
cleanup cannot restore them automatically on timeout. Original callback and raw
setup promises are tracked independently of deadline races. The final cleanup
check bounds their join and restores globals only after that join succeeds;
an incomplete join retains mocks and guarded roots for worker recovery.

The native signal fake distinguishes signal zero from termination. A missing
synthetic PID returns ESRCH; a present PID succeeds without changing rows or
recording a termination. The replacement case explicitly feeds fake proc ENOENT
through the production Linux observer on every platform, for both a hidden live
child (unknown) and the exited captured child (ended). Before this fake migration,
the exited control reports ended false and fails; afterward closure settles
without granting authority over the replacement root.

The positive case replaces the admitted root birth while keeping a live row at
that same PID and group, and reparents an already pinned hook. The owner must
admit and signal only that hook, durably close the old tree and leave the
replacement untouched. Two negative cases retain an additional unowned writer
or an unreadable root birth, and require no signals and no closed owner.

The same mocked Date serves all stop time readers. Only the helper's pause
advances that clock; other native timers remain real. Native exec and signal
boundaries assert their selectors and targets. Filesystem persistence remains
real. Before the fix, the positive case reproduces authority-unknown in owner
capture; the two conservative controls pass. Afterward all modes pass. Native
root-exit retry is separately covered by claude-code-remote.test.ts.

The deadline-retention mode keeps both synthetic admitted births live through
TERM/KILL, advances the common virtual Date only at stop pauses, and observes
exact expiry of the production total deadline. The real Claude adapter receives
the owner's failed stop, reports cleanup-incomplete and unknown state, while the
real owner's persisted row remains owned and unended. No CLI is launched, no
native signal is sent and no wall time is awaited. This separates deadline
safety from the native TERM-resistant control's generous production grace.
