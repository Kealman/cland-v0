# Stage QA brief: E-1535 stage 2 — disk logins across hosts - sign-in, bind, release, snapshots, DigitalOcean volumes and the key store

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (start `bash` first; zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers and does not split unquoted path lists; always brace a variable before `:`). The run is local, on macOS (BSD `stat`, Node 24 with `node:sqlite`, `uuidgen`, `lsof`, `getconf DARWIN_USER_TEMP_DIR`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, DigitalOcean API, key, credential, harness login, sudo, mount, Telegram, Discord, speech API, npm registry or network (R-1530's QA rule).** The named files use only their own fakes (the fake host provider and its directory-backed volumes, the scripted fake DigitalOcean API, fake SSH and scp, the stub `cland-auth` fixture, the fake Claude Code, Codex and OpenCode binaries with their fake login files, in-memory or temporary SQLite). The scratch rows start one hub through the real CLI in a disposable project; they create no host and sign in nothing. **No real harness, no browser, no Neovim, no GUI.**

**Landing markers filled (Coordinator, at T-1780's landing `ee21cb146`).** T-1780 was filled from its reviewed head `678733ec59f841f49f5b10d5b7b7be9b24894887` (rev-35 `rev-35-1780-final-1`, C1 to C4 verified), and its landing `ee21cb1468ea1fe80f464ba8c5a45fbbf5a3fa11` is byte-identical to that head for every file it changes (VERIFIED). E1535S2-04 expects `open landing markers: 0`.

**Written at dev `acd4e3aafebec085e8d6e3dac126feccc86e39c7`** (T-1779's landing, the seventh of eight). Markers: VERIFIED = read in source, Git or the tracker at that dev; INFERRED = a reasoned expectation no read or run has proven (rule 22: an INFERRED line is never a pass condition on its own). A dev SHA later than `acd4e3aaf` is re-read under "Rows to verify after landing" before the run; E1535S2-02 names which later commits are acceptable.

The stage is the first one with live login flows: `cland login add` for disk logins with terminal sign-in (fake SSH), the key store and `cland login add --kind key`, snapshots as backups with `cland login snapshot`, binding a login at launch on a running host, bounded snapshot scheduling, release at host stop with the kept volume, and DigitalOcean login volumes against the scripted fake API. The run is meant to take about three and a half hours: setup and E1535S2-00 to E1535S2-05 about 20 minutes; the sealed T1/T2 rows E1535S2-10 to E1535S2-55 about 60 minutes; the native rows E1535S2-60 to E1535S2-73 about 100 minutes, one file per preservation slot; scratch rows E1535S2-80 to E1535S2-89 about 10 minutes. Waits for cover-quiet admission, the preservation lock or load are not product results.

## Carried corrections

A reused kit block must be reconciled against the source brief's recorded run corrections. This brief reuses the stage-1 brief's kits and helpers, which come from one fixed commit `K` (`f43f4e21049e9c62a97c8dec1ebf37f9c7035a62`, never by blob, A-17643). It therefore carries the whole chain of corrections exactly as `qa/briefs/E-1535-stage-1.md` holds it at commit `M2` (`0d0618042fae7b76919d1be152e252b09e4a43ad`, the tracker commit that recorded stage 1's clear rerun; the brief's blob there is `dd84d5b93927798242c0bee78ddc3310145ecbf0`, byte-identical to the one the clear rerun used at `353d17e3`, VERIFIED): every section from `## Carried corrections` up to `## Stage` (127 lines, VERIFIED), read into `$EV/carried-from-M2.md` at setup and followed as written, then the stage-1 rerun's outcome below. T-1782 later added a historical-boundary paragraph to the top of that brief (commit `d725dd47f`); it does not touch the carried sections (VERIFIED: its hunks are lines 1 to 17, one T-1772 scope line and the E1535S1-10 row). What applies here, and how, is stated in "How this brief applies them"; nothing below is optional.

### From the E-1535 stage-1 rerun (qa-678, A-18243, clear at `353d17e3`)

The rerun needed no new run-copy assertion, expected-result or fixture correction (its report, "Corrections and disclosures"). It recorded one finding aside, Low, T-1676: four dead hub and spoke fallback sockets and 47 dead fixture-owner receipts in `$T` from the unchanged messenger and Neovim producers; every receipt PID absent, no open handle, every recorded fixture root gone; inventoried, attributed and removed by literal path before the final row. All 63 per-file inventories read `0 -> 0` for stage roots. Its accepted later commits were member-free test fixes (T-1797, T-1800), coordinator brief and add-only durations commits and tracker-only commits. The run-1 rule proposal it repeated stays in force here: a fixture root is owned at allocation, and process teardown and root removal are separate evidence.

### From the stage-2 implementer and reviewer evidence (not a QA run)

- **A sealed overlay once turned suite-runner red (A-18377, A-18378, T-1778).** In T-1778's native slot, `hub/test/suite-runner.test.ts` passed 55 of 57 when its outer runner supplied a scratch HOME, XDG, Git and TMPDIR plus a private `NODE_COMPILE_CACHE`, and 57 of 57 in the standard context (only `CLAND_*` removed, no HOME, TMPDIR or cache overlay). The Coordinator classified the red as a runner-context artifact without isolating the causal overlay. The per-test notes of this stage's native files say the same thing in their own words: `hub/test/login-write-back.test.ts`'s note says "Do not supply HOME, TMPDIR or cache overrides to the runner", and the others say to strip inherited `CLAND_*`. **Native files therefore run in the standard environment here (`std.mjs`), never through the fresh seal.** Their fixtures seal their own children with `fixtureEnvironment`.
- **The login-add fixture-owner registry (T-1805, backlog).** After `hub/test/login-add.test.ts` runs, a fixture-owner receipt in the TMPDIR's `cland-fixture-owners-<uid>` directory keeps a `roots` list that names an already removed `/tmp/hc-…` root and the live worktree of the source under test (found by impl-1778 at `1cba8d79c`, A-18377). No deletion was observed. This brief records that receipt (E1535S2-60, E1535S2-99) and never fails the stage on it, never removes it, and never lets any cleanup act on its `roots`.
- **TMPDIR inventories by exact name sets (A-18439, T-1779).** T-1779's local native slot captured the full TMPDIR name set before and after (9837 entries each, no new or removed entry). The system TMPDIR and `/private/tmp` hold historical residue from earlier runs: about 86 roots with the prefixes `hc-`, `sf-`, `cland-ssh` and `cland-suite-`, plus `cland-fixture-owners-<uid>` receipts (the requester's count; INFERRED: the drafting census, read-only at 2026-11-10, found 92 `cland-suite-*` in `/private/tmp`, 5 `cland-suite-*` and one `cland-fixture-owners-<uid>` directory in the system TMPDIR and 0 `hc-`, `sf-` or `cland-ssh*`; the counts move with other sessions). **Pre-existing entries are attributed, never failed.** Only names that appear after a file and belong to that file's own fixture families can fail a row.

### Known flakes for this stage

From the stage-1 brief at `M2`, carried: T-1731 (`hub/test/host-ssh-contract.test.ts`, which runs alone here in E1535S2-70) and T-1770 (`hub/test/host-provider-digitalocean.test.ts`, E1535S2-12: only the `422` expansion of `digitalocean <status> pauses every create …`, failing at line 368 with actual `['created','failed','created']`; line 368 is still `assert.deepEqual(results.map(r => r.state), ['created', 'created', 'created']);` at `acd4e3aaf`, VERIFIED) are known flakes only by their exact signatures. For either: keep the full output, rerun that file once alone (T-1731 under the lock in the standard environment; T-1770 through `nt`), report both runs; the second result stands for the row and both are findings for the requester. T-1758 and T-1689 (`hub/test/suite-cancel.test.ts`) are not in this brief's tables.

**Regressions, never reruns:** T-1735 (`hub/test/host-relaunch-native.test.ts`'s `git add .` failure on `processes.json.new`), T-1732 (an unattributed listener in `hub/test/transport-forwards.test.ts`) and T-1797 (`hub/test/host-create-ready.test.ts`'s C3 mismatched-prelude case timing out at its 300 ms gate; fixed by `c3f4d7598`, VERIFIED an ancestor of `acd4e3aaf`). **T-1736 is not a flake.** Any other failure is judged as it stands.

### Known non-blocking items (record if seen; never a stage failure on their own)

- **T-1801** (backlog): `LoginBinder.close` joins in-flight attach, list and `loginDisk` calls but cannot abort them; shutdown waits for each operation's own deadline. A slow but positive close in `hub/test/login-binding.test.ts` is this item, recorded with its wall time.
- **T-1802** (backlog): `hub/src/host/cland-auth.sh` `thaw` is a bare `fsfreeze -u`; a replay after a lost thaw receipt is refused on an unfrozen disk, and the snapshot scheduler keeps its freeze and release fence. A retained fence with that cause is this item.
- **T-1804** (backlog): explorer protocol recordings key on archive-loading state. This brief runs no recording refresh; if a run of anything here leaves `nvim/test/fixtures/` changed, record it as T-1804 and keep the diff (it also makes `dirty entries` non-zero: report it, do not revert by hand).
- **T-1805** (backlog): the login-add fixture-owner receipt above.
- **T-1676** (backlog): dead hub and spoke fallback sockets and fixture-owner receipts from unchanged producers, the carried class.
- **T-1806** (backlog, needs-triage): native host fixtures leave `cland-h-*` socket directories in `/private/tmp` (impl-1780's run of `hub/test/host-create-ready.test.ts` at `678733ec5` added ten, and its four-file native slot fourteen, A-18459 and A-18460, Coordinator decision 93073308), and `/private/tmp` holds the historical native-fixture roots named above. New `cland-h-*` names after any native row whose test reaches `createHost` through `records.ts` `hostPaths` (E1535S2-60, E1535S2-64 to E1535S2-71 and E1535S2-73; run-1 correction, A-18475) are this item: `invd.mjs` marks them `known-class`, the row records them, QA leaves them untouched, and they never fail a row.

### How this brief applies them, and the reconciliation

- **Two environments (new here, A-18378).** The sealed T1 and T2 rows, the typecheck and every scratch command run through the stage-3 kit's `fresh.mjs` (fresh seal, streaming redaction, `QA_SESSION`, `TMPDIR=$T`), as in stage 1. The native rows (the T3 files, plus the T2 files the requester grouped with them: `hub/test/host-unreachable.test.ts`, `hub/test/host-stop.test.ts` and the two provider-volume files, VERIFIED T2 in `hub/test/tiers.json`) run through this brief's `std.mjs`: QA's own environment with every `CLAND_*` name removed and nothing added. **Credentials go through the shared filter (rule 15):** `std.mjs` removes every name the filter in `test-support/fixture-environment.ts` (the one `fixtureEnvironment` and the scratch builders apply, with `withoutExecutorCredentials` from `shared/executor-credentials.ts`) drops as a credential, plus the kit's credential-prefix gate names and every `FAKE_` name, and prints the removed names (never values); on macOS that includes `SSH_AUTH_SOCK` (VERIFIED: the filter's `SSH_` family), which would otherwise reach the native files. It refuses (BLOCKED) when HOME is not the user's home, TMPDIR is not the recorded system per-user TMPDIR, or `NODE_COMPILE_CACHE` is set. It streams through the same redactor and publication scan as `fresh.mjs`.
- **Kit pin (carried; commit `K`).** `holder`, `quiet`, `ld` and `tap.mjs` from `qa/briefs/E-1532-stage-4.md` at `K`; `seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh` and `helpers.sh` from `qa/briefs/E-1533-stage-3.md` at `K`, each extracted with `git show`, never by blob. Not taken: E-1534 stage 2's relay kit, any brief's `expect.json`, `src.mjs`, `checks.sh` or `scratch.sh`. The corrections text is read at commit `M2`.
- **Per-file name-set inventories (A-18182, A-18439).** Every file in every row gets an exact before and after name set, taken only after the file's `exit` line: of `$T` for sealed rows; of the system TMPDIR (`$ST`), of `/private/tmp` and of `$ST/cland-fixture-owners-<uid>` for native rows. `invd.mjs` prints, per file and directory, the new names, the removed names and the new names in the row's own fixture families (VERIFIED from source per row). **A new own-family name is a FAIL of that row**, against the member whose landing edited the file; every other new name is recorded with its first-seen file and attributed (an existing class below, or other sessions' activity in a shared directory); a new name that is live (an open handle or a live owner PID) is a FINDING.
- **Expected-registration correction and shared registrars (A-18029, carried).** Every exact list below was expanded from source at `acd4e3aaf` through loops, nested loops, the filtered transition loop and the imported registrar `hostProviderVolumeContract` (with `snapshotOperations` true for both providers at this build), then matched name by name against each registration template (VERIFIED: every name matches exactly one template, every template's expansion count equals its array's size, no duplicates). **No stage file registers a title with leading whitespace** (VERIFIED). Lists are re-derived at `<dev SHA>` if it is later than `acd4e3aaf`.
- **Landing delta from another fix (carried).** E1535S2-02 compares each member's own changed lines at its landing with its reviewed tip's against their merge base and names every tree difference with its source. VERIFIED at `acd4e3aaf`: every landing's own lines equal its tip's; every landing is byte-identical to its tip except T-1777, whose `hub/test/durations.json` differs only by the two orphan baselines T-1782's earlier landing `d725dd47f` removed (`host-provider-digitalocean-volumes.test.ts::digitalocean volume creation requires a pool, shares pause and resolves acquire pool` and `host-provider-volumes.test.ts::digitalocean new snapshot operations refuse without API calls`).
- **Presentation substitution (A-18029, carried).** No `host-secret-admission` row. If any capture loses lines to the scanner (`# fresh: line withheld by the publication scan`, or the same line from `std.mjs`), the row is INCONCLUSIVE, not FAIL: keep the capture and ask the requester before any substitution. Stage titles and fixtures say `key`, `token`, `secret`, `login` and `sentinel`; none was found to match the scanner (INFERRED).
- **Mapping ids (A-17843, carried).** E1535S2-04 checks that every `E1535S2-NN` the criteria map names exists as a row, and counts the T-1780 landing markers.
- **Dead receipts and sockets (carried T-1676 clause).** In `$T`: inventoried, checked dead (no `lsof` entry, owner PIDs gone, fixture roots gone), attributed by the per-file inventories, then removed by literal path before E1535S2-99, as stage 1 did. **In the shared system TMPDIR and `/private/tmp`, QA removes nothing**: those directories belong to every session on this Mac; new entries there are attributed and reported, and the T-1805 receipt is left untouched.
- **Cleanup order (carried).** Census, then the dead `$T` residue removed by literal path, then the end check with `$Q` and `$T` present, then `$Q`, `$T` and the worktree after the verdict. If any inventory shows a new own-family name, nothing is removed anywhere: keep `$Q`, `$T` and `$W` and report to the requester (Coordinator decision 4b0df390, A-18182, carried).
- **Not applicable here:** the Neovim, web and messenger rows of stage 1 (no stage path under `nvim/` or `web/`, VERIFIED, and no remote file changed); standalone filtered cases; the epic occasion suite, droplet gate filter and dpkg quoting (a stage run, no `cland demo`).

### Kit conventions carried

- **Rule 22.** Every selector, test name and string is marked VERIFIED or INFERRED; an INFERRED expectation is never a pass condition on its own.
- **TAP.** `node --test <file>` reports top-level registrations with `1..N` and `# tests/pass/fail/cancelled/skipped/todo` counters that include nested subtests; names escape `#` and `\`. `tap.mjs` parses exactly that. Nested registrations here: one in `hub/test/login-binding.test.ts` (plan 32, `# tests` 33), one in `hub/test/login-release.test.ts` (plan 24), one in `hub/test/fake-ssh.test.ts` (plan 15), one in `hub/test/host-create-ready.test.ts` (plan 11) (VERIFIED).
- **Exact strings** are counted by `src.mjs` with `String.split`, never by shell `grep`; tree-wide absence checks use `git grep` at `$S`.
- **The preservation lock** is the directory `/tmp/cland-preserve.lock`: `mkdir` must exit 0, then an owner file naming this run, row and file; removal only after the owner check, by literal path. Here **one native file per slot**, and a slot is at most 15 minutes: `std.mjs` sends TERM to its own child at 900 s and exits 124, which makes the row INCONCLUSIVE (record it, release the slot, report). A held lock makes the row BLOCKED for now (retry later; never remove another owner's lock).

### Run 1 corrections (qa-678, A-18475, clear at `121ec8bef`)

- **E1535S2-05 self-match.** The tree-wide scan also excludes this brief (`':!qa/briefs/E-1535-stage-2.md'`). Run 1 counted 2, both literals in this file (its `src.mjs` assertion and the scan expression itself), and recorded the corrected count 0 under Coordinator decision 788ff6b1.
- **T-1806 scope.** Every native row whose test reaches `createHost` through `records.ts` `hostPaths` leaves dead `cland-h-*` socket directories in `/private/tmp`, rows E1535S2-60 and E1535S2-73 included (decisions 6be29ff4 and 846009f2). Run 1 counted 21, all untouched.
- **Actual fixture prefixes.** The DigitalOcean volume fixtures use `cland-fake-do-`, and `host-unreachable` uses `cland-init-machine-`. These replace the INFERRED families of rows E1535S2-67 and E1535S2-68.

## Stage

- Epic: E-1535 (Logins).
- Exact stage name: disk logins across hosts - sign-in, bind, release, snapshots, DigitalOcean volumes and the key store.
- Items, in plan order, by lane (VERIFIED in `task plan show E-1535` at `acd4e3aaf`): [T-1777 (`cland login add` for disk logins, terminal sign-in), T-1781 (snapshots as backups and `cland login snapshot`)], [T-1778 (binding a login at launch), T-1779 (release at host stop and the kept volume), T-1780 (logins attached while a new host provisions), T-1803 (bounded snapshot scheduling and no snapshot of an unsettled binding)], [T-1782 (DigitalOcean login volumes)], [T-1783 (the key store and `cland login add --kind key`)]. The run reads membership, counts and state from `task plan show E-1535 --json` (E1535S2-00), never from this list. QA finding fixes added after writing are listed in the request.
- Policy: affected/after-stage.
- Scope: **affected.** The combined changed behaviour through the stage's named test files, the importers of the fixtures, registrars and fakes the stage edits, read-only source and tree checks, and scratch checks of the key-login CLI on a CLI-started hub. No earlier-epic regression pass beyond those files.
  - T-1782 (landed `d725dd47f`, the first landing; VERIFIED; byte-identical to its reviewed tip `da45c36b0`, rev-35 `rev-35-1782-final-1`): DigitalOcean answers `getSnapshot`, `listSnapshots` and `deleteSnapshot` through the API (`volumeSnapshotInfo`, `volumeSnapshots`, `deleteVolumeSnapshot`, a confirmed delete) and `createVolume` with `fromSnapshot` sends `snapshot_id`, the retained source region and the `cland`, project and pool tags; snapshot ownership (project, region, receipt) is persisted under the provider root and fences forged receipts and cross-project restores; `createVolume` needs `admission: {login, project, pool}` (`LoginVolumeAdmission` in `provider.ts`) and is refused before any API call without it; the test-only refusal is gone. Files: `hub/src/host/provider/digitalocean.ts`, `provider.ts`, `hub/src/executor/droplet/api.ts`, `deadline.ts`; `hub/test/fakes/digitalocean/fake-api.ts`; tests `hub/test/host-provider-digitalocean-volumes.test.ts` and `hub/test/host-provider-volumes.test.ts` (T2 each; the stage-1 unsupported-operation case removed); docs `docs/hub/host-providers.md`, the two per-file notes, and the historical-boundary paragraph of `qa/briefs/E-1535-stage-1.md`.
  - T-1777 (landed `e6fbbd906`; VERIFIED; own lines equal to its tip `00f767bc9`, rev-35 `rev-35-1777-final-1`; durations delta named above): `cland login add <harness> [--name] [--pool] [--account] [--kind disk]` (`hub/src/cli/login.ts`, `login-terminal.ts`) reserves a creating row, reuses a ready pool host, joins a boot or creates one, pins it, creates a 1 GiB volume in the pool region, attaches, mounts at `/cland/auth/<harness>-<name>`, publishes Codex's file-store `config.toml`, and returns a terminal plan: `ssh -t` running `CODEX_HOME=… codex login --device-auth`, `CLAUDE_CONFIG_DIR=… claude auth login` or `OPENCODE_DB=… opencode auth login` (`hub/src/host/login-signin.ts`, `login-add.ts`); `login.signed-in` with exit 0 unmounts, snapshots, detaches and marks ready, anything else signed-out with the disk kept. The CLI owns the SSH process through native close. Fake SSH maps the exact sign-in forms under the authenticated fake machine and refuses other `/cland/auth/` commands (`hub/test/fakes/fake-ssh.ts`); the agent's file operations map validated login paths (`hub/src/host/agent/fake-login-mount.ts`, `operations.ts`, `prepared.ts`, `closure.json`); `shared/fake-layout.ts` gains a join primitive; `mountedOpenCodeDatabase` in `hub/src/accounts/registry.ts`. Tests: `hub/test/login-add.test.ts` (T3), `login-terminal` (T3), `fake-ssh` (T3, edited), `host-login-disk` (T3, two new cases), `login-add-component`, `login-host-pin` (T2), `login-signin`, `accounts-policy` (T1), `login-list` (T2, edited), and the wait-helper test below.
    - The same landing extracts the shared wait deadline `waitTimeoutMs` in `hub/test/until.ts`, with its T1 test `hub/test/until.test.ts`.
  - T-1783 (landed `a6d28fd1e`; VERIFIED; byte-identical to its tip `5689ab7cf`, rev-36 `rev-36-1783-final-1`): `.cland/auth/<name>.key`, a create-only 0600 AES-256-GCM envelope under `[auth] key` in `.cland/secrets.toml` with the project tag and name as associated data (`hub/src/host/login-keys.ts`); the CLI reads the key from stdin or a hidden prompt, encrypts locally after a `login.list` authority preflight and sends metadata only (`hub/src/cli/login-key.ts`); the hub decrypts, registers the value with its redactor and stores a ready key row (`dispatch.ts`); `auth.key` joins `SECRET_NAMES` with its own validation and rotation fences (`hub/src/remote/secrets.ts`, `hub/src/cli/secret.ts`); the managed ignore gains `auth/` and `auth.lock` (`hub/src/project.ts`). Tests: `hub/test/login-keys.test.ts` (T2, new), `secrets` (T2, edited), `secrets-resolution` (T1, edited); `hub/test/secrets-fixture.ts`.
  - T-1781 (landed `0e4ab826c`; VERIFIED; byte-identical to its tip `e82955b06`, rev-36 `rev-36-1781-final-2`): `LoginSnapshots` (`hub/src/host/login-snapshots.ts`): one snapshot after a successful sign-in, a daily in-use backup under freeze and thaw on the hub clock, the newest two ids kept (older ones deleted only after confirmed deletion), rate refusals retried at the provider's time, a persisted freeze intent and receipt with startup recovery, a release fence (`beginRelease`, `onReleased`) for T-1779's owner, and a synchronous provider `authorize` send check (`snapshotVolume(volume, {authorize})`, `not-sent`); `cland login snapshot <name>` (frame `login.snapshot`, local human only, a key login refused). Tests: `hub/test/login-snapshots.test.ts`, `hub/test/login-snapshot-cli.test.ts` (T2, new), the two provider-volume files (edited), `hub/test/host-provider-contract.ts`.
  - T-1778 (landed `93727d257`; VERIFIED; byte-identical to its tip `1cba8d79c`, rev-35 `rev-35-1778-final-3`): `LoginBinder` (`hub/src/host/login-binding.ts`) at the shared native spawn boundary selects a ready disk login of the harness, provider and region (indexed `selectForLaunch`), commits a writer binding in its unsettled phase, attaches, mounts, settles, and starts the session with `CODEX_HOME`, `CLAUDE_CONFIG_DIR` or `OPENCODE_DB` at the mount; a held settled binding is reused; failures roll back to ready or keep a fence; the remote command environment drops five stray auth variables and maps the login homes at host execution (`hub/src/host/agent/command-environment.ts`); the process row persists `login` (`hub/src/adapters/processes.ts`). Shared fixtures `hub/test/settled-login-fixture.ts` (`settledLogin`, `mountedSettledLogin`), `hub/test/fixture-store.ts`, `hub/test/host-create-fixture.ts`. Tests: `hub/test/login-binding.test.ts`, `hub/test/login-selection.test.ts`, `hub/test/fixture-store.test.ts` (T2, new); fixture migrations in `host-create-ready`, `host-destroy-native`, `host-relaunch`, `host-restart`, `host-ssh-contract` (T3) and `host-status`, `host-stop`, `pool-failures`, `pool-scale`, `session-pool-placement`, `waiting-launch`, `waiting-launch-restart` (T2).
  - T-1803 (landed `63954d9c8`; VERIFIED; byte-identical to its tip `73df80b3f`, rev-35 `rev-35-1803-final-1`; `regression_of` T-1781): `LoginRecords.onChange` passes the changed login name and the scheduler keeps one timer per login; `hasPendingBinding` is an indexed existence query (`login_bindings_pending`); scheduled and manual backups defer while a binding is unsettled, with a persisted deferred reason (its exact text is the "deferred reason" line of `src.mjs`). Tests: `hub/test/login-snapshots.test.ts` (five new cases, nothing removed: VERIFIED), `login-records` (one new case).
  - T-1779 (landed `acd4e3aaf`, the writing dev; VERIFIED; byte-identical to its tip `c74c0e7c8`, rev-36 `rev-36-1779-final-2`): the confirmed host-destroy boundary releases settled disk bindings concurrently (`releaseHostLogins`, `hub/src/host/login-release.ts`): `beginRelease`, unmount through the agent (which ends disk users), confirmed detach, unbind, `onReleased`; a lost or gone host skips the unmount and frees only a volume a fresh inventory reports detached, retried on the hub clock from 1 s to 30 s (`LoginReleaseOwner`, `login-release-owner.ts`); a refused release keeps the host and binding and emits one Coordinator line per host and login; `Host.loginDiskReachable` (optional, synchronous) in `host.ts` and `ssh-host.ts`; concurrent destroy callers join one operation (`provision-host.ts`); health loss passes `lost: true` (`host-health.ts`). Tests: `hub/test/login-release.test.ts` (T2, new), `login-write-back` (T3, new), `host-contract-coverage` (T1, one new case), edits to `host-destroy-native`, `host-restart` (T3), `host-stop` (T2), `hub/test/login-selection.test.ts`.
  - T-1780 (reviewed head `678733ec5`, rev-35 `rev-35-1780-final-1` clear after `rev-35-1780-source-2`; not landed at writing, VERIFIED: no `Item: T-1780` on dev at `acd4e3aaf`; its landing receipt is in "Build"; 13 files, VERIFIED with `git diff --stat acd4e3aaf 678733ec5`): demand-created hosts prepare logins at a new `createHost` checkpoint `onConnecting` (`hub/src/host/provision-host.ts`), set when the row enters `connecting`; the dispatcher passes a demand reader from `PoolRuntime.start` through `Sessions.startPoolScaling` (`hub/src/host/pool-runtime.ts`, `hub/src/hub/dispatch.ts`); `Sessions.provisionLogins` (`hub/src/adapters/sessions.ts`) prepares one disk per waiting harness with the new `LoginBinder.prepare` (`hub/src/host/login-binding.ts`: selection, the writer binding and the attach now, the mount later through `finish(host)`, or `rollback()`), keeping each wait's exact admission and rechecking it at every boundary; the hook's `ready()` mounts on the answering Host and joins every finish before the row becomes ready, and `failed()` fences new work synchronously, then joins and rolls back before the host-stop release owner runs. Manual and minimum creation bind no login; ordinary no-login and account-limit refusals stay launch-scoped and the healthy host still becomes ready. `LoginBinder.bind` is now `prepare` then `finish` (the rollback and its named failures moved into `prepare`'s closures). Tests: `hub/test/login-provision-bind.test.ts` (T2, new, 19 top-level and 3 nested); no existing test file changed (VERIFIED: the diff's only other test path is `hub/test/tiers.json`). Docs: `docs/hub/logins.md`, `hub/README.md`, the new per-file note and its index row, the implement skill.
- **Merge watch.** `hub/src/hub/dispatch.ts`, `hub/src/host/logins.ts`, `docs/hub/logins.md`, `hub/README.md`, `docs/agents/tests/index.md`, `hub/test/tiers.json` and `.agents/skills/implement/SKILL.md` are edited by most members; `hub/src/host/agent/closure.json` by T-1777, T-1778 and T-1779; `hub/src/host/login-snapshots.ts` by T-1781, T-1803 and T-1779; the provider files by T-1782 and T-1781. E1535S2-02 names every later commit that touched a member's files (VERIFIED lists at writing in that row).

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what. E1535S2-04 checks that every row id named here exists in the tables below. VERIFIED at `acd4e3aaf`; the T-1780 rows VERIFIED at its reviewed head `678733ec5`. Where a test title holds a word the closed-item wording lint watches, it is quoted from its first words with `…`; `expect.json` holds every full title.

| criterion | proven by |
| --- | --- |
| T-1782 C1 (a volume from a snapshot sends that snapshot id, the region and the cland, project and pool tags) | E1535S2-68 (test `digitalocean snapshot restore sends source region and tags; deletion needs observed absence`; test `digitalocean snapshot restore keeps retained region when API region order changes`; test `digitalocean volume create carries lon1, 1 GiB and project/pool tags`); E1535S2-03 |
| T-1782 C2 (`listSnapshots` and `deleteSnapshot` go through the fake API; deleted only after a GET reads 404) | E1535S2-68 (registrar case `digitalocean: snapshot history, cloning and confirmed deletion`; the restore and deletion test above; test `digitalocean snapshot receipts and source project fence destructive use across restart`); E1535S2-03 |
| T-1782 C3 (no login admission: refused before any API call naming it; with one, it reaches the fake API outside the fake-host fence) | E1535S2-68 (test `digitalocean volume create requires login admission outside the fake-host fence`; test `digitalocean volume admission selects pool and shares the creation pause`); E1535S2-03 |
| T-1782 C4 (DigitalOcean passes T-1772's volume contract cases) | E1535S2-68 (the six `digitalocean: …` registrar cases, exact, with `digitalocean: snapshot history, cloning and confirmed deletion` and `digitalocean: refused snapshot authorization sends no native effect`); E1535S2-12 (the unedited DigitalOcean provider, prepare and executor consumers of `api.ts` and `digitalocean.ts`) |
| T-1782 C5 (no code, test or doc still names the test-only volume refusal) | E1535S2-05 (`retired DigitalOcean refusal outside the historical stage-1 brief: 0`, and the stage-1 brief's historical boundary present); E1535S2-03; E1535S2-68 (`host-provider-volumes` exact, without the removed stage-1 control) |
| T-1777 C1 (`login add codex`: an empty 1 GiB volume in the pool region, mounted at `/cland/auth/codex-<name>`, fake `codex login --device-auth` over `ssh -t` with `CODEX_HOME` at the mount and a file-store `config.toml`) | E1535S2-60 (`login-add`, its integrated case); E1535S2-62 (the `codex` expansion of `terminal <harness> sign-in stays inside the authenticated fake machine`); E1535S2-10 (test `all harness sign-in plans contain only the documented home and native arguments`); E1535S2-63 (test `login file publication shares the attached fake mount and leaves ordinary paths unchanged`); E1535S2-03 |
| T-1777 C2 (`login add claude-code`: `CLAUDE_CONFIG_DIR` at its mount; then `ready`, detached, one snapshot id, last sign-in) | E1535S2-60; E1535S2-62 (the `claude-code` expansion); E1535S2-10; E1535S2-03 |
| T-1777 C3 (no host in the pool: one is created and the sign-in runs once it is ready) | E1535S2-60; E1535S2-10 (`login-host-pin`: the three `terminal outcome <code> holds its host through cleanup and releases the pin` expansions and the five `sign-in revalidates captured host authority after <boundary>` expansions); E1535S2-03 |
| T-1777 C4 (a nonzero exit or a disconnect: `signed-out`, volume unmounted, detached and kept) | E1535S2-10 (the `1` and `null` expansions of `failed terminal sign-in <code> keeps a detached signed-out disk`; the `disconnect` and `failure` expansions of `login add <outcome> settles only its admitted connection`); E1535S2-60 (the disconnected connection); E1535S2-61 (`login-terminal`: native SSH joined after hub disconnect and CLI cancellation); E1535S2-03 |
| T-1777 C5 (while signing in: `creating`, neither free nor bound) | E1535S2-10 (the creating-isolation case of `login-signin`, title `disk sign-in stays creating …`; the three `login add <outcome> …` expansions); E1535S2-60 |
| T-1777 C6 (the fake login token is in no argv, frame, log line or journal record; no logout recorded) | E1535S2-60; E1535S2-62 (each sign-in expansion asserts the output omits the token) |
| T-1777 C7 (no logout command in any command cland builds for a harness) | E1535S2-10 (test `production harness command sources contain no logout commands`); E1535S2-05 (`logout commands in production source: 0`) |
| T-1783 C1 (a sentinel piped into `login add opencode --kind key` is AES-256-GCM ciphertext in `.cland/auth/<name>.key`, decrypting with the `[auth]` key, with no plaintext byte) | E1535S2-20 (test `key files encrypt a sentinel, reuse the store key and authenticate project and name`; test `stdin key CLI publishes metadata only and the hub retains no sentinel bytes`); E1535S2-81 (scratch: two key logins, sentinel bytes 0 under `.cland`); E1535S2-03 |
| T-1783 C2 (the hub starts with `[auth]`, `cland secret list` shows only its fingerprint, an unknown `[auth]` key is refused) | E1535S2-20 (test `auth store key starts the hub, lists only a fingerprint and rejects unknown auth names`; test `secret commands repair a malformed unused auth store key while startup refuses it`); E1535S2-83 (scratch: restart and `secret list`) |
| T-1783 C3 (the first key login writes an `[auth]` key; a second reuses it) | E1535S2-20 (the first `login-keys` case); E1535S2-81 (secrets file digest unchanged by the second key login); E1535S2-03 |
| T-1783 C4 (the `login.add` frame, argv, hub log, journal and `hub.db` hold no sentinel byte) | E1535S2-20 (the stdin CLI case: frame fields, argv and log, journal and database scans with a positive control; test `key admission registers plaintext before storing metadata and refuses invalid ciphertext without a row`); E1535S2-81; E1535S2-03 |
| T-1783 C5 (a key argument refused naming stdin; a one-byte ciphertext change refused naming the login, not the key) | E1535S2-20 (the stdin CLI case and the first `login-keys` case); E1535S2-82 (scratch: the argument refusal, no sentinel echoed); E1535S2-03 |
| T-1783 C6 (`.cland/auth/` ignored by Git; a symlinked key file or `.cland/auth` refused) | E1535S2-20 (test `key store refuses symlink directories and files and never overwrites a key`; the CLI case's Git check-ignore); E1535S2-81 (scratch: `git check-ignore`); E1535S2-03 |
| T-1781 C1 (a successful sign-in leaves one snapshot; a third deletes the oldest, keeping the last two ids) | E1535S2-30 (test `third confirmed backup retains only the newest two snapshots`; the `rate` and `failed` expansions of `sign-in snapshot <outcome> preserves its terminal outcome`; test `retained snapshot receipt from another volume is refused before publication`); E1535S2-10 (the creating-isolation case of `login-signin`: one sign-in snapshot); E1535S2-60 (one snapshot per success); E1535S2-03 |
| T-1781 C2 (an in-use login snapshotted once per 24 h under freeze and thaw; thawed when the snapshot fails) | E1535S2-30 (test `in-use backup runs at 24 hours under freeze and thaw, including snapshot failure`; test `freeze that takes effect then rejects is still thawed and recorded`; test `legacy in-use row without a sign-in timestamp keeps one persisted daily deadline`; test `successful provider send queued before release is refused at its final send boundary`); E1535S2-03 |
| T-1781 C3 (a host stop with a snapshot due completes deletion first; the detached volume is snapshotted afterwards) | E1535S2-30 (test `release notification returns before detached provider work and key login names its missing disk`; test `due backup survives a stopped hub and release makes a ready detached disk eligible`; test `release joins a held freeze and thaw before provider snapshot starts`); E1535S2-50 (the release owner's calls) |
| T-1781 C4 (a rate-limited snapshot retried at the provider's retry time and not before; no host stop waits for it) | E1535S2-30 (test `rate limit persists exact retry deadline and restart resumes detached backup`; the release-notification test above); E1535S2-68 (the rate-limit registrar case of both providers); E1535S2-03 |
| T-1781 C5 (`cland login snapshot <name>` snapshots a ready or in-use disk login; a key login refused naming its missing disk) | E1535S2-30 (test `login snapshot CLI confirms a ready disk and refuses a key with no disk`); E1535S2-82 (scratch: a key login's snapshot refused); E1535S2-03 |
| T-1781 C6 (a snapshot due while the hub is stopped is taken after the next start) | E1535S2-30 (test `due backup survives a stopped hub and release makes a ready detached disk eligible`; test `startup thaws a retained freeze and publishes its captured snapshot without another provider request`; the restart part of the rate-limit test) |
| T-1803 C1 (a login change schedules work for that login only; one save decodes a bounded number of rows across 10,000 logins) | E1535S2-30 (test `one login save has bounded scheduling work across ten thousand retained logins`; the many-readers row-work case, title `… detection bounds binding-row work for a login with many readers`); E1535S2-10 (test `change notifications identify row saves and binding-only mutations for legacy listeners`); E1535S2-03 |
| T-1803 C2 (an unsettled binding is never frozen or snapshotted; a deferred reason is recorded; an absent phase reads as settled) | E1535S2-30 (the deferral case, title `… binding defers scheduled and manual backups …`; test `settling a binding preserves a future daily backup deadline`; the earlier daily-backup cases with absent-phase bindings as positive controls); E1535S2-03 |
| T-1803 C3 (the existing snapshot, rate-retry, release-fence and recovery tests pass unchanged) | E1535S2-30 (exact, all 27 titles, the 22 earlier ones unchanged); E1535S2-02 (`T-1803 removed lines in login-snapshots and login-records: 0`) |
| T-1778 C1 (a launch on a ready fake host attaches and mounts a ready login of its harness, starts with the home variable at the mount; the login reads `in-use <host>`) | E1535S2-40 (test `pool launch attaches and mounts a ready login before spawn`); E1535S2-65 (`host-create-ready`'s created OpenCode case binds `fixture-opencode` through the native fake provider and `Host.loginDisk`); E1535S2-03 |
| T-1778 C2 (a second session of that harness reuses the binding with no attach) | E1535S2-40 (test `second session reuses the binding and records login and account`; test `concurrent launches of one harness share one mounted writer`); E1535S2-03 |
| T-1778 C3 (`account = "work"` binds only a `work` login; the session row records login and account) | E1535S2-40 (test `role account selects a project login without a local account registry`; test `item pool launch preserves project account and mount through admission`; test `idle item handoff keeps the bound project account without a registry lookup`; test `explicit empty account overrides role pin and selects and reuses an unpinned login`); E1535S2-69 (`host-relaunch`: account `work` and the destination login) |
| T-1778 C4 (the process row's account environment holds the mount path only; the spawned environment holds none of the five stray auth variables) | E1535S2-40 (test `remote command overlay removes stray harness authentication variables`; test `process login and mount overlay survive reopening the process table`; test `host execution maps mounted login environment while retaining logical input`); E1535S2-03 |
| T-1778 C5 (a mount failure detaches the volume, leaves the login `ready` and fails the launch naming the login) | E1535S2-40 (test `mount failure unmounts and detaches before returning login to ready`; test `unknown mount outcome fences binding without another native mutation`; the incomplete-rollback case, title `incomplete rollback retains durable …`); E1535S2-03 |
| T-1778 C6 (a local launch reads no login and starts as before) | E1535S2-40 (test `local launch uses no login even when project disk is ready`); E1535S2-41 (the migrated placement, status and waiting-launch consumers) |
| T-1778 selection and fixtures (no ticket criterion: review findings settled by the indexed selector and the shared setup owner) | E1535S2-40 (`login-selection`, `fixture-store`, exact); E1535S2-65, E1535S2-66, E1535S2-69 (the `mountedSettledLogin` fixture in native files) |
| T-1779 C1 (`host stop` with a bound login unmounts and detaches before deletion is requested; the login reads `ready` with the same volume id) | E1535S2-50 (test `host stop unmounts and detaches the same volume before deletion`); E1535S2-67 (the `true` and `false` expansions of `C3 stop joins lease renewal and requires confirmed destroy: <confirmed>`); E1535S2-66 (`host-destroy-native`); E1535S2-03 |
| T-1779 C2 (a login rotated over two turns on host A is read at that generation by the first turn on host B, same volume id) | E1535S2-64 (test `rotated disk reaches the next host and release closes only disk writers`) |
| T-1779 C3 (two logins release concurrently: both unmounts in flight before either detach) | E1535S2-50 (test `two login unmounts run concurrently before detach`); E1535S2-64 (both unmount requests outstanding through the real ssh Host); E1535S2-03 |
| T-1779 C4 (a background process holding the disk is ended before the unmount; no other process signalled) | E1535S2-64; E1535S2-63 (the `live parent` and `retained orphan` expansions of `login-disk closes only disk users in <tree> trees`) |
| T-1779 C5 (a host lost for 15 minutes or reported gone is deleted without an unmount; its logins read `ready` only after the provider reports the volumes detached) | E1535S2-50 (the two expansions of `lost host retains …`; test `provider gone receipt skips unmount and frees only detached disk`; the two expansions of `health <…> reaches login release`; the two expansions of `held freeze on <…> host is abandoned without host calls`; test `automatic detached retry stops after positive inventory`; test `restart recovers detached retry without decoding retained login history`; test `unreachable tunnel deletes and settles session before held volume reconciliation`; test `gone startup revokes and settles spend before installed owner reconciles destroyed host disk`; test `dispatcher composition recovers a destroyed host disk from durable startup records`); E1535S2-67 (`host-unreachable`, the lost and gone cases); E1535S2-66 (`host-destroy-native`'s tunnel-down case and `host-restart`'s deleted host); E1535S2-51 (test `optional login-disk reachability preserves absent Hosts and exact boolean observations`); E1535S2-03 |
| T-1779 C6 (an unmount refused for remaining writers keeps the host and binding bound; one Agents line names host and login) | E1535S2-50 (test `writers remaining retain host and binding and emit one notice`; test `refusal then hard deadline emits exactly one destruction notice after detached read`; test `refusal then deleted attached inventory and automatic detach emit two total notices`; test `reachable held freeze with refused thaw still blocks release`); E1535S2-03 |
| T-1780 C1 (a launch that starts a fake host gets its login attached before the host reads `ready`, then placed with no further attach) | E1535S2-45 (test `cold launch attaches while connecting and reuses the mounted login after ready`; test `host ready and native admission wait for the mount receipt`); E1535S2-65 (`host-create-ready`'s waiting pool launch case, in T-1780's native preservation set, A-18459); E1535S2-03 |
| T-1780 C2 (on the hub clock, create-to-`ready` time is the same with and without the bind) | E1535S2-45 (test `login preparation adds no hub-clock time to simulated cloning`, its `with login` and `without demand` subtests: a 500 ms simulated attachment overlaps 1000 ms of cloning and both ready receipts read 1000 ms) |
| T-1780 C3 (a host that fails to boot after its login was attached leaves the login `ready` and detached, same volume) | E1535S2-45 (the `after` and `before` expansions of `boot failure <…> attachment preserves the ready disk`; the `failure` and `abort` expansions of `<boundary> fences attach while provisioning inventory is held`; the `attached` and `mounting` expansions of `cancelled wait at <boundary> rolls back the same disk before host readiness`); E1535S2-73 (`host-provision-gate` over the edited `createHost`); E1535S2-03 |
| T-1780 C4 (two launches of different harnesses that start one host get one login each attached during provisioning) | E1535S2-45 (test `two waiting harnesses attach before cloning finishes`: Codex and Claude Code); E1535S2-03 |
| T-1780 review regressions (no ticket criterion: rev-35 `rev-35-1780-source-1` findings) | E1535S2-45 (the missing-login, account-limit, unknown-attachment, role-removal, changed-account, captured-wait cancellation, late-timer and delay-owner cases); E1535S2-40 and E1535S2-41 (launch binding and pool consumers over the reshaped `LoginBinder`); E1535S2-64, E1535S2-65, E1535S2-66 (the native preservation set) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1535 --json` lists in stage `disk logins across hosts - sign-in, bind, release, snapshots, DigitalOcean volumes and the key store`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion). A dirty build, a missing required merge (**every member needs a landing here, T-1780 included**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `acd4e3aafebec085e8d6e3dac126feccc86e39c7`): T-1782 landed as `d725dd47f`, T-1777 as `e6fbbd906`, T-1783 as `a6d28fd1e`, T-1781 as `0e4ab826c`, T-1778 as `93727d257`, T-1803 as `63954d9c8` and T-1779 as `acd4e3aaf`, each with exactly one `Item:` trailer on the first-parent history (VERIFIED); T-1780 landed as `ee21cb146` (`ee21cb1468ea1fe80f464ba8c5a45fbbf5a3fa11`, batch 2e976452, one `Item: T-1780` trailer; its files byte-identical to the reviewed tip `678733ec5`, VERIFIED by the Coordinator at landing), and the plan read `merged 8`, `total 8`, `statuses {"done":8}`. `task plan show E-1535` read the stage `open` with "stage cover missing Linux droplet, macOS" (VERIFIED at writing). The stage cover pair is the one at the requested dev SHA, after T-1780's landing and any add-only durations commit.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. No row needs `web/dist`, a browser or Neovim.

**Where things live.** Scratch state is under `$Q` (`/private/tmp/q53-…`, realpath, 23 bytes; the stage-3 kit's seal accepts exactly this prefix) and `$T` (`/private/tmp/qa-e1533-s3-<uuid>`, the suite root's byte length; also the kit's prefix), as in stage 1. Native rows use the system per-user TMPDIR `$ST` (realpath of `getconf DARWIN_USER_TEMP_DIR`) and `/private/tmp` as they are: QA reads their name sets and writes nothing there. The scratch project is `$Q/p1`; its `hub.db` and `.cland/auth/` hold the only login rows and key files this run writes. The only paths under the repository are `$W` in `.cland/worktrees/` and the evidence `$EV` in `.cland/qa/E-1535/<run>/`, both ignored by Git. Nothing is written to `.cland/tasks/` of the live project.

**Isolation (rule 15).** Every scratch check runs in the disposable project p1 with its own HOME, XDG directories and Git config, through the fresh seal. Never the live project's hub, config, roles, territory, `hub.db`, secrets or discovery, and never the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). The native rows read HOME only as the standard environment does (every fixture builds its children's HOME with `fixtureEnvironment`); they write nothing to it (INFERRED from the per-test notes; E1535S2-99's root status and the census check what can be checked). Never read or print a credential; never run `cland login …`, `cland secret …`, `cland config set`, `cland role launch`, `cland session …`, `cland host …` or `cland hub …` against the live project. The live hub is read only by QA's own shell for the plan read and `quiet`. **No credential reaches a process QA starts:** the seals filter through `fixtureEnvironment`, and `std.mjs` removes the same names through the same shared filter before every native file (both after their overlays). QA's shell may hold credential-prefix names (`SSH_AUTH_SOCK` on macOS); S0 records their count and the names `std.mjs` removes, never a value.

Three kinds of command, never mixed. **QA's own shell** keeps QA's session identity: worktree, roots, `quiet`, the plan read, the source and tree checks that read files only, every record. **Sealed commands** run through `$Q/fresh.mjs`: the T1 and T2 files, the typecheck (cwd `$W`, `plain` mode), the scratch rows (`hub` mode, cwd `$Q/p1`, through `body.sh`). **Native commands** run through `$Q/std.mjs` (cwd `$W`), one file per preservation slot.

**Removals.** Every `rm` names one literal path, written out in full after it was printed and checked; never a glob, a variable, a command substitution or `xargs` (the project's literal-rm hook refuses them and stalls the session). Scratch helpers write into `$Q`, removed with `$Q` at the end. Nothing in `$ST` or `/private/tmp` outside `$Q` and `$T` is ever removed.

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json` (`>=24.13.0 <25`, VERIFIED). If TMPDIR is unset in QA's shell, export it to the value `getconf DARWIN_USER_TEMP_DIR` prints (the system value, not an overlay). In QA's own shell (bash):

```sh
R=/Users/evgeniyivanov/Projects/cland/v0
S=<dev SHA>                                    # the full dev SHA from the request
K=f43f4e21049e9c62a97c8dec1ebf37f9c7035a62     # the fixed kit commit (A-17643: pin a commit, never a blob)
M2=0d0618042fae7b76919d1be152e252b09e4a43ad    # the stage-1 brief as its clear rerun used it; its carried corrections
RUN=qa-e1535s2-$(date +%F)-1                   # unique run id for E-1535; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
echo "QA shell credential-prefix names: $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')"
W=$R/.cland/worktrees/qa-e1535s2-$RUN
EV=$R/.cland/qa/E-1535/$RUN
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
ST=$(cd "$(getconf DARWIN_USER_TEMP_DIR)" && pwd -P)   # the system per-user TMPDIR, realpath; native rows run with it unchanged
T=/private/tmp/qa-e1533-s3-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q53-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh" "$Q/bin" "$Q/kit"
chmod 700 "$Q/claude" "$Q/fake-claude"         # E-1532 DoD fix: Claude roots 0700
: > "$Q/pids"; : > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
# body.sh's gate requires these shims by name even though this stage's scratch rows create no host:
ln -s "$W/hub/test/fakes/fake-ssh.ts" "$Q/bin/ssh"; ln -s "$W/hub/test/fakes/fake-scp.ts" "$Q/bin/scp"
printf '#!/bin/sh\nexec "$@"\n' > "$Q/bin/setsid"
printf "#!/bin/sh\nln -s '%s/node_modules' node_modules\n" "$W" > "$Q/bin/npm"
chmod 700 "$Q/bin/setsid" "$Q/bin/npm"
printf '{"W":"%s","Q":"%s","EV":"%s","T":"%s","R":"%s","ST":"%s","SESSION":"%s"}\n' "$W" "$Q" "$EV" "$T" "$R" "$ST" "$QA_SESSION" > "$Q/state.json"
git -C "$R" show "$M2:qa/briefs/E-1535-stage-1.md" | awk '/^## Carried corrections/{f=1} /^## Stage$/{exit} f' > "$EV/carried-from-M2.md"
echo "carried brief commit $(git -C "$R" rev-parse "$M2^{commit}") want 0d0618042fae7b76919d1be152e252b09e4a43ad; blob $(git -C "$R" rev-parse "$M2:qa/briefs/E-1535-stage-1.md") want dd84d5b93927798242c0bee78ddc3310145ecbf0; carried lines $(wc -l < "$EV/carried-from-M2.md" | tr -d ' ') want 127"
```

**The kits, from one fixed commit.** `K` above, exactly as stage 1 took them: from `qa/briefs/E-1532-stage-4.md` at `K`, `holder`, `quiet`, `ld` (lines 133 to 136) and `tap.mjs` (lines 228 to 279); from `qa/briefs/E-1533-stage-3.md` at `K`, its heredocs `seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh` and `helpers.sh`, each taken whole and written to `$Q` unchanged. A missing kit file or block at `K` is a setup BLOCKED.

```sh
for b in E-1532-stage-4 E-1533-stage-3; do git -C "$R" show "$K:qa/briefs/$b.md" > "$Q/kit/$b.md"; done
echo "kit commit $(git -C "$R" rev-parse "$K^{commit}") want f43f4e21049e9c62a97c8dec1ebf37f9c7035a62"
sed -n '133,136p' "$Q/kit/E-1532-stage-4.md" > "$Q/kit-shell.sh"; sed -n '228,279p' "$Q/kit/E-1532-stage-4.md" > "$Q/kit-tap.sh"
echo "kit first lines: $(head -n 1 "$Q/kit-shell.sh" | cut -c1-10) | $(head -n 1 "$Q/kit-tap.sh" | cut -c1-27)"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
kitb() { awk -v n="$2" 'BEGIN{h="cat > \"$Q/" n "\" <<"} index($0,h)==1{f=1} f{print} f&&/^(JS|SH|JSON)$/{exit}' "$Q/kit/$1.md"; }
for n in seal.mjs fresh.mjs frame.mjs body.sh helpers.sh; do kitb E-1533-stage-3 "$n" > "$Q/kit3-$n.sh"; echo "kit3 $n: $(head -n 1 "$Q/kit3-$n.sh" | cut -c1-40) | lines $(wc -l < "$Q/kit3-$n.sh" | tr -d ' ')"; . "$Q/kit3-$n.sh"; done
node --check "$Q/tap.mjs" && node --check "$Q/seal.mjs" && node --check "$Q/fresh.mjs" && node --check "$Q/frame.mjs" && bash -n "$Q/body.sh" && bash -n "$Q/helpers.sh" && echo "kits checked"
```

Expected: `carried brief commit`, `blob`, `carried lines` and `kit commit` each equal to `want`; `kit first lines: holder() { | cat > "$Q/tap.mjs" <<'JS'`; each `kit3` line starts with `cat > "$Q/<name>" <<'` and has more than one line; `kits checked`. The kit's `fresh.mjs` and the S0 probe below are unchanged from stage 1.

**This brief's own helpers.** `std.mjs` (the standard native environment), `invd.mjs` (per-file name-set deltas), `rcp.mjs` (new fixture-owner receipts, the T-1805 record), and the shell functions `nt` (sealed rows), `ns` (native rows, one slot per file) and `mrow` (scratch rows, the kit's own form):

```sh
cat > "$Q/std.mjs" <<'JS'
// node "$Q/std.mjs" <cwd> <command> [args…]   one native command in the standard environment: QA's own environment minus every CLAND_* name
// and minus the credential names the shared filter removes (rule 15), plus FAKE_ names; names only are printed, never values.
// Nothing is added: no HOME, TMPDIR, XDG, Git or NODE_COMPILE_CACHE overlay (A-18377/A-18378: a sealed overlay turned suite-runner red).
// Refuses (exit 2, "std: BLOCKED") on a HOME other than the user's, a TMPDIR other than the recorded system per-user TMPDIR,
// or NODE_COMPILE_CACHE set. Streams stdout and stderr through the redactor and the publication scan.
// QA_SLOT_MS (default 900000) bounds one preservation slot: TERM to the child, exit 124.
import { readFileSync, realpathSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';
const Q = dirname(fileURLToPath(import.meta.url));
const s = JSON.parse(readFileSync(`${Q}/state.json`, 'utf8'));
const refuse = why => { console.error(`std: BLOCKED: ${why}`); process.exit(2); };
if (s.Q !== Q || !s.ST || !s.W) refuse('state.json names another scratch root or no system TMPDIR');
const CRED = /^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/;
const real = p => { try { return realpathSync(p); } catch { return p; } };
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAND_')));
// The shared filter is the one fixtureEnvironment and the scratch builders apply after their last overlay (test-support/fixture-environment.ts:
// its credential test, then withoutExecutorCredentials from shared/executor-credentials.ts). A name is a credential when that pass drops it as
// an overlay. CLAUDE_, CODEX_, OPENCODE_ and GIT_ names are dropped there as profile families too, so for them only the filter's suffix test
// decides, probed under a neutral QAPROBE_ prefix. This kit's credential-prefix gate names and FAKE_ names are removed as well.
const { fixtureEnvironment } = await import(`${s.W}/test-support/fixture-environment.ts`);
const dropped = k => { try { return !Object.hasOwn(fixtureEnvironment(Q, {}, { [k]: 'std-probe' }), k); } catch { return true; } };
const credential = k => /^(CLAUDE_|CODEX_|OPENCODE_|GIT_)/.test(k) ? dropped(`QAPROBE_${k}`) : dropped(k);
const removed = Object.keys(env).filter(k => credential(k) || CRED.test(k) || k.startsWith('FAKE_')).sort();
for (const k of removed) delete env[k];
console.error(`std: removed by the shared credential filter (names only) ${removed.length}: ${removed.join(' ') || 'none'}`);
if (Object.keys(env).some(k => CRED.test(k) || k.startsWith('FAKE_') || credential(k))) refuse('a credential-prefix or FAKE_ name survived the filter');
if (env.HOME !== userInfo().homedir) refuse('HOME is not the user home');
if (!env.TMPDIR || real(env.TMPDIR) !== s.ST) refuse('TMPDIR is not the system per-user TMPDIR');
if (env.NODE_COMPILE_CACHE !== undefined) refuse('NODE_COMPILE_CACHE is set');
const secrets = Object.entries(process.env).filter(([k, v]) => typeof v === 'string' && v.length >= 8 && /(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY)/i.test(k)).map(([, v]) => v);
const { assertPublishable } = await import(`${s.W}/.agents/skills/qa/qa-demo-policy.ts`);
const [cwd, command, ...args] = process.argv.slice(2);
if (!command) refuse('usage: <cwd> <command> [args…]');
let withheld = 0;
const clean = line => {
  let out = line;
  for (const v of secrets) if (out.includes(v)) out = out.split(v).join('[redacted]');
  try { assertPublishable(out); } catch { out = '# std: line withheld by the publication scan'; }
  if (out !== line) withheld++;
  return out;
};
const pipe = (from, to) => new Promise(done => {
  let buf = ''; from.setEncoding('utf8');
  from.on('data', c => { buf += c; const parts = buf.split('\n'); buf = parts.pop(); for (const p of parts) to.write(clean(p) + '\n'); });
  from.on('end', () => { if (buf) to.write(clean(buf) + '\n'); done(); });
});
const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
const streams = Promise.all([pipe(child.stdout, process.stdout), pipe(child.stderr, process.stderr)]);
const limit = Number(process.env.QA_SLOT_MS ?? 900000);
let overran = false;
const timer = setTimeout(() => { overran = true; console.error(`std: slot limit ${limit} ms reached; TERM sent to ${child.pid}`); child.kill('SIGTERM'); }, limit);
child.on('error', error => { console.error(`std: ${error.message}`); process.exitCode = 1; });
child.on('close', async code => { clearTimeout(timer); await streams; console.error(`# std: redacted or withheld lines ${withheld}`); process.exitCode = overran ? 124 : (code ?? 1); });
JS
cat > "$Q/invd.mjs" <<'JS'
// node "$Q/invd.mjs" <inv dir> <own-family regex>   per file and directory: exact name-set deltas (after minus before, before minus after)
// Kinds: t ($T, sealed rows), st (system TMPDIR), tmp (/private/tmp), rcp (the TMPDIR's cland-fixture-owners-<uid>). Own-family names never count in rcp.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const [dir, own] = process.argv.slice(2), OWN = new RegExp(own || '^$');
const KNOWN = /^(hc-|sf-|cland-ssh|cland-suite-|cland-fixture-owners-|cland-h-|cland-[0-9a-f]{16}\.sock$|cland-spoke-[0-9a-f]{16}\.sock$)/, ALIAS = /^ct-[a-f0-9]{32}$/;
const read = f => readFileSync(f, 'utf8').split('\n').filter(Boolean);
const keys = readdirSync(dir).filter(f => f.endsWith('.label')).map(f => f.slice(0, -6)).sort((a, b) => Number(a) - Number(b));
let ownTotal = 0, otherTotal = 0;
for (const k of keys) {
  const label = readFileSync(`${dir}/${k}.label`, 'utf8').trim();
  for (const kind of ['t', 'st', 'tmp', 'rcp']) {
    if (!existsSync(`${dir}/${k}.before.${kind}`) || !existsSync(`${dir}/${k}.after.${kind}`)) continue;
    const b = read(`${dir}/${k}.before.${kind}`), a = read(`${dir}/${k}.after.${kind}`), B = new Set(b), A = new Set(a);
    const added = a.filter(n => !B.has(n)), gone = b.filter(n => !A.has(n));
    const mine = kind === 'rcp' ? [] : added.filter(n => OWN.test(n));
    ownTotal += mine.length; otherTotal += added.length - mine.length;
    console.log(`${label} [${kind}]: before ${b.length}; after ${a.length}; new ${added.length}; own-family new ${mine.length}; gone ${gone.length}`);
    for (const n of added) console.log(`  new ${kind}: ${n}${mine.includes(n) ? ' OWN' : ALIAS.test(n) ? ' alias' : KNOWN.test(n) ? ' known-class' : kind === 'rcp' ? ' receipt' : ''}`);
    if (gone.length <= 20) for (const n of gone) console.log(`  gone ${kind}: ${n}`);
  }
}
console.log(`other new entries in all files: ${otherTotal}`);
console.log(`own-family new entries in all files: ${ownTotal}`);
JS
cat > "$Q/rcp.mjs" <<'JS'
// node "$Q/rcp.mjs" <inv dir>   every fixture-owner receipt new after a file: owner pid alive, roots, roots present, roots naming the source worktree or repository
// Reads receipts only (version, pid, born, roots); never writes, removes or acts on a root (T-1805).
import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
const s = JSON.parse(readFileSync(new URL('./state.json', import.meta.url), 'utf8'));
const dir = process.argv[2], R = realpathSync(s.R), W = realpathSync(s.W), D = `${s.ST}/cland-fixture-owners-${process.getuid()}`;
const read = f => existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean) : [];
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
let count = 0, source = 0;
for (const k of readdirSync(dir).filter(f => f.endsWith('.label')).map(f => f.slice(0, -6))) {
  const B = new Set(read(`${dir}/${k}.before.rcp`)), label = readFileSync(`${dir}/${k}.label`, 'utf8').trim();
  for (const n of read(`${dir}/${k}.after.rcp`).filter(n => !B.has(n))) {
    count++; let v; try { v = JSON.parse(readFileSync(`${D}/${n}`, 'utf8')); } catch { console.log(`${label}: receipt ${n}: unreadable or gone`); continue; }
    const roots = Array.isArray(v.roots) ? v.roots : [], src = roots.filter(r => r === W || r === R || r.startsWith(`${R}/`));
    if (src.length) source++;
    console.log(`${label}: receipt ${n}: pid alive ${alive(v.pid)}; roots ${roots.length}; roots present ${roots.filter(r => existsSync(r)).length}; roots naming the source worktree or repository ${src.length}${src.length ? ' (T-1805 class)' : ''}`);
  }
}
console.log(`new receipts ${count}; naming the source ${source}`);
JS
node --check "$Q/std.mjs" && node --check "$Q/invd.mjs" && node --check "$Q/rcp.mjs" && echo "helpers checked"
# snapt <prefix>: the $T name set; snaps <prefix>: the system TMPDIR, /private/tmp and the receipt directory name sets (taken only while no file runs)
snapt() { ls -A "$T" | LC_ALL=C sort > "$1.t"; }
snaps() { ls -A "$ST" | LC_ALL=C sort > "$1.st"; ls -A /private/tmp | LC_ALL=C sort > "$1.tmp"; ls -A "$ST/cland-fixture-owners-$(id -u)" 2> /dev/null | LC_ALL=C sort > "$1.rcp"; }
# nt <id> <files…>: sealed T1/T2 files from $W, each in a fresh plain seal (TMPDIR=$T), one at a time, TAP, with $T name sets before and after each file
nt() { local id=$1 f k=0; shift; quiet || return 1; : > "$EV/$id.log"; mkdir -p "$EV/$id.inv"
  for f in "$@"; do k=$((k+1)); ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }
    printf '%s\n' "$f" > "$EV/$id.inv/$k.label"; snapt "$EV/$id.inv/$k.before"
    node "$Q/fresh.mjs" "$W" plain node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log"
    snapt "$EV/$id.inv/$k.after"; done
  node "$Q/tap.mjs" check "$EV/$id.log" "$Q/expect.json" | tee "$EV/$id.check.txt"
  node "$Q/invd.mjs" "$EV/$id.inv" '^$' > "$EV/$id.inventory-delta.txt"; tail -n 2 "$EV/$id.inventory-delta.txt"; }
# slot/unslot: one preservation slot (mkdir must exit 0; owner file; owner-checked literal-path release)
slot() { if ! mkdir /tmp/cland-preserve.lock 2> /dev/null; then echo "BLOCKED: /tmp/cland-preserve.lock is held: $(cat /tmp/cland-preserve.lock/owner 2> /dev/null || echo 'no owner file')"; return 1; fi
  printf 'qa %s %s pid %s %s %s\n' "$RUN" "$1" "$$" "$(date -u +%FT%TZ)" "$2" > /tmp/cland-preserve.lock/owner; echo "slot taken $2 $(date -u +%FT%TZ)" >> "$EV/$1.slots.txt"; }
unslot() { if [ "$(cut -d' ' -f1-3 /tmp/cland-preserve.lock/owner 2> /dev/null)" = "qa $RUN $1" ]; then rm /tmp/cland-preserve.lock/owner && rmdir /tmp/cland-preserve.lock && echo "slot released $(date -u +%FT%TZ)" >> "$EV/$1.slots.txt"; else echo "FINDING: preservation lock owner changed during $1; lock left in place" | tee -a "$EV/$1.slots.txt"; return 1; fi; }
# ns <id> <own-family regex> <files…>: native files from $W in the standard environment, each alone in its own preservation slot, TAP, name sets before and after each file
ns() { local id=$1 own=$2 f k=0; shift 2; : > "$EV/$id.log"; : > "$EV/$id.slots.txt"; mkdir -p "$EV/$id.inv"
  for f in "$@"; do k=$((k+1)); quiet || return 1; ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }
    slot "$id" "$f" || return 1
    printf '%s\n' "$f" > "$EV/$id.inv/$k.label"; snaps "$EV/$id.inv/$k.before"
    node "$Q/std.mjs" "$W" node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log"
    snaps "$EV/$id.inv/$k.after"; unslot "$id" || return 1; done
  node "$Q/tap.mjs" check "$EV/$id.log" "$Q/expect.json" | tee "$EV/$id.check.txt"
  node "$Q/invd.mjs" "$EV/$id.inv" "$own" > "$EV/$id.inventory-delta.txt"; tail -n 2 "$EV/$id.inventory-delta.txt"
  node "$Q/rcp.mjs" "$EV/$id.inv" > "$EV/$id.receipts.txt"; tail -n 1 "$EV/$id.receipts.txt"; }
# own-family patterns with alternation, kept out of the case table (VERIFIED from the files' allocation calls)
OWN63='^((ld|ldc|ldi|lds|ldt|ldv)-[A-Za-z0-9]{6}|ct-[a-f0-9]{32}|cland-auth-script-.*)$'   # host-login-disk roots and aliases, cland-auth scripts
OWN71='^(agent-.*|host-[a-z-]+-[A-Za-z0-9]{6})$'                                         # host-agent roots, hub/test/host-contract.ts roots
# mrow <id> <function>: one scratch row in a fresh hub seal, cwd p1, after cover-quiet admission and the load gate (the kit's form)
mrow() { quiet || return 2; { ld; node "$Q/fresh.mjs" "$Q/p1" hub /bin/bash "$Q/body.sh" "$2"; echo "row exit $?"; } > "$EV/$1.txt" 2>&1; tail -n 1 "$EV/$1.txt"; }
```

Expected: `helpers checked`.

The S0 environment prints, the two seals as in stage 1 and the standard environment once:

```sh
for m in plain hub; do node "$Q/fresh.mjs" "$Q" "$m" node -e 'const fs=require("fs"),os=require("os"),path=require("path");const e=process.env,h=os.userInfo().homedir,real=p=>{try{return fs.realpathSync(p)}catch{return p}};const allowed=new Set([real(path.dirname(process.execPath))]);console.log(process.argv[1]+": credential-prefix names "+Object.keys(e).filter(k=>/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)).length+"; QA_SESSION "+(e.QA_SESSION?"set":"unset")+"; TMPDIR is T "+(e.TMPDIR===e.QA_T)+"; HOME is Q/home "+(e.HOME===e.QA_Q+"/home")+"; CLAND_TEST_HOST_ knobs "+Object.keys(e).filter(k=>k.startsWith("CLAND_TEST_HOST_")).length+"; FAKE_LOGIN_ names "+Object.keys(e).filter(k=>k.startsWith("FAKE_LOGIN_")).length+"; real-HOME PATH entries other than the Node bin "+e.PATH.split(":").filter(p=>p.startsWith("~")||((p===h||p.startsWith(h+"/"))&&!allowed.has(real(p)))).length)' "$m"; done 2>&1 | tee "$EV/S0-env.txt"
node "$Q/std.mjs" "$W" node -e 'const fs=require("fs"),os=require("os");const e=process.env,real=p=>{try{return fs.realpathSync(p)}catch{return p}};console.log("std: credential-prefix names "+Object.keys(e).filter(k=>/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)).length+"; CLAND_ names "+Object.keys(e).filter(k=>k.startsWith("CLAND_")).length+"; FAKE_ names "+Object.keys(e).filter(k=>k.startsWith("FAKE_")).length+"; HOME is the user home "+(e.HOME===os.userInfo().homedir)+"; TMPDIR is the system TMPDIR "+(real(e.TMPDIR)===real(process.argv[1]))+"; NODE_COMPILE_CACHE set "+(e.NODE_COMPILE_CACHE!==undefined)+"; node "+process.version)' "$ST" 2>&1 | tee -a "$EV/S0-env.txt"
echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' '); T bytes $(printf '%s' "$T" | wc -c | tr -d ' '); a suite root for comparison $(printf '%s' "/private/tmp/cland-suite-$(uuidgen | tr 'A-Z' 'a-z')" | wc -c | tr -d ' '); ST $ST" | tee -a "$EV/S0-env.txt"
```

Expected (recorded as `S0`): `kits checked`, `helpers checked`; QA's shell `credential-prefix names:` any count (recorded); `std: removed by the shared credential filter (names only) <n>: <names>` recorded as the removed set (INFERRED: `SSH_AUTH_SOCK` among them on a macOS login shell); both seals `credential-prefix names 0`, `QA_SESSION set`, `TMPDIR is T true`, `HOME is Q/home true`, `CLAND_TEST_HOST_ knobs 0`, `FAKE_LOGIN_ names 0`, `0` real-HOME entries, each `# fresh: redacted or withheld lines 0`; `std: credential-prefix names 0; CLAND_ names 0; FAKE_ names 0; HOME is the user home true; TMPDIR is the system TMPDIR true; NODE_COMPILE_CACHE set false; node v24.…` and `# std: redacted or withheld lines 0`; `Q bytes 23`, `T bytes` equal to the suite root's. A `std: BLOCKED` line, a non-zero credential count in either seal or after `std.mjs`'s filter, stops the run before any row (BLOCKED): report the names (never values) to the requester. The removed-names line repeats in every native log; it must name the same set each time (a change is recorded).

The TAP expectations. `exact: true` lists every registration; `exact: false` with `[]` means the whole file must be `CLEAN`. Every list was read at dev `acd4e3aaf` and matched name by name against its source templates (VERIFIED; the counts: `login-records` 20, `login-list` 2, `login-signin` 5, `login-host-pin` 12, `login-add-component` 5, `accounts-policy` 4, `until` 1, `login-keys` 6, `secrets` 7, `login-snapshots` 27, `login-snapshot-cli` 1, `login-binding` 32, `login-selection` 2, `fixture-store` 2, `login-release` 24, `host-contract-coverage` 9, `login-add` 1, `login-terminal` 2, `fake-ssh` 15, `host-login-disk` 14, `cland-auth` 10, `login-write-back` 1, `host-create-ready` 11, `host-destroy-native` 3, `host-restart` 1, `host-unreachable` 20, `host-stop` 4, `host-provider-volumes` 15 with six `fake: …` registrar cases, `host-provider-digitalocean-volumes` 17 with six `digitalocean: …` registrar cases).

T-1780's new `hub/test/login-provision-bind.test.ts` was read at its reviewed head `678733ec5` (VERIFIED: 19 top-level, from 16 registration calls with three two-way loops; three nested subtests, so `# tests` 22). T-1780 changes no other test file (VERIFIED), and every list above still matches its templates at `678733ec5` (VERIFIED, re-derived there).

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/login-records.test.ts": {"exact": true, "names": [
  "disk and key login rows round-trip every field without key disk properties",
  "change notifications identify row saves and binding-only mutations for legacy listeners",
  "refuses login transition from creating to creating naming current state",
  "refuses login transition from creating to in-use naming current state",
  "refuses login transition from ready to creating naming current state",
  "refuses login transition from ready to ready naming current state",
  "refuses login transition from ready to signed-out naming current state",
  "refuses login transition from in-use to creating naming current state",
  "refuses login transition from in-use to in-use naming current state",
  "refuses login transition from signed-out to ready naming current state",
  "refuses login transition from signed-out to in-use naming current state",
  "refuses login transition from signed-out to signed-out naming current state",
  "creating is neither free nor bound; bindings enforce exclusive writer and non-exclusive readers",
  "login syntax, uniqueness, harness and key disk constraints name their rules",
  "binding invariant: disk volume missing is a typed refusal with no partial write",
  "binding invariant: writer volume differs is a typed refusal with no partial write",
  "binding invariant: reader uses original volume is a typed refusal with no partial write",
  "binding invariant: key has volume is a typed refusal with no partial write",
  "binding invariant: exclusive second binding is a typed refusal with no partial write",
  "binding invariant: second writer is a typed refusal with no partial write"]},
 "hub/test/login-list.test.ts": {"exact": true, "names": [
  "login list text and JSON expose rows and hosts, retained across hub restart",
  "login list refuses session, web and remote edges like host list"]},
 "hub/test/login-signin.test.ts": {"exact": true, "names": [
  "all harness sign-in plans contain only the documented home and native arguments",
  "production harness command sources contain no logout commands",
  "failed terminal sign-in 1 keeps a detached signed-out disk",
  "failed terminal sign-in null keeps a detached signed-out disk",
  "disk sign-in stays creating until unmount, snapshot and detach receipts"]},
 "hub/test/login-host-pin.test.ts": {"exact": true, "names": [
  "terminal outcome 0 holds its host through cleanup and releases the pin",
  "terminal outcome 1 holds its host through cleanup and releases the pin",
  "terminal outcome null holds its host through cleanup and releases the pin",
  "login admission refuses INVALID before host creation or pinning",
  "login admission refuses work before host creation or pinning",
  "login admission refuses empty name before host creation or pinning",
  "a pinned host renews its lease and idle-stop waits for unpinning",
  "sign-in revalidates captured host authority after create",
  "sign-in revalidates captured host authority after attach",
  "sign-in revalidates captured host authority after mount",
  "sign-in revalidates captured host authority after publish",
  "sign-in revalidates captured host authority after replacement"]},
 "hub/test/login-add-component.test.ts": {"exact": true, "names": [
  "login add disconnect settles only its admitted connection",
  "login add failure settles only its admitted connection",
  "login add success settles only its admitted connection",
  "login add preparation failure reaches CLI without a terminal plan",
  "dispatcher shutdown joins every login closer and still closes the suite owner after failure"]},
 "hub/test/cli-usage-compatibility.test.ts": {"exact": false, "names": []},
 "hub/test/cli-help.test.ts": {"exact": false, "names": []},
 "hub/test/cli-command-help.test.ts": {"exact": false, "names": []},
 "hub/test/cli-usage.test.ts": {"exact": false, "names": []},
 "hub/test/web-authority.test.ts": {"exact": false, "names": []},
 "hub/test/web-authority-unit.test.ts": {"exact": false, "names": []},
 "hub/test/accounts-policy.test.ts": {"exact": true, "names": [
  "hub source has no provider endpoint or credential-store access",
  "image installer exception permits only the exact v2 literal in its recipe file",
  "mounted database path permits only one exact pure registry helper",
  "account migrations contain no literal timer waits or elapsed-time assertions"]},
 "hub/test/until.test.ts": {"exact": true, "names": [
  "wait deadline policy preserves local, droplet, explicit and invalid scaling"]},
 "hub/test/host-provider-fake.test.ts": {"exact": false, "names": []},
 "hub/test/host-provider-digitalocean.test.ts": {"exact": false, "names": []},
 "hub/test/host-provider-digitalocean-prepare.test.ts": {"exact": false, "names": []},
 "hub/test/executor-prepare-component.test.ts": {"exact": false, "names": []},
 "hub/test/executor-snapshot-confirmation.test.ts": {"exact": false, "names": []},
 "hub/test/login-keys.test.ts": {"exact": true, "names": [
  "key files encrypt a sentinel, reuse the store key and authenticate project and name",
  "key store refuses symlink directories and files and never overwrites a key",
  "a held key-store write fences other key creation and store-key rotation",
  "key admission registers plaintext before storing metadata and refuses invalid ciphertext without a row",
  "store key cannot rotate while a retained key login has lost its file",
  "stdin key CLI publishes metadata only and the hub retains no sentinel bytes"]},
 "hub/test/secrets.test.ts": {"exact": true, "names": [
  "hub start tightens secrets to 600 before serving",
  "hub start refuses symlinked secrets without changing their target or leaving a lock",
  "secret set accepts stdin only, list prints names and fingerprints, and unset removes one value without leaking it",
  "secret commands refuse value arguments, unknown names, empty input and malformed TOML without echoing input",
  "secret commands preserve other names through rotation and refuse symlinks on reads and writes",
  "auth store key starts the hub, lists only a fingerprint and rejects unknown auth names",
  "secret commands repair a malformed unused auth store key while startup refuses it"]},
 "hub/test/secrets-resolution.test.ts": {"exact": false, "names": []},
 "hub/test/login-snapshots.test.ts": {"exact": true, "names": [
  "one login save has bounded scheduling work across ten thousand retained logins",
  "pending detection bounds binding-row work for a login with many readers",
  "third confirmed backup retains only the newest two snapshots",
  "pending binding defers scheduled and manual backups until settlement",
  "settling a binding preserves a future daily backup deadline",
  "in-use backup runs at 24 hours under freeze and thaw, including snapshot failure",
  "rate limit persists exact retry deadline and restart resumes detached backup",
  "release notification returns before detached provider work and key login names its missing disk",
  "due backup survives a stopped hub and release makes a ready detached disk eligible",
  "sign-in snapshot rate preserves its terminal outcome",
  "sign-in snapshot failed preserves its terminal outcome",
  "snapshot refuses a resolved disk with a different durable volume identity",
  "unfinished pruning resumes retained snapshot deletion without creating another backup",
  "legacy in-use row without a sign-in timestamp keeps one persisted daily deadline",
  "freeze that takes effect then rejects is still thawed and recorded",
  "release joins a held freeze and thaw before provider snapshot starts",
  "startup thaws a retained freeze and publishes its captured snapshot without another provider request",
  "ownership change after resolve await fences publication and later effects",
  "ownership change after freeze await fences publication and later effects",
  "ownership change after provider await fences publication and later effects",
  "release during held provider I/O retains confirmed thaw outcome",
  "release during held provider I/O retains unconfirmed thaw outcome",
  "fixture cleanup joins held snapshot work before database and root disposal",
  "startup keeps a freeze fenced when its host generation is replaced",
  "retained snapshot receipt from another volume is refused before publication",
  "changing volume cannot transplant an in-flight snapshot outcome onto a new disk",
  "successful provider send queued before release is refused at its final send boundary"]},
 "hub/test/login-snapshot-cli.test.ts": {"exact": true, "names": [
  "login snapshot CLI confirms a ready disk and refuses a key with no disk"]},
 "hub/test/login-binding.test.ts": {"exact": true, "names": [
  "pool launch attaches and mounts a ready login before spawn",
  "second session reuses the binding and records login and account",
  "role account selects a project login without a local account registry",
  "mount failure unmounts and detaches before returning login to ready",
  "incomplete rollback retains durable pending fence and refuses later reuse",
  "local launch uses no login even when project disk is ready",
  "remote command overlay removes stray harness authentication variables",
  "no eligible login waits with harness before spawning",
  "concurrent launches of one harness share one mounted writer",
  "process login and mount overlay survive reopening the process table",
  "unknown mount outcome fences binding without another native mutation",
  "item pool launch preserves project account and mount through admission",
  "invalid missing-item launch never binds a login",
  "invalid invalid-name launch never binds a login",
  "invalid unknown-role launch never binds a login",
  "fresh same-host resume keeps the settled login and mount",
  "native same-host resume keeps the settled login and mount",
  "binding close joins held list to its settled receipt",
  "binding close joins held list to its unknown receipt",
  "binding close joins held attach to its settled receipt",
  "binding close joins held attach to its unknown receipt",
  "binding close joins held mount to its settled receipt",
  "binding close joins held mount to its unknown receipt",
  "a held key login never becomes a disk mount environment",
  "an item already claimed by another worker refuses before binding",
  "idle item handoff keeps the bound project account without a registry lookup",
  "settled binding with another provider is refused without native effects",
  "settled binding with another region is refused without native effects",
  "an unpinned already-limited login account refuses before native binding effects",
  "host execution maps mounted login environment while retaining logical input",
  "held binding body failure drains before borrowed storage closes",
  "explicit empty account overrides role pin and selects and reuses an unpinned login",
  "explicit account without a matching login waits before growth",
  "role account without a matching login waits before growth"]},
 "hub/test/login-selection.test.ts": {"exact": true, "names": [
  "launch selection has fixed indexed query and decode work across ten thousand retained logins",
  "stage-one login database migrates private binding harness and indexes without changing public rows"]},
 "hub/test/fixture-store.test.ts": {"exact": true, "names": [
  "setup Store joins a held producer before closing: rejected=false",
  "setup Store joins a held producer before closing: rejected=true"]},
 "hub/test/pool-scale.test.ts": {"exact": false, "names": []},
 "hub/test/host-status.test.ts": {"exact": false, "names": []},
 "hub/test/waiting-launch.test.ts": {"exact": false, "names": []},
 "hub/test/waiting-launch-restart.test.ts": {"exact": false, "names": []},
 "hub/test/pool-failures.test.ts": {"exact": false, "names": []},
 "hub/test/session-pool-placement.test.ts": {"exact": false, "names": []},
 "hub/test/login-release.test.ts": {"exact": true, "names": [
  "host stop unmounts and detaches the same volume before deletion",
  "two login unmounts run concurrently before detach",
  "writers remaining retain host and binding and emit one notice",
  "lost host retains settled binding until detached inventory",
  "lost host retains pending binding",
  "snapshot thaw refusal prevents unmount and machine deletion",
  "host without logins requires no release owner",
  "provider gone receipt skips unmount and frees only detached disk",
  "concurrent stop callers join one release",
  "health 15-minute loss reaches login release",
  "health gone receipt reaches login release",
  "refusal then hard deadline emits exactly one destruction notice after detached read",
  "held freeze on lost host is abandoned without host calls",
  "held freeze on gone host is abandoned without host calls",
  "automatic detached retry stops after positive inventory",
  "restart recovers detached retry without decoding retained login history",
  "close joins held retry before storage closes",
  "forced fixture body failure joins held destroy and health before SQLite close",
  "fake volume inventory ignores an in-progress atomic write but refuses corrupt canonical records",
  "reachable held freeze with refused thaw still blocks release",
  "refusal then deleted attached inventory and automatic detach emit two total notices",
  "unreachable tunnel deletes and settles session before held volume reconciliation",
  "gone startup revokes and settles spend before installed owner reconciles destroyed host disk",
  "dispatcher composition recovers a destroyed host disk from durable startup records"]},
 "hub/test/host-contract-coverage.test.ts": {"exact": true, "names": [
  "Host contract exercises every interface member and detects an uncovered addition",
  "Host spawn contract inventory includes logFile and exited with positive omission controls",
  "Host stop option inventory detects an uncovered callback addition",
  "Host spawn option inventory detects an uncovered callback addition",
  "local Host retains no optional Claude launch or adoption implementation",
  "optional login-disk contract covers absence, refusal and exact input with planted failures",
  "optional terminal printer contract covers absence and its exact session command",
  "optional capacity contract covers absence, report delivery and unsubscribe with positive controls",
  "optional login-disk reachability preserves absent Hosts and exact boolean observations"]},
 "hub/test/host-agent-closure.test.ts": {"exact": false, "names": []},
 "hub/test/host-agent-boundary.test.ts": {"exact": false, "names": []},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []},
 "hub/test/login-add.test.ts": {"exact": true, "names": [
  "terminal disk logins create a host, reuse it and retain only public metadata"]},
 "hub/test/login-terminal.test.ts": {"exact": true, "names": [
  "terminal sign-in joins native SSH after hub disconnect",
  "terminal sign-in joins native SSH after CLI cancellation"]},
 "hub/test/fake-ssh.test.ts": {"exact": true, "names": [
  "terminal claude-code sign-in stays inside the authenticated fake machine",
  "terminal codex sign-in stays inside the authenticated fake machine",
  "terminal opencode sign-in stays inside the authenticated fake machine",
  "fake SSH refuses unrecognized login disk commands before local execution",
  "fake SSH terminal sign-in cannot execute a harness planted on PATH",
  "one-shot command uses fake host HOME and stdin",
  "scp writes exact bytes inside host home and refuses escape",
  "production binaries ignore either incomplete fake gate",
  "fake SSH setup rejection disposes its root before any bin or host setup",
  "master relays both Unix directions, dynamic forward/cancel, exit leaves stale control",
  "master SIGKILL closes forwards; gone refuses later connections",
  "rejects missing/wrong pins, occupied forwards and TCP listen; loopback destination uses Unix map",
  "kill-master refuses copied and stale ownership; failed bind preserves live receipt",
  "held one-shot cancellation joins its writer before fixture removal",
  "master remains usable beyond the former launch close deadline"]},
 "hub/test/host-login-disk.test.ts": {"exact": true, "names": [
  "login file publication shares the attached fake mount and leaves ordinary paths unchanged",
  "all login filesystem operations use the attached fake mount and retain logical paths",
  "login-disk closes only disk users in live parent trees",
  "login-disk closes only disk users in retained orphan trees",
  "login-disk holds writer admission through the final unlink boundary",
  "login-disk joins a previously admitted writer before its disk census",
  "login-disk held-spawn setup rejection joins native admission before client close",
  "login-disk joins completion persistence and exit publication before replying",
  "login-disk joins its owned close callback when kernel exit precedes native publication",
  "login-disk mounts only this fake machine attachment through the SSH Host",
  "login-disk uses exactly sudo -n helper op volume path and preserves typed helper failures",
  "login-disk rejects malformed paths and volume names before invoking a helper",
  "login-disk incomplete helper retains durable mutation ownership across agent restart",
  "login-disk fixture closes its server after rejected connect and attempts every cleanup join"]},
 "hub/test/cland-auth.test.ts": {"exact": true, "names": [
  "C4: invalid helper arguments fail before any external command",
  "mount drains and unmounts the device automount before mounting the login path",
  "helper dispatches freeze and thaw only for the matching mounted volume",
  "unmount observes writers gone and refuses a disk with persistent writers",
  "writer probe errors and missing fuser never authorize unmount",
  "lost or replaced mount after admission refuses every later effect",
  "contended operation lock refuses before mount discovery or effects",
  "failed positive census and failed signal retain the mounted disk",
  "mount installs the requested scratch device and checks identity before permissions",
  "mount changes after the writer census fence signals and final unmount"]},
 "hub/test/login-write-back.test.ts": {"exact": true, "names": [
  "rotated disk reaches the next host and release closes only disk writers"]},
 "hub/test/host-create-ready.test.ts": {"exact": true, "names": [
  "C1/C2 create reaches ready with clone and tunnel and runs OpenCode; list shows declared facts",
  "C3 mismatched prelude key never registers or starts a supervisor and releases machine after gate",
  "failed readiness releases only after positive settlement: unknown",
  "failed readiness releases only after positive settlement: inventory unknown",
  "failed readiness releases only after positive settlement: timed out",
  "failed readiness releases only after positive settlement: leftovers",
  "failed readiness releases only after positive settlement: complete",
  "held final readiness cannot publish ready after revoke",
  "held final readiness cannot publish ready after shutdown",
  "forced fixture body failure joins held creation before storage and root disposal",
  "T-1746 waiting pool launch creates a leased watchdog host and is placed"]},
 "hub/test/host-destroy-native.test.ts": {"exact": true, "names": [
  "C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=false",
  "C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=true",
  "destroy joins an admitted held acquisition and prevents ready resurrection"]},
 "hub/test/host-restart.test.ts": {"exact": true, "names": [
  "restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership"]},
 "hub/test/host-unreachable.test.ts": {"exact": true, "names": [
  "three minutes down publishes one unreachable line and recovery preserves the host",
  "lost host invokes the confirmed deletion owner: provider gone=false",
  "lost host invokes the confirmed deletion owner: provider gone=true",
  "shortened health clocks require the fake-host fence: false",
  "shortened health clocks require the fake-host fence: true",
  "lost deadline joins renewal and publishes now before deletion ownership",
  "a restored unreachable host already up clears its retained outage state",
  "registry replays the continuous outage start: later loss=false",
  "registry replays the continuous outage start: later loss=true",
  "outage settles sessions and roles: recovered",
  "outage settles sessions and roles: lost",
  "outage settles sessions and roles: gone",
  "outage settles sessions and roles: mirror-failure",
  "provider replies are fenced by the outage and flapping checks are rate bounded",
  "loss waits for ledger-blocked renewal before publishing the watchdog deadline",
  "idle stop and outage grace retain a 30s lease: spare=false recover=false",
  "idle stop and outage grace retain a 30s lease: spare=false recover=true",
  "idle stop and outage grace retain a 30s lease: spare=true recover=false",
  "idle stop and outage grace retain a 30s lease: spare=true recover=true",
  "failed lease shortening retains an owned next-tick mirror retry"]},
 "hub/test/host-stop.test.ts": {"exact": true, "names": [
  "C3 stop joins lease renewal and requires confirmed destroy: true",
  "C3 stop joins lease renewal and requires confirmed destroy: false",
  "C5 host help lists status and stop",
  "C4 manual create refuses occupied max_hosts before publishing another row"]},
 "hub/test/host-provider-volumes.test.ts": {"exact": true, "names": [
  "fake: refused snapshot authorization sends no native effect",
  "fake: snapshot history, cloning and confirmed deletion",
  "fake: volumes create, list and confirm deletion",
  "fake: volumes enforce one attachment and region binding",
  "fake: ignored volume deletion retains inventory",
  "fake: volumes rate limit snapshots until retry time",
  "mandatory volume contract rejects deletion acknowledged without removal",
  "volume inventory, attachment and snapshot pacing survive provider recreation",
  "concurrent volume attachment and snapshot calls each admit one winner",
  "fake snapshot window rejects invalid durations",
  "malformed retained volume ownership and snapshot facts fail closed without writes",
  "fake login contents survive snapshots, cloning and machine release",
  "fake snapshot deletion confirms absence and retained history fails closed",
  "surviving snapshot IDs support lookup clone and delete after volume deletion",
  "snapshot ID deletion retries history publication after provider recreation"]},
 "hub/test/host-provider-digitalocean-volumes.test.ts": {"exact": true, "names": [
  "digitalocean: refused snapshot authorization sends no native effect",
  "digitalocean: snapshot history, cloning and confirmed deletion",
  "digitalocean: volumes create, list and confirm deletion",
  "digitalocean: volumes enforce one attachment and region binding",
  "digitalocean: ignored volume deletion retains inventory",
  "digitalocean: volumes rate limit snapshots until retry time",
  "digitalocean volume create carries lon1, 1 GiB and project/pool tags",
  "digitalocean volume create requires login admission outside the fake-host fence",
  "digitalocean volume actions publish attachment only after completed",
  "digitalocean volume admission selects pool and shares the creation pause",
  "digitalocean lost volume create reply retains discoverable resource without replay",
  "digitalocean known snapshot refusal returns immediately for the exact volume identity",
  "digitalocean snapshot restore sends source region and tags; deletion needs observed absence",
  "digitalocean snapshot receipts and source project fence destructive use across restart",
  "digitalocean volume fixture closes API and retains root after rejected owner drain",
  "digitalocean snapshot restore keeps retained region when API region order changes",
  "digitalocean snapshot authorization rechecks after the actual POST pacing wait"]},
 "hub/test/login-provision-bind.test.ts": {"exact": true, "names": [
  "cold launch attaches while connecting and reuses the mounted login after ready",
  "two waiting harnesses attach before cloning finishes",
  "login preparation adds no hub-clock time to simulated cloning",
  "boot failure before attachment preserves the ready disk",
  "boot failure after attachment preserves the ready disk",
  "unknown rollback retains pending binding without retrying detach",
  "host ready and native admission wait for the mount receipt",
  "missing login holds demand without creating a host",
  "cancelled captured wait cannot attach after held inventory completes",
  "failure fences attach while provisioning inventory is held",
  "abort fences attach while provisioning inventory is held",
  "forced setup failure drains a late scheduled attachment before hub and root cleanup",
  "cancelled wait at attached rolls back the same disk before host readiness",
  "cancelled wait at mounting rolls back the same disk before host readiness",
  "changed role account during mount releases the captured disk and launches with the current pin",
  "removed role while inventory is held cannot consume a login or fail the host",
  "selected account limit refuses the wait while preserving the healthy host and free disk",
  "unknown attachment keeps the pending fence and healthy host without spawning",
  "attachment delay owner rejects calls admitted after its cleanup"]},
 "hub/test/host-provision-gate.test.ts": {"exact": false, "names": []},
 "hub/test/host-relaunch.test.ts": {"exact": false, "names": []},
 "hub/test/host-watchdog.test.ts": {"exact": false, "names": []},
 "hub/test/host-ssh-contract.test.ts": {"exact": false, "names": []},
 "hub/test/host-local-contract.test.ts": {"exact": false, "names": []},
 "hub/test/host-agent.test.ts": {"exact": false, "names": []},
 "hub/test/cli-imports.test.ts": {"exact": false, "names": []}
}
JSON
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks (`src.mjs`), counted with `String.split` at the build. Every line reads `ok` at T-1780's reviewed head `678733ec5` (VERIFIED in its read-only worktree: 81 lines, T-1782 10, T-1777 12, T-1783 10, T-1781 9, T-1803 6, T-1778 11, T-1779 12, T-1780 11). Three T-1778 lines follow T-1780's reshaping of `LoginBinder` (reuse, rollback unmount, named bind failure now live in `prepare`'s closures): at `acd4e3aaf` those three and T-1780's eleven read `MISMATCH` and the other 67 `ok` (VERIFIED), so the run's dev must include T-1780's landing.

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   ok or MISMATCH per line (every line VERIFIED ok at T-1780's reviewed head 678733ec5). Counts use String.split.
import { readFileSync, existsSync } from 'node:fs';
const W = process.argv[2];
const read = f => existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null;
const DO = 'hub/src/host/provider/digitalocean.ts', PV = 'hub/src/host/provider/provider.ts', API = 'hub/src/executor/droplet/api.ts';
const SI = 'hub/src/host/login-signin.ts', LA = 'hub/src/host/login-add.ts', CL = 'hub/src/cli/login.ts';
const LK = 'hub/src/host/login-keys.ts', CK = 'hub/src/cli/login-key.ts', SE = 'hub/src/remote/secrets.ts', PJ = 'hub/src/project.ts';
const SN = 'hub/src/host/login-snapshots.ts', LG = 'hub/src/host/logins.ts', BI = 'hub/src/host/login-binding.ts', CE = 'hub/src/host/agent/command-environment.ts';
const RL = 'hub/src/host/login-release.ts', RO = 'hub/src/host/login-release-owner.ts', PH = 'hub/src/host/provision-host.ts', HH = 'hub/src/host/host-health.ts', SH = 'hub/src/host/ssh-host.ts', HT = 'hub/src/host/host.ts';
const SS = 'hub/src/adapters/sessions.ts', DI = 'hub/src/hub/dispatch.ts';
const C = [
  // T-1782 (DigitalOcean login volumes)
  ['T-1782 C1 a restore sends the snapshot id with the source region and the three tags', DO, "const volume = await this.#api.createVolume({ name: options.name, region, size_gigabytes: 1, ...(snapshot ? { snapshot_id: snapshot.id } : {}), tags: ['cland', projectTag(this.#options.root, options.project), `cland-pool-${pool}`] });", '=1'],
  ['T-1782 C1 the region comes from the retained source region', DO, 'const region = snapshot?.sourceRegion ?? options.region;', '=1'],
  ['T-1782 C2 snapshot history through the API', API, 'volumeSnapshots(id: string, deadline?: number): Promise<BlockVolumeSnapshot[]>', '=1'],
  ['T-1782 C2 snapshot deletion is a confirmed delete', API, 'deleteVolumeSnapshot(id: string, deadline?: number): Promise<void> { return this.#confirmedDelete(', '=1'],
  ['T-1782 C2 an unconfirmed snapshot deletion is incomplete', DO, "catch { return { state: 'incomplete', reason: 'DigitalOcean snapshot deletion unconfirmed' }; }", '=1'],
  ['T-1782 C3 a volume create without login admission is refused before any API call', DO, "return { state: 'refused', reason: 'DigitalOcean volume create requires login admission' };", '=1'],
  ['T-1782 C3 the additive admission type', PV, 'export type LoginVolumeAdmission = { login: string; project: string; pool: string };', '=1'],
  ['T-1782 C5 the test-only refusal is gone from the provider', DO, 'test-only', '=0'],
  ['T-1782 C5 no unsupported snapshot stub remains', DO, 'Snapshot unsupported', '=0'],
  ['T-1782 C5 no unsupported fromSnapshot stub remains', DO, 'fromSnapshot unsupported', '=0'],
  // T-1777 (cland login add, disk, terminal sign-in)
  ['T-1777 C1 Codex sign-in command', SI, 'case \'codex\': return `CODEX_HOME=${quote(path)} codex login --device-auth`;', '=1'],
  ['T-1777 C1 Codex file-store config before the terminal', SI, "Buffer.from('cli_auth_credentials_store = \"file\"\\n')", '=1'],
  ['T-1777 C1 the mount path', SI, 'const path=`/cland/auth/${o.harness}-${name}`;', '=1'],
  ['T-1777 C1 a 1 GiB volume in the pool region', SI, 'region:o.region,sizeGiB:1,', '=1'],
  ['T-1777 C2 Claude Code sign-in command', SI, 'case \'claude-code\': return `CLAUDE_CONFIG_DIR=${quote(path)} claude auth login`;', '=1'],
  ['T-1777 C2 exit zero ends ready, otherwise signed-out', SI, "const row=o.logins.transition(name!,code===0&&!failure?'ready':'signed-out');", '=1'],
  ['T-1777 C3 no ready host creates one through the pool', LA, 'await o.createHost(pool);', '=1'],
  ['T-1777 C4 a failure before native effects ends signed-out after cleanup', SI, "if(!uncertain){await cleanup();o.logins.transition(name,'signed-out');}", '=1'],
  ['T-1777 C5 the creating row is reserved before host work', LA, 'const admitted=reserveDiskLogin({logins:o.records.logins,', '=1'],
  ['T-1777 the terminal plan is ssh -t with the sign-in command', LA,
   "return {pending,plan:{name:pending.name,host:record.id,command:'ssh',args:[...args,loginSignInCommand(input.harness,pending.path)]}};", '=1'],
  ['T-1777 the CLI owns the terminal SSH', CL, 'return terminalLogin(discovery,input,env);', '=1'],
  ['T-1777 C7 no logout in the sign-in owner commands', SI, 'logout\'', '=0'],
  // T-1783 (key store)
  ['T-1783 C1 AES-256-GCM under the store key', LK, "const cipher = createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),nonce);", '=1'],
  ['T-1783 C1 create-only 0600 key file', LK, 'constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,0o600', '=1'],
  ['T-1783 C2 auth.key is a known secret name', SE, "export const SECRET_NAMES = ['telegram.token', 'discord.token', 'speech.elevenlabs_key', 'speech.xai_key', 'auth.key'] as const;", '=1'],
  ['T-1783 C3 the first key login writes the store key, later ones reuse it', SE, "key=randomBytes(32).toString('base64'); secrets['auth.key']=key; saveSecrets(root,secrets);", '=1'],
  ['T-1783 C4 only metadata reaches the hub', CK, "await send({harness:'opencode',kind:'key',name,account:input.account ?? name});", '=1'],
  ['T-1783 C5 a decrypt failure names the login only', LK, 'catch { throw Error(`login ${name}: cannot decrypt key file`); }', '=1'],
  ['T-1783 C5 value arguments are refused naming stdin', CL, 'key values are read from stdin, never arguments', '=1'],
  ['T-1783 C6 symlinked key paths refused', LK, 'if (symlinkOnPath(root,path) !== null) throw Error(`login ${name}: symlink refused`);', '=1'],
  ['T-1783 C6 the managed ignore names auth/', PJ, 'auth/', '>=1'],
  ['T-1783 the hub decrypts and registers before the metadata row', LK, 'const value=readLoginKey(root,project,input.name);\n register([value]);', '=1'],
  // T-1781 (snapshots as backups)
  ['T-1781 C1 pruning keeps the newest two', SN, 'while(ids.length>2) {', '=1'],
  ['T-1781 C1 pruning waits for confirmed deletion', SN, "if(deleted.state!=='deleted')throw Error('snapshot deletion unconfirmed');", '=1'],
  ['T-1781 C2 the daily interval', SN, 'const DAY = 24*60*60*1000;', '=1'],
  ['T-1781 C2 freeze before the provider snapshot', SN, "await target.host.loginDisk({op:'freeze',volume:target.volume.name,path:`/cland/auth/${row.harness}-${row.name}`});", '=1'],
  ['T-1781 C2 thaw in finally', SN, '} finally {if(thaw)await thaw();}', '=1'],
  ['T-1781 C4 a rate refusal keeps the provider retry time', SN, "retryAt:result.state==='refused'?result.retryAt:new Date(clock.now().getTime()+60000).toISOString()", '=1'],
  ['T-1781 C5 a key login has no disk', SN, "if(row.kind!=='disk')return Promise.reject(Error('key login has no disk'));", '=1'],
  ['T-1781 C5 the snapshot command', CL, "{type:'login.snapshot',name:args[0]!}", '=1'],
  ['T-1781 the provider send check', PV, 'authorize', '>=1'],
  // T-1803 (bounded scheduling, no snapshot of an unsettled binding)
  ['T-1803 C1 a change names the changed login', LG, 'onChange(listener:(name:string)=>void):()=>void', '=1'],
  ['T-1803 C1 the scheduler rearms only that login', SN, 'this.unsubscribe=options.logins.onChange(name=>this.schedule(name));', '=1'],
  ['T-1803 C1 a save notifies by name', LG, "private save(row: Login): void { this.db.prepare('update logins set record=? where name=?').run(JSON.stringify(row),row.name); this.changed(row.name); }", '=1'],
  ['T-1803 C2 the unsettled-binding index', LG, "db.exec('create index if not exists login_bindings_pending on login_bindings(login,phase)');", '=1'],
  ['T-1803 C2 unsettled-binding detection is an existence query', LG,
   "return this.db.prepare(\"select 1 from login_bindings where login=? and phase='pending' limit 1\").get(name)!==undefined;", '=1'],
  ['T-1803 C2 the deferred reason', SN,
   "outcome='login snapshot deferred: pending binding'", '=1'],
  // T-1778 (binding a login at launch)
  ['T-1778 C1 the mount path from the full harness id', BI, 'export const loginMount = (login: Pick<Login,\'harness\'|\'name\'>): string => `/cland/auth/${login.harness}-${login.name}`;', '=1'],
  ['T-1778 C1 the harness home variable at the mount', BI, "return login.harness==='opencode' ? {OPENCODE_DB:mountedOpenCodeDatabase(path)} : login.harness==='codex' ? {CODEX_HOME:path} : {CLAUDE_CONFIG_DIR:path};", '=1'],
  ['T-1778 C1 an unsettled writer binding before any attach', BI,
   "this.records.bind(login.name,{host:input.host.name,role:'writer',volumeId:volume.id,phase:'pending'});", '=1'],
  ['T-1778 C1 settled after the mount', BI, 'this.records.settleBinding(login.name,input.host.name);', '=1'],
  ['T-1778 C2 a held binding is reused without attach (reshaped by T-1780)', BI, 'return {finish:async()=>({login:login.name,account:login.account,accountEnv:loginEnvironment(login)}),rollback:async()=>{}};', '=1'],
  ['T-1778 C4 five stray auth variables removed on the remote side', CE, "for (const key of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','OPENAI_API_KEY','CODEX_API_KEY','CODEX_ACCESS_TOKEN']) delete env[key];", '=1'],
  ['T-1778 C4 the process row persists the login', 'hub/src/adapters/processes.ts', "for (const column of ['account', 'account_env', 'login'])", '=1'],
  ['T-1778 C5 a failed bind unmounts and detaches before ready (reshaped by T-1780)', BI, "if(mountAttempted)await mountHost.loginDisk!({op:'umount',volume:volume.name,path:loginMount(login)});", '=1'],
  ['T-1778 C5 the failure names the login (reshaped by T-1780)', BI, 'if(mountAttempted)throw Error(`login ${login.name}: bind failed`);', '=1'],
  ['T-1778 no eligible login refuses naming harness and pool', BI, 'throw Error(`no login ${input.harness} in pool ${input.pool}`);', '=1'],
  ['T-1778 indexed launch selection', LG, 'selectForLaunch(input:{host:string;harness:string;provider:string;region:string;account:string|null})', '=1'],
  // T-1779 (release at host stop, the kept volume)
  ['T-1779 C1 unmount then confirmed detach before unbinding', RL, "await host.loginDisk({op:'umount',volume:volume.name,path:loginMount(login)});\n   if((await provider.detachVolume(volume,machine)).state!=='detached')throw Error('login detach unconfirmed');\n   records.logins.unbind(login.name,id);", '=1'],
  ['T-1779 C1 release precedes machine release in destroy', PH, 'const finishLogins=record.machine?await releaseHostLogins({records:o.records,id:record.id,root:o.root,provider,machine:record.machine,lost:o.lost===true,clock:o.clock??realClock}):async()=>{};', '=1'],
  ['T-1779 C3 every disk releases in parallel', RL, 'const results=await Promise.allSettled(disks.map(async({binding,login})=>{', '=1'],
  ['T-1779 C5 a lost host skips unmount', RL, 'if(lost)return;', '=1'],
  ['T-1779 C5 a lost host frees only a detached volume', RL, 'if(!volume||volume.attachedTo!==null){incomplete=true;report(login.name,true);continue;}', '=1'],
  ['T-1779 C5 health loss reaches the lost release', HH, 'return destroyHost({...o,lost:true});', '=1'],
  ['T-1779 C5 the detached retry is bounded at 1 s to 30 s', RO, 'export const LOGIN_RELEASE_RETRY_MAX_MS=30000;', '=1'],
  ['T-1779 C6 a refused release emits a notice once per host and login', RL, "if(seen?.has(key)&&!seen.has(key+':destroyed')){seen.add(key+':destroyed');", '=1'],
  ['T-1779 unsettled bindings are never released', RL, "const bindings=records.logins.forHost(id).filter(binding=>binding.phase!=='pending');", '=1'],
  ['T-1779 optional synchronous reachability on the Host', HT, 'loginDiskReachable?(): boolean;', '=1'],
  ['T-1779 the ssh Host reports reachability from existing state', SH, 'loginDiskReachable:()=>', '=1'],
  ['T-1779 concurrent destroy callers join one operation', PH, 'const current=work.get(o.id);if(current)return current;', '=1'],
  // T-1780 (logins attached while a new host provisions; VERIFIED at its reviewed head 678733ec5)
  ['T-1780 C1 the binder prepares (select, bind, attach) before any mount', BI, '\n prepare(input:BindingInput):Promise<PreparedLogin> {', '=1'],
  ['T-1780 C1 the mount runs later, on the answering Host', BI, "await host.loginDisk({op:'mount',volume:volume.name,path:loginMount(login)});", '=1'],
  ['T-1780 C1 preparation starts when the row enters connecting', PH, "record.state='connecting';o.records.provisions.save(record);\n  loginWork=o.onConnecting?.(record,signal);", '=1'],
  ['T-1780 C1 ready joins every mount after the agent answers', PH, 'await o.owner.ready(record.id,signal);\n  signal?.throwIfAborted();\n  await loginWork?.ready();', '=1'],
  ['T-1780 C1 no native mount while the agent is not connected', SS, "host:{name:record.id,loginDisk:async()=>{throw Error('agent not connected');}},machine,", '=1'],
  ['T-1780 C3 a boot failure rolls back the prepared logins', PH, 'await loginWork?.failed().catch(()=>{});', '=1'],
  ['T-1780 C3 failure fences new work synchronously', SS, 'failed=true; // Fence unadmitted work synchronously, before joining any read.', '=1'],
  ['T-1780 C4 one disk per waiting harness', SS, 'if(seen.has(d.harness))return false;', '=1'],
  ['T-1780 the pool runtime passes its demand reader to creation', 'hub/src/host/pool-runtime.ts', '}),()=>this.#demand?.(name)??[])).then(async result => {', '=1'],
  ['T-1780 the dispatcher threads demand into pool creation', DI, 'sessions.startPoolScaling((pool,authorize,demand) => this.#createPoolHost(pool,authorize,demand), {', '=1'],
  ['T-1780 only demand creation installs the hook', DI, '...(demand?{onConnecting:(record,signal)=>this.#sessions!.provisionLogins(record,demand(),signal)}:{})', '=1'],
];
for (const [label, file, text, e] of C) {
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  const pass = t !== null && (e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1)));
  console.log(`${pass ? 'ok' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
JS
node --check "$Q/src.mjs" && echo "src checked"
# ids.mjs <brief>: A-17843 — every E1535S2-NN the criteria map names exists as a row of the case or manual tables; the open landing markers
cat > "$Q/ids.mjs" <<'JS'
import { readFileSync } from 'node:fs';
const t = readFileSync(process.argv[2], 'utf8'), map = t.slice(t.indexOf('### Criteria map'), t.indexOf('## Build'));
const named = new Set(map.match(/E1535S2-\d+/g) ?? []), rows = new Set([...t.matchAll(/^\| (E1535S2-\d+) \|/gm)].map(m => m[1]));
const missing = [...named].filter(id => !rows.has(id)), marker = 'TODO(' + 'T-1780-landing)';
console.log(`criteria-map ids ${named.size}; table rows ${rows.size}; missing from the tables: ${missing.length}${missing.length ? ' ' + missing.join(' ') : ''}`);
console.log(`open landing markers: ${t.split(marker).length - 1}`);
JS
node --check "$Q/ids.mjs" && echo "ids checked"
```

The check functions for QA's own shell, and this brief's scratch functions (`body.sh` sources `helpers.sh` and `scratch.sh`):

```sh
cat > "$Q/checks.sh" <<'SH'
landing() { git -C "$W" log --first-parent --format=%H --grep "^Item: $1\$" "$S"; }
BASE=c22755e3f72005075621de32483af42810457a19   # the tracker commit before the stage's first landing (the parent of T-1782's landing)
MEMBERS="T-1782 T-1777 T-1783 T-1781 T-1778 T-1803 T-1779 T-1780"
STAGE="disk logins across hosts - sign-in, bind, release, snapshots, DigitalOcean volumes and the key store"
WROTE=acd4e3aafebec085e8d6e3dac126feccc86e39c7   # the dev this brief was written at (T-1779's landing)
# addonly <commit>: hub/test/durations.json at <commit> keeps every earlier budget, files, tests and allow entry unchanged (add-only)
addonly() { git -C "$W" show "$1^:hub/test/durations.json" > "$Q/dur-a.json"; git -C "$W" show "$1:hub/test/durations.json" > "$Q/dur-b.json"
  node -e 'const fs=require("fs"),[a,b]=process.argv.slice(1).map(f=>JSON.parse(fs.readFileSync(f,"utf8"))),eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);let changed=0,added=0;for(const m of ["budget","files","tests","allow"]){const x=a[m]??{},y=b[m]??{};for(const k of Object.keys(x))if(!(k in y)||!eq(x[k],y[k]))changed++;added+=Object.keys(y).filter(k=>!(k in x)).length}console.log("existing duration entries changed or removed "+changed+"; added "+added+"; version same "+(a.version===b.version))' "$Q/dur-a.json" "$Q/dur-b.json"; }
# preserved: consumer test files no stage landing may edit (VERIFIED unedited from BASE to acd4e3aaf)
preserved() { printf '%s\n' hub/test/host-provider-fake.test.ts hub/test/host-provider-digitalocean.test.ts hub/test/host-provider-digitalocean-prepare.test.ts hub/test/executor-prepare-component.test.ts hub/test/executor-snapshot-confirmation.test.ts hub/test/cli-help.test.ts hub/test/cli-command-help.test.ts hub/test/cli-usage-compatibility.test.ts hub/test/cli-usage.test.ts hub/test/web-authority.test.ts hub/test/web-authority-unit.test.ts hub/test/host-agent.test.ts hub/test/host-local-contract.test.ts hub/test/host-watchdog.test.ts hub/test/cland-auth.test.ts hub/test/host-agent-closure.test.ts hub/test/host-agent-boundary.test.ts hub/test/cli-imports.test.ts hub/test/host-unreachable.test.ts; }
# ownlines <landing> <tip>: the member's own changed lines at its landing equal its tip's against their merge base (A-17643)
ownlines() { local L=$1 H=$2 MB F; MB=$(git -C "$W" merge-base "$H" "$L^1"); F=$(git -C "$W" diff --name-only "$L^1" "$L" | grep -v '^\.cland/')
  git -C "$W" diff "$MB" "$H" -- $F | grep -E '^[+-]' | grep -v -E '^(\+\+\+|---) ' | sort > "$Q/own-$H.txt"
  git -C "$W" diff "$L^1" "$L" -- $F | grep -E '^[+-]' | grep -v -E '^(\+\+\+|---) ' | sort > "$Q/land-$L.txt"
  cmp -s "$Q/own-$H.txt" "$Q/land-$L.txt" && echo yes || echo "no: $(diff "$Q/own-$H.txt" "$Q/land-$L.txt" | grep -c '^[<>]') lines differ"; }
s00() {   # build, plan and landing receipts
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-before.txt"; echo "root non-tracker entries $(wc -l < "$EV/root-status-before.txt" | tr -d ' ')"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1535 --json) > "$EV/plan.json"; echo "plan read exit $?"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name===process.argv[2]);console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}):"stage missing")' "$EV/plan.json" "$STAGE" | tee "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"; done
}
s01() { node "$Q/fresh.mjs" "$W" plain node --version; node "$Q/fresh.mjs" "$W" plain npm run typecheck > "$EV/typecheck.log" 2>&1; echo "typecheck exit $?"; echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"; }
s02() {   # landing diffs (read-only), the stage-wide invariants, the landing check and the later commits
  for id in $MEMBERS; do L=$(landing "$id" | head -n 1); echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id test paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/test nvim/test web/test | tr '\n' ' ')"
    echo "$id product paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/src hub/bin shared nvim/lua web/src | tr '\n' ' ')"
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json hub/package.json web/package.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "stage paths under nvim/ or web/: [$(git -C "$W" diff --name-only "$BASE" "$S" -- nvim web | tr '\n' ' ')]"
  echo "remote authority table changed in the stage: [$(git -C "$W" diff --name-only "$BASE" "$S" -- hub/src/remote/authority.ts | tr '\n' ' ')]"
  echo "fixture producers changed since 7c0320829: [$(git -C "$W" diff --name-only 7c0320829 "$S" -- nvim/test/stub-hub.ts nvim/test/client.ts nvim/test/fixture.ts shared/fixture-ownership.ts | tr '\n' ' ')]"
  L=$(landing T-1803 | head -n 1); echo "T-1803 removed lines in login-snapshots and login-records: $( [ -n "$L" ] && git -C "$W" diff "${L}^1" "$L" -- hub/test/login-snapshots.test.ts hub/test/login-records.test.ts | grep -c -E '^-[^-]')"
  for pair in "T-1782 da45c36b07cc0e905404b6324a321f734efe0c05" "T-1777 00f767bc96c8ca76e27115b2e9c2d438e60c5362" "T-1783 5689ab7cfd7f6f46ff0ca661071980734a259ebe" "T-1781 e82955b062a3ad409869889e1dd9c51d7d2d0416" "T-1778 1cba8d79c7b4136f4f91b7650a4f0c9fb0efe993" "T-1803 73df80b3f3c4afbcd9501d0b1421bf0a0cbbbe90" "T-1779 c74c0e7c8bdbac65ac04b84a0960c2e542312bac" "T-1780 ${T1780_TIP:-678733ec59f841f49f5b10d5b7b7be9b24894887}"; do set -- $pair; id=$1; head=$2; L=$(landing "$id" | head -n 1)
    [ -n "$L" ] && git -C "$W" cat-file -e "$head^{commit}" 2> /dev/null || { echo "$id landing ${L:-none} tip $head: BLOCKED (no landing or no tip)"; continue; }
    F=$(git -C "$W" diff --name-only "$L^1" "$L" | grep -v '^\.cland/' | tr '\n' ' ')
    echo "$id own lines at its landing $L equal its tip $head: $(ownlines "$L" "$head")"
    echo "$id files byte-identical to $head at its landing: $(git -C "$W" diff --quiet "$head" "$L" -- $F && echo yes || echo "no: $(git -C "$W" diff --name-only "$head" "$L" -- $F | tr '\n' ' ')")"
    echo "$id commits after its landing touching its files: [$(git -C "$W" log --format=%h "$L..$S" -- $F | tr '\n' ' ')]"; done
  echo "writing dev is an ancestor of the request: $(git -C "$W" merge-base --is-ancestor "$WROTE" "$S" && echo yes || echo no)"
  echo "later dev commits after acd4e3aaf: $(git -C "$W" rev-list --first-parent --count "$WROTE..$S")"
  for c in $(git -C "$W" rev-list --first-parent --reverse "$WROTE..$S"); do
    echo "  later $(git -C "$W" rev-parse --short=9 "$c") items [$(git -C "$W" log -1 --format=%B "$c" | grep -E '^Item: ' | tr '\n' ' ')] paths [$(git -C "$W" diff --name-only "$c^1" "$c" | tr '\n' ' ')]"
    git -C "$W" log -1 --format=%B "$c" | grep -q -E '^Item: ' || { git -C "$W" diff --name-only "$c^1" "$c" | grep -q -x hub/test/durations.json && echo "    $(addonly "$c")"; }; done
  echo "T-1780 landings $(landing T-1780 | wc -l | tr -d ' ')"
}
s05() {   # tree-wide absence checks at the build (read-only git)
  echo "retired DigitalOcean refusal outside the historical stage-1 brief: $(git -C "$W" grep -n -E 'acquisition is test-only|(get|list|delete)Snapshot unsupported|fromSnapshot unsupported' "$S" -- . ':!qa/briefs/E-1535-stage-1.md' ':!qa/briefs/E-1535-stage-2.md' | wc -l | tr -d ' ')"
  echo "stage-1 brief historical boundary paragraphs: $(git -C "$W" show "${S}:qa/briefs/E-1535-stage-1.md" | grep -c 'Historical build boundary (T-1782 migration)')"
  echo "logout commands in production source: $(git -C "$W" grep -n -E 'codex[[:space:]]+logout|claude[[:space:]]+auth[[:space:]]+logout|/logout' "$S" -- hub/src shared | wc -l | tr -d ' ')"
  echo "managed ignore names auth: $(git -C "$W" show "${S}:hub/src/project.ts" | grep -c -x -F 'auth/')"
}
s99() {   # end check with $Q and $T still present (cleanup order)
  echo "POST HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-after.txt"; echo "root non-tracker status unchanged: $(cmp -s "$EV/root-status-before.txt" "$EV/root-status-after.txt" && echo yes || echo no)"
  echo "preservation lock present: $([ -e /tmp/cland-preserve.lock ] && echo "yes: $(cat /tmp/cland-preserve.lock/owner 2> /dev/null)" || echo no)"
  echo "own-family new entries across all rows: $(cat "$EV"/*.inventory-delta.txt | awk -F': ' '/^own-family new entries in all files: /{s+=$2} END{print s+0}')"
  echo "other new entries across all rows: $(cat "$EV"/*.inventory-delta.txt | awk -F': ' '/^other new entries in all files: /{s+=$2} END{print s+0}')"
  echo "new fixture-owner receipts naming the source worktree or repository: $(cat "$EV"/*.receipts.txt 2> /dev/null | grep -c 'T-1805 class')"
  echo "slot overruns: $(grep -l -F 'std: slot limit' "$EV"/*.log 2> /dev/null | wc -l | tr -d ' ')"
  echo "T entries other than node-compile-cache: $(ls -A "$T" | grep -v -c -x node-compile-cache)"
  for e in $(ls -A "$T" | grep -v -x node-compile-cache); do echo "  T: $e type $(stat -f %HT "$T/$e") open $(lsof -t "$T/$e" 2> /dev/null | wc -l | tr -d ' ')"; done
  F=$(ls "$EV"/*.inv/1.before.st 2> /dev/null | head -n 1)
  for p in hc- sf- cland-ssh cland-suite- cland-fixture-owners- cland-h-; do echo "historical $p: TMPDIR first $(grep -c "^$p" "$F" 2> /dev/null) now $(ls -A "$ST" | grep -c "^$p"); /private/tmp first $(grep -c "^$p" "${F%.st}.tmp" 2> /dev/null) now $(ls -A /private/tmp | grep -c "^$p")"; done
  echo "fixture-owner receipts in the TMPDIR: $(ls -A "$ST/cland-fixture-owners-$(id -u)" 2> /dev/null | wc -l | tr -d ' ')"
}
SH
cat > "$Q/scratch.sh" <<'SH'
# this stage's scratch rows; cland, hp, hubstart, up, alive, run, has, there and dg come from the kit's helpers.sh
SENT=E1535S2-sentinel-key-0001     # fixture strings, never a real key
SENT2=E1535S2-sentinel-key-0002
# sentinels <name>: occurrences of a sentinel's bytes in every regular file under .cland (counts only; no content printed)
sentinels() { node -e 'const fs=require("fs"),p=require("path"),n=Buffer.from(process.argv[1]);let files=0,hits=0;const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())walk(f);else if(e.isFile()){files++;const b=fs.readFileSync(f);let i=-1;while((i=b.indexOf(n,i+1))>=0)hits++}}};walk(".cland");console.log("  files scanned "+files+"; sentinel occurrences "+hits)' "$1"; }
r80() {   # p1: a Git repository, cland init, then one CLI-started hub
  echo "PRE p1 entries $(ls -A "$QA_Q/p1" | wc -l | tr -d ' ')"
  cd "$QA_Q/p1" || return 1
  git init -q -b dev && git commit -q --allow-empty -m init; echo "git exit $?"
  cland init . > "$QA_EV/E1535S2-80-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  hubstart; echo "hub start exit $?; hub $(up)"
  echo "auth directory before any key login: $(there .cland/auth)"
}
r81() {   # T-1783 C1, C3, C4, C6: two key logins from stdin on the real CLI
  cd "$QA_Q/p1" || return 1
  printf '%s\n' "$SENT" > "$QA_Q/sent.in"; printf '%s\n' "$SENT2" > "$QA_Q/sent2.in"
  run "(key add 1)" cland login add opencode --kind key < "$QA_Q/sent.in"; echo "  added lines $(has 'added key login opencode-1')"
  echo "  key file $(there .cland/auth/opencode-1.key); store file $(there .cland/secrets.toml)"
  D1=$(dg .cland/secrets.toml)
  run "(key add 2)" cland login add opencode --kind key --name keytwo < "$QA_Q/sent2.in"; echo "  added lines $(has 'added key login keytwo')"
  echo "  store key reused (secrets file unchanged by the second key login): $([ "$D1" = "$(dg .cland/secrets.toml)" ] && echo yes || echo no)"
  for s in "$SENT" "$SENT2"; do sentinels "$s"; done
  node --input-type=module -e 'const {readLoginKey}=await import(process.env.QA_W+"/hub/src/host/login-keys.ts");const {projectTag}=await import(process.env.QA_W+"/hub/src/executor/droplet/droplet.ts");const {readProjectConfig}=await import(process.env.QA_W+"/hub/src/init/config.ts");const r=process.cwd(),c=readProjectConfig(r+"/.cland/config.toml",r,()=>{},process.env);console.log("  opencode-1 decrypts to its sentinel "+(readLoginKey(r,projectTag(r,c.name),"opencode-1")===process.argv[1]))' "$SENT"
  git check-ignore -q .cland/auth/opencode-1.key; echo "  git ignores the key file: exit $?"
  run "(login list json)" cland login list --json; cp "$QA_Q/r.out" "$QA_Q/logins-before.json"
  node -e 'let v;try{v=JSON.parse(require("fs").readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  json rows: not JSON");process.exit(0)}const has=(r,k)=>Object.hasOwn(r,k)?JSON.stringify(r[k]):"absent";for(const r of v)console.log("  json row "+r.name+": harness "+r.harness+"; kind "+r.kind+"; state "+r.state+"; account "+r.account+"; volumeId "+has(r,"volumeId")+"; snapshotIds "+has(r,"snapshotIds")+"; exclusive "+has(r,"exclusive")+"; bindings "+(r.bindings??[]).length)'
}
r82() {   # T-1783 C5 and T-1781 C5 on the real CLI: refusals, with no sentinel echoed
  cd "$QA_Q/p1" || return 1
  run "(key as an argument)" cland login add opencode --kind key "$SENT"; echo "  stdin guidance lines $(has 'key values are read from stdin, never arguments'); sentinel lines $(has "$SENT")"
  run "(Claude Code key)" cland login add claude-code --kind key < "$QA_Q/sent.in"; echo "  OpenCode-only lines $(has 'key logins support OpenCode only in 0.4.x'); sentinel lines $(has "$SENT")"
  run "(snapshot of a key login)" cland login snapshot opencode-1; echo "  no-disk lines $(has 'key login has no disk')"
  run "(login list after refusals)" cland login list --json
  node -e 'const fs=require("fs");let a,b;try{a=JSON.parse(fs.readFileSync(process.env.QA_Q+"/logins-before.json","utf8"));b=JSON.parse(fs.readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  rows: not JSON");process.exit(0)}let same=true;try{require("assert").deepStrictEqual(b,a)}catch{same=false}console.log("  rows unchanged by the refusals "+same)'
  echo "  key files $(ls -A .cland/auth | grep -c '\.key$')"
}
r83() {   # T-1783 C2 across a real restart: [auth] starts the hub, secret list shows only the fingerprint, rows retained
  cd "$QA_Q/p1" || return 1
  P1=$(hp); cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"
  hubstart; echo "hub start exit $?; hub $(up); new hub pid $([ "$(hp)" != "$P1" ] && echo yes || echo no)"
  run "(secret list)" cland secret list; echo "  auth.key lines $(has 'auth.key')"
  node --input-type=module -e 'const fs=await import("node:fs");const {readSecretsFile}=await import(process.env.QA_W+"/hub/src/remote/secrets.ts");const k=readSecretsFile(process.cwd())["auth.key"];const t=["r.out","r.err"].map(f=>{try{return fs.readFileSync(process.env.QA_Q+"/"+f,"utf8")}catch{return ""}}).join("\n");console.log("  store key present "+(typeof k==="string"&&k.length>0)+"; store key value occurrences in the listing "+(k?t.split(k).length-1:"n/a"))'
  run "(login list json after restart)" cland login list --json
  node -e 'const fs=require("fs");let a,b;try{a=JSON.parse(fs.readFileSync(process.env.QA_Q+"/logins-before.json","utf8"));b=JSON.parse(fs.readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  rows: not JSON");process.exit(0)}let same=true;try{require("assert").deepStrictEqual(b,a)}catch{same=false}console.log("  rows unchanged across the restart "+same)'
  for s in "$SENT" "$SENT2"; do sentinels "$s"; done
}
r89() {   # the scratch census: hub stopped, every recorded pid gone, no process naming the scratch root
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub stop exit $?; hub $(up)"
  for p in $(sort -u "$QA_Q/pids"); do echo "  pid $p alive $(alive "$p")"; done
  ps -axo pid=,ppid=,command= | grep -F "$QA_Q" | grep -v -E 'fresh\.mjs|body\.sh|grep -F' > "$QA_Q/census.txt"
  echo "  processes naming the scratch root: $(wc -l < "$QA_Q/census.txt" | tr -d ' ')"; sed 's/^/  census: /' "$QA_Q/census.txt" | cut -c1-200
  ps -axo pid=,ppid=,command= | grep -F "$QA_W" | grep -v -E 'fresh\.mjs|body\.sh|std\.mjs|grep -F' > "$QA_Q/census-w.txt"
  echo "  processes naming the worktree: $(wc -l < "$QA_Q/census-w.txt" | tr -d ' ')"; sed 's/^/  census-w: /' "$QA_Q/census-w.txt" | cut -c1-200
}
SH
. "$Q/checks.sh"; bash -n "$Q/scratch.sh" && echo "scratch checked"
```

Expected: `expect checked`, `src checked`, `ids checked`, `scratch checked`. Record the setup in `S0`. `T1780_TIP` defaults to T-1780's reviewed head `678733ec5` (`678733ec59f841f49f5b10d5b7b7be9b24894887`, VERIFIED: the commit `rev-35-1780-final-1` cleared); set it in QA's own shell before E1535S2-02 only if the request names another tip.

**Cleanup, in this order (carried).** Step 1, after E1535S2-89 passes: inventory each dead T-1676 residue entry in `$T` (hub and spoke fallback sockets, a fixture-owner receipt directory) with its type, receipt count, owner PIDs (absent), open handles (`lsof`, none) and recorded fixture roots (gone), attribute it to its row by the per-file inventories and remove it by its literal path. If any inventory shows a new own-family name, step 1 removes nothing and step 3 keeps `$Q`, `$T` and the worktree for the requester. **Nothing in `$ST` or `/private/tmp` outside `$Q` and `$T` is removed, ever** (the T-1805 receipt included). Step 2: run and record E1535S2-99 with `$Q` and `$T` still present. Step 3, after the verdict: print `$Q` and check it begins with `/private/tmp/q53-`, then remove it by that literal path with a non-force recursive remove; print `$T`, check it begins with `/private/tmp/qa-e1533-s3-` and holds nothing but `node-compile-cache`, and remove it by that literal path; remove the worktree with `git -C "$R" worktree remove "$W"` (its `node_modules` symlink first, by literal path, if Git refuses). Secrets in `$Q/p1/.cland/hub.json`, `$Q/p1/.cland/secret`, `$Q/p1/.cland/secrets.toml` and `$Q/p1/.cland/auth/` are never printed or posted.

## Cases

Every case is one or more named test files run once at the build, from QA's own shell through `nt` (sealed, `TMPDIR=$T`) or `ns` (standard environment, one preservation slot per file), recorded with `qa-record.sh note` (surface `hub-api`), its evidence `$EV/<id>.log`, `$EV/<id>.check.txt`, `$EV/<id>.inv/` (the name sets), `$EV/<id>.inventory-delta.txt` and, for `ns`, `$EV/<id>.slots.txt` and `$EV/<id>.receipts.txt`. A case passes only when every check line reads `CLEAN` (exit 0; `fail`, `cancelled`, `skipped` and `todo` 0; `pass` equal to `tests`; every listed name `ok`; for an `exact` list, the plan equal to the list and no unlisted name) and its delta reads `own-family new entries in all files: 0`. A missing file is a FAIL naming the file. A `fresh: BLOCKED` or `std: BLOCKED` line makes the row BLOCKED; a `std: slot limit` line makes it INCONCLUSIVE. Run in table order; never two files at once. Tiers are read from `hub/test/tiers.json` at `acd4e3aaf` (VERIFIED). Own-family patterns are VERIFIED from each file's allocation calls (`tempProject(t,'hc-','/tmp')` in `hub/test/host-create-fixture.ts`; `mkdtemp(join(tmpdir(),'<prefix>'))` in the files named; `ct-<32 hex>` aliases in `/private/tmp` from `shared/fixture-sockets.ts`), except where a row says INFERRED.

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1535S2-10 | hub-api | QA | `nt E1535S2-10 hub/test/login-records.test.ts hub/test/login-list.test.ts hub/test/login-signin.test.ts hub/test/login-host-pin.test.ts hub/test/login-add-component.test.ts` | Each `CLEAN` with its exact list (T1, T2, T1, T2, T2; in-memory SQLite, injected Host and provider seams, `projectHub` with FakeClock; no native process). `login-records` 20 (T-1803 adds the change-notification case; the ten refused transitions and six binding invariants unchanged); `login-list` 2 (edited for the additive row and frame shape); `login-signin` 5 (exact sign-in commands, the production-source logout scan, both failed-terminal expansions, the creating-isolation case); `login-host-pin` 12 (host pinned before sign-in and released after confirmed cleanup on `0`, `1` and `null`; name admission before host work; lease renewal while pinned; five revalidation boundaries); `login-add-component` 5 (only the admitted connection completes; preparation failure; attempt-all dispatcher shutdown). `$T` deltas: no new entry (INFERRED; any new entry is recorded) |
| E1535S2-11 | hub-api | QA | `nt E1535S2-11 hub/test/cli-usage-compatibility.test.ts hub/test/cli-help.test.ts hub/test/cli-command-help.test.ts hub/test/cli-usage.test.ts hub/test/web-authority.test.ts hub/test/web-authority-unit.test.ts hub/test/accounts-policy.test.ts hub/test/until.test.ts` | Each `CLEAN` (T1, T2, T1, T1, T2, T1, T1, T1). The first six are unedited (VERIFIED, `preserved`) and hold the frozen `LOGIN_USAGE` row (`hub/test/fixtures/cli-usage/commands.json`, migrated by the login-add, key-store and snapshot landings, with the binding landing's session usage) and the web edge's table (`login.add`, `login.snapshot` refused). `accounts-policy` exact 4 (the one permitted `mountedOpenCodeDatabase` constructor); `until` exact 1 (`waitTimeoutMs` keeps every earlier scaling) |
| E1535S2-12 | hub-api | QA | `nt E1535S2-12 hub/test/host-provider-fake.test.ts hub/test/host-provider-digitalocean.test.ts hub/test/host-provider-digitalocean-prepare.test.ts hub/test/executor-prepare-component.test.ts hub/test/executor-snapshot-confirmation.test.ts` | Each `CLEAN` (T2 each; all unedited, VERIFIED): the importers of T-1782's `digitalocean.ts`, `provider.ts`, `hub/src/executor/droplet/api.ts` (snapshot type gains `resource_id`, `regions`; three new endpoints and their pacing classes) and `deadline.ts`, and of T-1781's `fake.ts`. `host-provider-digitalocean` keeps its 80 registrations; the T-1770 signature is the only rerun (see "Known flakes for this stage") |
| E1535S2-20 | hub-api | QA | `nt E1535S2-20 hub/test/login-keys.test.ts hub/test/secrets.test.ts hub/test/secrets-resolution.test.ts` | Each `CLEAN` (T2, T2, T1). `login-keys` exact 6: an independent AES-256-GCM decode of the sentinel with project and name as associated data, store-key reuse and tamper refusal naming the login (C1, C3, C5); symlinked directory and file refusal, create-only (C6); serialized writers; plaintext registered with the redactor before the row, invalid ciphertext leaves no row (C4); store-key rotation refused while a retained key login lost its file; the real CLI over stdin into `projectHub` with frame, argv, log, journal and database scans and a positive control, the argument refusal, one-byte corruption, Git check-ignore, the denied preflight writing nothing, and `opencode-2` after a disk row named `opencode-1` (C1 to C6). `secrets` exact 7 with the two `[auth]` cases (C2); `secrets-resolution` (edited: `auth` has no environment override) |
| E1535S2-30 | hub-api | QA | `nt E1535S2-30 hub/test/login-snapshots.test.ts hub/test/login-snapshot-cli.test.ts` | Each `CLEAN` with its exact list (T2 each; directory-backed fake provider, FakeClock, scratch SQLite; no native process). `login-snapshots` 27: T-1803's five (bounded save work across 10,000 logins with decode, query and plan controls; bounded binding-row work with 1,000 readers; the deferral case with its persisted reason and no freeze or provider effect; a future daily deadline kept by a settled bind; and the final send-boundary refusal) and T-1781's 22, unchanged (C1 to C6 of T-1781 as the criteria map names them). `login-snapshot-cli` 1: the real CLI confirms a ready disk backup, a store read sees one id, the key refusal names its absent disk, help lists the syntax |
| E1535S2-40 | hub-api | QA | `nt E1535S2-40 hub/test/login-binding.test.ts hub/test/login-selection.test.ts hub/test/fixture-store.test.ts` | Each `CLEAN` with its exact list (T2 each). `login-binding` 32 (plan 32; one nested subtest): C1 to C6 of T-1778 as the criteria map names them, the unknown-outcome fence, held-close joins for list, attach and mount to settled and unknown receipts, provider and region mismatch refusals, the account-limit refusal before native effects, the host-execution mapping and the explicit empty account. A slow but positive binding close is T-1801 (recorded, not failed). T-1780 reshapes `LoginBinder.bind` into `prepare` then `finish` without editing this file (VERIFIED), so these 32 cases are the launch path's preservation over it. `login-selection` 2: zero history decodes and indexed plans across 10,000 synthetic logins; the stage-one schema migration with a planted index failure rolled back. `fixture-store` 2: setup Store drains a held producer before closing on success and rejection |
| E1535S2-41 | hub-api | QA | `nt E1535S2-41 hub/test/pool-scale.test.ts hub/test/host-status.test.ts hub/test/waiting-launch.test.ts hub/test/waiting-launch-restart.test.ts hub/test/pool-failures.test.ts hub/test/session-pool-placement.test.ts` | Each `CLEAN` (T2 each). T-1778's fixture migrations: each provided or injected pool host seeds a settled disk binding through `settledLogin` before ready publication, so placement, status, waiting and failure assertions and bounds are unchanged (A-18341 found seven failures in `host-status` and `pool-scale` before that migration). Unchanged local launches here are the C6 consumers. `pool-scale`, `waiting-launch` and `waiting-launch-restart` also run T-1780's demand reader through `PoolRuntime.start` and `Sessions.startPoolScaling` (VERIFIED: none of these files changed in T-1780; the dispatcher passes `onConnecting` to an injected creator too when demand exists, and an injected creator that never calls it binds nothing at creation (INFERRED for these files' creators, not read one by one); the reviewer's Linux run at `678733ec5` passed every T2 file, A-18462) |
| E1535S2-45 | hub-api | QA | `nt E1535S2-45 hub/test/login-provision-bind.test.ts` | `CLEAN` with its exact list (T2 in `tiers.json`, VERIFIED at `678733ec5`; `projectHub` with an injected create checkpoint, the directory-only fake provider, a recording Host and FakeClock; no native process). 19 top-level, `# tests` 22 (the `with login` and `without demand` subtests of the hub-clock case and one forced-setup scope; VERIFIED). T-1780 C1: the cold-launch case (attachment inventory, the unsettled binding, one mount, the fake adapter's spawn receipt) and the mount-receipt case (held mount: still connecting, no spawn; release: settled binding, then spawn); C2: the hub-clock case (both ready receipts at 1000 ms); C3: both boot-failure expansions (original volume id, detached inventory), both fence expansions (`failure`, `abort`: zero attaches after the failure, then the durable destroyed checkpoint), both cancelled-wait expansions; C4: the two-harness case (Codex and Claude Code). The review regressions: missing login, selected account limit and unknown attachment each keep a healthy ready host; role removal and a changed role account release the captured disk; the delay owner and the late-timer case join every admitted attachment before hub shutdown. No other T1/T2 test file changed in T-1780 (VERIFIED). `$T` delta: no new entry (INFERRED; its fixture uses `tempProject`, which registers the root at allocation, VERIFIED) |
| E1535S2-50 | hub-api | QA | `nt E1535S2-50 hub/test/login-release.test.ts` | `CLEAN` with its exact list (T2; directory-backed fake provider, recording Host, Store, FakeClock; one nested subtest). 24 cases: C1, C3, C5 and C6 of T-1779 as the criteria map names them, plus the snapshot thaw refusal, no release owner without logins, concurrent stop callers joining one release, ordered teardown on a forced body failure, and atomic fake inventory reads |
| E1535S2-51 | hub-api | QA | `nt E1535S2-51 hub/test/host-contract-coverage.test.ts hub/test/host-agent-closure.test.ts hub/test/host-agent-boundary.test.ts` | Each `CLEAN` (T1 each). `host-contract-coverage` exact 9 with T-1779's `optional login-disk reachability preserves absent Hosts and exact boolean observations`; `host-agent-closure` and `host-agent-boundary` (unedited) hold `hub/src/host/agent/closure.json`, regenerated by T-1777 (`fake-login-mount.ts`), T-1778 (`command-environment.ts`) and T-1779 (`fake-volume-contents.ts`), and the agent import policy over the edited agent modules |
| E1535S2-55 | hub-api | QA | `nt E1535S2-55 hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Each `CLEAN` (T1). Every new test file of the stage has its per-file note under `docs/agents/tests/`, its index row and its tier (`login-add`, `login-terminal`, `login-write-back` T3; `login-add-component`, `login-host-pin`, `login-keys`, `login-snapshots`, `login-snapshot-cli`, `login-binding`, `login-selection`, `fixture-store`, `login-release` T2; `login-signin`, `until` T1; VERIFIED in `hub/test/tiers.json`), and the provisioning-bind file `hub/test/login-provision-bind.test.ts` (T2; its per-file note under `docs/agents/tests/` and its row in `docs/agents/tests/index.md`, VERIFIED at `678733ec5`) |
| E1535S2-60 | hub-api | QA | `ns E1535S2-60 '^hc-' hub/test/login-add.test.ts` | `CLEAN` with its exact list (T3; a CLI-started hub, pinned fake SSH and the existing fake binaries; no real provider or harness). One case: host creation and reuse, Codex's file-store config, 1 GiB region-matched volumes, one snapshot per success, last sign-in, detached ready rows, creating isolation, signed-out disconnect cleanup, no completion from another connection, no logout in the fake calls, synthetic disk tokens absent from metadata, output and logs (T-1777 C1 to C6, T-1781 C1). **Inventory:** `own-family new entries in all files: 0` (its note: `hc-*` in `/tmp` back to zero after the native writers, hub and watchdog owners join). **T-1805:** `$EV/E1535S2-60.receipts.txt` may list one new receipt with `roots naming the source worktree or repository 1 (T-1805 class)`; record its file name, roots count and the absence of every listed `hc-` root, leave it untouched; it is a finding aside, never a FAIL |
| E1535S2-61 | hub-api | QA | `ns E1535S2-61 '^login-term-' hub/test/login-terminal.test.ts` | `CLEAN` with its exact list (T3; a real CLI against a Unix stub hub and a scratch SSH executable). Both expansions: native birth captured before the interruption, CLI close observed, the final ESRCH for the exact SSH PID; cancellation reports a null exit only after native exit (T-1777 C4). Inventory own-family 0 |
| E1535S2-62 | hub-api | QA | `ns E1535S2-62 '^fs-' hub/test/fake-ssh.test.ts` (alone) | `CLEAN` with its exact list (T3; plan 15, one nested subtest). The three `terminal <harness> sign-in stays inside the authenticated fake machine` expansions (generation 0 written under the fake machine, the token absent from the output; T-1777 C1, C2, C6); unknown `/cland/auth/` commands refused before execution; a harness planted on `PATH` never receives sign-in; the transport subset unchanged. Inventory own-family 0. A `ct-` alias new after it is recorded (`alias`) and reported |
| E1535S2-63 | hub-api | QA | `ns E1535S2-63 "$OWN63" hub/test/host-login-disk.test.ts hub/test/cland-auth.test.ts` | Each `CLEAN` with its exact list (T3 each, two slots). `host-login-disk` 14: T-1777's two new cases (login file publication and every filesystem operation through the attached fake mount with logical paths; T-1777 C1) and the twelve stage-1 cases unchanged, including the two disk-user tree expansions (T-1779 C4). `cland-auth` 10, unedited in this stage (VERIFIED). **Inventory:** own-family 0 for both, `ct-` aliases included (T-1799's assertion; a new `ld*`, `ct-` or `cland-auth-script-` name is a FAIL) |
| E1535S2-64 | hub-api | QA | `ns E1535S2-64 '^lwb-' hub/test/login-write-back.test.ts` | `CLEAN` with its exact list (T3; two native agent sockets, the directory provider, the fake Codex binary). Host A signs in and completes two turns (generation 2); an agent-owned writer and an outside process; the shared destroy boundary closes the writer with its native completion receipt while the outside process lives; host B binds the same volume and completes generation 3; three host/generation entries and the same volume id; a second disk with both unmounts outstanding through the real ssh Host before any detach (T-1779 C2, C3, C4). **Inventory:** own-family 0 (its note: no newly retained `lwb-` roots) |
| E1535S2-65 | hub-api | QA | `ns E1535S2-65 '^hc-' hub/test/host-create-ready.test.ts` | `CLEAN` with its exact list (T3; plan 11, one nested subtest). The created OpenCode case binds `fixture-opencode` through the native fake provider and `Host.loginDisk`, checks the host-local mount link and the persisted `OPENCODE_DB` path, then stops and joins its writers (T-1778 C1); the rest unchanged. The C3 mismatched-prelude case is T-1797's fixed case: a timeout there is a regression finding. Inventory own-family 0 (`hc-` in `/tmp`). T-1780 edits neither this file nor `hub/test/host-create-fixture.ts` (VERIFIED), but its `createHost.onConnecting` checkpoint and the demand reader run under the `T-1746 waiting pool launch …` case; this file, `host-destroy-native`, `host-restart` and `login-write-back` are T-1780's native preservation set (12, 3, 1 and 1 passing at `678733ec5`, A-18459). New `cland-h-*` entries in `/private/tmp` after this file are T-1806 (impl-1780 saw ten), recorded, never failed |
| E1535S2-66 | hub-api | QA | `ns E1535S2-66 '^hc-' hub/test/host-destroy-native.test.ts hub/test/host-restart.test.ts` | Each `CLEAN` with its exact list (T3 each, two slots). Each launched fake host starts with `mountedSettledLogin` (an attached, mounted OpenCode volume recorded as settled); the destroy and restart assertions and bounds are unchanged, and the added disk assertions observe ready only after a detached inventory (T-1779 C1, C5; T-1778's fixture). Inventory own-family 0 |
| E1535S2-67 | hub-api | QA | `ns E1535S2-67 '^cland-proj-' hub/test/host-unreachable.test.ts hub/test/host-stop.test.ts` | Each `CLEAN` with its exact list (T2 each in `tiers.json`, VERIFIED; run here in the standard environment and in its own slots as the requester grouped them). `host-unreachable` 20, unedited (the 15-minute and gone paths into the confirmed deletion owner; T-1779 C5). `host-stop` 4: both `C3 stop joins lease renewal and requires confirmed destroy` expansions with an allocated, attached directory-provider volume and a recording `loginDisk` Host, so stop proves unmount and detach before the scripted machine and key deletion (T-1779 C1). Inventory own-family 0 (`cland-proj-` is `tempProject`'s default prefix, VERIFIED for `host-stop`; INFERRED for `host-unreachable`) |
| E1535S2-68 | hub-api | QA | `ns E1535S2-68 '^hp-vol-' hub/test/host-provider-volumes.test.ts hub/test/host-provider-digitalocean-volumes.test.ts` | Each `CLEAN` with its exact list (T2 each in `tiers.json`, VERIFIED; the provider-volume contract files, grouped with the native rows by the requester). `host-provider-volumes` 15: the six `fake: …` registrar cases (`hostProviderVolumeContract('fake', …, true)`) and nine direct cases, without the removed stage-1 control `digitalocean new snapshot operations refuse without API calls` (T-1782 C5). `host-provider-digitalocean-volumes` 17: the six `digitalocean: …` registrar cases (T-1782 C4, with T-1772's snapshot-history case and T-1781's refused-authorization case) and eleven direct cases (T-1782 C1 to C3, T-1781 C4's actual-POST recheck). Inventory own-family 0 (`hp-vol-` VERIFIED for the fake file; the DigitalOcean fixture's prefix INFERRED) |
| E1535S2-69 | hub-api | QA | `ns E1535S2-69 '^$' hub/test/host-relaunch.test.ts hub/test/host-watchdog.test.ts` | Each `CLEAN` (T3 each, two slots). `host-relaunch` (edited by T-1778): the two hosts are pool members with explicit settled disk metadata, source `codex-f1` and destination `codex-f2`, account `work`, destination-only `CODEX_HOME` in the spawn and the persisted row, and the no-login destination case refused with zero spawns (T-1778 C3). `host-watchdog` (unedited) is in T-1778's required native set. No own family is claimed (INFERRED); every new name is recorded |
| E1535S2-70 | hub-api | QA | `ns E1535S2-70 '^$' hub/test/host-ssh-contract.test.ts` (alone) | `CLEAN` (T3, its own slot, never beside another file: T-1731). Edited by T-1778 (the raw positive control uses neutral `EXPLICIT`, four planted credential negatives on both paths) and reached by T-1779's `hostContract` and `Host.loginDiskReachable`. The T-1731 signature is the only rerun |
| E1535S2-71 | hub-api | QA | `ns E1535S2-71 "$OWN71" hub/test/host-local-contract.test.ts hub/test/host-agent.test.ts` | Each `CLEAN` (T3 each, two slots; both unedited, VERIFIED). `host-local-contract` registers the `hostContract` cases, which T-1779 extended; `host-agent` covers the agent server over T-1777's and T-1778's `operations.ts`, `prepared.ts`, `processes.ts` and `server.ts` edits. Own families: `agent-*` from `host-agent`'s `mkdtemp` calls and `host-…-` from `hub/test/host-contract.ts` (VERIFIED) |
| E1535S2-72 | hub-api | QA | `ns E1535S2-72 '^$' hub/test/cli-imports.test.ts` | `CLEAN` (T3, its slot; unedited). `hub/src/cli/login.ts` now imports `login-terminal.ts` and `login-key.ts`; the command closures stay within their import budgets (INFERRED relevance: no stage member edited the test) |
| E1535S2-73 | hub-api | QA | `ns E1535S2-73 '^pg-' hub/test/host-provision-gate.test.ts` | `CLEAN` (T3, its slot; unedited, VERIFIED). It imports `createHost` from `hub/src/host/provision-host.ts`, which T-1780 edits (the `onConnecting` checkpoint, the ready join and the failure rollback; VERIFIED at `678733ec5`): the boot deadlines, cancellation authority and confirmed deletion hold with no hook installed (manual and minimum creation bind no login). Own family `pg-` in `/tmp` (VERIFIED in its source). T-1780 adds no T3 file (VERIFIED) |

### Web cases (when in scope)

None. No stage path is under `web/` (VERIFIED); the wire additions (`login` on session views, `login.add`, `login.signed-in` and `login.snapshot` frames) are additive and optional, and the typecheck (E1535S2-01) covers the web workspace against them.

## Manual checks

Run in table order: E1535S2-00 to E1535S2-05 before the cases, E1535S2-80 to E1535S2-89 after them, then cleanup step 1, then E1535S2-99. Scratch rows depend on the state the rows before them leave; a row whose prerequisite failed is BLOCKED, naming it. Record each with `sh .agents/skills/qa/qa-record.sh note E-1535 "$RUN" <id> hub-api "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence file>` from `$W`. Every scratch row's evidence begins with the kit's `PRE gate` line and ends with `# fresh: redacted or withheld lines 0` and `row exit 0`; a gate refusal is BLOCKED.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1535S2-00 | hub-api | QA | `s00 > "$EV/E1535S2-00.txt" 2>&1` | PRE line: HEAD, dev and request the same 40 hex; `dirty entries 0`; root non-tracker count recorded. `plan read exit 0`; the stage line: exact name, `qa` `{"scope":"affected","when":"after-stage"}`, `items` T-1777, T-1781, T-1778, T-1779, T-1780, T-1803, T-1782, T-1783 plus any finding fixes the request names, `merged` equal to `total`, `state` not `closed`. Every member `landings 1`; anything else is BLOCKED. The receipts, VERIFIED at `acd4e3aaf`: `T-1782 landings 1 d725dd47f…`, `T-1777 landings 1 e6fbbd906…`, `T-1783 landings 1 a6d28fd1e…`, `T-1781 landings 1 0e4ab826c…`, `T-1778 landings 1 93727d257…`, `T-1803 landings 1 63954d9c8…`, `T-1779 landings 1 acd4e3aaf…`; `T-1780 landings 1 ee21cb146…` and the stage read `merged 8`, `total 8`, `statuses {"done":8}` (full 40-hex SHAs in the evidence) |
| E1535S2-01 | hub-api | QA | `s01 > "$EV/E1535S2-01.txt" 2>&1` | Node 24; `typecheck exit 0` (the integrated build: every member's `dispatch.ts`, `protocol.ts`, `shared/wire/index.ts` and `logins.ts` edits together, the web workspace over the additive wire fields, its colour and contrast checks); `dirty entries 0` |
| E1535S2-02 | hub-api | QA | `s02 > "$EV/E1535S2-02.txt" 2>&1` (`T1780_TIP` defaults to `678733ec5`) | Every landing `package.json and lockfiles: 0` and `preserved files edited at its landing: []`; `stage paths under nvim/ or web/: []`; `remote authority table changed in the stage: []`; `fixture producers changed since 7c0320829: []`; `T-1803 removed lines in login-snapshots and login-records: 0` (T-1803 C3). **Landing check** (VERIFIED at `acd4e3aaf`): every member `own lines … equal its tip …: yes`; `files byte-identical …: yes` for every member except `T-1777 … no: hub/test/durations.json` (T-1782's `d725dd47f` removed two orphan baselines first; named in "How this brief applies them"); later commits touching its files: `T-1782 [93727d257 0e4ab826c e6fbbd906]` (T-1778 and T-1777: `hub/test/durations.json`; T-1781: the provider, API, test and doc files), `T-1777 [acd4e3aaf 63954d9c8 93727d257 0e4ab826c a6d28fd1e]` (shared docs, `logins.ts`, `dispatch.ts`, `closure.json`, usage fixture, tiers; T-1781 also `login-signin.ts`, `cli/login.ts`, `login-list.test.ts`), `T-1783 [acd4e3aaf 63954d9c8 93727d257 0e4ab826c]` (shared docs, `dispatch.ts`, `cli/login.ts`, usage fixture, tiers), `T-1781 [acd4e3aaf 63954d9c8 93727d257]` (`login-snapshots.ts`, `logins.ts`, shared docs; T-1803 also `login-snapshots.test.ts`), `T-1778 [acd4e3aaf 63954d9c8]` (`logins.ts`, `closure.json`, `login-selection.test.ts`, shared docs; T-1779 also the destroy, restart and stop tests), `T-1803 [acd4e3aaf]` (`login-snapshots.ts`, `logins.ts`, `login-selection.test.ts`, docs), `T-1779 []` at writing. T-1780's head `678733ec5` touches files of T-1777 (`dispatch.ts`, `pool-runtime.ts`, shared docs, tiers, the implement skill), T-1778 (`login-binding.ts`, `sessions.ts`, shared docs), T-1779 (`provision-host.ts`, `dispatch.ts`, shared docs) and, through `docs/hub/logins.md`, `hub/README.md`, `docs/agents/tests/index.md` and `hub/test/tiers.json`, every other member except T-1782 (VERIFIED by file list; T-1782's files are not among them). `T-1780 own lines at its landing ee21cb146 equal its tip 678733ec5…: yes`, `files byte-identical … : yes` (VERIFIED by the Coordinator at landing), `T-1780 … later commits: [ ]` apart from accepted coordinator and tracker commits. With T-1780 landed, `ee21cb146` is prepended to the later-commit list of every member above except T-1782: `T-1777 [ee21cb146 acd4e3aaf …]`, `T-1783 [ee21cb146 …]`, `T-1781 [ee21cb146 …]`, `T-1778 [ee21cb146 …]`, `T-1803 [ee21cb146 acd4e3aaf]`, `T-1779 [ee21cb146]`. Any list differing beyond that, other than by accepted coordinator or tracker commits, is a finding. **Later dev commits:** `writing dev is an ancestor of the request: yes`. Each `later` line after `acd4e3aaf` must be one of: (a) T-1780's landing, `items [Item: T-1780 ]` exactly once, with `T-1780 landings 1`; (b) a coordinator commit, `items []`, with paths only `hub/test/durations.json` and files under `qa/briefs/`, its durations line reading `existing duration entries changed or removed 0` and `version same true` (add-only); (c) a tracker commit, `items []`, with paths only under `.cland/`. Any other later commit, a second `Item: T-1780` or a durations line with a changed or removed entry makes the run BLOCKED: keep the evidence and report it to the requester |
| E1535S2-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1535S2-03.txt" 2>&1` | Every line `ok`: 81 lines (VERIFIED at T-1780's reviewed head `678733ec5`; at `acd4e3aaf` 67 `ok`, the three reshaped T-1778 lines and T-1780's eleven `MISMATCH`, VERIFIED). T-1780 (the binder's `prepare`, the later mount on the answering Host, preparation at `connecting`, the ready join after the agent answers, no mount while the agent is not connected, the boot-failure rollback and its synchronous fence, one disk per harness, the pool runtime's demand reader, the dispatcher's demand thread and its demand-only hook). T-1782 (the restore POST with `snapshot_id`, region and tags; the retained source region; the snapshot list and confirmed delete in the API; the incomplete deletion; the admission refusal and its type; no test-only or unsupported stub), T-1777 (both sign-in commands, the file-store config, the mount path, 1 GiB in the pool region, ready or signed-out at completion, host creation, cleanup before signed-out, the creating row reserved first, the `ssh` plan, the CLI-owned terminal, no logout literal), T-1783 (AES-256-GCM, create-only 0600, `auth.key` in `SECRET_NAMES`, the store key written once, metadata only to the hub, the login-only decrypt refusal, stdin guidance, symlink refusal, `auth/` ignored, decrypt and register before the row), T-1781 (keep two, confirmed pruning, 24 h, freeze, thaw in `finally`, retry time, key has no disk, the `login.snapshot` frame, the send check), T-1803 (name-carrying change notifications, per-login rearm, the existence index and query, the deferred reason), T-1778 (the mount path and home variables, the unsettled writer binding before attach, settled after mount, reuse without attach, the five stray variables, the process-row column, rollback and its named failure, the no-login refusal, indexed selection), T-1779 (unmount then confirmed detach then unbind, release before machine release, parallel release, the lost path's skipped unmount and detached-only freeing, health loss, the bounded retry, the once-only notices, unsettled bindings never released, optional reachability on the Host and on the ssh Host, joined destroy callers). A `MISMATCH` on a settled line is read at the build (a renamed string is followed); it is a FAIL unless the landing changed it with a recorded decision |
| E1535S2-04 | hub-api | QA | `node "$Q/ids.mjs" "$W/qa/briefs/E-1535-stage-2.md" > "$EV/E1535S2-04.txt" 2>&1` | `missing from the tables: 0` (A-17843) and `open landing markers: 0` (only the T-1780 landing marker is counted); a non-zero count is BLOCKED (the brief was not completed at T-1780's landing). Also read by hand: each map row cites tests that row's command runs |
| E1535S2-05 | hub-api | QA | `s05 > "$EV/E1535S2-05.txt" 2>&1` | `retired DigitalOcean refusal outside the historical stage-1 brief: 0` (T-1782 C5; VERIFIED 0 at `acd4e3aaf`); `stage-1 brief historical boundary paragraphs: 1` (VERIFIED); `logout commands in production source: 0` (T-1777 C7; VERIFIED 0 over `hub/src` and `shared`); `managed ignore names auth: 1` (T-1783 C6; VERIFIED: `auth/` is one exact line of `hub/src/project.ts`) |
| E1535S2-80 | hub-api | Human | `mrow E1535S2-80 r80` | **Setup.** `PRE p1 entries 0`; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `hub start exit 0; hub up`; `auth directory before any key login: absent` (INFERRED). A failure makes E1535S2-81 to E1535S2-83 BLOCKED |
| E1535S2-81 | hub-api | Human | `mrow E1535S2-81 r81` | **T-1783 C1, C3, C4, C6 on the real CLI.** `(key add 1) exit 0` with `added lines 1`; `key file present; store file present`; `(key add 2) exit 0` with `added lines 1`; `store key reused (secrets file unchanged by the second key login): yes`; both sentinels `sentinel occurrences 0` under `.cland` (no plaintext in the key files, `hub.db`, logs or journal); `opencode-1 decrypts to its sentinel true`; `git ignores the key file: exit 0`; `(login list json) exit 0` with `json row keytwo` and `json row opencode-1`, each `harness opencode; kind key; state ready; account <its name>; volumeId absent; snapshotIds absent; exclusive absent; bindings 0`. INFERRED: the exact output strings come from `hub/src/cli/login-key.ts` (`added key login <name>`) and `hub/src/cli/login.ts`, the decrypt call from `login-keys.ts`, `droplet.ts` and `init/config.ts` signatures, not from a run |
| E1535S2-82 | hub-api | Human | `mrow E1535S2-82 r82` | **T-1783 C5 and T-1781 C5 refusals.** `(key as an argument)` exit non-zero with `stdin guidance lines 1; sentinel lines 0`; `(Claude Code key)` exit non-zero with `OpenCode-only lines` at least 1 and `sentinel lines 0`; `(snapshot of a key login)` exit non-zero with `no-disk lines 1`; `rows unchanged by the refusals true`; `key files 2`. INFERRED: exit codes and refusal lines from the source strings, not from a run |
| E1535S2-83 | hub-api | Human | `mrow E1535S2-83 r83` | **T-1783 C2 across a real restart.** `hub after stop: down`; `hub start exit 0; hub up; new hub pid yes` (the hub starts with an `[auth]` section); `(secret list) exit 0` with `auth.key lines` at least 1; `store key present true; store key value occurrences in the listing 0` (fingerprint only); `rows unchanged across the restart true`; both sentinels `sentinel occurrences 0`. INFERRED: `cland secret list` prints one line per name with a fingerprint (its source and `secrets.test.ts`), not from a run |
| E1535S2-89 | hub-api | Human | `mrow E1535S2-89 r89` | `hub stop exit 0; hub down`; every recorded pid `alive no`; `processes naming the scratch root: 0`; `processes naming the worktree: 0` (no fake host, agent, harness, holder or hub from any row still runs; any line is a FINDING unless its command is unrelated, recorded; references to `$W` by another session's read-only command are not residue). Then cleanup step 1 |
| E1535S2-99 | hub-api | QA | `s99 > "$EV/E1535S2-99.txt" 2>&1` (after cleanup step 1, with `$Q` and `$T` present) | HEAD, dev and request still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock present: no`; `slot overruns: 0`. **Inventories:** `own-family new entries across all rows: 0` (any other value is a FAIL against the member whose landing edited the producing file, named from that row's delta file); `other new entries across all rows` recorded and attributed per row (shared-directory activity of other sessions, the carried classes); `new fixture-owner receipts naming the source worktree or repository`: 0 or 1, the T-1805 class from E1535S2-60, recorded aside; `T entries other than node-compile-cache 0` after cleanup step 1. **Historical residue (attributed, never failed):** the `historical …` lines give the first and final counts of `hc-`, `sf-`, `cland-ssh`, `cland-suite-`, `cland-fixture-owners-` and `cland-h-` (T-1806) in the system TMPDIR and `/private/tmp`; a rise is attributed through the per-file deltas, which name the file after which each new entry appeared. A finding: a live new entry, a new receipt with a live owner, a rise attributed to a stage-edited file outside its own families, residue from a changed producer outside the carried clause. A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1535-stage-2.md --commit <dev SHA>`, with a dev SHA that includes every stage landing. The brief is complete only when qa lint passes at the build and no T-1780 marker remains.

## Probes that mislead

- **Generated names cannot be certified by `qa lint`.** Loop and registrar titles (`refuses login transition from <current> to <target> naming current state`, `binding invariant: <scenario> …`, `failed terminal sign-in <code> …`, `terminal outcome <code> …`, `login admission refuses <name> …`, `sign-in revalidates captured host authority after <boundary>`, `login add <outcome> …`, `sign-in snapshot <outcome> …`, `ownership change after <boundary> await …`, `release during held provider I/O retains <…> thaw outcome`, `invalid <…> launch never binds a login`, `<fresh or native> same-host resume …`, `binding close joins held <stage> to its <outcome> receipt`, `settled binding with another <mismatch> …`, `setup Store joins a held producer before closing: rejected=<…>`, the `lost host retains <…>`, `health <…> reaches login release` and `held freeze on <…> host …` expansions, `terminal sign-in joins native SSH after <interruption>`, `terminal <harness> sign-in …`, `login-disk closes only disk users in <tree> trees`, `failed readiness releases only after positive settlement: <name>`, `held final readiness cannot publish ready after <action>`, `C1/C2/C3 destroy settles … tunnel down=<…>`, the `host-unreachable` parameterised cases, `C3 stop joins lease renewal and requires confirmed destroy: <…>`, and the `fake: …` and `digitalocean: …` registrar cases) are expanded in `expect.json` and checked by `tap.mjs` at the run.
- **The registrar flag decides the volume contract's size.** `hostProviderVolumeContract` adds its refused-authorization and snapshot-history cases only with `snapshotOperations = true`; at this build both providers pass it (VERIFIED), unlike the recorded stage-1 build.
- **A filtered nested loop.** `login-records` registers only the transitions outside the table (`continue` on allowed pairs); the full current × target product overstates the plan.
- **Nested subtests are not top-level names.** `hub/test/login-binding.test.ts` reports one more test than its plan because of one nested subtest; `tap.mjs` counts the plan, derived at the build.
- **Two environments are two kinds of evidence.** A sealed row's `$T` delta and a native row's `$ST` and `/private/tmp` deltas are different directories. A native row's new non-own name in a shared directory may be another session's; attribute it, do not fail it.
- **Pre-existing is not new.** The system TMPDIR already holds `ld*`, `ldt-*`, `hc-*` and other roots from earlier runs (the drafting census, INFERRED counts). Only after-minus-before names count against a file.
- **An inventory taken while a file runs proves nothing (A-18182).** `snaps` and `snapt` run only after the file's `exit` line.
- **A clean TAP is not root removal (A-18182).** Process teardown and root removal are separate evidence; the deltas prove removal.
- **The T-1805 receipt is not a cleanup instruction.** Its `roots` list names the live worktree; QA never removes, rewrites or acts on it, and never removes anything a receipt names.
- **Seeded and sentinel values are fixtures.** `E1535S2-sentinel-key-0001` and `-0002` are fixture strings; the scratch store key in `$Q/p1/.cland/secrets.toml` is a scratch value, compared in memory and never printed. A scanner withholding a sentinel line is INCONCLUSIVE (A-18029's rule), never a reason to print it.
- **The local Host's refusal code is `wrong-volume`** (T-1776's choice for a Host without login disks), and `loginDiskReachable` absent means previous behaviour, not unreachable.
- **Plain `node --test` is not the suite runner.** It enforces no duration allowance and no resource tripwire preload: a slow pass is not a finding (T-1801's slow close included) and a fast one proves no budget.
- Process cleanup probes use the fixture-owned pid census (`$Q/pids`) and the scratch-root and worktree censuses; a machine-wide `pgrep` counts other sessions too.
- File-change probes use isolation and digests; mtime alone is confounded by live sessions rewriting the same file.
- Speed criteria use measured wall times, never projections (T-1780 C2 is a hub-clock equality in its test, not a wall-time claim).
- "No skip" names platform-only cases and where they are covered: the fake helper's Linux `/proc` census runs only on Linux covers.
- Re-check helper and function names with grep at the tested build; renames happen. The kits come from commit `K` and the corrections from commit `M2`; a different commit is a setup BLOCKED.

## Out of scope

- The real DigitalOcean API, droplets, volumes, snapshots, keys, tokens and any network.
- Real harness sign-in, browsers opened by a sign-in, real SSH and terminals; the capacity line, the login wait and its card, exclusive logins and keys at spawn (stage 3); signed out, signing in again, remove, reconciliation of unsettled bindings and the amendment (stage 4, T-1793).
- Real `sudo`, mounts, devices, `fsfreeze` and the privileged helper on a real host; the fake helper's Linux `/proc` path (Linux covers).
- Neovim and web consumers (no stage path under `nvim/` or `web/`, VERIFIED; T-1778's recording refresh found no wire change, A-18368 and A-18369; T-1804 is that refresh's open nondeterminism).
- Linux and container runs, the stage covers and the items' loaded repetitions: their evidence; this run is macOS only and says so.
- Duration allowances (`hub/test/durations.json`) as pass conditions.
- T-1731 and T-1770 as bugs (signatures only); T-1735, T-1732 and T-1797 (fixed; a recurrence is a regression finding); T-1801, T-1802, T-1804, T-1805, T-1806 and T-1676 as fixes (recorded if seen).
- Any `cland login …`, `cland secret …`, `cland config set`, `cland role launch`, `cland session …`, `cland hub …` or `cland host …` on the live project.

Missing authorization (a real provider token, a harness account, a GUI) is out of scope, not BLOCKED, because no case needs one.

## Grants

none. No grant is needed: every case runs on this Mac against fakes, the sealed rows with a disposable HOME and the native rows with fixture-sealed children, and no credential.

## Rows to verify after landing

**Every line here was settled at dev `acd4e3aafebec085e8d6e3dac126feccc86e39c7`, which includes seven of the eight landings, and T-1780's lines at its reviewed head `678733ec59f841f49f5b10d5b7b7be9b24894887`.** Before requesting QA, the coordinator re-reads each line below at the requested dev SHA, records each difference in the brief, and fills the three landing markers. E1535S2-02 names the acceptable later commits.

**Settled at `acd4e3aaf` (VERIFIED):**

- E1535S2-00: every member listed by `cland task plan show E-1535` at the build has `landings 1`; the plan's stage name, lanes and policy.
- E1535S2-02: the seven landing pairs (own lines equal; byte-identical except T-1777's named durations delta); the later-commit lists; `T-1803 removed lines …: 0`; the preserved list unedited; no `nvim/` or `web/` path; the remote authority table untouched.
- E1535S2-03: 70 source lines `ok` at `acd4e3aaf` (67 of them unchanged at `678733ec5`). E1535S2-05: the four tree counts.
- Every exact list in `expect.json` (29 files at `acd4e3aaf`), matched name by name against the source templates, and every tier named in the tables.
- The own-family patterns marked VERIFIED in the case rows.
- The stage-1 brief's carried sections at `M2` (127 lines, blob `dd84d5b9…`) and the T-1770 signature line.

**Settled at T-1780's reviewed head `678733ec5` (VERIFIED, read with `git show` and in its read-only worktree):**

- "Stage": its scope entry; the 13 files of `git diff --stat acd4e3aaf 678733ec5`; no existing test file changed.
- `expect.json`: `hub/test/login-provision-bind.test.ts`, its exact names matched against its templates; every other exact list re-derived there with no change.
- `src.mjs`: T-1780's eleven lines and the three T-1778 lines it reshaped, all `ok` there (81 in all).
- T-1780's case rows (`E1535S2-45`, `E1535S2-73`), its docs line in `E1535S2-55`, its note in `E1535S2-65`, its criteria-map rows and the review-regression row.
- `T1780_TIP` = `678733ec59f841f49f5b10d5b7b7be9b24894887` (`rev-35-1780-final-1`).

**Needs the landing commit (the three landing markers):**

- "Build": the landing SHA with its one `Item: T-1780` trailer, and the plan read `merged 8`, `total 8`, `statuses {"done":8}`.
- E1535S2-00: `T-1780 landings 1 <sha>` and the same plan read.
- E1535S2-02: the landing check against `T1780_TIP` and the landing SHA in each touched member's later-commit list. If the landing is not byte-identical to `678733ec5` (a merge with later dev), re-read `src.mjs`'s T-1780 and reshaped T-1778 lines and the `login-provision-bind` list at the landing too.

**Component-only, with the reason:**

- T-1782's DigitalOcean volume operations: no real API in QA; the scripted fake API in process is the boundary (E1535S2-68, E1535S2-12).
- T-1777's disk sign-in: a real terminal sign-in needs a real harness and host; the native fake-SSH CLI flow is the boundary (E1535S2-60 to E1535S2-62).
- T-1781's scheduled backups and T-1803's scheduling: hub-clock work in process with the fake provider (E1535S2-30); the CLI refusal of a key login is also on the scratch hub (E1535S2-82).
- T-1778's binding and T-1779's release: they need a pool host with an attached volume, which a scratch hub without a created host cannot provide; native fake-host files carry them (E1535S2-40, E1535S2-50, E1535S2-63 to E1535S2-70).
- T-1783's key store: both component (E1535S2-20) and on the scratch hub through the real CLI (E1535S2-81 to E1535S2-83).
- T-1780's provisioning attach: it needs a demand-created host, which a scratch hub without a pool image and created host cannot provide; the injected-checkpoint component file (E1535S2-45) and the native creation files (E1535S2-65, E1535S2-73) carry it.

**INFERRED, with the reason:**

- E1535S2-80 to E1535S2-83: exact output strings, exit codes and the decrypt helper's call, derived from source, not from a run.
- The publication scanner passing every stage title, fixture string and sentinel unwithheld.
- That no native file writes under the user's HOME (their notes and fixtures say children are sealed; only the root status, the censuses and the inventories are checked).
- Own families marked INFERRED (`host-unreachable`'s `cland-proj-`, the DigitalOcean volume fixture's prefix) and the rows that claim none (E1535S2-69, E1535S2-70, E1535S2-72).
- The historical residue counts (the requester's "about 86"; the drafting census in "Carried corrections").
- Each native file finishing within its 15-minute slot (the reviewers' local native receipts were well inside it; not timed by QA).

## Source provenance

VERIFIED = read in source, Git or the tracker at dev `acd4e3aafebec085e8d6e3dac126feccc86e39c7`; all re-read at the build if it is later.

- The kits: commit `K` = `f43f4e21049e9c62a97c8dec1ebf37f9c7035a62`: `qa/briefs/E-1532-stage-4.md` lines 133 to 136 and 228 to 279; `qa/briefs/E-1533-stage-3.md` heredocs `seal.mjs`, `fresh.mjs`, `frame.mjs`, `body.sh`, `helpers.sh`. The carried corrections: commit `M2` = `0d0618042fae7b76919d1be152e252b09e4a43ad`, `qa/briefs/E-1535-stage-1.md` (blob `dd84d5b93927798242c0bee78ddc3310145ecbf0`), sections `## Carried corrections` to `## Stage`; the stage-1 rerun report `.cland/artifacts/A-18243-e-1535-stage-1-qa-clear-at-353d17e3-rerun-after-t-1799/report.md`.
- The standard-environment decision: `.cland/artifacts/A-18377-t-1778-native-fixture-correction-seven-file-receipts-adverse-cleanup-and-conserv/README.md` and `.cland/artifacts/A-18378-t-1778-standard-context-suite-runner-comparison-at-1cba8d79c/`; the per-test notes of `login-add`, `login-terminal`, `login-write-back`, `host-login-disk`, `host-create-ready`, `host-destroy-native`, `host-restart`, `host-unreachable`, `host-stop`, `host-provider-volumes` and `host-provider-digitalocean-volumes` under `docs/agents/tests/`; T-1779's TMPDIR name-set receipt `.cland/artifacts/A-18439-t-1779-c74-full-tmpdir-before-after-inventory-delta.json`.
- T-1782 (`d725dd47f`, tip `da45c36b0`, 12 files): `hub/src/host/provider/digitalocean.ts`, `provider.ts`, `hub/src/executor/droplet/api.ts`, `deadline.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, the two provider-volume tests, `hub/test/durations.json` (two orphan baselines removed), docs `docs/hub/host-providers.md` and the two per-file notes, `qa/briefs/E-1535-stage-1.md` (historical boundary).
- T-1777 (`e6fbbd906`, tip `00f767bc9`, 52 files): `hub/src/cli/login.ts`, `login-terminal.ts`, `usage/login.ts`, `help.ts`; `hub/src/host/login-add.ts`, `login-signin.ts`, `logins.ts`, `pool-runtime.ts`; `hub/src/host/agent/fake-login-mount.ts` (new), `fake-login-disk.ts`, `operations.ts`, `prepared.ts`, `closure.json`; `hub/src/hub/dispatch.ts`, `daemon.ts`, `server.ts`, `web-authority.ts`; `hub/src/protocol.ts`, `shared/wire/index.ts`, `shared/fake-layout.ts`, `hub/src/accounts/registry.ts`; `hub/test/fakes/fake-ssh.ts`, `hub/test/harness.ts`; tests named in "Stage"; docs `docs/hub/logins.md`, `docs/agents/session-permissions.md` and eight per-file notes.
  - Its wait-helper part: `hub/test/until.ts` (`waitTimeoutMs`) and `hub/test/until.test.ts`.
- T-1783 (`a6d28fd1e`, tip `5689ab7cf`, 20 files): `hub/src/host/login-keys.ts`, `hub/src/cli/login-key.ts`, `login.ts`, `secret.ts`, `usage/login.ts`, `usage/secret.ts`, `hub/src/remote/secrets.ts`, `hub/src/project.ts`, `hub/src/hub/dispatch.ts`; `hub/test/login-keys.test.ts`, `secrets.test.ts`, `secrets-resolution.test.ts`, `secrets-fixture.ts`; docs `docs/hub/logins.md`, `docs/hub/project-secrets.md`.
- T-1781 (`0e4ab826c`, tip `e82955b06`, 33 files): `hub/src/host/login-snapshots.ts` (new), `logins.ts`, `login-signin.ts`, `provider/provider.ts`, `fake.ts`, `digitalocean.ts`, `hub/src/executor/droplet/api.ts`, `hub/src/cli/login.ts`, `dispatch.ts`, `web-authority.ts`, `protocol.ts`, `shared/wire/index.ts`; `hub/test/login-snapshots.test.ts`, `login-snapshot-cli.test.ts`, `host-provider-contract.ts`, the two provider-volume tests, `login-list.test.ts`; docs.
- T-1778 (`93727d257`, tip `1cba8d79c`, 50 files): `hub/src/host/login-binding.ts` (new), `logins.ts`, `hub/src/adapters/sessions.ts`, `processes.ts`, `contract.ts`, `hub/src/host/agent/command-environment.ts`, `operations.ts`, `processes.ts`, `server.ts`, `closure.json`, `hub/src/protocol.ts`, `shared/wire/index.ts`, `hub/src/cli/usage/session.ts`; `hub/test/settled-login-fixture.ts`, `fixture-store.ts`, `host-create-fixture.ts`; tests named in "Stage"; docs.
- T-1803 (`63954d9c8`, tip `73df80b3f`, 9 files): `hub/src/host/login-snapshots.ts`, `logins.ts`; `hub/test/login-snapshots.test.ts`, `login-records.test.ts`, `login-selection.test.ts`; docs.
- T-1779 (`acd4e3aaf`, tip `c74c0e7c8`, 30 files): `hub/src/host/login-release.ts`, `login-release-owner.ts` (new), `login-snapshots.ts`, `logins.ts`, `provision-host.ts`, `host-health.ts`, `host.ts`, `ssh-host.ts`, `hub/src/host/agent/fake-volume-contents.ts`, `closure.json`, `hub/src/hub/dispatch.ts`; `hub/test/login-release.test.ts`, `login-write-back.test.ts`, `host-contract.ts`, `host-contract-coverage.test.ts`, `host-destroy-native.test.ts`, `host-restart.test.ts`, `host-stop.test.ts`, `login-selection.test.ts`; docs.
- T-1780 (reviewed head `678733ec5`, branch `t/T-1780-logins-attached-while-a-new-host`, 13 files; open and ready at writing, its landing in "Build"): `hub/src/adapters/sessions.ts` (`provisionLogins`, the captured waiting admissions, `#diskAccountRequest`), `hub/src/host/login-binding.ts` (`prepare`, `PreparedLogin`, `ProvisionLoginDemand`, `ProvisionLoginWork`), `hub/src/host/pool-runtime.ts` (the demand reader), `hub/src/host/provision-host.ts` (`onConnecting`, the ready join, the failure rollback), `hub/src/hub/dispatch.ts`; `hub/test/login-provision-bind.test.ts` (T2, new), `hub/test/tiers.json`; docs `docs/hub/logins.md`, `hub/README.md`, its per-file note under `docs/agents/tests/`, `docs/agents/tests/index.md`, the implement skill and its change note. Review: `rev-35-1780-source-1` not clear at `e2c1263be` (four findings), `rev-35-1780-source-2` and `rev-35-1780-final-1` clear at `678733ec5`, C1 to C4 verified (A-18462); native preservation A-18459, its `cland-h-*` residue assigned to T-1806 (A-18460).
- Known non-blocking items, read in `.cland/tasks/` at writing: T-1801, T-1802, T-1804, T-1805, T-1806 (backlog, needs-triage), T-1676 (backlog).
- Plan: stage 2 `{"scope":"affected","when":"after-stage"}`, lanes [T-1777, T-1781], [T-1778, T-1779, T-1780, T-1803], [T-1782], [T-1783]; `open`, stage cover missing at writing.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "disk logins across hosts - sign-in, bind, release, snapshots, DigitalOcean volumes and the key store"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id and any earlier verdict's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1535 stage disk logins across hosts - sign-in, bind, release, snapshots, DigitalOcean volumes and the key store` or `qa not clear E-1535 stage disk logins across hosts - sign-in, bind, release, snapshots, DigitalOcean volumes and the key store` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.

## T-1780 landing markers

Filled by the Coordinator at T-1780's landing `ee21cb146` (2026-11-10); E1535S2-04 reads `open landing markers: 0`. The places were:

1. "Build", the landing receipt sentence: the landing SHA with its one `Item: T-1780` trailer, and the plan read `merged 8`, `total 8`, `statuses {"done":8}`.
2. E1535S2-00: the T-1780 receipt line and the same plan read.
3. E1535S2-02: T-1780's landing check against `T1780_TIP` (`678733ec5`), any byte difference named with its cause, and the landing SHA in each touched member's later-commit list. If the landing is not byte-identical to `678733ec5`, also re-read the T-1780 and reshaped T-1778 lines of `src.mjs` and the `login-provision-bind` list at the landing.


T-1784 current replay migration: the exact-name selectors above use
`no eligible login waits with harness before spawning` and
`missing login holds demand without creating a host`. Their stage-2 historical
identities were `no eligible login refuses with harness and pool before spawning`
and `missing login refuses the waiting launch while the healthy host stays ready`.
Published stage-2 receipts retain those historical source identities; they are
not evidence that the renamed capacity cases ran on a later head. Current pool
admission accepts durable login waits and prevents demand creation without the
matching login. The direct binder's independent refusal guard remains covered.
The two explicit/role account capacity cases are current replay additions and
were not part of the historical stage-2 receipt.
