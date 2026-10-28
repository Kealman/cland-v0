# hub/test/telegram-marks-setup.test.ts

T2 fake-platform setup controls for the shared native workbench marks fixture.
Both missing and explicitly aborted hub setup receipts use pacingOwner's bounded
acquisition/disposal path. Arm the native poll-close observer before cancellation,
then assert its exact receipt, hub.stopped, closed native fake with zero handlers
and connections, closed Store, and zero owned observers and clock timers.
The same disposal barrier is registered before directory cleanup, including signal
cleanup. No workbench is launched by these setup controls. Run this file alone.

The allocator registers each root once with ownDirectory.beforeRemove, including
the Web root supplied through its optional project allocator. The gate bounds
waiting without discarding the underlying owner settlement. A held closer
control uses an injected deadline: removal rejects while root and Store remain
usable; release the closer, observe the Store closed, retry the same remover and
assert ENOENT. Directory ordering alone is not this successful-drain gate.
