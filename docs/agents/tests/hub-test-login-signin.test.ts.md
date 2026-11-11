# hub/test/login-signin.test.ts

T1: in-memory SQLite, injected Host/provider boundaries and FakeClock. Cases
prove exact public sign-in commands, the production source logout prohibition,
failed terminal outcomes retaining detached signed-out disks, and creating
isolation through unmount, snapshot and detach receipts. No native process,
socket, real clock wait or external login runs.

Run `node --test hub/test/login-signin.test.ts` with supported Node 24. CLI and
native fake SSH evidence live in login-add.test.ts; hub connection authority
is covered by login-add-component.test.ts.

`sign-in records volume and snapshot lifetime receipts in the admitted pool` asserts exact receipts using useClock(FakeClock), confirmed snapshot deletion time, next-month pruning and refusal of a changed clock.

Renewal controls prove the shared snapshot owner holds release and shutdown
through an outstanding freeze, then thaws before they settle. Held inventory
cases replace the writer episode without changing its public shape, remove the
writer, detach the disk or replace its birth; each refuses before freeze or
snapshot. The native next-turn and bound Codex controls live in
login-resignin-native.test.ts; restart/fence controls live in
login-signin-recovery.test.ts.

`renewal freeze recovery thaws on the same admitted machine` and its
different-birth companion reproduce a failed thaw, reconstruct the shared
snapshot owner, then prove matching-host recovery and non-transfer of authority.
The resolver and renewal share snapshotHostIdentity; no second snapshot is sent.

The absent-live-host control refuses thaw without a current captured machine.
Admission and completion use the real removal and snapshot owner guards. A
queued backup alone permits renewal; an unknown native snapshot admission does
not. The rate-refusal regression proves native success publishes ready with a
pending backup and retryAt, then the shared owner's scheduled attempt snapshots.
The unbound interruption control supplies a cleanup callback and proves owner
loss invokes no disk cleanup, retains the admitted host and refuses another signer.
