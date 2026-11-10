# hub/test/login-exclusive.test.ts

Run `node --test hub/test/login-exclusive.test.ts` on supported Node. T2 uses
disposable roots, directory-only provider volumes, recording Hosts and FakeClock.
The cases exercise writer/reader selection and latest-snapshot cloning,
exclusive and attached-elsewhere refusals, missing snapshots, confirmed reader
deletion and retained ownership on incomplete deletion. The CLI case proves
local `login set` and writer/reader membership in `login list`.

The initial reader-selection red receipt was `no login codex in pool agents`;
reader-release red retained a clone in inventory; CLI red rejected `login set`.
Native rotating-file evidence is in login-exclusive-native.test.ts.

Fault controls retain the ordinary assertions and reopen SQLite for lost clone
creation responses, committed deletion with lost response, and failed unbind in
both reachable and lost-host release. Allocation count proves restart does not
send another create before ownership is recovered. Failed binding publication
must clean the captured clone. A forced fixture-body failure holds creation until
binder shutdown and asserts its joined completion before SQLite close. Snapshot
helpers await FakeClock advancement before provider reads.

Installed-owner controls first destroy a host with an unbound create obligation,
observe its incomplete cleanup and automatic retry, then close/reopen SQLite and
install the real retry callback through `destroyHost`. Both interrupted and
already-destroyed rows must finish without a manual release-helper call. A
deleting intent plus an omitted-but-existing volume must keep ownership when the
exact provider deletion refuses. Final-reader recovery through the binder and
unbound-release path uses real `LoginSnapshots`: its release fence must clear and
pending backup must durably complete. Advance the hub clock by its one-millisecond
minimum timer tick before awaiting that backup receipt; a zero advance runs no
scheduled snapshot.
