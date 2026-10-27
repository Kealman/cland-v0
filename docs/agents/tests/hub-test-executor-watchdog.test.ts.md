# hub/test/executor-watchdog.test.ts

T1 tests the exported `armWatchdog`, `watchdogAlive` and `stopWatchdog` OS boundary with injected
native births, UTC starts, PID presence, signals and fake time. No real child,
provider, socket or wall-clock wait is needed. The executor checkpoint cases use
disposable lease files and `fixtureEnvironment`, with injected provider/lock facts.

Keep the previous persisted shape (`pid`, `startedUtc`, absent `pidIdentity`) as
the migration fixture. Assert its coherent native/start observation is durably
checkpointed once before the first signal. Refuse changed/unreadable starts,
changed/unreadable births, absent checkpoints and failed checkpoints. Preserve
the record on failed persistence. A precise row never adopts a replacement's
birth, even if its whole-second start is identical.

Retain positive SIGTERM and SIGKILL controls beside no-signal checks. Reuse
between initial validation and SIGTERM, and at grace expiry before SIGKILL, must
not signal the replacement. An unreadable live identity exhausts the fake-time
bound explicitly; it is not an exit receipt. Final signal and live-process
assertions remain after the stop's actual completion or rejection.

Checkpoint cases invoke `DropletExecutor.inspect` through its host boundary and
read back the persisted lease after completion. Migration preserves a concurrent
state transition and refuses a newer watchdog. No role-clause expansion or
permission change is involved.

The held-provider release case observes the initial persisted `releasing` state,
lets inspection durably upgrade the legacy watchdog, then completes release.
Assert final `released` state, retained native identity, one legacy start probe
and the positive SIGTERM receipt. The ownership-only checkpoint and every full
`writeLease` call, including run updates, share a per-directory queue; stale
same-watchdog records retain persisted native identity instead of reopening
legacy adoption. Register unconditional disposal before launching held work:
abort setup, release all barriers, drain the full writer promises, close the
executor, restore/sync filesystem mocks, then remove the root. Inspect's bounded
reply is separate from its underlying ownership checkpoint; track and drain both.
Setup observers are armed before launch, independently bounded by 1000 ms of fake
time and abortable through both the fixture controller and the test signal.
Keep the separate 2 s test hang guard.
The overlapping-write control holds the checkpoint's actual filesystem rename,
starts a terminal full write, then drains both and reads back both durable facts.
Removing the shared queue and identity retention must make that control fail.
Both held boundaries have missing-receipt and aborted-setup controls. Call the
same idempotent disposal registered with `t.after`, then assert every writer's
settlement, restored default and named ESM rename bindings and root absence.

Native launch/restart capture and the release/rearm interleaving remain in
`hub/test/executor-droplet.test.ts` (T3). Its armed and rearmed records must match
the actual native birth, and its held startup probe retains the released-lease
and replacement-exit assertions. Synthetic T1 reuse does not claim real OS PID
recycling; the native suite does not force same-second PID reuse.

Arm controls inject the owned `ChildProcess` launch handle plus native probes and
fake time. One unavailable birth must recover to a coherent birth/start/birth
record within the 10-second retry window, without a bare-PID signal. A held
probe must refuse at exactly 10 seconds, clean up through the owned handle and
ignore its late reply. A changed readable birth after an unavailable UTC start
must refuse before another start probe; ownership cannot reset between retries.
Keep the successful owned-child SIGTERM control after arm and the existing
restart no-signal controls. Native probe timeouts use the remaining window,
capped at 3000 ms, and retry gaps use 25 ms of injected time. Failure cleanup's
child-close bound is separate (5000 ms by default). These controls use no real
process, wall-clock wait or new duration allowance.

Every arm control registers its fixture owner before launch and arms the setup
observer before starting arm work. An independent setup FakeClock progresses
inside `start` through a 1000 ms bound; a missing probe receipt needs no caller
advance of the arm clock. Combine fixture, test and explicit cancellation.
Unconditional disposal releases the held native reply, joins admitted arm/stop
work, setup observers and clock drivers, then observes fake-child close and the
owned-child-map cleanup. Keep the missing-receipt and aborted-setup controls:
they observe setup failure while arm time is still zero, join the late verified
arm, stop it through its owned handle, and refuse a second stop when the public
native-birth port reports a replacement. Timer counts only supplement those
actual completion and close receipts. No real-time wait is added.
