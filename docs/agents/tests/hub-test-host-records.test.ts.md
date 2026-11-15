# hub/test/host-records.test.ts

`hub/test/host-records.test.ts` is T2. Use `tempProject` and `projectHub`; no SSH,
provider or real keys. Create fresh hosts with `createFakeHost`; both it and
startup registration use `shared/fake-host-directory.ts`. The short directory
alias resolves to `<realpath(root)>/.fixture-sockets/<id>/`, containing
`host-key.pub` and the synthetic `client-key`. Set both `CLAND_FAKE_HOSTS=f1,f2` and `CLAND_FAKE_HOST_ROOT`.

The tests cover additive migration, preservation/reopen, host-bound digest checks,
revocation without automatic remint, 0700 directories/0600 files, output registry
restoration, two pinned fake records, missing-hook controls and deep socket paths.
The startup test inspects public hub.status frames and flushed log/journal bytes
for the generated secret without printing it. Direct registry tests include a
positive control before restoration. Preserve `hub/test/host-registry.test.ts`
unedited for prior session-frame and process-host compatibility.

Run this file alone with `node --test hub/test/host-records.test.ts`, after checking
disk space, load and cover-quiet admission. It starts no browser or GUI. Unconfigured production roots retain machine runtime socket paths; scratch
projects opt into owned fixture sockets and keep bootstrap secrets local. Fixtures own their writers and close them before root removal.

T-1572's conflict-resolution cases open an existing SQLite file with legacy
remote tables both with and without a hosts table. Keep users, hosts and remote
schema owners in deterministic Store construction order before shared migrations.
Assert legacy pairings and sentinel data survive, remote target/stop-cause columns
are added, both project-user pairings survive reopen, and auth reset keeps the
first user's pairing without altering host records. All data and host proof
values are synthetic; no HostSecretStore file or SSH process is needed here.

T-1657 startup coverage checks both hosts against the keys written by
`createFakeHost`, reads the registered client-key files, and checks every host
socket path including its NUL against 104 bytes. The `suite-tmpdir` case sets
TMPDIR to `/private/tmp/cland-suite-<36-character UUID>` on macOS (the system
temporary directory on other platforms) before creating the project and hosts.
It restores TMPDIR and drains the embedded hub before owned directory cleanup;
no native child process is started. Both startup cases reproduce ENOENT with
the old registration layout. Missing-variable controls still register no hosts.

Registration-only T2 cases inject inert named Hosts to keep startup free of
carrier processes. The production daemon now creates carriers for uninjected
registered records; T3 host-ssh-contract covers that ownership and an agent-backed
launch. Registration, secret-redaction and connected-path assertions stay here.

The registry-runtime control uses real registered records and inert injected
carriers/git daemons. It asserts each created transport explicitly supplies
`agentNode` equal to the resolved `layout.node`, both for the existing `node`
layout default and a custom absolute runtime containing spaces. Registered hosts
therefore never use the generic transport's absent-option fallback. No SSH or
Node subprocess is started. The v0.4 image/provisioning contract owns which Node
the layout's PATH default resolves to; this control changes no layout default.

The scratch disposal regression arms temporaryInventory from
test-support/temporary-inventory.ts over an explicitly owned parent. A nested
owned project registers a host, proves its socket storage resolves inside its
scratch root, completes cleanup, asserts full parent name-set equality and
checks that its exact captured alias was removed. Parallel T2 workers do not
share that inventory parent. Global full-name preservation belongs only to a
separately authorized isolated native slot. Scratch roots opt into persisted routing through enableFixtureHostSockets
in shared/fixture-sockets.ts; tempProject enables it, and QA projects bypassing
that helper call it before registration. An explicit absolute fake-host root
also enables it. Production roots without that opt-in retain existing
candidates and permissions. Socket nodes stay under the scratch root through a
short reciprocal alias, removed only after writer drainage.

Opt-in registration is lazy and leaves an unused root empty. The first host path
allocation creates private storage and the persisted marker. fixtureEnvironment
writes the exact-root CLAND_TEST_HOST_SOCKET_ROOT after all overlays so a cold
hub/CLI child can allocate first. Inherited or overlaid root claims cannot
replace the builder's root. The marker keeps later independent readers on the
same paths. T3 fixture-socket-lifecycle proves that cross-process boundary.
Shared account wrappers pass the subject project root separately from their
scratch account root so CLI and hub launches keep both lifetimes explicit.
The root's shared socket disposer owns alias removal and registration retirement;
there is no additional post-disposal fallback-path deletion hook.
