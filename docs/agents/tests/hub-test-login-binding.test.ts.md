# hub/test/login-binding.test.ts

T2 public session-launch seam: projectHub sockets, recording provided Host and
real directory-backed FakeHostProvider volumes. No child, browser, external
provider, real login or credential is used. Every fixture owns a disposable
root through tempProject and seals its environment through fixtureEnvironment.

Run `node --test hub/test/login-binding.test.ts` on supported Node 24, with
inherited CLAND variables stripped and cover-quiet admission respected.

Generated cases prove mount before spawn and provider attachment (C1), a single
mount reused by two sessions (C2), role account independent of the local registry
(C3), persisted login/account and mount-only accountEnv plus five stripped auth
variables (C4), unmount/detach rollback with ready state (C5), and local bypass
(C6). Additional cases cover pending unknown-outcome fencing, no eligible login,
concurrent launches, process-table reopen, project account continuity through
item admission and idle handoff, invalid/unowned item refusal before binding,
fresh/native same-host resume, held-key refusal and join-only close settlement
with pending-after-close fencing. Held-close controls cover listVolumes,
attachVolume and loginDisk separately; unknown attachment/mount settlement stays
pending, while a list-only failure performs no native acquisition. An unpinned
already-limited selected account refuses before inventory, attachment or mount,
leaving the ready login free. The fixture supplies a single FakeClock and
explicit fake process facts for both hub lock and droplet startup spend lock. Provider inventory, mounted command,
process publication and SQLite records are the positive receipts.

`settled-login-fixture.ts` supplies explicit settled disk metadata for tests of
placement and lifecycle that do not exercise binding itself. `readyLogin` supplies
a directory-backed volume for native host-create scenarios. Tests of missing
logins omit these helpers; no production admission exemption exists.

Native integration evidence lives in `host-create-ready.test.ts`: its existing
created OpenCode session case binds `fixture-opencode`, checks the host-local
mount link and the persisted OPENCODE_DB path, then stops and joins its writers.
Run it only in the release preservation slot. Linux task verification supplies
T1/T2 and changed T3; remaining T3 belongs to merge-queue/integrated occasions,
and T4 to stage/epic occasions. Stage QA runs on dev.

Cross-host pool binding and no-ready-destination refusal extend the public native
`host-relaunch.test.ts` scenarios. Destination login/account/CODEX_HOME persist
after handoff; missing destination login admits no native spawn. The E-1534
retry/native/component/publication/resume regressions remain in the consumer
sweep; changed native files run in preservation slots and Linux task verification.

The directory-backed host-execution environment case verifies all three home/DB
variables map to the attached volume while the input overlay stays logical; it
also checks real-host identity and remote auth filtering. It calls the exported
mapper through the execution-environment helper, without a native process.

Held-producer owners register before fixture allocation, so FIFO resource cleanup
releases and joins them before borrowed Store handles close. A nested forced-body
rejection control proves that order with a still-held mount. Item precedence
controls combine an already-claimed item with an invalid new session name and
retain the earlier claim refusal; unchanged Lead launch controls remain in place.

The explicit-empty-account control overrides an unavailable role account, then
selects and reuses the ready login without a pin; both process account/login and
the logical overlay are checked. Empty input is normalized before indexed selection.

Key selection, hub restart with a rotated encrypted key, persisted-environment separation and host.stop invariance are documented in [key spawn coverage](hub-test-login-key-spawn.test.ts.md).
Capacity admission now returns a durable login wait for an exhausted login or
a retained pending binding. The first uncertain native attempt still refuses
and retains its pending fence; later attempts perform no native effect.

`explicit account without a matching login waits before growth` and
`role account without a matching login waits before growth` prove the Sessions
reserve call carries either pin before effects. Existing host count stays one,
there is no mount or native spawn, and the returned wait names the harness.
