# hub/test/claude-stop-owner-component.test.ts

T2 runs the real AgentProcesses persistence, adoption, reconciliation, prepared
stop admission and stop helper against scripted ps/proc and signal boundaries.
No child is launched or signalled. Each mode gets a disposable root and the
shared fixtureEnvironment. It drains owner writes before removing the root.

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
