# hub/test/host-records.test.ts

`hub/test/host-records.test.ts` is T2. Use `tempProject` and `projectHub`; no SSH,
provider or real keys. The fake tree has `<root>/<id>/host-key.pub` and a synthetic
`client-key` path. Set both `CLAND_FAKE_HOSTS=f1,f2` and `CLAND_FAKE_HOST_ROOT`.

The tests cover additive migration, preservation/reopen, host-bound digest checks,
revocation without automatic remint, 0700 directories/0600 files, output registry
restoration, two pinned fake records, missing-hook controls and deep socket paths.
The startup test inspects public hub.status frames and flushed log/journal bytes
for the generated secret without printing it. Direct registry tests include a
positive control before restoration. Preserve `hub/test/host-registry.test.ts`
unedited for prior session-frame and process-host compatibility.

Run this file alone with `node --test hub/test/host-records.test.ts`, after checking
disk space, load and cover-quiet admission. It starts no browser or GUI. Socket
fallback directories are machine runtime paths; bootstrap secrets stay in the
scratch project. Fixtures own their writers and close them before root removal.

T-1572's conflict-resolution cases open an existing SQLite file with legacy
remote tables both with and without a hosts table. Keep users, hosts and remote
schema owners in deterministic Store construction order before shared migrations.
Assert legacy pairings and sentinel data survive, remote target/stop-cause columns
are added, both project-user pairings survive reopen, and auth reset keeps the
first user's pairing without altering host records. All data and host proof
values are synthetic; no HostSecretStore file or SSH process is needed here.
