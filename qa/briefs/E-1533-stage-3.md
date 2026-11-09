# Stage QA brief: E-1533 stage 3 — create to ready

> Historical build scope (T-1738): this completed epic's brief records the pre-pool-configuration build identified in its Build section and evidence. Its host-template counts and append-hosts snippets apply only to that historical build, not current dev. Current init writes one [hosts] table; edit that existing table, require provider on every pool, and specify slots for custom sizes such as fake/c-8. Current pool config coverage and after-stage QA use docs/agents/tests/hub-test-host-pools-config.test.ts.md and E-1534's stage brief. Do not replay this brief against a post-T-1738 build without migrating its setup and expectations.


Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers; always brace a variable before `:`). The run is local, on macOS (BSD `stat`, Node 24 with `node:sqlite`, `uuidgen`, `lsof`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, DigitalOcean API, key, credential, npm registry or network (R-1530's QA rule).** The named files use only their own fakes: the scripted fake DigitalOcean API of `hub/test/fakes/digitalocean/fake-api.ts` (loopback listener, synthetic credential, FakeClock) with its scripted machine, the fake `ssh`/`scp` stand-ins of `hub/test/fakes/` against fake hosts on this Mac, the directory-only fake host provider and a scripted offline `npm` stub. The scratch rows use the **fake provider only**: the scratch hub reaches fake hosts through `$Q/bin`, whose `ssh` and `scp` are links to the build's `hub/test/fakes/fake-ssh.ts` and `fake-scp.ts`, whose `npm` is an offline stub and whose `setsid` is the tests' shim; `ssh-keygen` is the system binary and only writes a local key file. A loopback listener inside a named file is a fake, not network. Never run `hub/bin/verify-provision.sh` or `hub/src/executor/droplet/provision.sh` on this Mac. **No real harness:** Claude Code, Codex and OpenCode run only as the build's fakes. No browser, no GUI, no Neovim.

The stage is library, CLI and test level. The run is meant to take about four hours: setup and E1533S3-00 to E1533S3-03 about 20 minutes (the typecheck included); the named files E1533S3-10 to E1533S3-47 about 170 minutes, one file at a time, the native T3 files under the preservation lock; scratch rows E1533S3-50 to E1533S3-62 about 45 minutes. Waits for cover-quiet admission, the preservation lock or load are not product results.

**Status at writing: T-1730, T-1719, T-1734 and T-1718 have landed on dev** (T-1730 `0e32c139d`, T-1719 `7d7aab2bc`, T-1734 `c049da468`, T-1718 `142fbe97d`); their files, titles and strings are VERIFIED at dev `142fbe97d`. **T-1720 was read at its queued head** `3c8880cc0be27026234a4504f63ecdc7a0226fa9` (branch `t/T-1720-cland-host-destroy`, in the merge queue); its files, titles and strings are VERIFIED-on-branch, and the "Landing check" under "Build" confirms them at the tested dev SHA. What is still INFERRED is listed under "Rows to verify after landing".

## Carried corrections

A reused kit block must be reconciled against the source brief's recorded run corrections. This brief builds on `qa/briefs/E-1533-stage-2.md` (its kit, seal and run decisions; blob `8b487eb00083f2b85fb2266bfa5f111005703b4b` at dev `efd68fbf0`), which itself carried `qa/briefs/E-1533-stage-1.md` and `qa/briefs/E-1532-stage-6.md`. What was carried, and how, is stated here; nothing below is optional.

### From `qa/briefs/E-1533-stage-2.md`, its verbatim copy of stage 1's "Corrections from this brief's own run (qa-678, A-17199)", verbatim

The stage-1 run at `5795362b` (run qa-s1-2026-11-06-qa678-1) applied two Coordinator-approved run-copy corrections. Both come from the E-1532 stage-6 run (A-17053), whose kit this brief reused by blob without its recorded corrections. A brief that copies this kit carries them as written here:

- **Seal every command fresh.** Build every files, typecheck and scratch command through a fresh shared-builder seal, with the hub overlay inside the builder and `login:false`. Never build them from a static `env.sh` or `env-hub.sh` snapshot (T-1705). Run the credential-name count as an immediate gate before each command; a non-zero count stops the row. Redact the stdout and stderr captures while they stream. Set `QA_SESSION` inside the builder, so recorder lines name the QA session and not the rescue default.
- **Known dead TMPDIR residue.** Inventory known residue from unchanged test files before the final census, and attribute it per file. At this build that is T-1676's spoke fallback sockets and `cland-fixture-owners-<uid>` receipts from `executor-droplet` (5+5) and `executor-prepare` (1+1). Check it dead (no `lsof` Unix entry, owner PIDs gone), then remove it by literal path after row 35, and repeat row 36. Live residue, or residue attributable to a stage item, stays a finding.

### From `qa/briefs/E-1533-stage-2.md`, "Decisions from this brief’s first run (qa-678, A-17342)", verbatim

- **T-1676 dead residue covers an unchanged producer inside a file the stage edited.** In E1533S2-35 a `cland-fixture-owners-<uid>` receipt came from the CLI-started-hub block of `claude-code-remote.test.ts`, which is byte-identical to the stage-1 build. That counts as T-1676 found aside, once QA has shown the residue is dead (PID absent, receipt not open, fixture root gone) and that the producing block’s SHA-256 is unchanged. Residue whose producing code the stage changed stays a finding.
- **E1533S2-50 found T-1733.** `cland config set` deletes the `[hosts.*]` tables, so the stage was not clear. The rerun after T-1733 lands uses this brief’s original row order, because the fix must make row 50 pass as written. T-1733 landed as `945b974cef3badd17e582c6d3f88f7c0b73fba30` (batch e4878d6a, A-17358). It adds a tenth stage member and changes `hub/src/init/config-set.ts`, `hub/src/init/config.ts` and the other config writers its sweep found. The rerun checks its landing receipt like the other members. The rerun (qa-s2-2026-11-07-qa678-2, A-17366, clear) added T-1733’s committed title `config set preserves SSH hosts and both pools before host prepare` (`hub/test/host-prepare.test.ts`) to host-prepare’s `expect.json` list as an expected-registration correction. A brief that copies this kit adds the new titles of every late-landing member to its lists.

### From `qa/briefs/E-1533-stage-2.md`, "Probes that mislead", the known-flake rule, verbatim

- **Known flakes by signature, not by guess.** `host-ssh-contract` runs alone because T-1731 (its test `accepted spawn reconciles its durable token after the commit reply is dropped` resolving with a raw `process-exited` event) showed only in a four-file mix. `transport-forwards` C1's two unattributed `MainThrea` loopback listeners are T-1732's open cause; T-1670 now attributes them. If either signature appears, keep the full output (for transport-forwards, the attribution lines: pid, sources, nativeStart, parent, command, raw rows), rerun the row once alone under the lock, and report both runs; the second result stands for the row and both are findings for the requester. Any other failure is judged as it stands.

**Added here, under the same exact-signature policy: T-1735.** `host-relaunch-native` (E1533S3-36) has one known pre-existing race: test `C2 production Codex relaunch crosses owned carriers and consumes a fresh native first input` failing with `Error: git -c gc.auto=0 add .: fatal: unable to stat '.fixture-sockets/<host>/home/.cland-host/run/processes.json.new': No such file or directory` (exit code 128, thrown from `hub/src/territory.ts`), because the fake host's home lies inside the tree the relaunch stages (T-1735, backlog; 5/5 differentials at `efd68fbf` and at T-1718's head `9a369e72`). Only that title failing with that exact text matches. Keep the full output, rerun the row once alone under the lock, report both runs; the second result stands for the row and both are findings for the requester. A different title, a different path in the message, or any other error is judged as it stands.

### How this brief applies them, and the reconciliation

- **Fresh seal (carried, both halves).** No `env.sh` or `env-hub.sh` exists in this run. Every named file, the typecheck and every scratch command runs through `fresh.mjs`, which builds its environment with `seal()` (the shared builder, `fixtureEnvironment` wrapped by `scratchGitEnvironment`) at the moment it starts. The QA roots, `QA_SESSION` and, for scratch rows, the hub overlay go **into** the builder; nothing is added after it returns. **Re-scoped for this stage:** the hub overlay grows by the fake transport and harness inputs a created host needs (`CLAND_SSH_BIN`, `CLAND_SCP_BIN`, `CLAND_OPENCODE_BIN`, `FAKE_OPENCODE_SOCKET`) and the seal's `front` gains `$Q/bin`; these are exactly the inputs `hub/test/host-create-ready.test.ts` gives its own hub (VERIFIED at dev `142fbe97d`; at T-1720's head the same fixture moves into `hub/test/host-create-fixture.ts`, VERIFIED-on-branch). `fresh.mjs` refuses to start (exit 2, `fresh: BLOCKED`) on any credential-prefix name, and `body.sh` repeats the count as an immediate gate before a scratch row's function runs. QA's own shell commands run through the harness exec with `login:false`.
- **Streaming redaction (carried).** `fresh.mjs` pipes stdout and stderr line by line: exact values of every credential-shaped variable of QA's own shell become `[redacted]`, and a line the build's publication scanner (`assertPublishable`, `.agents/skills/qa/qa-demo-policy.ts`) refuses is replaced by `# fresh: line withheld by the publication scan`. It ends with `# fresh: redacted or withheld lines <n>`.
- **`QA_SESSION` (carried).** As stage 2: exported in QA's shell, carried by `state.json` into the builder.
- **Known dead TMPDIR residue (carried, re-scoped).** The 5+5 and 1+1 counts are stage 1's; this run re-inventories them. `nt` snapshots `$T` after every file into `$EV/<id>.tmpdir.txt`, so each entry is attributed to the first file after which it appears. Before the final census (E1533S3-62), known T-1676 classes from unchanged files (hub/spoke fallback endpoints, `cland-run` Codex sockets, `cland-fixture-owners-<uid>` receipts, `cx-*.sock` placeholders) are checked dead and removed by literal path, then E1533S3-62 is repeated. Residue first seen after a file a stage-3 landing added or edited (E1533S3-02) stays a finding, **except** under the A-17342 unchanged-producer clause: `claude-code-remote.test.ts` and `host-agent-restart.test.ts` are edited by T-1730 (and `host-runtime-bundle.test.ts`, `host-prepare.test.ts` and `host-provider-fake.test.ts` by T-1719, T-1734 and T-1718), so residue from them counts as T-1676 only after QA shows it dead and the producing block's SHA-256 equal at `<dev SHA>` and at `efd68fbf099dde2366c93d88ad09b8af8287385f`. T-1730 edits `remoteClaudeFixture` (its `upgrade` option); a receipt produced inside that function is therefore a finding unless QA shows the producing statements outside the edited lines.
- **Expected-registration correction (carried, applied in advance).** `expect.json` below is read at dev `142fbe97d` for the four landed members (VERIFIED) and at T-1720's queued head `3c8880cc` (VERIFIED-on-branch). Before the case rows run, QA re-derives every list for a file a stage landing added or edited from that file at `<dev SHA>` and records each difference as an expected-registration correction in `$EV/expect-corrections.txt`; a title that proves a criterion and is missing at the build is a FAIL, never a correction. T-1720's files are additionally compared byte for byte with `3c8880cc` (the "Landing check"); a difference there is an expected-registration correction under this rule, never a silent pass.
- **Known-flake rule (carried verbatim, T-1735 added).** `host-ssh-contract` again runs alone (E1533S3-40). `transport-forwards` is not run by this brief (stage 2 owns T-1670; nothing in this stage touches it); its T-1732 clause applies only if a later request adds it.
- **From `qa/briefs/E-1532-stage-6.md`'s own-run corrections (A-17053), through stage 2:** the S0 PATH exemption is carried (exactly the running Node `bin` and the pinned Neovim directory, by realpath); manual shells sealed per command, carried as the fresh seal. **Host clone discovery files are designed secret holders — not carried as a check:** E1533S3-54 does make a host clone the territory, so the created host holds a clone and its discovery file, but no row scans for secret holders and no row prints any file under `$Q/fh`; a later row that scans would have to carry that correction in full.
- **Stage-2 rows superseded by this stage (not carried).** Stage 2's E1533S2-56 (a `digitalocean` pool's keyed prepare refused, `DigitalOcean pool image preparation unsupported`) and its `src.mjs` strings for that refusal and for the `host.prepare`-only dispatch text were product decisions T-1719 and T-1718 replace; E1533S3-03 asserts the old texts are gone. Running a `digitalocean` prepare in scratch is out of scope here (it would enter the executor builder; no token exists in the seal).

### Kit conventions carried from stages 1 and 2

- **Rule 22.** Every selector, test name and string below is marked VERIFIED, VERIFIED-on-branch or INFERRED; an INFERRED expectation is never a pass condition on its own. Ids (host ids, machine ids) are read back from `cland host list` and files, never from a create result.
- **TAP.** `node --test <file>` reports top-level registrations with `1..N` and `# tests/pass/fail/cancelled/skipped/todo` counters that include nested subtests; names escape `#` and `\`. `tap.mjs` parses exactly that.
- **Exact strings** are counted by `src.mjs` with `String.split`, never by shell `grep`.
- **Censuses** exclude the census process and all its ancestors and match only this run's `$Q`, `$W` and fixture-socket alias paths.
- **The preservation lock** is the directory `/tmp/cland-preserve.lock`, taken with `mkdir`, an owner file naming this run and row, and an owner-checked removal by literal path. A held lock makes the row BLOCKED for now (retry it later; never remove another owner's lock).

## Corrections from this brief's own run (qa-678, A-17467)

The stage-3 run at `093f851b` (run qa-s3-2026-11-07-qa678-1, clear) applied two Coordinator decisions and found one kit defect. A brief that copies this kit carries all three:

- **Cleanup order (ask 8483de13).** The cleanup paragraph under "Build" removes `$Q` and `$T` before E1533S3-62, but `s62` reads `$Q/alias.txt`, lists `$T` and is recorded through `$Q/fresh.mjs`. Run it in this order: after E1533S3-61 passes, remove the validated alias and the known dead T-1676 residue by literal path; run and record E1533S3-62 with `$Q` and `$T` still present; after the verdict, remove `$Q`, `$T` and the worktree by literal paths with the checks given.
- **E1533S3-56 is out of stage scope (decision 06c3f284).** `ports()` maps every loopback port to `session.sock`, but the fake OpenCode on a created host listens on TCP loopback (the capture: `opencode serve did not answer within 30000 ms: server listening on http://127.0.0.1:54101`). The scratch launch therefore cannot pass with this kit. T-1718 C1 is proven by E1533S3-20, including the native launch. The scratch launch moved to the E-1533 Definition-of-done demo. E1533S3-57's `oc row` line follows it under the same label; T-1720 C1's settlement is proven by E1533S3-43 and E1533S3-27.
- **`m56` shell defect.** `case "$r" in "host=$ID "*) …` inside a `$(…)` substitution gives `syntax error near unexpected token newline` (scratch.sh:54). Compute the match outside the substitution before reusing `m56`.

## Stage

- Epic: E-1533 (Host providers, images and DigitalOcean, under R-1530).
- Exact stage name: create to ready.
- Items, in plan order: lane 1 T-1719 (DigitalOcean pool images, and hosts created from them), then T-1734 (one pool-name grammar: config accepts `agents_1`, DigitalOcean acquire and key identity do not); lane 2 T-1718 (`cland host create` / `cland host list`, a host from create to ready on the fake provider), then T-1720 (`cland host destroy`); lane 3 T-1730 (a host's version handoff installs the whole runtime tree). The run reads membership, counts and state from `task plan show E-1533 --json` (E1533S3-00), never from this list. QA finding fixes added to this stage after writing are listed in the request; none at writing.
- Policy: full/after-stage.
- Scope: **full.** The stage's own behaviour end to end (its named files, the preservation files its items name, read-only source checks and scratch checks on the real CLI), and the epic's earlier stages' user-visible surfaces as a regression pass, one representative per surface: stage 1 (`provider interface, fake provider, hook and prelude`) by E1533S3-45 (provider interface and fake provider), E1533S3-46 (the `[verification] provision` hook in the key) and E1533S3-47 (the prelude); stage 2 (`DigitalOcean on a fake API, the recipe and pool images`) by E1533S3-11 (DigitalOcean on the fake API), E1533S3-18 (the recipe), E1533S3-19 and E1533S3-53 (pool images and `cland host prepare`), E1533S3-33 and E1533S3-54's code-tree line (whole-runtime delivery) and E1533S3-50 (config-set preservation of the hosts tables, T-1733).
  - T-1719 (landed `7d7aab2bc`; VERIFIED at dev `142fbe97d`; first read at branch head `6229e2c4f`, reviewer final clear rev-36 A-17403): DigitalOcean prepare builds a pool image through the executor's builder lifecycle (`prepareSnapshot` generalised with a storage, recipe, base ref and key comparison; the executor keeps its defaults): the builder runs the agent-host recipe, then the hook as root, then `prepare` as `runner`; the image is snapshotted, transferred to the pool's region and tagged `cland`, project and pool; the previous image is retired only after the new one is recorded, each deletion confirmed by a GET. Records live at `.cland/run/hosts/<pool>-image.json` and `<pool>-recovery`. A create uses the current pool image id and the provider's prelude as `user_data`, refused `run cland host prepare: pool image missing or stale` when the image is missing, stale or not in the region. **Current admission:** host.create uses the lease, armed watchdog and hosts reservation; direct acquire without receipts refuses before API access. The landing also renders the `cland-auth` helper lazily in `hub/src/host/prelude.ts` and adds `hub/src/host/cland-auth.sh` to the runtime bundle (`host-runtime-bundle`, `host-runtime-delivery` edited). **Coordinator decision (the item body's open question on prelude steps, C7, comment 2026-11-06):** the provider supplies its own prelude steps (`rm -f /etc/udev/rules.d/99-digitalocean-automount.rules`), so `user_data` carries them from the provider, not from the test. (superseded by T-1756)
  - T-1734 (landed `c049da468`; VERIFIED at dev `142fbe97d`): one pool-name grammar, `parsePoolName` in `hub/src/host/pool-name.ts` (`^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$`), used by config reading (`readHostPools` and the transport reader in `hub/src/host/transport-config.ts`), pool snapshot storage (`poolSnapshotStorage`), the recovery-directory scan (`snapshot-recovery.ts`), the `host.prepare`/`host.create` frame decoder (`protocol.ts`), the fake provider's prepare, acquire and reap, and DigitalOcean's acquire, volume create, prepare, pool-tag reap and key identity. **It chose the refusal branch of C1:** a name outside the grammar throws `invalid host pool: <name>; use 1–64 letters, digits and hyphens, starting with a letter or digit` at config read, and the daemon rethrows it at start (`hub/src/hub/daemon.ts` lists `invalid host pool:` among startup-fatal config errors), so the hub refuses to start. `HOST_USAGE` gains `pool: 1–64 letters, digits and hyphens; first character letter or digit`.
  - T-1718 (landed `142fbe97d`; VERIFIED there; first read at branch head `4639f0cc5`): `cland host create [pool]` (frame `host.create`) reaches `ready` through `creating`, `booting`, `connecting`, `cloning`; a fresh pinned host key is rendered in the prelude, the fake provider takes its public key from the user-data, the hub's SSH gate is bounded at 5 minutes (`PROVISION_GATE_MS`), whole-runtime delivery (T-1723) precedes registration and runtime add (T-1706), ready waits for the tunnel and the territory clone. Records live in hub.db (`provisioned_hosts`), failed hosts release their machine only after a positive complete settlement, interrupted checkpoints become `failed`/`incomplete` at the next start. `cland host list` (frame `host.list`) prints a JSON array with id, pool, provider, size, region, state, uptime (seconds, ready hosts) and `livePerHour`. **Coordinator decisions (the item body's open questions on the command and on prices):** `host create` is a local-only command (local human CLI or Neovim; sessions, remotes and web refused); declared prices show in `host list`; E-1534 owns `host status`. **Current admission:** `HostProvider.createAdmission` accepts durable lease, armed watchdog and hosts reservation receipts and is side-effect free. The fake allows; DigitalOcean refuses missing receipts, and `acquire` enforces the same policy. `createHost` checks the prepared image, reserves spend, publishes the lease and arms the watchdog before asking for admission. An unprepared pool names `cland host prepare`. The contract suite gains the registration `<name>: create admission is allowed without side effects`. `HOST_USAGE` now reads `host create [pool] human-only local CLI: create a pool host from a current pool image to ready`. (superseded by T-1756)
  - T-1720 (in the merge queue; VERIFIED-on-branch at `3c8880cc0`): `cland host destroy <id>` (frame `host.destroy`, local human CLI or Neovim only; web `'host.destroy': 'requires the local human CLI or Neovim'`) runs `destroyHost` in `hub/src/host/provision-host.ts`: unknown ids throw `unknown host`; the record is checkpointed `destroying` with `deletion not confirmed`; an admitted creation still in flight is aborted and joined; a registered host is removed from the running hub (the revoke owner) before the provider's `release(machine, confirm)` runs; the release observer reports one confirming read for the `machine` and one for the `key`, each logged as `{"event":"host-destroy","host":…,"resource":…,"read":…}` in `.cland/log/hub.log`; after the machine read is checkpointed, `Sessions.hostDeleted(id, read)` (`hub/src/adapters/sessions.ts`) releases every generation on that host and marks its sessions `exited`; only a `released` result with both reads makes the record `destroyed`; anything else keeps it `destroying` with `deletion not confirmed…` and a second destroy retries. The CLI prints the record as JSON and exits 0 only for `destroyed`. Destroyed records stay in `cland host list` with `state` `destroyed`. The fake provider's release reads its `gone` marker and the absence of `host-key.pub`, `client-key` and `known_hosts`; DigitalOcean's reports its confirmed DELETE/GET for the droplet and each key. New files: `hub/test/host-destroy.test.ts` (T2), `hub/test/host-destroy-native.test.ts` (T3, native) and the shared fixture `hub/test/host-create-fixture.ts`, onto which `host-create-ready.test.ts` is refactored with its titles unchanged.
  - T-1730 (landed `0e32c139d`; VERIFIED at dev `142fbe97d`; first read at branch head `bce79b583`, source review rev-35 A-17398 clear): `agentVersionHandoff` installs the whole runtime tree through `deliverRuntime` instead of the agent closure; `verifyAgentPackage` accepts the version symlink to its own `.runtime-<version>-` generation and returns the canonical generation it verified, which the supervisor reuses through launch; old generations stay for running readers. **Coordinator decision 237710ec (item comment):** whole-runtime handoff compatibility starts at v0.4.0, the first host release; no released host agent precedes it, so pre-v0.4 symlink-refusing agents need no migration (documented in `code-delivery.ts` and `docs/agents/host-agent.md`).

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what. Titles of the landed members are VERIFIED at dev `142fbe97d`; T-1720's are VERIFIED-on-branch at `3c8880cc0`.

| criterion | proven by |
| --- | --- |
| T-1719 C1 (prepare runs the agent-host recipe, the hook as root, `prepare` as `runner`; the image tagged `cland`, project, pool, in the pool's region) | E1533S3-10 (test `digitalocean prepare builds an agent image then root provision and runner prepare, and reuses its key`; test `digitalocean prepare transfers an unchanged image after the pool region changes`); E1533S3-03 |
| T-1719 C2 (an unchanged key makes no creating API call and answers `current`) | E1533S3-10 (the same prepare test: request count unchanged on the second prepare; test `digitalocean pool key invalidates an omitted harness default without changing executor digest`) |
| T-1719 C3 (a replaced image deleted only after the new one is recorded; DELETE 404 with a live GET kept on the retirement record) | E1533S3-10 (test `digitalocean replacement publishes before retirement and retains a split DELETE404 with live GET`; test `digitalocean periodic reconciliation leaves an admitted pool builder recovery owned until it joins`) |
| T-1719 C4 (create sends the current image id and the prelude as `user_data`; with no current image refused naming `cland host prepare` before any POST) | E1533S3-10 (test `digitalocean create refuses a missing or stale pool image and sends provider prelude with a current one`); E1533S3-11 (test `digitalocean configured base image does not override a prepared pool image`; the create test's body image 9001); E1533S3-03 |
| T-1719 C5 (the executor's prepare test files pass with no test edited) | E1533S3-02 (no preserved file in any landing, none since `efd68fbf`); E1533S3-13 to E1533S3-17 (whole files) |
| T-1719 C6 (outside the test environment `host.create` on `digitalocean` requires durable lease, watchdog and spend receipts before acquisition API calls) | E1533S3-10 (test `digitalocean production create names the missing host lease watchdog and spend before API access`: `createAdmission()` refused with zero requests and `acquire` returning the same refusal); E1533S3-21 (test `DigitalOcean create requires a prepared pool before acquisition API calls`: the CLI frame, exit 1, stderr naming `host prepare`, a mocked `fetch` never called); E1533S3-11 (test `digitalocean registry resolves and production acquisition refuses before any API request`); E1533S3-03 (admission after the image check and watchdog arming in `createHost`; the policy in `createAdmission`); E1533S3-59 (the frame on the real CLI)  (superseded by T-1756) |
| T-1719 C7 (the provider supplies its prelude steps: automount rule removed, `cland-auth` with its sudoers line, Codex `cli_auth_credentials_store = "file"`) | E1533S3-10 (the create test asserts all three in `user_data`); E1533S3-03 (`providerSteps` set inside `digitalocean.ts`); E1533S3-47 (the renderer) |
| T-1734 C1 (`agents_1` refused at config read naming the grammar, or accepted consistently; every reader agrees) — the refusal branch landed | E1533S3-19 (the `"agents_1"`, `"-agents"`, `""` and `"agents.dot"` expansions of `pool grammar refuses <name> at config and storage`: `readHostPools` and `poolSnapshotStorage` both throw `letters, digits and hyphens`; test `project config read refuses underscore pool before any host command`; test `host prepare decoder shares pool grammar and preserves omitted and valid legacy frames`); E1533S3-11 (the `"agents_1"` and `"-agents"` expansions of `digitalocean refuses invalid pool <name> before acquire or reap API calls`); E1533S3-45 (test `fake provider refuses underscore pools consistently with config`); E1533S3-28 (test `quoted empty pool transport is refused at startup`, now naming the grammar); E1533S3-60 (the real hub refuses to start); E1533S3-03 |
| T-1734 C2 (orphan reaping parses pool tags and key names with the config's function) | E1533S3-11 (the `agents-host-x` expansion of `digitalocean reaps valid pool tags and keys exactly: <pool>`: the exact pool's tagged droplet and key reaped, the `<pool>_1` droplet and the suffixed key kept; the invalid-pool reap expansions refused with zero requests); E1533S3-03 (pool-tag reap and key identity through `parsePoolName`; no other pool pattern left in the pool readers) |
| T-1718 C1 (`cland host create agents` reaches `ready` with tunnel and clone; a `session.launch` with that `host` runs OpenCode) | E1533S3-20 (test `C1/C2 create reaches ready with clone and tunnel and runs OpenCode; list shows declared facts`); E1533S3-54, E1533S3-56 |
| T-1718 C2 (`cland host list` shows id, pool, provider, size, region, state, uptime, declared live price) | E1533S3-20 (the same test); E1533S3-55 |
| T-1718 C3 (a machine whose key differs from its user-data is never connected; after the bounded wait `failed` and released) | E1533S3-20 (test `C3 mismatched prelude key never registers or starts a supervisor and releases machine after gate`; the `complete` and `unknown` expansions of `failed readiness releases only after positive settlement: <receipt>`); E1533S3-03 (the fake reads the key from user-data; the 300000 ms gate) |
| T-1718 C4 (a create on a pool whose image is not current refused naming `cland host prepare`) | E1533S3-21 (test `C4 create refuses an unprepared pool naming host prepare`; test `C4 create refuses a prepared image after harness pins change`); E1533S3-52 (a fake pool: admission allows, then the image check refuses). An unprepared `digitalocean` pool names host prepare at the same image check (E1533S3-21, E1533S3-59)  (superseded by T-1756) |
| T-1718 C5 (`host.create`/`host.list` from a session or remote refused; `cland host --help` lists `create` and `list`) | E1533S3-21 (test `C5 host help lists create and list`); E1533S3-24 (test `C5 human revoke closes host peers and refuses subsequent hellos`, now looping `host.prepare`, `host.create`, `host.list`); E1533S3-25 (test `signed-in web refuses pool preparation`, same loop); E1533S3-26 (frozen usage); E1533S3-03; E1533S3-51 |
| T-1718 decisions (local-only; prices in `host list`), the admission seam and review fixes (restart reconciliation, fenced ready checkpoint) | E1533S3-21, E1533S3-24, E1533S3-25 (local-only); E1533S3-55 (`livePerHour`); E1533S3-45 and E1533S3-11 (the `fake: …` and `digitalocean: …` expansions of `<name>: create admission is allowed without side effects`); E1533S3-22, E1533S3-23 (records, restart, and the `changed`, `unknown`, `released` expansions of `prepopulated membership cannot admit a <fault> provider identity` and the expansions of `no-registration <fault> machine stays fenced during <boundary>`); E1533S3-20 (the `revoke` and `shutdown` expansions of `held final readiness cannot publish ready after <action>`; test `forced fixture body failure joins held creation before storage and root disposal`) |
| T-1720 C1 (destroy ends the session as exited, removes machine and key, one confirming read each in the hub log) | E1533S3-43 (the `tunnel down=false` expansion of `C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=<bool>`: `cland host destroy` exit 0 with `state` `destroyed`, the OpenCode row `exited`, `client-key` gone, `host-destroy` log events exactly `machine` then `key`, each with a non-empty `read`); E1533S3-27 (test `release names confirming machine and key reads, including an already gone machine`; the deleted-host generation tests); E1533S3-45 and E1533S3-11 (the contract lifecycle registration now asserts the `machine` and `key` reads); E1533S3-57 |
| T-1720 C2 (destroy with the tunnel down) | E1533S3-43 (the `tunnel down=true` expansion: the host's key replaced and its Host closed, then the same destroy outcome) |
| T-1720 C3 (provider read still finds the machine: stays listed with `deletion not confirmed`; a second destroy retries) | E1533S3-43 (the `tunnel down=true` expansion: a first destroy against an ignored delete exits 1, the session not `exited`, `cland host list` showing `deletion not confirmed`; the second destroy exits 0 `destroyed`); E1533S3-27 (the `missing` and `throw` expansions of `destroy requires confirming reads: <outcome>`; test `restarted ambiguous acquisition without a machine stays deletion not confirmed`); E1533S3-43 (test `destroy joins an admitted held acquisition and prevents ready resurrection`) |
| T-1720 C4 (unknown id refused; `host.destroy` from a session or remote refused) | E1533S3-27 (test `C4 destroy refuses an unknown id`: exit 1, `unknown host`); E1533S3-24 and E1533S3-25 (their loops now include `host.destroy`); E1533S3-58; E1533S3-03 |
| T-1730 C1 (V1 ready then handed V2: `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts`, `hub/mod/cland` under `code/V2`, each matching the V2 manifest) | E1533S3-29 (test `C1-C3 whole runtime delivery verifies files, reuses digest and atomically replaces CLI and spoke`, its T-1730 handoff block); E1533S3-03 |
| T-1730 C2 (after the handoff the agent restarts on V2 and a Claude Code session launches with its mod bridge connected) | E1533S3-32 (test `T-1730 C2 upgraded runtime launches Claude with connected mod bridge`); E1533S3-30 (test `T-1730 supervisor launches verified generation after version pointer changes`) |
| T-1730 C3 (a V1 reader keeps its generation until it exits) | E1533S3-29 (the open V1 reader in the same test) |
| T-1730 C4 (existing version-handoff cases in `host-agent-restart` and `host-agent-closure` pass, migrated only where closure-only, each migration named) | E1533S3-30 (the `version delivery` and `kill-agent` expansions of `C1-C3 <mode> reconnect reads retained table without signalling harness`; test `C3 adopted Claude worker survives version replacement with receipt authority and no signal`); E1533S3-31 (closure file unedited, passing on the regenerated `closure.json`); E1533S3-03 (`T-1730 migration` comments); E1533S3-02 |
| T-1730 decision (v0.4.0 boundary, no released host agent before it) | E1533S3-03 (the code comment and the doc line) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1533 --json` lists in stage `create to ready`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task with a branch still needs its landing receipt even if the branch has no commits; a task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion). A dirty build, a missing required merge (**every member needs a landing here**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `142fbe97d8883b44cbc820ca9f0c228d82fcb0a8`): T-1730 landed as `0e32c139d8e159b426526f79dc10b31475231913`, T-1719 as `7d7aab2bc3ef84ea9b314f733ee512d03429905f`, T-1734 as `c049da468317f921f91c93cfa43c21a38b48dafa` and T-1718 as `142fbe97d8883b44cbc820ca9f0c228d82fcb0a8`; their files, titles and strings were read at that dev (VERIFIED). T-1730's and T-1719's landed files are byte-identical to the branch heads first read (`bce79b583`, `6229e2c4f`); T-1718's landing differs from its head `4639f0cc5` by the review integration (`createAdmission`, `samePoolImageKey`, the address-keyed fake membership, new admission, recovery and contract cases), all re-read here. The one `poolImageKey` definition is `(root, env, provider)`. **T-1720 had not landed:** it was read in the merge queue at `3c8880cc0be27026234a4504f63ecdc7a0226fa9` (branch `t/T-1720-cland-host-destroy`, three commits on `142fbe97d`), VERIFIED-on-branch.

**Landing check (T-1720).** At `<dev SHA>`, QA confirms T-1720's landing receipt (`git log --first-parent --format=%H --grep "^Item: T-1720$" <dev SHA>` prints exactly one commit, E1533S3-00) and that `hub/test/host-destroy.test.ts`, `hub/test/host-destroy-native.test.ts`, `hub/test/host-create-fixture.ts`, `hub/test/host-create-ready.test.ts`, `hub/test/host-provider-contract.ts`, `hub/test/host-secret-admission.test.ts`, `hub/test/web-authority.test.ts` and `hub/test/fixtures/cli-usage/commands.json` are byte-identical to `3c8880cc0` (E1533S3-02's `T-1720 files byte-identical to 3c8880cc` line). A difference is an expected-registration correction under the carried rule (re-derive the lists, record it in `$EV/expect-corrections.txt`, map every T-1720 criterion to a title at the build), never a silent pass. Every other string, title and path is re-read at `<dev SHA>` and a difference recorded before judging.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. No named file needs `web/dist`; E1533S3-01 runs the typecheck only.

**Where things live.** All scratch state is outside the project root: `$Q` (`/private/tmp/q53-…`, realpath, 23 bytes) holds the scratch project `p1`, the fake-host root `$Q/fh` (its hosts live in `$Q/fh/.fixture-sockets/<machine>`), the shims `$Q/bin`, the scratch HOME and every directory `fixtureEnvironment` synthesizes, and every helper file. The fake-host root's short alias is one symlink `/private/tmp/ct-<32 hex>` (`shared/fixture-sockets.ts`), recorded by E1533S3-61 and removed by its literal path at cleanup. `$T` is `TMPDIR` of every sealed command. The only paths under the repository are the ones QA tooling prescribes, both ignored by `.cland/.gitignore`: the detached build `$W` in `.cland/worktrees/` and the evidence tree `$EV` in `.cland/qa/E-1533/<run>/`. Nothing is written to `.cland/tasks/` of the live project; E1533S3-00 and E1533S3-62 print the root's non-tracker status, which must not change.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed, through the fresh seal. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its config, its territory, its `hub.db` or the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). Never read or print `.cland/secrets.toml`, any `hub.json` secret, `~/.config/cland/sandbox-remote.secrets.toml`, any key under `$Q/p1/.cland/run/host-provisions/` or `$Q/fh`, or any credential; never run a real `ssh`, `scp`, `sshd` or `npm ci`/`npm install` against a registry; never run `cland executor prepare`, `cland verify`, `cland host prepare`, `cland host create`, `cland host destroy` or `cland hub reload` against the live project. The live hub is read only by QA's own shell for the plan read and `quiet`.

Two shells, never mixed. **QA's own shell** keeps QA's session identity and runs its commands with the harness's `login:false`: it creates the worktree and the scratch roots, runs `quiet`, the plan read and the read-only source checks, starts every sealed command through `fresh.mjs`, and records every check with `qa-record.sh`. **Every other command runs inside `fresh.mjs`**: named files and the typecheck in `plain` mode (cwd `$W`), scratch rows in `hub` mode (cwd `$Q/p1`, through `body.sh`). Never use `env -i`; never source an environment snapshot.

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json`. In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s3-$(date +%F)-1                        # unique run id for E-1533; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}   # the QA session's name (a rescue run sets rescue-<job id> first)
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
W=$R/.cland/worktrees/qa-e1533s3-$RUN          # the clean detached build (ignored by Git)
EV=$R/.cland/qa/E-1533/$RUN                    # captures (ignored by Git)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
NV=$(cd "$W" && node nvim/bin/nvim-path.ts 2> /dev/null); NVD=$(dirname "${NV:-/nonexistent/x}")   # the pinned Neovim directory, only for the S0 exemption
T=/private/tmp/qa-e1533-s3-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q53-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh" "$Q/bin"
chmod 700 "$Q/claude" "$Q/fake-claude"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch hub pid is appended here
: > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
# The created host's transport shims, exactly as hub/test/host-create-ready.test.ts builds them (VERIFIED at dev 142fbe97d; hub/test/host-create-fixture.ts at T-1720's head):
ln -s "$W/hub/test/fakes/fake-ssh.ts" "$Q/bin/ssh"; ln -s "$W/hub/test/fakes/fake-scp.ts" "$Q/bin/scp"
printf '#!/bin/sh\nexec "$@"\n' > "$Q/bin/setsid"
printf "#!/bin/sh\nln -s '%s/node_modules' node_modules\n" "$W" > "$Q/bin/npm"
chmod 700 "$Q/bin/setsid" "$Q/bin/npm"
printf '{"W":"%s","Q":"%s","EV":"%s","T":"%s","R":"%s","SESSION":"%s"}\n' "$W" "$Q" "$EV" "$T" "$R" "$QA_SESSION" > "$Q/state.json"
```

**The kit, by exact line range.** The shell functions `holder`, `quiet` and `ld` (lines 133 to 136) and `tap.mjs` (lines 228 to 279) are taken unchanged from the stage-4 brief **as committed in the build** (`$W/qa/briefs/E-1532-stage-4.md`, blob `4ed467672750bf34179ed72549df863d1541eddb`, the same blob on dev at `efd68fbf0`). A different blob means the ranges moved, and the setup is BLOCKED. **Not taken:** the kit's `nt` and `rp` (lines 137 to 140), which source a static `env.sh`; this brief's own `nt`, `pl` and `mrow` replace them, as in stage 2.

```sh
K="$W/qa/briefs/E-1532-stage-4.md"
echo "kit blob $(git -C "$W" rev-parse HEAD:qa/briefs/E-1532-stage-4.md) want 4ed467672750bf34179ed72549df863d1541eddb"
sed -n '133,136p' "$K" > "$Q/kit-shell.sh"
sed -n '228,279p' "$K" > "$Q/kit-tap.sh"
echo "kit first lines: $(head -n 1 "$Q/kit-shell.sh" | cut -c1-10) | $(head -n 1 "$Q/kit-tap.sh" | cut -c1-27)"
echo "kit shell names env.sh: $(grep -c 'env.sh' "$Q/kit-shell.sh")"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
node --check "$Q/tap.mjs" && echo "tap checked"
```

Expected: `kit blob` equal to `want`; `kit first lines: holder() { | cat > "$Q/tap.mjs" <<'JS'`; `kit shell names env.sh: 0`; `tap checked`.

**The fresh seal.** Stage 2's `seal.mjs`, `fresh.mjs`, `body.sh` and `helpers.sh`, with this run's root patterns (`q53-`, `qa-e1533-s3-`) and the created-host overlay in `hub` mode. `frame.mjs` is E-1532 stage 6's one-frame hub client (`qa/briefs/E-1532-stage-6.md`, its "Additions in stage 6"): there is no CLI flag for a launch host; `session.launch` accepts `host` as a frame field.

```sh
cat > "$Q/seal.mjs" <<'JS'
// seal(extra, front): one launch's environment, built when called. Overlays go INTO fixtureEnvironment(Q, base, overlays), which filters credentials after them; scratchGitEnvironment wraps it; nothing is added after.
import { dirname } from 'node:path';
import { userInfo } from 'node:os';
const base = process.env;
const [W, Q, EV, T, R] = [base.QA_W, base.QA_Q, base.QA_EV, base.QA_T, base.QA_R];
if (!W || !EV || !R || !/^\/private\/tmp\/q53-[A-Za-z0-9]+$/.test(Q ?? '') || !/^\/private\/tmp\/qa-e1533-s3-[0-9a-f-]{36}$/.test(T ?? '')) {
  console.error('seal: refused: not this run\'s scratch roots'); process.exit(2);
}
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${W}/test-support/fixture-environment.ts`);
const realHome = userInfo().homedir, nodeBin = dirname(process.execPath);
const drop = p => !p || p === nodeBin || p.startsWith('~') || p === realHome || p.startsWith(`${realHome}/`)
  || p.startsWith(`${W}/hub/test/fakes`) || p === Q || p.startsWith(`${Q}/`);
const rest = String(base.PATH ?? '').split(':').filter(p => !drop(p));
export function seal(extra = {}, front = []) {
  for (const k of Object.keys(extra)) if (!/^(CLAND_|FAKE_|QA_)/.test(k)) throw new Error(`seal: overlay ${k} refused`);
  for (const p of front) if (p !== `${Q}/bin`) throw new Error(`seal: front ${p} refused`);
  return scratchGitEnvironment(Q, fixtureEnvironment(Q, base, { PATH: [...new Set([...front, nodeBin, ...rest])].join(':'), TMPDIR: T, QA_W: W, QA_Q: Q, QA_EV: EV, QA_T: T, QA_R: R, GH_PAGER: undefined, ...extra }), { excludesFile: `${Q}/home/.gitignore-global` });
}
JS
cat > "$Q/fresh.mjs" <<'JS'
// node "$Q/fresh.mjs" <cwd> <plain|hub> <command> [args…]   one command in a fresh shared-builder seal
// Inputs (QA roots, QA_SESSION and, in hub mode, the hub and created-host overlay plus $Q/bin in front) go INTO seal(); nothing is overlaid after it returns.
// Refuses (exit 2, "fresh: BLOCKED") on any credential-prefix name. Streams stdout and stderr line by line through the redactor.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const Q = dirname(fileURLToPath(import.meta.url));
const s = JSON.parse(readFileSync(`${Q}/state.json`, 'utf8'));
if (s.Q !== Q || !s.SESSION) { console.error('fresh: BLOCKED: state.json names another scratch root or no QA session'); process.exit(2); }
const CRED = /^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/;
const secrets = Object.entries(process.env).filter(([k, v]) => typeof v === 'string' && v.length >= 8 && (CRED.test(k) || /(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY)/i.test(k))).map(([, v]) => v);
for (const [name, key] of Object.entries({ QA_W: 'W', QA_Q: 'Q', QA_EV: 'EV', QA_T: 'T', QA_R: 'R' })) process.env[name] = s[key];
const { seal } = await import(`${Q}/seal.mjs`);
const { assertPublishable } = await import(`${s.W}/.agents/skills/qa/qa-demo-policy.ts`);
const [cwd, mode, command, ...args] = process.argv.slice(2);
if (!['plain', 'hub'].includes(mode) || !command) { console.error('fresh: usage: <cwd> <plain|hub> <command> [args…]'); process.exit(2); }
const hub = { CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_FAKE_HOST_ROOT: `${Q}/fh`,
  CLAND_SSH_BIN: `${s.W}/hub/test/fakes/fake-ssh.ts`, CLAND_SCP_BIN: `${s.W}/hub/test/fakes/fake-scp.ts`,
  CLAND_OPENCODE_BIN: `${s.W}/hub/test/fakes/opencode/opencode`, FAKE_OPENCODE_SOCKET: 'session.sock' };
const env = mode === 'hub' ? seal({ QA_SESSION: s.SESSION, ...hub }, [`${Q}/bin`]) : seal({ QA_SESSION: s.SESSION });
const leaked = Object.keys(env).filter(k => CRED.test(k)).length;
if (leaked) { console.error(`fresh: BLOCKED: credential-prefix names in the seal: ${leaked}`); process.exit(2); }
let withheld = 0;
const clean = line => {
  let out = line;
  for (const v of secrets) if (out.includes(v)) out = out.split(v).join('[redacted]');
  try { assertPublishable(out); } catch { out = '# fresh: line withheld by the publication scan'; }
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
child.on('error', error => { console.error(`fresh: ${error.message}`); process.exitCode = 1; });
child.on('close', async code => { await streams; console.error(`# fresh: redacted or withheld lines ${withheld}`); process.exitCode = code ?? 1; });
JS
cat > "$Q/frame.mjs" <<'JS'
// node "$QA_Q/frame.mjs" '<json frame without id>' [timeoutMs]    sealed, cwd = p1: one hub request over the project's socket; prints {"ok":..,"value|error":..}
// The secret is read from .cland/hub.json by askHubFrame and never printed. The request is the human's (CLI client).
import { readFileSync } from 'node:fs';
const { askHubFrame } = await import(`${process.env.QA_W}/shared/socket-client.ts`);
const d = { ...JSON.parse(readFileSync('.cland/hub.json', 'utf8')), root: process.cwd() };
const frame = JSON.parse(process.argv[2]);
try { console.log(JSON.stringify({ ok: true, value: await askHubFrame(d, frame, Number(process.argv[3] ?? 60000)) })); }
catch (e) { console.log(JSON.stringify({ ok: false, error: String(e?.message ?? e) })); }
JS
cat > "$Q/body.sh" <<'SH'
# /bin/bash "$QA_Q/body.sh" <function>   inside fresh.mjs (hub mode), cwd p1: helpers and scratch functions only, the immediate gate, then the function
. "$QA_Q/helpers.sh"; . "$QA_Q/scratch.sh"
n=$(node -e 'console.log(Object.keys(process.env).filter(k=>/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)).length)')
echo "PRE gate: credential-prefix names $n; QA_SESSION set $([ -n "$QA_SESSION" ] && echo yes || echo no); HOME is Q/home $([ "$HOME" = "$QA_Q/home" ] && echo yes || echo no); TMPDIR is T $([ "$TMPDIR" = "$QA_T" ] && echo yes || echo no); fake host root $([ "$CLAND_FAKE_HOST_ROOT" = "$QA_Q/fh" ] && echo yes || echo no); ssh is the fake $([ "$(command -v ssh)" = "$QA_Q/bin/ssh" ] && echo yes || echo no); scp is the fake $([ "$(command -v scp)" = "$QA_Q/bin/scp" ] && echo yes || echo no); npm is the stub $([ "$(command -v npm)" = "$QA_Q/bin/npm" ] && echo yes || echo no)"
[ "$n" = 0 ] || { echo "BLOCKED: credential-name gate"; exit 2; }
[ "$(command -v ssh)" = "$QA_Q/bin/ssh" ] && [ "$(command -v scp)" = "$QA_Q/bin/scp" ] && [ "$(command -v npm)" = "$QA_Q/bin/npm" ] || { echo "BLOCKED: a real ssh, scp or npm would be reachable by name"; exit 2; }
"$1"
SH
cat > "$Q/helpers.sh" <<'SH'
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
hubstart() { cland hub start > "$QA_Q/hubstart.out" 2>&1; local x=$?; [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; return $x; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
alive() { kill -0 "$1" 2> /dev/null && echo yes || echo no; }
run() { l=$1; shift; "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; head -n 20 "$QA_Q/r.out" | sed 's/^/  out: /'; head -n 20 "$QA_Q/r.err" | sed 's/^/  err: /'; }
has() { node -e 'const fs=require("fs"),q=process.env.QA_Q,n=process.argv.at(-1);let t="";for(const f of ["r.out","r.err"]){try{t+=fs.readFileSync(q+"/"+f,"utf8")+"\n"}catch{}}console.log(t.split("\n").filter(l=>l.includes(n)).length)' -- "$1"; }
cnt() { node -e 'const fs=require("fs");let t="";try{t=fs.readFileSync(process.argv[1],"utf8")}catch{console.log("MISSING");process.exit(0)}console.log(t.split(process.argv[2]).length-1)' "$1" "$2"; }
there() { [ -e "$1" ] && echo present || echo absent; }
dg() { node -e 'try{console.log(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))}catch{console.log("MISSING")}' "$1"; }
# machines: fake machine directories under the fake-host root (real directories; the /private/tmp/ct-… alias points here)
machines() { ls -A "$QA_Q/fh/.fixture-sockets" 2> /dev/null | grep -c '^fake-'; }
# hl: one summary line per `cland host list` row from the last run's stdout (no secret fields exist in a row)
hl() { node -e 'const fs=require("fs");let v;try{v=JSON.parse(fs.readFileSync(process.env.QA_Q+"/r.out","utf8"))}catch{console.log("  list: not JSON");process.exit(0)}if(!Array.isArray(v)){console.log("  list: not an array");process.exit(0)}if(!v.length)console.log("  list: empty");for(const r of v)console.log("  row id="+r.id+" pool="+r.pool+" provider="+r.provider+" size="+r.size+" region="+r.region+" state="+r.state+" uptime="+(typeof r.uptime==="number"?(r.uptime>=0?"nonnegative":"negative"):String(r.uptime))+" livePerHour="+r.livePerHour+" machine="+(r.machine?.id??"none")+" release="+(r.release??"none")+" reason="+(r.reason??"none"))'; }
# pick: from the last list, the one ready agents row: host id and machine id into $QA_Q/host.id and machine.id (rule 22: ids from the listing)
pick() { node -e 'const fs=require("fs"),q=process.env.QA_Q;const v=JSON.parse(fs.readFileSync(q+"/r.out","utf8"));const r=v.filter(x=>x.pool==="agents"&&x.state==="ready");console.log("  ready agents rows "+r.length);if(r.length===1){fs.writeFileSync(q+"/host.id",r[0].id);fs.writeFileSync(q+"/machine.id",r[0].machine.id)}'; }
hd() { node --input-type=module -e 'const {hostDirectory}=await import(process.env.QA_W+"/shared/fake-host-directory.ts");console.log(hostDirectory(process.env.QA_Q+"/fh",process.argv[1]))' "$1"; }
# ports <machine>: the fake ssh's loopback map for that host: every port 1024–65535 to <home>/session.sock (E-1532 DoD's map; the tests' freePort override cannot be applied to a CLI-started hub)
ports() { node --input-type=module -e 'const {hostDirectory}=await import(process.env.QA_W+"/shared/fake-host-directory.ts");const fs=await import("node:fs");const d=hostDirectory(process.env.QA_Q+"/fh",process.argv[1]);const m={};for(let p=1024;p<65536;p++)m[p]="session.sock";fs.writeFileSync(d+"/ports.json",JSON.stringify(m));console.log("ports map "+process.argv[1]+": every loopback port to session.sock")' "$1"; }
# srow <name>: the session's process row read from this project's hub.db through the build's ProcessTable, as host-create-ready and host-destroy-native read it (session.list's view carries no host field)
srow() { node --input-type=module -e 'const {ProcessTable}=await import(process.env.QA_W+"/hub/src/adapters/processes.ts");const t=new ProcessTable(".cland/hub.db");try{const r=t.get(process.argv[1]);console.log(r?"host="+r.host+" status="+r.status:"no row")}finally{t.close()}' "$1"; }
SH
node --check "$Q/seal.mjs" && node --check "$Q/fresh.mjs" && node --check "$Q/frame.mjs" && bash -n "$Q/body.sh" && bash -n "$Q/helpers.sh" && echo "seal checked"
# nt <id> <files…>: named files from $W, each in a fresh plain seal (TMPDIR=$T), one at a time, TAP; $T listed after each file; then the tap.mjs check
nt() { local id=$1 f; shift; quiet || return 1; : > "$EV/$id.log"; : > "$EV/$id.tmpdir.txt"; for f in "$@"; do ld >> "$EV/$id.log" || { tail -n 1 "$EV/$id.log"; return 1; }; node "$Q/fresh.mjs" "$W" plain node --test --test-concurrency=1 --test-reporter=tap "$f" >> "$EV/$id.log" 2>&1; echo "exit $? $f" >> "$EV/$id.log"; ls -A "$T" | sed "s|^|$f: |" >> "$EV/$id.tmpdir.txt"; done; node "$Q/tap.mjs" check "$EV/$id.log" "$Q/expect.json" | tee "$EV/$id.check.txt"; }
# pl <id> <files…>: nt under the preservation lock; mkdir is the lock, the owner file names this run and row
pl() {
  if ! mkdir /tmp/cland-preserve.lock 2> /dev/null; then echo "BLOCKED: /tmp/cland-preserve.lock is held: $(cat /tmp/cland-preserve.lock/owner 2> /dev/null || echo 'no owner file')"; return 1; fi
  printf 'qa %s %s pid %s %s\n' "$RUN" "$1" "$$" "$(date -u +%FT%TZ)" > /tmp/cland-preserve.lock/owner
  nt "$@"; local x=$?
  if [ "$(cut -d' ' -f1-3 /tmp/cland-preserve.lock/owner 2> /dev/null)" = "qa $RUN $1" ]; then rm /tmp/cland-preserve.lock/owner && rmdir /tmp/cland-preserve.lock && echo "preservation lock released"; else echo "FINDING: preservation lock owner changed during $1; lock left in place"; fi
  return $x
}
# mrow <id> <function>: one scratch row in a fresh hub seal, cwd p1, after cover-quiet admission and the load gate
mrow() { quiet || return 2; { ld; node "$Q/fresh.mjs" "$Q/p1" hub /bin/bash "$Q/body.sh" "$2"; echo "row exit $?"; } > "$EV/$1.txt" 2>&1; tail -n 1 "$EV/$1.txt"; }
```

The S0 environment prints, each through its own fresh seal:

```sh
for m in plain hub; do node "$Q/fresh.mjs" "$Q" "$m" node -e 'const fs=require("fs"),os=require("os"),path=require("path");const e=process.env,h=os.userInfo().homedir,real=p=>{try{return fs.realpathSync(p)}catch{return p}};const allowed=new Set([real(path.dirname(process.execPath)),real(process.argv[1])]);console.log(process.argv[2]+": credential-prefix names "+Object.keys(e).filter(k=>/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)).length+"; CLAND_ names "+Object.keys(e).filter(k=>k.startsWith("CLAND_")).sort().join(" ")+"; FAKE_ names "+Object.keys(e).filter(k=>k.startsWith("FAKE_")).sort().join(" ")+"; QA_SESSION "+(e.QA_SESSION?"set":"unset")+"; TMPDIR is T "+(e.TMPDIR===e.QA_T)+"; HOME is Q/home "+(e.HOME===e.QA_Q+"/home")+"; first PATH entry "+(e.PATH.split(":")[0]===e.QA_Q+"/bin"?"Q/bin":"other")+"; real-HOME PATH entries other than the Node bin and the pinned Neovim directory "+e.PATH.split(":").filter(p=>p.startsWith("~")||((p===h||p.startsWith(h+"/"))&&!allowed.has(real(p)))).length)' "$NVD" "$m"; done 2>&1 | tee "$EV/S0-env.txt"
node "$Q/fresh.mjs" "$Q" plain /bin/sh -c 'for c in claude codex opencode ssh; do echo "plain: $c on the sealed PATH: $(command -v "$c" || echo none)"; done' 2>&1 | tee -a "$EV/S0-env.txt"
node "$Q/fresh.mjs" "$Q" hub /bin/sh -c 'for c in claude codex opencode ssh scp npm setsid ssh-keygen; do echo "hub: $c on the sealed PATH: $(command -v "$c" || echo none)"; done' 2>&1 | tee -a "$EV/S0-env.txt"
echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' '); T bytes $(printf '%s' "$T" | wc -c | tr -d ' '); a suite root for comparison $(printf '%s' "/private/tmp/cland-suite-$(uuidgen | tr 'A-Z' 'a-z')" | wc -c | tr -d ' ')" | tee -a "$EV/S0-env.txt"
```

Expected (recorded as check `S0` with `qa-record.sh note`, capture `$EV/S0-env.txt`): `seal checked`; both modes `credential-prefix names 0`; `plain` `CLAND_` names exactly the builder's own (`CLAND_DISCORD_API_ROOT CLAND_ELEVENLABS_API_ROOT CLAND_EXECUTOR_STATE CLAND_TELEGRAM_API_ROOT CLAND_TEST_OWNED_ROOT`) and `FAKE_` names `FAKE_CLAUDE_HOME FAKE_CODEX_HOME FAKE_OPENCODE_HOME`; `hub` the same plus `CLAND_FAKE_HOST_ROOT CLAND_OPENCODE_BIN CLAND_SCP_BIN CLAND_SSH_BIN CLAND_TEST_SKIP_ORPHAN_SWEEP` and `FAKE_OPENCODE_SOCKET` (any other name is BLOCKED); `QA_SESSION set`; TMPDIR and HOME `true`; `first PATH entry` `other` in `plain`, `Q/bin` in `hub`; `0` real-HOME entries; each `# fresh: redacted or withheld lines 0`; `plain:` the three harnesses and `ssh` resolve to `none` or to a system path (`/usr/bin/ssh` is acceptable in `plain`, which runs only named files that bring their own fakes); `hub:` the three harnesses `none`, `ssh`, `scp`, `npm` and `setsid` under `$Q/bin`, `ssh-keygen` a system path; `Q bytes 23`, `T bytes` equal to the suite root's. A non-zero credential count stops the run before any row (BLOCKED).

The TAP expectations. `expect.json` lists, per file, top-level names its source registers. `exact: true` lists every registration; `exact: false` lists the names that prove a criterion (a subset; the rest of the file must still pass). Lists were read at dev `142fbe97d` (VERIFIED); `host-destroy`, `host-destroy-native` and the T-1720 edits to `host-create-ready` (titles unchanged), `host-secret-admission` and `web-authority` were read at `3c8880cc0` (VERIFIED-on-branch). Contract registrations (`<name>: …`) come from `hostProviderContract`/`hostProviderVolumeContract` through `register(name, run)`. **Before E1533S3-10, re-derive every list a stage landing touched from its file at `<dev SHA>`** (the expected-registration correction) and append each difference to `$EV/expect-corrections.txt`.

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/host-provider-digitalocean-prepare.test.ts": {"exact": true, "names": [
  "digitalocean production create names the missing host lease watchdog and spend before API access",
  "digitalocean prepare builds an agent image then root provision and runner prepare, and reuses its key",
  "digitalocean create refuses a missing or stale pool image and sends provider prelude with a current one",
  "digitalocean replacement publishes before retirement and retains a split DELETE404 with live GET",
  "digitalocean prepare transfers an unchanged image after the pool region changes",
  "digitalocean pool key invalidates an omitted harness default without changing executor digest",
  "digitalocean periodic reconciliation leaves an admitted pool builder recovery owned until it joins"]},
 "hub/test/host-provider-digitalocean.test.ts": {"exact": false, "names": [
  "digitalocean create carries configured inputs, isolated key and project/pool tags; invalid region makes no call",
  "digitalocean release confirms both droplet and key with GET after split DELETE 404",
  "digitalocean lost create response is reaped after provider restart; other pool and project survive",
  "digitalocean owned host and its key survive reap while an unowned host is removed",
  "digitalocean configured base image does not override a prepared pool image",
  "digitalocean provider keeps sentinel out of output, errors and user-data, and launches no child",
  "digitalocean registry resolves and production acquisition refuses before any API request",
  "digitalocean reap finds tagged droplets and pool-prefixed keys without local intents",
  "digitalocean reap rechecks owner admission after held inventory and preceding deletion",
  "digitalocean reap preserves overlapping pool keys with and without intent records",
  "digitalocean reap holds owner admission through both confirmed deletes; snapshot-only callers fail closed",
  "digitalocean reap admits orphan key cleanup through its current owner",
  "digitalocean incomplete retirement blocks owner claims through restart until both resources reconcile",
  "digitalocean pending retirement reconciles after transient key GET failure and empty inventories",
  "digitalocean pending retirement survives a lost owner settlement acknowledgement",
  "digitalocean: provider declares sane prices, billing and capabilities",
  "digitalocean: create admission is allowed without side effects",
  "digitalocean: provider contract creates, prepares, observes and confirms release",
  "digitalocean: reap releases only the requested project and pool",
  "digitalocean: refused acquire has a typed outcome",
  "digitalocean: failed-acquire acquire has a typed outcome",
  "digitalocean: delayed-boot preserves observed lifecycle outcomes",
  "digitalocean: never-boot preserves observed lifecycle outcomes",
  "digitalocean: ignored-delete preserves observed lifecycle outcomes",
  "digitalocean declarations load API prices and limit atomically and retain the last good read",
  "digitalocean 429 pauses every create until retry time without POST cascades or token leaks",
  "digitalocean 422 pauses every create until retry time without POST cascades or token leaks",
  "digitalocean unavailable declarations refuse safely and recover without partial publication",
  "digitalocean initial declaration 429 holds subsequent creates without a request",
  "digitalocean unrelated 422 is failed and does not pause creation",
  "digitalocean accepted create followed by address GET 429 retains ownership and pauses later creates",
  "digitalocean held create refusal cannot shorten a concurrent declaration refresh pause",
  "digitalocean refuses invalid pool \"agents_1\" before acquire or reap API calls",
  "digitalocean refuses invalid pool \"-agents\" before acquire or reap API calls",
  "digitalocean reaps valid pool tags and keys exactly: agents-host-x"]},
 "hub/test/host-provider-digitalocean-volumes.test.ts": {"exact": true, "names": [
  "digitalocean: volumes create, list and confirm deletion",
  "digitalocean: volumes enforce one attachment and region binding",
  "digitalocean: ignored volume deletion retains inventory",
  "digitalocean: volumes rate limit snapshots until retry time",
  "digitalocean volume create carries lon1, 1 GiB and project/pool tags",
  "digitalocean volume actions publish attachment only after completed",
  "digitalocean volume creation requires a pool, shares pause and resolves acquire pool",
  "digitalocean lost volume create reply retains discoverable resource without replay",
  "digitalocean known snapshot refusal returns immediately for the exact volume identity"]},
 "hub/test/executor-droplet.test.ts": {"exact": false, "names": [
  "macOS inhibits idle sleep while the lease lives and drops the inhibitor after release"]},
 "hub/test/executor-prepare.test.ts": {"exact": false, "names": [
  "a project without pins prepares a reusable snapshot for delivery",
  "prepare keys hash committed hook bytes without Neovim fields and ignore local hook edits",
  "prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes"]},
 "hub/test/executor-prepare-component.test.ts": {"exact": false, "names": [
  "project provision runs as root before runner prepare, failure=false",
  "project provision runs as root before runner prepare, failure=true",
  "previous persisted snapshot wire shape remains readable before recipe rebuild",
  "prepare captures applied provision input despite disk edits and refuses an unbound supplied key before reuse"]},
 "hub/test/executor-safety.test.ts": {"exact": false, "names": [
  "concurrent host processes share one reservation lock and recover a dead holder",
  "the remote shell and the host deadline both end a timed-out run once and release",
  "prepare, run, fallback, cancel and stopped-hub watchdog leave the sentinel nowhere"]},
 "hub/test/verify-prepare.test.ts": {"exact": true, "names": [
  "prepare uses installed snapshot inputs and rebuilds changed or missing installs"]},
 "hub/test/image-recipe.test.ts": {"exact": true, "names": [
  "x86_64 builder preserves the committed recipe bytes and snapshot digest",
  "x86_64 base downloads and verifies exact Node bytes without project packages",
  "arm64 base downloads and verifies exact Node bytes without project packages",
  "unknown architectures and unsafe version pins refuse before rendering",
  "agent recipe pins all harnesses and installs OpenCode only from the v2 installer before ready",
  "agent defaults use doctor minimums and reject unpinned or injected harness versions",
  "baked harness installer stubs remain discoverable with a login-disk HOME"]},
 "hub/test/host-prepare.test.ts": {"exact": false, "names": [
  "pool prepare CLI publishes an image and then reports current",
  "pool prepare invalidates harnesses and names the changed part",
  "pool prepare invalidates lock and names the changed part",
  "pool prepare invalidates provision and names the changed part",
  "pool prepare selects all configured pools and unknown pool names the choices",
  "fake image build joins the configured build receipt and records its key",
  "pool harness pins use renderer ids and exact release versions",
  "config set preserves SSH hosts and both pools before host prepare",
  "pool grammar refuses \"agents_1\" at config and storage",
  "pool grammar refuses \"-agents\" at config and storage",
  "pool grammar refuses \"\" at config and storage",
  "pool grammar refuses \"agents.dot\" at config and storage",
  "project config read refuses underscore pool before any host command",
  "host prepare decoder shares pool grammar and preserves omitted and valid legacy frames"]},
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
  "forced fixture body failure joins held creation before storage and root disposal"]},
 "hub/test/host-create-admission.test.ts": {"exact": true, "names": [
  "C4 create refuses an unprepared pool naming host prepare",
  "C5 host help lists create and list",
  "C4 create refuses a prepared image after harness pins change",
  "DigitalOcean create requires a prepared pool before acquisition API calls", "pre-row admission refusal acquires nothing and publishes no provision record", "DigitalOcean SSH gate records the provision identity and address without fake environment reads"],"note":"(superseded by T-1756)"},
 "hub/test/host-provision-records.test.ts": {"exact": true, "names": [
  "ready checkpoint refuses a registration revoked at the held final boundary",
  "revocation after ready atomically replaces the provision state",
  "ready checkpoint refuses a different durable machine address",
  "startup inventory streams only current registrations while retaining failed history"]},
 "hub/test/host-provision-recovery.test.ts": {"exact": true, "names": [
  "restart retains interrupted creating as failed incomplete without replay or release",
  "restart retains interrupted booting as failed incomplete without replay or release",
  "restart retains interrupted connecting as failed incomplete without replay or release",
  "restart retains interrupted cloning as failed incomplete without replay or release",
  "prepopulated membership cannot admit a changed provider identity",
  "prepopulated membership cannot admit a unknown provider identity",
  "prepopulated membership cannot admit a released provider identity",
  "no-registration interrupted machine stays fenced during restore",
  "no-registration failed machine stays fenced during restore",
  "no-registration released machine stays fenced during restore",
  "no-registration interrupted machine stays fenced during automatic registration",
  "no-registration failed machine stays fenced during automatic registration",
  "no-registration released machine stays fenced during automatic registration"]},
 "hub/test/host-secret-admission.test.ts": {"exact": false, "names": [
  "C3/C4 host CLI requires session credential and denies human frames",
  "C5 human revoke closes host peers and refuses subsequent hellos"]},
 "hub/test/web-authority.test.ts": {"exact": false, "names": [
  "signed-in web refuses pool preparation"]},
 "hub/test/cli-help.test.ts": {"exact": false, "names": [
  "cland --help retains its pre-refactor output byte for byte",
  "cland host serve --help exits without starting an agent",
  "cland host serve -h exits without starting an agent"]},
 "hub/test/host-destroy.test.ts": {"exact": true, "names": [
  "C4 destroy refuses an unknown id",
  "release names confirming machine and key reads, including an already gone machine",
  "destroy requires confirming reads: missing",
  "destroy requires confirming reads: throw",
  "restarted ambiguous acquisition without a machine stays deletion not confirmed",
  "held deleted-generation release preserves an onward replacement row and pending stop",
  "deleted host drains retained generation after its display row moved",
  "deleted host refuses incomplete local release receipt: generation",
  "deleted host refuses incomplete local release receipt: forward-owner",
  "forced held-release body failure joins deletion before session and storage cleanup"]},
 "hub/test/host-destroy-native.test.ts": {"exact": true, "names": [
  "C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=false",
  "C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=true",
  "destroy joins an admitted held acquisition and prevents ready resurrection"]},
 "hub/test/transport-config.test.ts": {"exact": false, "names": [
  "ssh, omitted transport and malformed non-transport hosts keys preserve config behavior",
  "quoted empty pool transport is refused at startup"]},
 "hub/test/host-runtime-delivery.test.ts": {"exact": true, "names": [
  "C1-C3 whole runtime delivery verifies files, reuses digest and atomically replaces CLI and spoke",
  "held installer fixture teardown joins writer before removing its root"]},
 "hub/test/host-agent-restart.test.ts": {"exact": false, "names": [
  "C1-C3 kill-agent reconnect reads retained table without signalling harness",
  "C1-C3 version delivery reconnect reads retained table without signalling harness",
  "C4 corrupt and escaping bundles never become selectable",
  "C3 adopted Claude worker survives version replacement with receipt authority and no signal",
  "T-1730 supervisor launches verified generation after version pointer changes"]},
 "hub/test/host-agent-closure.test.ts": {"exact": true, "names": [
  "committed agent closure matches the complete source and native asset graph",
  "host registry startup imports no development-only package",
  "restart requires exact fresh native birth and refuses reused or inherited PID authority",
  "recovery handshake preserves previous hello shape and gates the additive restore operation"]},
 "hub/test/claude-code-remote.test.ts": {"exact": false, "names": [
  "T-1730 C2 upgraded runtime launches Claude with connected mod bridge",
  "remote Claude frame launch adopts its worker and delivers through host hooks and bridge",
  "remote Claude pre-spawn root refusal permits immediate same-name launch",
  "remote Claude pre-spawn root refusal permits immediate different-name launch",
  "remote Claude native lost-reply same-name retry",
  "remote Claude native sent-abort same-name retry",
  "native command admission receipt pid-existed"]},
 "hub/test/host-runtime-bundle.test.ts": {"exact": true, "names": [
  "runtime manifest carries the hub lock, CLI, spoke and Claude mod with verified digests",
  "upload abort reclaims joined input",
  "upload abort retains input identity on incomplete cleanup"]},
 "hub/test/host-ssh-registry.test.ts": {"exact": true, "names": [
  "default version layout derives code root and supervisor once",
  "registry startup uses default installed supervisor and cleanup drains all owners after carrier failure"]},
 "hub/test/host-survival-native.test.ts": {"exact": false, "names": [
  "three remote harnesses retain births, forwards and welcomed spokes across 20s hub downtime and master loss"]},
 "hub/test/host-relaunch-native.test.ts": {"exact": false, "names": [
  "C2 production Codex relaunch crosses owned carriers and consumes a fresh native first input"]},
 "hub/test/host-revoke-native.test.ts": {"exact": false, "names": [
  "revoke settles live Claude Codex OpenCode and an already released Claude generation on the fake host"]},
 "hub/test/host-runtime-join.test.ts": {"exact": false, "names": [
  "C1/C2 runtime host joins without restart and removal settles rows and closes carrier and Git",
  "C3 runtime registered host reopens on the next hub start"]},
 "hub/test/host-runtime-owner.test.ts": {"exact": true, "names": [
  "runtime add opens the same owners and reopens a registered host after close",
  "runtime removal settles before carrier and Git closure and refuses later add",
  "duplicate runtime add retains the published owner without reacquiring or closing it",
  "failed runtime publication joins rollback before allowing another add",
  "failed runtime remove retains ownership and retries cleanup before unpublishing",
  "shutdown joins an in-flight runtime add and prevents its publication"]},
 "hub/test/host-ssh-contract.test.ts": {"exact": false, "names": [
  "ssh Host runs every shared Host behavioral contract through fake ssh",
  "C2 claude adapter sends no planted hub-only key through the SSH agent",
  "accepted spawn reconciles its durable token after the commit reply is dropped"]},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []},
 "hub/test/host-provider-fake.test.ts": {"exact": false, "names": [
  "fake: provider declares sane prices, billing and capabilities",
  "fake: create admission is allowed without side effects",
  "fake: provider contract creates, prepares, observes and confirms release",
  "fake: reap releases only the requested project and pool",
  "fake: refused acquire has a typed outcome",
  "fake: failed-acquire acquire has a typed outcome",
  "fake: delayed-boot preserves observed lifecycle outcomes",
  "fake: never-boot preserves observed lifecycle outcomes",
  "fake: ignored-delete preserves observed lifecycle outcomes",
  "fake arm64 only: provider contract creates, prepares, observes and confirms release",
  "fake x86_64 only: provider contract creates, prepares, observes and confirms release",
  "fake machine has independent home, run, boot identity and pinned key",
  "registry refuses fake outside its test environment and caches registered providers",
  "fake opens no network socket for any lifecycle operation",
  "fake provider refuses underscore pools consistently with config"]},
 "hub/test/prepare-key.test.ts": {"exact": true, "names": [
  "project hook owns Chromium libraries and pinned Neovim while the generic recipe stays neutral",
  "four-part prepare keys retain the existing snapshot hash",
  "a lock-only change invalidates the prepared browser snapshot",
  "snapshot dependency installation includes the lockfile-pinned Headless Shell",
  "absent prepare parts compare as none and become stale only when added or removed",
  "provision digest changes invalidate the snapshot with provision named",
  "config template documents the optional root provisioning script",
  "generic recipe digest invalidates a project snapshot without a hook",
  "legacy keys without recipe compare stale with recipe named",
  "a hook path change with identical bytes still marks provision stale"]},
 "hub/test/host-prelude.test.ts": {"exact": true, "names": [
  "C1: prelude installs pinned keys and hardened sshd settings",
  "C2: DigitalOcean steps, helper, sudoers and file credential store are installed",
  "C3: sentinel scan detects planted values and assignments, and rendered data excludes environment secrets"]}
}
JSON
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks. `src.mjs` counts exact strings at the build with `String.split` (`ok` or `MISMATCH`; `info` lines are printed for the reader, never judged alone), and keeps stage 2's computed T-1714 byte identity as the recipe's regression check.

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   exact-string counts at the build (String.split): ok, MISMATCH or info; then computed checks
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const W = process.argv[2];
const read = f => existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null;
const DO = 'hub/src/host/provider/digitalocean.ts', prep = 'hub/src/executor/droplet/prepare.ts', rec = 'hub/src/image/recipe.ts', recipe = 'hub/src/executor/droplet/provision.sh';
const ph = 'hub/src/host/provision-host.ts', usage = 'hub/src/cli/usage.ts', fixture = 'hub/test/fixtures/cli-usage/commands.json', web = 'hub/src/hub/web-authority.ts', dispatch = 'hub/src/hub/dispatch.ts';
const cd = 'hub/src/host/code-delivery.ts', pkg = 'hub/src/host/agent/package.ts', sv = 'hub/src/host/agent/supervisor.sh';
const C = [
  // T-1719 (VERIFIED at dev 142fbe97d)
  ['T-1719 C6 durable receipt admission names missing lease', DO, "missing.push('lease')", '=1'], // (superseded by T-1756)
  ['T-1719 C6 DigitalOcean admission is a typed side-effect-free method', DO, "createAdmission(): {state:'allowed'} | Extract<AcquireResult,{state:'refused'}> {", '=1'],
  ['T-1719 C6 DigitalOcean acquire calls the same admission', DO, 'const admission=this.createAdmission();', '=1'],
  ['T-1719 C4 missing or stale image refusal names host prepare', DO, "reason: 'run cland host prepare: pool image missing or stale'", '=1'],
  ['T-1719 C7 the provider supplies its prelude step', DO, "providerSteps: 'rm -f /etc/udev/rules.d/99-digitalocean-automount.rules'", '=1'],
  ['T-1719 C4 the create sends the prelude as user_data', DO, 'user_data: record.userData', '=1'],
  ['T-1719 C1 prepare goes through the executor builder', DO, 'const result = await executor.preparePool(options.pool, options.key);', '=1'],
  ['T-1719 the stage-2 keyed-prepare refusal is gone', DO, 'DigitalOcean pool image preparation unsupported', '=0'],
  ['T-1719 C5 executor builder default unchanged (T-1714 C5)', prep, "builder = await options.builder(options.recipe ?? renderRecipe({ arch: 'x86_64', node: key.node }));", '=1'],
  ['T-1713 C1 region allow-list unchanged (machines and volumes)', DO, "['lon1', 'fra1', 'ams3']", '=2'],
  // T-1718 (VERIFIED at dev 142fbe97d)
  ['T-1718 C5 host create in HOST_USAGE', usage, '  host create [pool] human-only local CLI: create a pool host from a current pool image to ready', '=1'], // (superseded by T-1756)
  ['T-1718 C5 host list in HOST_USAGE', usage, '  host list       human-only local CLI: id, pool, provider, size, region, state, uptime, USD/hour', '=1'],
  ['T-1718 C5 frozen usage fixture names host create', fixture, '  host create [pool] human-only local CLI: create a pool host from a current pool image to ready', '=1'], // (superseded by T-1756)
  ['T-1718 admission seam on the provider interface', 'hub/src/host/provider/provider.ts', 'createAdmission(admission?:HostCreateAdmission): CreateAdmission;', '=1'], // (superseded by T-1756)
  ['T-1718 the fake provider allows creation', 'hub/src/host/provider/fake.ts', "createAdmission(): {state:'allowed'} { return {state:'allowed'}; }", '=1'],
  ['T-1718 createHost asks the provider for admission', ph, 'const admission=provider.createAdmission(createReceipt);', '=1'], // (superseded by T-1756)
  ['T-1718 createHost throws the admission refusal', ph, "if(admission.state==='refused')throw Error(admission.reason);", '=1'],
  ['T-1718 the branch head fake-only refusal is gone', ph, "if(config.provider!=='fake')throw", '=0'],
  ['T-1718 C5 web refuses host.create', web, "'host.create': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1718 C5 web refuses host.list', web, "'host.list': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1718 C5 local-only dispatch refusal (all host frames)', dispatch, '`${frame.type} requires the human CLI or Neovim on a local connection`', '=1'],
  ['T-1716 dispatch text of stage 2 replaced', dispatch, "${frame.type === 'host.prepare' ? 'host preparation' : 'host revocation'}", '=0'],
  ['T-1718 C4 stale or absent image names host prepare', ph, 'image is not current; run cland host prepare ${pool}`', '=1'],
  ['T-1718 C3 the provisioning gate is five minutes', ph, 'export const PROVISION_GATE_MS = 300000;', '=1'],
  ['T-1718 C3 the fake takes its pinned key from the user-data', 'hub/src/host/provider/fake.ts', "if (options.userData !== undefined && !publicKey) throw new Error('missing prelude public key');", '=1'],
  // T-1734 (VERIFIED at dev 142fbe97d)
  ['T-1734 C1 one pool-name parser', 'hub/src/host/pool-name.ts', 'export function parsePoolName(value: string): string {', '=1'],
  ['T-1734 C1 the refusal names the grammar', 'hub/src/host/pool-name.ts', 'use 1–64 letters, digits and hyphens, starting with a letter or digit', '=1'],
  ['T-1734 C1 config read parses every pool name', 'hub/src/host/transport-config.ts', 'parsePoolName(name);', '=1'],
  ['T-1734 C1 a bad pool name is fatal at hub start', 'hub/src/hub/daemon.ts', '|invalid host pool:|', '=1'],
  ['T-1734 C1 the frame decoder uses the parser', 'hub/src/protocol.ts', 'try { parsePoolName(f.pool); return true; } catch { return false; }', '=1'],
  ['T-1734 C1 the grammar in HOST_USAGE', usage, 'pool: 1–64 letters, digits and hyphens; first character letter or digit', '=1'],
  ['T-1734 C2 pool-tag reap parses with the parser', DO, "d.tags.some(t => t.startsWith('cland-pool-') && validPool(t.slice(11)) && parsePoolName(t.slice(11)) === options.pool)", '=1'],
  ['T-1734 C2 key identity parses with the parser', DO, 'return match && validPool(match[1]!) ? { pool: parsePoolName(match[1]!), intent: match[2]! } : undefined;', '=1'],
  ...['hub/src/host/transport-config.ts', 'hub/src/host/provider/pool-image.ts', 'hub/src/host/provider/fake.ts', 'hub/src/executor/droplet/snapshot-recovery.ts', DO].map(f => ['T-1734 no second pool pattern in a pool reader', f, '[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}', '=0']),
  ['T-1734 no second pool pattern in DigitalOcean acquire', DO, '^[a-zA-Z0-9-]+$', '=0'],
  ['T-1734 no second pool pattern in DigitalOcean key identity', DO, '([a-zA-Z0-9-]+)-host-', '=0'],
  // T-1720 (VERIFIED-on-branch 3c8880cc0; MISMATCH until it lands)
  ['T-1720 host destroy in HOST_USAGE', usage, '  host destroy <id> human-only local CLI: remove host, delete machine and key with confirming reads', '=1'],
  ['T-1720 C4 web refuses host.destroy', web, "'host.destroy': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1720 C4 unknown id refused', ph, "if(!initial)throw Error('unknown host');", '=1'],
  ['T-1720 C3 destroying checkpoint names the unconfirmed deletion', ph, "record.state='destroying';record.reason='deletion not confirmed';", '>=1'],
  ['T-1720 C1 one host-destroy log event per confirming read', ph, "o.log({event:'host-destroy',host:record.id,...receipt});", '=1'],
  ['T-1720 C1 deleted host settles its sessions', 'hub/src/adapters/sessions.ts', 'async hostDeleted(host:string, read:string):Promise<void> {', '=1'],
  ['T-1720 C1 the release observer on the interface', 'hub/src/host/provider/provider.ts', 'release(machine: Machine, confirm?:ReleaseObserver): Promise<ReleaseResult>;', '=1'],
  ['T-1720 C1 the fake reports its machine read', 'hub/src/host/provider/fake.ts', "confirm?.({resource:'machine',read:`read ${join(directory,'gone')}: deleted`});", '=1'],
  ['T-1720 C1 DigitalOcean reports its droplet read', DO, "confirm?.({resource:'machine',read:`GET /droplets/${id}: 404`});", '=1'],
  ['T-1720 the CLI exits 0 only for destroyed', 'hub/src/cli/host.ts', "return value.state === 'destroyed' ? 0 : 1;", '=1'],
  // T-1730 (VERIFIED at dev 142fbe97d)
  ['T-1730 C1 handoff installs the whole runtime', cd, "await deliverRuntime({...o,transport:o.transport as Pick<SshTransport,'copyFile'|'execute'>,signal});", '=1'],
  ['T-1730 decision: v0.4.0 boundary in code', cd, 'Whole-runtime compatibility begins at v0.4.0, the first host release', '=1'],
  ['T-1730 decision: v0.4.0 boundary in docs', 'docs/agents/host-agent.md', 'Whole-runtime handoff compatibility starts at v0.4.0', '=1'],
  ['T-1730 C2 verifier returns the generation it checked', pkg, 'export async function verifyAgentPackage(root:string,version:string):Promise<string> {', '=1'],
  ['T-1730 C2 supervisor launches the verified generation', sv, 'set -- "$node" "$generation/hub/src/host/agent/entry.ts"', '=1'],
  ['T-1730 C4 migrations named in comments', 'hub/test/host-agent-restart.test.ts', 'T-1730 migration', '>=1'],
  // stage-2 regression (VERIFIED at dev efd68fbf0 and 142fbe97d)
  ['T-1716 unknown pool names the configured pools', 'hub/src/host/provider/pool-image.ts', "unknown pool ${pool}; configured pools: ${names.join(', ') || 'none'}", '=1'],
  ['T-1716 CLI prints pool, state and changed parts', 'hub/src/cli/host.ts', "${result.pool}: ${result.state}; changed: ${result.changed.join(', ') || 'none'}", '=1'],
  ['T-1723 npm argv carries --ignore-scripts', cd, "spawn('npm',['ci','-w','hub','--omit=dev','--ignore-scripts']", '=1'],
  ['T-1714 C3 recipe names no npm opencode-ai', rec, 'opencode-ai', '=0'],
];
const tree = (dir, text) => { let n = 0; const walk = d => { for (const e of readdirSync(`${W}/${d}`, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(ts|sh)$/.test(p)) n += readFileSync(`${W}/${p}`, 'utf8').split(text).length - 1; } }; walk(dir); return n; };
for (const [label, file, text, e] of C) {
  if (e.startsWith('tree')) { const n = tree(file, text); console.log(`${n >= Number(e.slice(6)) ? 'ok' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`); continue; }
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  if (e === 'info') { console.log(`info ${label} | ${file} | ${n}`); continue; }
  const pass = t !== null && (e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1)));
  console.log(`${pass ? 'ok' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
// T-1734 (informational): every pattern literal and parser call across hub/src, per file (old pattern / acquire pattern / key pattern / parsePoolName calls); at dev 142fbe97d the old patterns remain only for host ids (records.ts, protocol.ts host.revoke) and the executor's run.ts
{ const pats = ['[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}', '^[a-zA-Z0-9-]+$', '([a-zA-Z0-9-]+)-host-', 'parsePoolName('], hits = [];
  const walk = d => { for (const e of readdirSync(`${W}/${d}`, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (p.endsWith('.ts')) { const t = readFileSync(`${W}/${p}`, 'utf8'); const n = pats.map(x => t.split(x).length - 1); if (n.some(Boolean)) hits.push(`${p}:${n.join('/')}`); } } };
  walk('hub/src'); console.log(`info T-1734 pool-name pattern sites (pattern counts per file) | hub/src | ${hits.sort().join(' ')}`); }
// T-1718/T-1719 integration: one poolImageKey; createHost asks for admission after image checks and watchdog arming # (superseded by T-1756)
{ const t = read('hub/src/host/provider/pool-image.ts') ?? ''; const defs = t.split('export async function poolImageKey(root: string, env: NodeJS.ProcessEnv, provider: string): Promise<PoolImageKey> {').length - 1;
  console.log(`${defs === 1 ? 'ok' : 'MISMATCH'} T-1718/T-1719 one poolImageKey (root, env, provider) | hub/src/host/provider/pool-image.ts | ${defs} | =1`);
  const h = read(ph) ?? '', a = h.indexOf('const admission=provider.createAdmission(createReceipt);'), k = h.indexOf('const key=await poolImageKey(o.root,o.env,config.provider);'), i = h.indexOf('image is not current; run cland host prepare'); // (superseded by T-1756)
  console.log(`${k >= 0 && i > k && a > i ? 'ok' : 'MISMATCH'} T-1718/T-1719 C6 admission follows image checks and watchdog arming in createHost | ${ph} | ${k} < ${i} < ${a}`); } // (superseded by T-1756)
// T-1714 C5 (stage-2 regression): the x86_64 rendering equals the deployed template with its Node placeholder filled; the template digest is the one image-recipe pins
{ const t = read(recipe) ?? '', d = createHash('sha256').update(t).digest('hex'), pinned = '3cf36474d3b4e6a42c2a9edcbfb68b44b7c08b405f82f99f755651f502f7ef3d';
  console.log(`${d === pinned ? 'ok' : 'MISMATCH'} T-1714 C5 template digest | ${recipe} | ${d} | ${pinned}`);
  const { renderRecipe } = await import(`${W}/${rec}`);
  const same = renderRecipe({ arch: 'x86_64', node: 'v24.21.0' }) === t.replace('__NODE_VERSION__', 'v24.21.0');
  console.log(`${same ? 'ok' : 'MISMATCH'} T-1714 C5 x86_64 rendering byte-identical to the template | ${rec} | ${same} | true`); }
JS
node --check "$Q/src.mjs" && echo "src checked"
```

The check functions for QA's own shell and the scratch functions.

```sh
cat > "$Q/checks.sh" <<'SH'
landing() { git -C "$W" log --first-parent --format=%H --grep "^Item: $1\$" "$S"; }
# preserved: test files no stage-3 landing may edit (the files the items name for preservation and the earlier stages' regression files).
# Not here, because a landing edits them by design (VERIFIED at dev 142fbe97d): host-prepare and host-provider-fake (T-1734 grammar cases; T-1718 admission effects), host-runtime-bundle and host-runtime-delivery (T-1719 bundles cland-auth.sh), host-provider-digitalocean* (T-1719, T-1734, T-1718).
preserved() { printf '%s\n' hub/test/executor-droplet.test.ts hub/test/executor-prepare.test.ts hub/test/executor-safety.test.ts hub/test/executor-prepare-component.test.ts hub/test/verify-prepare.test.ts hub/test/prepare-key.test.ts hub/test/image-recipe.test.ts hub/test/host-provider-declarations.test.ts hub/test/host-provider-volumes.test.ts hub/test/host-prelude.test.ts hub/test/cland-auth.test.ts hub/test/host-relaunch-native.test.ts hub/test/host-survival-native.test.ts hub/test/host-revoke-native.test.ts hub/test/host-agent-closure.test.ts hub/test/host-ssh-contract.test.ts hub/test/host-ssh-registry.test.ts hub/test/host-runtime-join.test.ts hub/test/host-runtime-owner.test.ts hub/test/cli-help.test.ts hub/test/config-set.test.ts hub/test/init-config.test.ts; }
# t1720files: the files the Landing check compares with T-1720's queued head 3c8880cc0
t1720files() { printf '%s\n' hub/test/host-destroy.test.ts hub/test/host-destroy-native.test.ts hub/test/host-create-fixture.ts hub/test/host-create-ready.test.ts hub/test/host-provider-contract.ts hub/test/host-secret-admission.test.ts hub/test/web-authority.test.ts hub/test/fixtures/cli-usage/commands.json; }
MEMBERS="T-1719 T-1734 T-1718 T-1720 T-1730"
# extra <ids…>: test files those landings added or edited that no row of expect.json runs (printed by s02; a non-empty list is read before judging)
extra() { for id in "$@"; do L=$(landing "$id" | head -n 1); [ -n "$L" ] && git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/test | grep '\.test\.ts$'; done | sort -u | node -e 'const k=Object.keys(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")));let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const f of s.split("\n").filter(Boolean))if(!k.includes(f))console.log(f)})' "$Q/expect.json"; }
s00() {   # build, plan and landing receipts (QA's own shell)
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-before.txt"; echo "root non-tracker entries $(wc -l < "$EV/root-status-before.txt" | tr -d ' ')"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1533 --json) > "$EV/plan.json"; echo "plan read exit $?"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name==="create to ready");console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}):"stage missing")' "$EV/plan.json" | tee "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do
    echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"
  done
}
s01() {   # typecheck at the integrated build, in a fresh seal
  node "$Q/fresh.mjs" "$W" plain node --version
  node "$Q/fresh.mjs" "$W" plain npm run typecheck > "$EV/typecheck.log" 2>&1; echo "typecheck exit $?"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
}
s02() {   # landing diffs (read-only): test paths, product paths, package files and preserved files per landing; preserved files since the stage-2 close
  for id in $MEMBERS; do L=$(landing "$id" | head -n 1)
    echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id test paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/test | tr '\n' ' ')"
    echo "$id product paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/src shared | tr '\n' ' ')"
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json hub/package.json web/package.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "commits after the stage-2 close efd68fbf0 touching preserved files: [$(git -C "$W" log --format=%h efd68fbf099dde2366c93d88ad09b8af8287385f.."$S" -- $(preserved) | tr '\n' ' ')]"
  echo "T-1730 closure test unedited since efd68fbf0: $(git -C "$W" diff --quiet efd68fbf099dde2366c93d88ad09b8af8287385f "$S" -- hub/test/host-agent-closure.test.ts && echo yes || echo no)"
  echo "T-1720 files byte-identical to 3c8880cc: $(git -C "$W" diff --quiet 3c8880cc0be27026234a4504f63ecdc7a0226fa9 "$S" -- $(t1720files) && echo yes || echo "no: $(git -C "$W" diff --name-only 3c8880cc0be27026234a4504f63ecdc7a0226fa9 "$S" -- $(t1720files) | tr '\n' ' ')")"
  echo "test files no row runs, from the T-1720 and T-1734 landings: [$(extra T-1720 T-1734 | tr '\n' ' ')]"
}
s62() {   # end check and TMPDIR residue inventory (QA's own shell)
  echo "POST HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-after.txt"; echo "root non-tracker status unchanged: $(cmp -s "$EV/root-status-before.txt" "$EV/root-status-after.txt" && echo yes || echo no)"
  echo "preservation lock present: $([ -e /tmp/cland-preserve.lock ] && echo "yes: $(cat /tmp/cland-preserve.lock/owner 2> /dev/null)" || echo no)"
  A=$(cat "$Q/alias.txt" 2> /dev/null); echo "scratch fixture alias: ${A:-none recorded} $([ -n "$A" ] && { [ -L "$A" ] && echo present || echo gone; })"
  echo "T entries other than node-compile-cache: $(ls -A "$T" | grep -v -c -x node-compile-cache)"
  for e in $(ls -A "$T" | grep -v -x node-compile-cache); do
    echo "  T: $e type $(stat -f %HT "$T/$e") open $(lsof -t "$T/$e" 2> /dev/null | wc -l | tr -d ' ') first seen after $(awk -v e="$e" -F': ' '$2==e{print $1; exit}' $(ls "$EV"/*.tmpdir.txt))"
  done
}
SH
cat > "$Q/scratch.sh" <<'SH'
m50() {   # scratch project p1: Git repo, cland init, two fake pools and harness pins written while the hub is stopped, hub started; config set keeps the hosts tables (stage-2 regression, T-1733)
  echo "PRE p1 entries $(ls -A "$QA_Q/p1" | wc -l | tr -d ' '); fh entries $(ls -A "$QA_Q/fh" | wc -l | tr -d ' ')"
  cd "$QA_Q/p1" || return 1
  git init -q -b dev && git commit -q --allow-empty -m init; echo "git exit $?"
  cland init . > "$QA_EV/E1533S3-50-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  echo "init template hosts tables: $(cnt .cland/config.toml '[hosts')"; echo "territory: $(there .cland/territory.git)"
  printf '%s\n' '' '[hosts]' 'harnesses = { codex = "1.0.0" }' '[hosts.agents]' 'provider = "fake"' 'size = "fake"' 'region = "fake-1"' 'transport = "ssh"' '[hosts.spare]' 'provider = "fake"' 'size = "fake"' 'region = "fake-1"' >> .cland/config.toml
  printf '# qa provision hook\n' > setup.sh
  echo "hosts tables written: agents $(cnt .cland/config.toml '[hosts.agents]') spare $(cnt .cland/config.toml '[hosts.spare]')"
  hubstart; echo "hub start exit $?; hub $(up)"
  run "(provision key)" cland config set verification.provision setup.sh
  echo "  file: provision key $(cnt .cland/config.toml 'provision = "setup.sh"'); hosts tables kept: agents $(cnt .cland/config.toml '[hosts.agents]') spare $(cnt .cland/config.toml '[hosts.spare]'); harness pin lines $(cnt .cland/config.toml '"1.0.0"')"
}
m51() {   # T-1718 C5, T-1720, T-1734: help lists prepare, create, list, destroy and the pool grammar
  cd "$QA_Q/p1" || return 1
  run "(host --help)" cland host --help
  echo "  prepare lines $(has '  host prepare [pool]'); create lines $(has '  host create [pool]'); list lines $(has '  host list'); destroy lines $(has '  host destroy <id>'); pool grammar lines $(has 'pool: 1–64 letters, digits and hyphens; first character letter or digit')"
}
m52() {   # T-1718 C4: a create on a pool with no current image is refused naming host prepare; nothing acquired
  cd "$QA_Q/p1" || return 1
  run "(create spare, never prepared)" cland host create spare
  echo "  prepare-naming lines $(has 'run cland host prepare spare'); fake machines $(machines)"
}
m53() {   # stage-2 regression (T-1716): prepare agents, then current
  cd "$QA_Q/p1" || return 1
  run "(prepare agents)" cland host prepare agents
  echo "  prepared line $(has 'agents: prepared; changed: node, recipe, provision, harnesses'); record $(there .cland/run/hosts/agents-image.json); fake image $(there "$QA_Q/fh/images/agents.json")"
  run "(prepare agents again)" cland host prepare agents
  echo "  current line $(has 'agents: current; changed: none')"
}
m54() {   # T-1718 C1: create agents reaches ready; ids read back from host list; clone and delivered code tree on the fake host
  cd "$QA_Q/p1" || return 1
  run "(create agents)" cland host create agents
  echo "  ready state lines $(has '"state": "ready"'); fake machines $(machines)"
  run "(list after create)" cland host list; hl; pick
  [ -s "$QA_Q/machine.id" ] || { echo "  no ready agents row: later host rows BLOCKED"; return 1; }
  readlink "$QA_Q/fh/.fixture-sockets/alias" > "$QA_Q/alias.txt" 2> /dev/null; echo "  alias recorded: $(cat "$QA_Q/alias.txt")"
  H=$(hd "$(cat "$QA_Q/machine.id")")/home
  node --input-type=module -e 'const {hostCloneRoot}=await import(process.env.QA_W+"/hub/src/host/clone.ts");const {VERSION}=await import(process.env.QA_W+"/hub/src/version.ts");const fs=await import("node:fs");const [h,p]=process.argv.slice(1);const c=hostCloneRoot(h+"/.cland-host/run",p);console.log("  territory clone git config "+(fs.existsSync(c+"/.git/config")?"present":"absent"));const code=h+"/.cland-host/code/"+VERSION;for(const f of ["hub/bin/cland.ts","hub/bin/cland-spoke.ts","hub/mod/cland/.claude-plugin/plugin.json"])console.log("  code tree "+f+" "+(fs.existsSync(code+"/"+f)?"present":"absent"))' "$H" "$(pwd -P)"
}
m55() {   # T-1718 C2: host list shows the declared facts; the refused spare create left no row
  cd "$QA_Q/p1" || return 1
  run "(list)" cland host list; hl
  node -e 'const fs=require("fs"),q=process.env.QA_Q;const v=JSON.parse(fs.readFileSync(q+"/r.out","utf8"));const id=fs.readFileSync(q+"/host.id","utf8");const r=v.find(x=>x.id===id);console.log("  listed host "+(r?"present":"absent")+"; spare rows "+v.filter(x=>x.pool==="spare").length);if(r)console.log("  facts pool="+r.pool+" provider="+r.provider+" size="+r.size+" region="+r.region+" state="+r.state+" uptime "+(typeof r.uptime==="number"&&r.uptime>=0?"nonnegative number":"other")+" livePerHour="+r.livePerHour)'
}
m56() {   # T-1718 C1: an OpenCode session launched on the created host through the frame (no CLI host flag)
  cd "$QA_Q/p1" || return 1
  M=$(cat "$QA_Q/machine.id"); ID=$(cat "$QA_Q/host.id"); H=$(hd "$M")/home
  ports "$M"
  run "(launch oc)" node "$QA_Q/frame.mjs" "{\"type\":\"session.launch\",\"name\":\"oc\",\"harness\":\"opencode\",\"model\":\"opencode/fake-paid\",\"host\":\"$ID\",\"cwd\":\"$H\"}" 120000
  echo "  ok lines $(has '"ok":true'); unmapped port lines $(has 'unmapped fake host loopback port')"
  for i in $(seq 1 60); do r=$(srow oc); case "$r" in *"status=running"*) break;; esac; sleep 1; done
  echo "  oc row: $r; host matches $(case "$r" in "host=$ID "*) echo yes;; *) echo no;; esac)"
}
m57() {   # T-1720 C1: destroy ends the session, releases machine and key, logs one confirming read for each
  cd "$QA_Q/p1" || return 1
  M=$(cat "$QA_Q/machine.id"); ID=$(cat "$QA_Q/host.id"); D=$QA_Q/fh/.fixture-sockets/$M
  before=$(cnt .cland/log/hub.log '"event":"host-destroy"')
  run "(destroy)" cland host destroy "$ID"
  echo "  destroyed state lines $(has '"state": "destroyed"')"
  echo "  oc row after destroy: $(srow oc)"
  echo "  machine released: gone marker $(cat "$D/gone" 2> /dev/null || echo none); host-key.pub $(there "$D/host-key.pub"); client-key $(there "$D/client-key"); known_hosts $(there "$D/known_hosts")"
  sleep 2; echo "  host-destroy log lines added $(( $(cnt .cland/log/hub.log '"event":"host-destroy"') - before )); machine reads $(cnt .cland/log/hub.log '"resource":"machine"'); key reads $(cnt .cland/log/hub.log '"resource":"key"')"
  run "(list after destroy)" cland host list; hl
}
m58() {   # T-1720 C4: an unknown id is refused; nothing changes
  cd "$QA_Q/p1" || return 1
  m=$(machines)
  run "(destroy unknown)" cland host destroy host-00000000-0000-0000-0000-000000000000
  echo "  unknown host lines $(has 'unknown host'); fake machines unchanged $([ "$(machines)" = "$m" ] && echo yes || echo no)"
}
m59() {   # DigitalOcean unprepared pool refuses with host prepare before acquisition API calls # (superseded by T-1756)
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"
  printf '%s\n' '[hosts.do]' 'provider = "digitalocean"' 'size = "s-2vcpu-4gb"' 'region = "lon1"' >> .cland/config.toml
  echo "do table written: $(cnt .cland/config.toml '[hosts.do]')"
  hubstart; echo "hub start exit $?; hub $(up)"
  m=$(machines)
  run "(create do)" cland host create do
  echo "  host-prepare lines $(has 'cland host prepare'); token-required lines $(has 'DIGITALOCEAN_TOKEN is required')" # (superseded by T-1756)
  echo "  fake machines unchanged $([ "$(machines)" = "$m" ] && echo yes || echo no); provider state $(there .cland/host-provider/digitalocean)"
  run "(list)" cland host list; hl
}
m60() {   # T-1734 C1: a pool named with an underscore is refused at config read, naming the grammar (the hub refuses to start); the config is restored byte for byte
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"
  cp .cland/config.toml "$QA_Q/config.before-m60"
  logbefore=$(cnt .cland/log/hub.log 'invalid host pool: agents_1; use 1–64 letters, digits and hyphens, starting with a letter or digit')
  printf '%s\n' '[hosts.agents_1]' 'provider = "fake"' 'size = "fake"' 'region = "fake-1"' >> .cland/config.toml
  hubstart; x=$?; echo "hub start exit $x; hub $(up)"; grep -v '^\s*$' "$QA_Q/hubstart.out" | head -n 3 | cut -c1-200 | sed 's/^/  start: /'
  echo "  grammar lines: start output $(cnt "$QA_Q/hubstart.out" 'invalid host pool: agents_1; use 1–64 letters, digits and hyphens, starting with a letter or digit'); hub log added $(( $(cnt .cland/log/hub.log 'invalid host pool: agents_1; use 1–64 letters, digits and hyphens, starting with a letter or digit') - logbefore ))"
  if [ "$(up)" = up ]; then echo "  UNEXPECTED: the hub started with an agents_1 pool"; run "(prepare agents_1)" cland host prepare agents_1; echo "  grammar lines $(has 'letters, digits and hyphens')"; cland hub stop > /dev/null 2>&1; fi
  echo "  records: agents_1 image $(there .cland/run/hosts/agents_1-image.json); fake image $(there "$QA_Q/fh/images/agents_1.json")"
  cp "$QA_Q/config.before-m60" .cland/config.toml; echo "config restored: $([ "$(dg .cland/config.toml)" = "$(dg "$QA_Q/config.before-m60")" ] && echo yes || echo no)"
  hubstart; echo "hub start exit $?; hub $(up)"; run "(list)" cland host list; hl
}
m61() {   # cleanup census: hub stopped; host-side fake processes listed; nothing names the scratch root, the alias or this build's fakes
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub stop exit $?; hub $(up)"
  for p in $(sort -u "$QA_Q/pids"); do echo "recorded pid $p alive $(alive "$p")"; done
  A=$(cat "$QA_Q/alias.txt" 2> /dev/null)
  node -e 'const {execFileSync}=require("child_process");const marks=process.argv.slice(1).filter(Boolean);const rows=execFileSync("ps",["-axo","pid=,ppid=,command="],{encoding:"utf8"}).split("\n").filter(Boolean).map(l=>{const m=/^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l);return {pid:+m[1],ppid:+m[2],cmd:m[3]}});const by=new Map(rows.map(r=>[r.pid,r]));const anc=new Set();let p=process.pid;while(p&&by.has(p)&&!anc.has(p)){anc.add(p);p=by.get(p).ppid}const hits=rows.filter(r=>!anc.has(r.pid)&&marks.some(m=>r.cmd.includes(m)));console.log("processes naming the scratch root, the alias or this build: "+hits.length);for(const h of hits)console.log("  survivor "+h.pid+" "+h.cmd.slice(0,160))' "$QA_Q" "$A" "$QA_W/"
}
SH
. "$Q/checks.sh"; bash -n "$Q/scratch.sh" && echo "scratch checked"
```

Expected: `expect checked`, `src checked`, `scratch checked`. Record all of the setup above in `S0`.

Cleanup after the evidence is recorded and E1533S3-61 passed: print the alias recorded in `$Q/alias.txt`, check it is a symlink named `/private/tmp/ct-` plus 32 hex that resolves into `$Q/fh/.fixture-sockets`, and remove that symlink by its literal path; print `$Q` and check it begins with `/private/tmp/q53-`, then remove it by that literal path with a non-force recursive remove; print `$T`, check it begins with `/private/tmp/qa-e1533-s3-` and holds nothing but `node-compile-cache`, and remove it by that literal path. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The secrets in `$Q/p1/.cland/hub.json`, `$Q/p1/.cland/secret`, `$Q/p1/.cland/run/host-provisions/` and `$Q/fh` are never printed or posted.

## Cases

Every case is one named test file run once at the build, from QA's own shell through `nt` (or `pl` for T3 and native files, under the preservation lock), and recorded with `qa-record.sh note` (surface `hub-api`), its evidence `$EV/<id>.log`, `$EV/<id>.check.txt` and `$EV/<id>.tmpdir.txt`. A case passes only when its check line reads `CLEAN` (exit 0; `fail`, `cancelled`, `skipped` and `todo` 0; `pass` equal to `tests`; every listed name `ok`; for an `exact` list, the plan equal to the list and no unlisted name). A missing file at the build is a FAIL naming the file, never a silent drop. A `fresh: BLOCKED` line in a log makes the row BLOCKED, not FAIL. Run in table order; never two files at once. Rows E1533S3-10 to E1533S3-43 are the stage's own behaviour and its named preservation files; E1533S3-45 to E1533S3-47 are the stage-1 regression representatives (stage-2 representatives are marked in their rows).

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1533S3-10 | hub-api | QA | `nt E1533S3-10 hub/test/host-provider-digitalocean-prepare.test.ts` | `CLEAN` with the exact list (T-1719 C1 to C4, C6, C7; VERIFIED at dev `142fbe97d`). Test `digitalocean production create names the missing host lease watchdog and spend before API access`: `refused`, reason matching `lease.*watchdog.*reservation`, `createAdmission()` refused with zero API requests and `acquire` returning that same refusal. Test `digitalocean prepare builds an agent image then root provision and runner prepare, and reuses its key`: builder `user_data` pins `@openai/codex@1.2.3`, the first scripted command names `setup.sh` as `root`, the second `prepare-agent` as `runner`, the record's image is the fake API's, its regions hold `fra1`, tag requests for `cland` and `cland-pool-agents`; the second prepare is `current` with the request count unchanged. Test `digitalocean create refuses a missing or stale pool image and sends provider prelude with a current one`: missing image `refused` naming `cland host prepare` with zero requests; after prepare, `created` with the body's image the prepared id and `user_data` holding `99-digitalocean-automount.rules`, `runner ALL=(root) NOPASSWD: /usr/local/sbin/cland-auth` and `cli_auth_credentials_store = "file"`; a one-byte hook edit makes the next create `refused` with no request. Test `digitalocean replacement publishes before retirement and retains a split DELETE404 with live GET`. Test `digitalocean prepare transfers an unchanged image after the pool region changes`. Test `digitalocean pool key invalidates an omitted harness default without changing executor digest`. Test `digitalocean periodic reconciliation leaves an admitted pool builder recovery owned until it joins`  (superseded by T-1756) |
| E1533S3-11 | hub-api | QA | `nt E1533S3-11 hub/test/host-provider-digitalocean.test.ts` | `CLEAN` with every listed name (stage-2 regression for DigitalOcean on the fake API; T-1719 seeds prepared pool images and replaces two stage-2 titles). Test `digitalocean create carries configured inputs, isolated key and project/pool tags; invalid region makes no call` now expects the body image 9001 (the seeded pool image). Test `digitalocean configured base image does not override a prepared pool image` replaces stage 2's missing-configured-image test; the keyed-prepare refusal test is gone (T-1719 builds pool images). Test `digitalocean registry resolves and production acquisition refuses before any API request` (T-1719 C6). The `digitalocean: …` contract registrations, including `digitalocean: create admission is allowed without side effects` (T-1718: admission with the injected API in the test environment changes no request count and no provider file); the reap, retirement, declaration and pause tests as in stage 2. T-1734: the `"agents_1"` and `"-agents"` expansions of `digitalocean refuses invalid pool <name> before acquire or reap API calls` (both `failed`, zero requests) and the `agents-host-x` expansion of `digitalocean reaps valid pool tags and keys exactly: <pool>` (only the exact pool's droplet and key reaped; the `<pool>_1` droplet and the suffixed key survive) |
| E1533S3-12 | hub-api | QA | `nt E1533S3-12 hub/test/host-provider-digitalocean-volumes.test.ts` | `CLEAN` with the exact list (T-1717's volume behaviour unchanged after T-1719's fixture seeding) |
| E1533S3-13 | hub-api | QA | `pl E1533S3-13 hub/test/executor-droplet.test.ts` | `CLEAN`, the whole file, unedited (T-1719 C5; `droplet.ts` gains `preparePool`). Test `macOS inhibits idle sleep while the lease lives and drops the inhibitor after release` runs on macOS and must not be skipped |
| E1533S3-14 | hub-api | QA | `pl E1533S3-14 hub/test/executor-prepare.test.ts` | `CLEAN`, the whole file, unedited (T-1719 C5: `prepareSnapshot` generalised; the executor's defaults, key and record path unchanged). Test `a project without pins prepares a reusable snapshot for delivery` still asserts the key's `recipe` equals the sha256 of `provision.sh` |
| E1533S3-15 | hub-api | QA | `nt E1533S3-15 hub/test/executor-prepare-component.test.ts` | `CLEAN` with every listed name, unedited (T-1719 C5; also the stage-1 provision hook: the `failure=false` and `failure=true` expansions of `project provision runs as root before runner prepare, failure=<bool>`) |
| E1533S3-16 | hub-api | QA | `pl E1533S3-16 hub/test/executor-safety.test.ts` | `CLEAN`, the whole file, unedited, nested `shell` and `host` subtests included in the counters (T-1719 C5; `snapshot-recovery.ts` gains pool storage) |
| E1533S3-17 | hub-api | QA | `pl E1533S3-17 hub/test/verify-prepare.test.ts` | `CLEAN`, test `prepare uses installed snapshot inputs and rebuilds changed or missing installs`, unedited (T-1719 C5) |
| E1533S3-18 | hub-api | QA | `nt E1533S3-18 hub/test/image-recipe.test.ts` | `CLEAN` with the exact list, unedited (stage-2 regression for the recipe; T-1719 renders the agent-host recipe for DigitalOcean pool keys). Test `x86_64 builder preserves the committed recipe bytes and snapshot digest`; test `agent recipe pins all harnesses and installs OpenCode only from the v2 installer before ready` |
| E1533S3-19 | hub-api | QA | `nt E1533S3-19 hub/test/host-prepare.test.ts` | `CLEAN` with every listed name (stage-2 regression for pool images, `cland host prepare` and config-set preservation; T-1734 adds its grammar cases). Test `pool prepare CLI publishes an image and then reports current`; the `harnesses`, `lock` and `provision` expansions of `pool prepare invalidates <part> and names the changed part`; test `pool prepare selects all configured pools and unknown pool names the choices`; test `config set preserves SSH hosts and both pools before host prepare` (T-1733). T-1734 C1: the expansions of `pool grammar refuses <name> at config and storage` (`readHostPools` and `poolSnapshotStorage` both throw `letters, digits and hyphens` for `agents_1`, `-agents`, the empty name, a 65-character name, `agents.dot` and a trailing newline); test `project config read refuses underscore pool before any host command` (`parseConfig` throws); test `host prepare decoder shares pool grammar and preserves omitted and valid legacy frames` |
| E1533S3-20 | hub-api | QA | `pl E1533S3-20 hub/test/host-create-ready.test.ts` | `CLEAN` with the exact list (T-1718 C1 to C3; VERIFIED at dev `142fbe97d`; T3, native fake SSH and scripted OpenCode; T-1720 moves its fixture into `hub/test/host-create-fixture.ts` with the titles unchanged, VERIFIED-on-branch). Test `C1/C2 create reaches ready with clone and tunnel and runs OpenCode; list shows declared facts`: `cland host create agents` exit 0 with `state` `ready`; the clone's `.git/config` on the host; an authenticated Host operation; `session.launch` with `harness` `opencode` and `host` the record id persists a running native row on that host; `cland host list` row `id`, `pool` `agents`, `provider` `fake`, `size` `fake`, `region` `fake-1`, `state` `ready`, `livePerHour` 0, `uptime` at least 0; a fresh hub restores the same machine address with one registration. Test `C3 mismatched prelude key never registers or starts a supervisor and releases machine after gate`: `failed`, reason matching `pinned-key.*timed out` and naming the native exit, `release` `released`, no registration, provider `gone`, no supervisor pid file. The `unknown`, `inventory unknown`, `timed out`, `leftovers` and `complete` expansions of `failed readiness releases only after positive settlement: <receipt>` (only `complete` releases). The `revoke` and `shutdown` expansions of `held final readiness cannot publish ready after <action>`. Test `forced fixture body failure joins held creation before storage and root disposal` |
| E1533S3-21 | hub-api | QA | `nt E1533S3-21 hub/test/host-create-admission.test.ts` | `CLEAN` with the exact list (T-1718 C4, C5; T-1719 C6 at the frame). Test `C4 create refuses an unprepared pool naming host prepare` (exit 1, stderr names `cland host prepare`); test `C4 create refuses a prepared image after harness pins change` (`cland host prepare agents`); test `C5 host help lists create and list`; test `DigitalOcean create requires a prepared pool before acquisition API calls` (a `[hosts.do]` pool with no token: a positive-control `fetch` interception first, then `cland host create do` exit 1, stderr naming `cland host prepare`, no `fetch` call)  (superseded by T-1756) |
| E1533S3-22 | hub-api | QA | `nt E1533S3-22 hub/test/host-provision-records.test.ts` | `CLEAN` with the exact list (T-1718 review fix: the ready checkpoint is fenced against revocation and a different machine address; startup inventory streams only current registrations) |
| E1533S3-23 | hub-api | QA | `nt E1533S3-23 hub/test/host-provision-recovery.test.ts` | `CLEAN` with the exact list (T-1718 review fix): the `creating`, `booting`, `connecting` and `cloning` expansions of `restart retains interrupted <state> as failed incomplete without replay or release` (`host.list` shows `failed`/`incomplete` naming `interrupted`; no acquisition replay, no release, no registration); the `changed`, `unknown` and `released` expansions of `prepopulated membership cannot admit a <fault> provider identity` (no carrier constructed; the legacy manual entry kept); the `interrupted`, `failed` and `released` expansions of `no-registration <fault> machine stays fenced during <boundary>` for both `restore` and `automatic registration` |
| E1533S3-24 | hub-api | QA | `nt E1533S3-24 hub/test/host-secret-admission.test.ts` | `CLEAN` with every listed name (T-1718 C5; T-1720 C4). Test `C5 human revoke closes host peers and refuses subsequent hellos` now loops `host.prepare`, `host.create`, `host.list` and, at T-1720's head, `host.destroy` (VERIFIED-on-branch): each with an `as` from the host client and the session UI is refused `forbidden`, and each from the remote host client without `as` is refused. This file's C1 title carries the Authorization-scheme word, so its `ok` line is withheld by the redactor (see "Probes that mislead") |
| E1533S3-25 | hub-api | QA | `nt E1533S3-25 hub/test/web-authority.test.ts` | `CLEAN` with every listed name (T-1718 C5; T-1720 C4). Test `signed-in web refuses pool preparation` now loops `host.prepare`, `host.create`, `host.list` and, at T-1720's head, `host.destroy` (VERIFIED-on-branch): each `ok` false with code `cli-neovim-only` |
| E1533S3-26 | hub-api | QA | `nt E1533S3-26 hub/test/cli-help.test.ts` | `CLEAN` with every listed name, the test file unedited (T-1718 C5, T-1734, T-1720: `cland --help` equals the frozen usage fixture, which T-1718 updated with `host create [pool]` and `host list`, T-1734 with the pool-grammar line and T-1720, VERIFIED-on-branch, with `host destroy <id>`) |
| E1533S3-27 | hub-api | QA | `nt E1533S3-27 hub/test/host-destroy.test.ts` | `CLEAN` with the exact list (T-1720 C1, C3, C4; T2, no native host; VERIFIED-on-branch at `3c8880cc0`). Test `C4 destroy refuses an unknown id` (exit 1, stderr `unknown host`). Test `release names confirming machine and key reads, including an already gone machine` (two releases of one fake machine, each reporting `machine` then `key` with non-empty reads; `client-key` gone). The `missing` and `throw` expansions of `destroy requires confirming reads: <outcome>` (the record stays `destroying` with `deletion not confirmed`, no session settled). Test `restarted ambiguous acquisition without a machine stays deletion not confirmed`. Test `held deleted-generation release preserves an onward replacement row and pending stop`; test `deleted host drains retained generation after its display row moved`; the `generation` and `forward-owner` expansions of `deleted host refuses incomplete local release receipt: <wrong>` (the session stays `running`); test `forced held-release body failure joins deletion before session and storage cleanup` |
| E1533S3-43 | hub-api | QA | `pl E1533S3-43 hub/test/host-destroy-native.test.ts` | `CLEAN` with the exact list (T-1720 C1 to C3; T3, native fake SSH, delivered runtime, scripted OpenCode, under the preservation lock; VERIFIED-on-branch at `3c8880cc0`). The `tunnel down=false` expansion of `C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=<bool>`: `cland host create agents` `ready`, an OpenCode session on the host `running`, `cland host destroy <id>` exit 0 with `state` `destroyed`, the session row `exited`, `client-key` gone, the hub log's `host-destroy` events exactly `machine` then `key`, each with a `read`. The `tunnel down=true` expansion: the host's key replaced and its Host closed (transport unavailable), a first destroy against an ignored delete exits 1 with the session not `exited` and `cland host list` showing `deletion not confirmed`, then a second destroy exits 0 `destroyed` with the same outcome. Test `destroy joins an admitted held acquisition and prevents ready resurrection` (a destroy during a held acquisition checkpoints `destroying`, joins the creation, ends `destroyed`, the registration never `registered`, the machine `gone`). Run after E1533S3-20, never beside it |
| E1533S3-28 | hub-api | QA | `nt E1533S3-28 hub/test/transport-config.test.ts` | `CLEAN` with every listed name (T-1734 C1 at hub start; T2; VERIFIED at dev `142fbe97d`). Test `quoted empty pool transport is refused at startup` now expects the hub start refused matching `letters, digits and hyphens` (T-1734 edited only that expectation); test `ssh, omitted transport and malformed non-transport hosts keys preserve config behavior`; the `host transport <value> refuses start and CLI reload` expansions unchanged |
| E1533S3-29 | hub-api | QA | `pl E1533S3-29 hub/test/host-runtime-delivery.test.ts` | `CLEAN` with the exact list, nested subtest included in the counters (T-1730 C1, C3; stage-2 regression for whole-runtime delivery, T-1723 C1 to C3). Test `C1-C3 whole runtime delivery verifies files, reuses digest and atomically replaces CLI and spoke` now ends with the T-1730 block: with a V1 reader open, `agentVersionHandoff(…, version 'V2').update` installs `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts` and `hub/mod/cland/.claude-plugin/plugin.json` under `code/V2`, every V2 file matching the V2 manifest's sha256, and the open V1 reader still reads its own generation's bytes. T-1719 adds: the delivered tree's `hub/src/host/prelude.ts` renders a prelude holding `CLAND_AUTH_HELPER` and the delivered `cland-auth.sh` bytes. The scripted npm still records exactly `ci -w hub --omit=dev --ignore-scripts` |
| E1533S3-30 | hub-api | QA | `pl E1533S3-30 hub/test/host-agent-restart.test.ts` | `CLEAN` with every listed name, the whole file (T-1730 C2, C4). The `version delivery` and `kill-agent` expansions of `C1-C3 <mode> reconnect reads retained table without signalling harness` (migrated: the handoff source is the whole runtime, the dropped reply is the real installer's, `runtime-manifest.json` and `node_modules` present, each migration commented `T-1730 migration`); test `C3 adopted Claude worker survives version replacement with receipt authority and no signal`; test `T-1730 supervisor launches verified generation after version pointer changes` (a positive pointer-swap receipt, the supervisor still launches the generation it verified, `hello.version` `V2`, the unverified entry never runs) |
| E1533S3-31 | hub-api | QA | `nt E1533S3-31 hub/test/host-agent-closure.test.ts` | `CLEAN` with the exact list, the test file unedited (T-1730 C4: `closure.json` regenerated by T-1730, so test `committed agent closure matches the complete source and native asset graph` proves it) |
| E1533S3-32 | hub-api | QA | `pl E1533S3-32 hub/test/claude-code-remote.test.ts` | `CLEAN` with every listed name, the whole file (T-1730 C2; T-1727's cases unchanged). Test `T-1730 C2 upgraded runtime launches Claude with connected mod bridge`: a V1 whole runtime supervised on the fake host, handed V2, `hello.version` `V2`, then a Claude Code launch from `code/V2` whose bridge delivers a `pong:` answer and completes its native turn. Test `remote Claude frame launch adopts its worker and delivers through host hooks and bridge` |
| E1533S3-33 | hub-api | QA | `nt E1533S3-33 hub/test/host-runtime-bundle.test.ts` | `CLEAN` with the exact list (stage-2 regression for whole-runtime delivery; T-1730 moves `runtimeTreePath` into `package.ts` and re-exports it; T-1719 edits one assertion, VERIFIED at dev `142fbe97d`). Test `runtime manifest carries the hub lock, CLI, spoke and Claude mod with verified digests` (its path list now includes `hub/src/host/cland-auth.sh`); the expansions `upload abort reclaims joined input` and `upload abort retains input identity on incomplete cleanup` |
| E1533S3-34 | hub-api | QA | `nt E1533S3-34 hub/test/host-ssh-registry.test.ts` | `CLEAN` with the exact list, unedited (T-1730 and T-1718 preservation: version layout and registry startup; T-1718 edits `registry.ts`) |
| E1533S3-35 | hub-api | QA | `pl E1533S3-35 hub/test/host-survival-native.test.ts` | `CLEAN`, test `three remote harnesses retain births, forwards and welcomed spokes across 20s hub downtime and master loss`, unedited (T-1730 and T-1718 preservation). Allow its 20 s planned downtime; a slow pass is not a finding |
| E1533S3-36 | hub-api | QA | `pl E1533S3-36 hub/test/host-relaunch-native.test.ts` | `CLEAN`, test `C2 production Codex relaunch crosses owned carriers and consumes a fresh native first input`, unedited (T-1718 preservation: runtime registry and settlement). T-1735 is its known race; only its exact signature takes the rerun of "Carried corrections" |
| E1533S3-37 | hub-api | QA | `pl E1533S3-37 hub/test/host-revoke-native.test.ts` | `CLEAN`, test `revoke settles live Claude Codex OpenCode and an already released Claude generation on the fake host`, unedited (the revoke settlement T-1718's failure path and T-1720's destroy go through) |
| E1533S3-38 | hub-api | QA | `pl E1533S3-38 hub/test/host-runtime-join.test.ts` | `CLEAN` with every listed name, unedited (T-1718 adds `ready` to the runtime owner T-1706 built; stage-1 surface). Test `C1/C2 runtime host joins without restart and removal settles rows and closes carrier and Git`; test `C3 runtime registered host reopens on the next hub start` |
| E1533S3-39 | hub-api | QA | `nt E1533S3-39 hub/test/host-runtime-owner.test.ts` | `CLEAN` with the exact list, unedited (T-1718 preservation of the runtime owner) |
| E1533S3-40 | hub-api | QA | `pl E1533S3-40 hub/test/host-ssh-contract.test.ts` | `CLEAN`, the whole file, run **alone** in its own row (the SSH Host the created host is). T-1731 is its known mix-only flake of test `accepted spawn reconciles its durable token after the commit reply is dropped`; see "Carried corrections" |
| E1533S3-41 | hub-api | QA | `nt E1533S3-41 hub/test/test-docs.test.ts` | `CLEAN`: every new stage test file (`host-provider-digitalocean-prepare`, `host-create-ready`, `host-create-admission`, `host-provision-records`, `host-provision-recovery`, `host-destroy`, `host-destroy-native`) has a guide under `docs/agents/tests/` (T-1734 added no test file) |
| E1533S3-42 | hub-api | QA | `nt E1533S3-42 hub/test/suite-tiers.test.ts` | `CLEAN`: every new stage test file is in `hub/test/tiers.json` (at dev `142fbe97d`: `host-provider-digitalocean-prepare` T2, `host-create-admission` T2, `host-create-ready` T3, `host-provision-records` T1, `host-provision-recovery` T2; at T-1720's head: `host-destroy` T2, `host-destroy-native` T3) |
| E1533S3-45 | hub-api | QA | `nt E1533S3-45 hub/test/host-provider-fake.test.ts` | `CLEAN` with every listed name (**stage-1 regression: provider interface and fake provider**; T-1718 adds keyed user-data and admission to the fake and the factory's `admissionEffects`, T-1719 an optional `prepared` flag to the contract helper, T-1734 a grammar case, T-1720 the release observer's `machine` and `key` reads to the contract's lifecycle registration, VERIFIED-on-branch). The contract runs for `fake`, `fake arm64 only` and `fake x86_64 only`, including `fake: create admission is allowed without side effects` (no file under the fake root changes); test `registry refuses fake outside its test environment and caches registered providers`; test `fake opens no network socket for any lifecycle operation`; test `fake provider refuses underscore pools consistently with config` (T-1734: `agents_1` acquire and reap `failed`) |
| E1533S3-46 | hub-api | QA | `nt E1533S3-46 hub/test/prepare-key.test.ts` | `CLEAN` with the exact list, unedited (**stage-1 regression: the `[verification] provision` hook in the key**). Test `provision digest changes invalidate the snapshot with provision named`; test `config template documents the optional root provisioning script` |
| E1533S3-47 | hub-api | QA | `nt E1533S3-47 hub/test/host-prelude.test.ts` | `CLEAN` with the exact list, unedited (**stage-1 regression: the prelude**, now rendered by T-1718's create and T-1719's DigitalOcean create). Tests: `C1: prelude installs pinned keys and hardened sshd settings`, `C2: DigitalOcean steps, helper, sudoers and file credential store are installed`, `C3: sentinel scan detects planted values and assignments, and rendered data excludes environment secrets` |

### Web cases (when in scope)

none. The stage changes no web surface beyond the authority table (E1533S3-25); no browser runs.

## Manual checks

Run in table order: E1533S3-00 to E1533S3-03 before the cases, E1533S3-50 to E1533S3-62 after them. Scratch rows depend on the state the rows before them leave; a row whose prerequisite failed is BLOCKED, naming it. Record each with `sh .agents/skills/qa/qa-record.sh note E-1533 "$RUN" <id> hub-api "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence file>` from `$W`. Every scratch row's evidence begins with its `PRE gate` line (`credential-prefix names 0`, `QA_SESSION set yes`, HOME, TMPDIR, fake host root, ssh, scp and npm `yes`) and ends with `# fresh: redacted or withheld lines 0` and `row exit 0`; anything else is read before judging, and a gate refusal is BLOCKED. Give E1533S3-54 and E1533S3-56 a command timeout of at least 900000 ms.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1533S3-00 | hub-api | QA | `s00 > "$EV/E1533S3-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA the same 40 hex; `dirty entries 0`; the root's non-tracker count recorded. `plan read exit 0`; the stage line shows `name` `create to ready`, `qa` `{"scope":"full","when":"after-stage"}`, `items` holding T-1719, T-1734, T-1718, T-1720 and T-1730 plus any finding fixes the request names, `merged` equal to `total`, and `state` not `closed`. Every member line reads `landings 1` with its commit; any other count is BLOCKED |
| E1533S3-01 | hub-api | QA | `s01 > "$EV/E1533S3-01.txt" 2>&1` (QA's own shell; the typecheck runs sealed) | Node 24; `typecheck exit 0` (the whole workspace at the integrated build, which also proves the reconciled `poolImageKey` callers compile); `dirty entries 0` |
| E1533S3-02 | hub-api | QA | `s02 > "$EV/E1533S3-02.txt" 2>&1` (QA's own shell, read-only) | Every landing `package.json and lockfiles: 0`. `preserved files edited at its landing: []` for every landing, `commits after the stage-2 close efd68fbf0 touching preserved files: []` and `T-1730 closure test unedited since efd68fbf0: yes` (a non-empty list is read before judging; it is a finding unless the item's criteria or a recorded decision allow it). **Landing check:** `T-1720 files byte-identical to 3c8880cc: yes` (a `no:` list is an expected-registration correction, see "Build"); `test files no row runs, from the T-1720 and T-1734 landings: []`. Test paths per landing, against these sets (VERIFIED at the landings for the four landed members; VERIFIED-on-branch at `3c8880cc0` for T-1720): T-1730 `hub/test/claude-code-remote.test.ts hub/test/durations.json hub/test/host-agent-restart.test.ts hub/test/host-runtime-delivery.test.ts`; T-1719 `hub/test/digitalocean-pool-fixture.ts hub/test/host-provider-contract.ts hub/test/host-provider-digitalocean-prepare.test.ts hub/test/host-provider-digitalocean-volumes.test.ts hub/test/host-provider-digitalocean.test.ts hub/test/host-runtime-bundle.test.ts hub/test/host-runtime-delivery.test.ts hub/test/tiers.json`; T-1734 `hub/test/fixtures/cli-usage/commands.json hub/test/host-prepare.test.ts hub/test/host-provider-digitalocean.test.ts hub/test/host-provider-fake.test.ts hub/test/transport-config.test.ts`; T-1718 `hub/test/durations.json hub/test/fixtures/cli-usage/commands.json hub/test/host-create-admission.test.ts hub/test/host-create-ready.test.ts hub/test/host-provider-contract.ts hub/test/host-provider-digitalocean-prepare.test.ts hub/test/host-provider-digitalocean.test.ts hub/test/host-provider-fake.test.ts hub/test/host-provision-records.test.ts hub/test/host-provision-recovery.test.ts hub/test/host-secret-admission.test.ts hub/test/tiers.json hub/test/web-authority.test.ts`; T-1720 `hub/test/durations.json hub/test/fixtures/cli-usage/commands.json hub/test/host-create-fixture.ts hub/test/host-create-ready.test.ts hub/test/host-destroy-native.test.ts hub/test/host-destroy.test.ts hub/test/host-provider-contract.ts hub/test/host-secret-admission.test.ts hub/test/tiers.json hub/test/web-authority.test.ts`. Product paths are recorded for the reader; T-1719's landing holds no executor test file |
| E1533S3-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1533S3-03.txt" 2>&1` (QA's own shell, read-only) | Every judged line reads `ok`; the `info` line is recorded. T-1719: durable receipt admission held, in DigitalOcean's `createAdmission`, which its `acquire` calls; the host-prepare refusal, the provider's own prelude step, `user_data`, the executor builder path and the executor default unchanged, the stage-2 keyed-prepare refusal gone. T-1718: `host create` (fake-provider wording) and `host list` in `HOST_USAGE` and the frozen fixture, the web refusals, one local-only dispatch text for every host frame (stage 2's `host.prepare`-only text gone), `createAdmission` on the interface and the fake, `createHost` asking for and throwing the admission refusal, the branch head's fake-only refusal gone, image check before watchdog arming and durable admission, the image-not-current refusal, the 300000 ms gate, the fake's key from user-data, one `poolImageKey (root, env, provider)`. T-1734: `parsePoolName` and its grammar text, config read, the startup-fatal `invalid host pool:`, the frame decoder, the usage line, the pool-tag reap and key identity through the parser, and no second pool pattern in the pool readers (the `info` line lists every remaining pattern and parser call; the old pattern remains only for host ids). T-1720 (VERIFIED-on-branch; `MISMATCH` until it lands): `host destroy <id>` in usage, the web refusal, `unknown host`, the `destroying`/`deletion not confirmed` checkpoint, one `host-destroy` log call, `hostDeleted`, the release observer on the interface, the fake's and DigitalOcean's machine reads, the CLI exit rule. T-1730: the handoff's `deliverRuntime`, the v0.4.0 boundary in code and docs, the verifier's returned generation, the supervisor's launch of it, the `T-1730 migration` comments. Stage-2 regression: the T-1716 texts, the T-1723 npm argv, no `opencode-ai`, the T-1714 template digest and byte-identical rendering. A `MISMATCH` is read at the build before judging (a renamed string is followed to its new text) and is a FAIL unless the landing changed it with a recorded decision  (superseded by T-1756) |
| E1533S3-50 | hub-api | Human | `mrow E1533S3-50 m50` | **Scratch project and config-set preservation (stage-2 regression, T-1733).** `PRE p1 entries 0; fh entries 0`; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `init template hosts tables: 0`; `territory: present`; `hosts tables written: agents 1 spare 1`; `hub start exit 0; hub up`; `(provision key) exit 0`; `provision key 1`; `hosts tables kept: agents 1 spare 1`; `harness pin lines` 1 or more. A hub start failure makes E1533S3-51 to E1533S3-60 BLOCKED |
| E1533S3-51 | hub-api | Human | `mrow E1533S3-51 m51` | **T-1718 C5, T-1720 and T-1734 help.** `(host --help) exit 0`; `prepare lines`, `create lines`, `list lines`, `destroy lines` (T-1720, VERIFIED-on-branch) and `pool grammar lines` (T-1734) each 1 or more |
| E1533S3-52 | hub-api | Human | `mrow E1533S3-52 m52` | **T-1718 C4.** `(create spare, never prepared) exit 1` with `prepare-naming lines` 1 or more (`pool spare image is not current; run cland host prepare spare`: the fake's admission allows, then the image check refuses); `fake machines 0` (refused before acquisition) |
| E1533S3-53 | hub-api | Human | `mrow E1533S3-53 m53` | **Stage-2 regression: pool image and `cland host prepare`.** `(prepare agents) exit 0`, `prepared line 1`, `record present`, `fake image present`; `(prepare agents again) exit 0`, `current line 1` |
| E1533S3-54 | hub-api | Human | `mrow E1533S3-54 m54` | **T-1718 C1, create to ready, and the stage-2 whole-runtime delivery on a real create.** `(create agents) exit 0` with `ready state lines` 1 or more; `fake machines 1`; `(list after create) exit 0` with one `row … pool=agents provider=fake … state=ready`; `ready agents rows 1`; `alias recorded` a `/private/tmp/ct-` path; `territory clone git config present`; `code tree` `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts` and `hub/mod/cland/.claude-plugin/plugin.json` each `present`. A failure here makes E1533S3-55 to E1533S3-58 BLOCKED |
| E1533S3-55 | hub-api | Human | `mrow E1533S3-55 m55` | **T-1718 C2.** `(list) exit 0`; `listed host present; spare rows 0`; `facts pool=agents provider=fake size=fake region=fake-1 state=ready uptime nonnegative number livePerHour=0` |
| E1533S3-56 | hub-api | Human | `mrow E1533S3-56 m56` | **T-1718 C1, OpenCode on the created host.** `ports map … every loopback port to session.sock`; `(launch oc) exit 0` with `ok lines 1`, `unmapped port lines 0`; `oc row: host=<the listed id> status=running` (read from hub.db through the build's `ProcessTable`, as the named tests read it); `host matches yes`. **INFERRED as a scratch path** (the named test patches `Host.spawn` and `freePort` in process; here the all-ports map and the hub's relative `FAKE_OPENCODE_SOCKET` with `cwd` at the host's home stand in). If `oc` does not run, record BLOCKED with the reply text; T-1718 C1's launch then rests on E1533S3-20, and E1533S3-57's session line is judged as `no row` |
| E1533S3-57 | hub-api | Human | `mrow E1533S3-57 m57` | **T-1720 C1 (VERIFIED-on-branch at `3c8880cc0`).** `(destroy) exit 0` with `destroyed state lines` 1 or more; `oc row after destroy: host=<the listed id> status=exited` (or `no row` when E1533S3-56 was BLOCKED); `machine released: gone marker deleted; host-key.pub absent; client-key absent; known_hosts absent`; `host-destroy log lines added 2` with `machine reads 1` and `key reads 1`; `(list after destroy) exit 0` with the host's row `state=destroyed release=released reason=none` (destroyed records stay listed) |
| E1533S3-58 | hub-api | Human | `mrow E1533S3-58 m58` | **T-1720 C4 (VERIFIED-on-branch).** `(destroy unknown) exit 1` with `unknown host lines` 1 or more; `fake machines unchanged yes` |
| E1533S3-59 | hub-api | Human | `mrow E1533S3-59 m59` | Unprepared DigitalOcean create exits 1 naming `cland host prepare`; zero provider acquisition calls, no machine or key allocated.  (superseded by T-1756) |
| E1533S3-60 | hub-api | Human | `mrow E1533S3-60 m60` | **T-1734 C1 (VERIFIED at dev `142fbe97d`: the refusal branch).** `hub after stop: down`; `hub start exit 1; hub down` (the daemon rethrows `invalid host pool:` at start); `grammar lines` 1 or more in the start output or the hub log (`invalid host pool: agents_1; use 1–64 letters, digits and hyphens, starting with a letter or digit`); no `UNEXPECTED` line; `records: agents_1 image absent; fake image absent`; `config restored: yes`; the closing `hub start exit 0; hub up` and `(list) exit 0`. A hub that starts with an `agents_1` pool is a FAIL |
| E1533S3-61 | hub-api | Human | `mrow E1533S3-61 m61` | `hub stop exit 0; hub down`; every recorded pid `alive no`; `processes naming the scratch root, the alias or this build: 0`. Each `survivor` is read: the destroyed fake host's supervisor or agent (command under the alias or `$Q/fh`) is the fake's limitation (a released fake machine is a directory, not a stopped computer); QA ends it with `kill -TERM <pid>` after re-reading its command, records it, and repeats the row, which must then print 0. A surviving fake OpenCode for `oc` is a FINDING against T-1720 C1. Any other survivor is a FINDING |
| E1533S3-62 | hub-api | QA | `s62 > "$EV/E1533S3-62.txt" 2>&1` (QA's own shell, after the cleanup above) | HEAD, dev and the request's SHA still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock present: no`; `scratch fixture alias … gone`; `T entries other than node-compile-cache 0`. Each leftover is listed with its type, open count and the first file after which it appeared. Known dead T-1676 residue from unchanged files (open 0, owner PIDs gone) is removed by literal path and the row repeated; residue from `claude-code-remote` or `host-agent-restart` follows the A-17342 clause; live residue, or residue first seen after any other file a stage-3 landing added or edited, is a finding. A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1533-stage-3.md --commit <dev SHA>`, with a dev SHA that includes every stage landing. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- **Generated names cannot be certified by `qa lint`.** Contract registrations (`digitalocean: …`, `fake: …`) and loop titles (`failed readiness releases only after positive settlement: <receipt>`, `held final readiness cannot publish ready after <action>`, `restart retains interrupted <state> …`, `prepopulated membership cannot admit a <fault> …`, `no-registration <fault> machine …`, `pool grammar refuses <name> …`, `digitalocean refuses invalid pool <name> …`, `digitalocean reaps valid pool tags and keys exactly: <pool>`, `destroy requires confirming reads: <outcome>`, `deleted host refuses incomplete local release receipt: <wrong>`, `C1/C2/C3 destroy settles native session …; tunnel down=<bool>`, `C1-C3 <mode> reconnect …`, `pool prepare invalidates <part> …`, `digitalocean <status> pauses …`, `upload abort …`, `<arch> base …`) are expanded in `expect.json` and checked by `tap.mjs` at the run.
- **The created host is a fake machine.** Its "machine" is a directory under `$Q/fh/.fixture-sockets`; its host agent, supervisor and harnesses are local processes; "release" writes a `gone` marker and removes its key files. A process surviving a released fake machine says nothing about a real droplet (E1533S3-61).
- **No real SSH can run.** `$Q/bin` shadows `ssh` and `scp` by name, and `body.sh` refuses to run a row if a name resolves elsewhere; `CLAND_SSH_BIN`/`CLAND_SCP_BIN` name the same fakes. `ssh-keygen` is real and only writes a local key under `$Q/p1/.cland/run/host-provisions/`; never print it.
- **The npm on a created host is the offline stub** (it links the installed `node_modules`); the delivered tree proves the copy and the manifest, not a registry install.
- **OpenCode on a created host from a CLI-started hub** depends on the all-ports `ports.json` map and the hub's relative `FAKE_OPENCODE_SOCKET` reaching the harness through the adapter's environment (INFERRED). A launch that fails with `unmapped fake host loopback port` or a socket error is a probe limit (BLOCKED), not a product failure, unless E1533S3-20 also fails.
- **DigitalOcean durable admission** is enforced at the provider before acquisition API calls. The CLI checks the prepared image before reserving spend, publishing the lease and arming the watchdog; an unprepared DigitalOcean pool names `cland host prepare`. (superseded by T-1756)
- **Destroyed hosts stay listed.** `cland host list` keeps a destroyed record with `state` `destroyed`; "gone from the list" is not the landed behaviour (E1533S3-57). Its `machine` and `key` confirming reads are hub-log events, not CLI output.
- **A refused hub start is the T-1734 pass.** E1533S3-60's `hub start exit 1` is expected; the row restores the config and restarts, so later rows see a running hub.
- **Hand-written `[hosts]` tables are additions, not edits**, appended while the hub is stopped; `[verification] provision` goes through `cland config set` only. E1533S3-60 restores the config by byte copy and checks the digest.
- **`host list` prints JSON.** `hl` reads it; a non-JSON reply prints `list: not JSON` and the row is read before judging.
- **The redactor withholds whole lines.** `host-secret-admission`'s C1 title is expected to be withheld; any other withheld `ok` line makes the row INCONCLUSIVE, never a silent pass. The `# pass`/`# fail` counters are never withheld.
- **The executor files run a loopback fake DigitalOcean API.** Their `127.0.0.1` listener and synthetic credential are fixtures. A real DigitalOcean variable in a seal is a BLOCKED gate.
- **Plain `node --test` is not the suite runner.** It enforces no duration allowance and no resource tripwire preload: a slow pass is not a finding and a fast one proves no budget.
- Process cleanup probes use the fixture-owned pid census registered at launch (`$Q/pids`) and the scratch-root census; a machine-wide `pgrep` counts other sessions too.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- Speed criteria use measured wall times, never projections; this stage has none (the 5-minute gate is proven with an injected 300 ms gate in E1533S3-20 and a source constant in E1533S3-03).
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases: `executor-droplet`'s macOS idle-sleep case runs here; no listed file skips on macOS at writing.
- Re-check helper and function names with grep at the tested build; renames happen. The kit's line ranges are pinned by the stage-4 brief's blob; a different blob is a setup BLOCKED.

## Out of scope

- The real DigitalOcean API, real droplets, volumes, snapshots, keys and tokens, any network, and npm on hosts (the delivery's install runs only as the scripted stub).
- A `digitalocean` pool prepare in scratch (it enters the executor builder; T-1719's scripted proof is E1533S3-10).
- E-1534: the host lease, watchdog and `hosts` spend, `host status`, the scheduler and the hosts table's remaining keys.
- The epic Definition of done (a separate run).
- T-1731, T-1732 and T-1735 as bugs: their signatures are handled as in "Carried corrections"; their fixes are not judged here.
- Linux and container runs, the stage covers and the items' loaded repetitions: their evidence; this run is macOS only and says so in the verdict.
- Duration allowances (`hub/test/durations.json`) as pass conditions.
- Any `cland executor prepare`, `cland verify`, `cland host prepare`, `cland host create`, `cland host destroy` or `cland hub reload` on the live project.

Missing authorization (a real-browser or GUI step, a droplet, a real provider token) is out of scope, not BLOCKED, because none of these cases needs one.

## Grants

none. No grant is needed: every case runs on this Mac against fakes with a disposable HOME and no credential.

## Rows to verify after landing

**Settle every line here at `<dev SHA>` before requesting QA; record each difference in the brief or the request.** VERIFIED = read at dev `142fbe97d` (the four landed members) or `efd68fbf0`. VERIFIED-on-branch = read at T-1720's queued head `3c8880cc0`, confirmed at the build by the Landing check. INFERRED = not proven by a read of the build; derived from source and the tests' own patterns.

**Settled by the landings (VERIFIED at dev `142fbe97d`; no longer open):**

- T-1719 (`7d7aab2bc`, byte-identical to `6229e2c4f` for its source and tests): E1533S3-10's titles and assertions (the production-create test now also asserts `createAdmission()`), E1533S3-11's retitled tests and body image 9001, the fixture seeding, the `prepared` flag, the cland-auth bundling edits to `host-runtime-bundle` and `host-runtime-delivery`, the `src.mjs` strings.
- T-1730 (`0e32c139d`, byte-identical to `bce79b583`): E1533S3-29, E1533S3-30 and E1533S3-32's titles and blocks, the nine `T-1730 migration` comments, the closure test unedited, the v0.4.0 boundary.
- T-1734 (`c049da468`): the refusal branch of C1; `parsePoolName` and its text; the hub refuses to start on `agents_1`; its tests in `host-prepare`, `host-provider-digitalocean`, `host-provider-fake` and `transport-config` (E1533S3-19, E1533S3-11, E1533S3-45, E1533S3-28, E1533S3-60).
- T-1718 (`142fbe97d`): historical frame refusal replaced by current prepared-image and durable lease/watchdog/spend admission. (superseded by T-1756)

**VERIFIED-on-branch, T-1720 (`3c8880cc0`, in the merge queue):** E1533S3-27's and E1533S3-43's files, titles, tiers (T2, T3) and guides; `hub/test/host-create-fixture.ts` and the refactor of `host-create-ready.test.ts` onto it with titles unchanged; the `host.destroy` entries in E1533S3-24's and E1533S3-25's loops; the frozen usage fixture's `host destroy <id>` line; the release observer in `host-provider-contract.ts`; the CLI shape `cland host destroy <id>` (JSON record, exit 0 only for `destroyed`); `unknown host`; `deletion not confirmed`; the `host-destroy` log event with `resource` and `read`; destroyed records kept in `host list` as `destroyed`; sessions on the destroyed host marked `exited` by `hostDeleted`; the CLI usage-error line, which now names `create [pool] | list | destroy id`; every T-1720 `src.mjs` string. All of these are confirmed by the Landing check (E1533S3-02) and E1533S3-03 at the build.

**INFERRED, still open (scratch paths only):**

- E1533S3-56: OpenCode on a created host from a CLI-started hub. The named tests patch `Host.spawn` and `freePort` in process; the all-ports `ports.json` map and the hub's relative `FAKE_OPENCODE_SOCKET` with `cwd` at the host's home are this brief's stand-ins, never run on a CLI-started hub. BLOCKED fallback as written; E1533S3-57's session line follows it.
- E1533S3-60: that the refused start's message reaches the start output's log tail or the hub log line counted (the rethrow and the tail printing are VERIFIED in `hub/src/hub/daemon.ts` and `hub/src/cli/hub.ts`; the exact capture is not).
- E1533S3-57: the `host-destroy` lines appearing in `.cland/log/hub.log` within the row's 2-second settle (the native test flushes the project logs first).
- E1533S3-50: `cland init` creating `.cland/territory.git` in a fresh repository; `applies now` from `config set`.
- The exit code of each refused CLI command where no test asserts it (non-zero; 1 where a test asserts it).

## Source provenance

VERIFIED = read in source at dev `efd68fbf0` and again at dev `142fbe97d`; re-read at the build.

- The kit: `qa/briefs/E-1532-stage-4.md` blob `4ed467672750bf34179ed72549df863d1541eddb`, lines 133 to 136 and 228 to 279; `qa/briefs/E-1533-stage-2.md` blob `8b487eb00083f2b85fb2266bfa5f111005703b4b` (the seal, fresh, body and helper files this brief adapts; its corrections and decisions copied above); `frame.mjs` from `qa/briefs/E-1532-stage-6.md`; the `ports` map from `qa/briefs/E-1532.md`; `fixtureEnvironment` and `scratchGitEnvironment` in `test-support/fixture-environment.ts` (`FAKE_` overlays kept, `FAKE_` base names dropped, credentials filtered after the overlays); `askHubFrame` in `shared/socket-client.ts`.
- Fake transport: `hub/test/fakes/fake-ssh.ts` (host commands run with `fixtureEnvironment(host.directory, process.env, …)`, so `PATH` carries `$Q/bin`; loopback forwards only through `<host directory>/ports.json`, `unmapped fake host loopback port`); `hub/test/fakes/opencode/fake-opencode.ts` listens on `FAKE_OPENCODE_SOCKET` when set; `hub/src/host/ssh-binaries.ts` (`CLAND_SSH_BIN`/`CLAND_SCP_BIN` honoured only with both fake-host controls set); `shared/fake-host-directory.ts` and `shared/fixture-sockets.ts` (hosts under `<root>/.fixture-sockets/<name>`, one `/tmp/ct-<32 hex>` alias); `hub/src/host/provider/fake.ts` (status `gone` after the `deleted` marker with no key files; release writes it); the OpenCode adapter passes the hub's non-`CLAND_` environment to its launches (`hub/src/adapters/opencode.ts`); `CLAND_OPENCODE_BIN` selects the binary (`hub/src/adapters/index.ts`); the hub log is `.cland/log/hub.log` (`hub/src/project.ts`); `ProcessTable` (`hub/src/adapters/processes.ts`) reads a session's row with `host` and `status`, as `host-create-ready` and `host-destroy-native` do (`session.list`'s `HarnessProcessView` carries no host field).
- Titles of files no stage-3 landing touches, at dev `142fbe97d`: `host-relaunch-native` (line 30), `host-survival-native` (25), `host-revoke-native` (33), `host-agent-closure` (9, 16, 38, 53), `host-ssh-registry` (17, 24), `host-runtime-join` (14, 43), `host-runtime-owner` (12, 27, 56, 63, 79, 90), `host-prelude` (6, 12, 22), `executor-safety` (34, 51, 90); stage 2's lists for `executor-*`, `verify-prepare`, `image-recipe`, `prepare-key`, `cli-help`, `host-ssh-contract`, `claude-code-remote` (T-1727 titles) and `host-provider-digitalocean-volumes`. Titles of files the landings edited (`host-prepare`, `host-provider-fake`, `host-provider-digitalocean`, `host-runtime-bundle`, `transport-config`, the T-1718 files), read at dev `142fbe97d`.
- Startup refusal path: `hub/src/hub/daemon.ts` rethrows `invalid host pool:` config errors at start; `hub/src/cli/hub.ts` prints `the hub did not start (exited with …)` with the last 15 lines of this attempt's hub log.
- DigitalOcean provider construction without a token (`hub/src/host/provider/registry.ts`, the constructor in `digitalocean.ts`): an API object and a directory path, no file write and no request; `createAdmission()` refuses because no API was injected.
- Plan JSON: a stage carries `name`, `state`, `qa`, `items`, `merged`, `total`, `statuses`; stage `create to ready` has `qa` `{"scope":"full","when":"after-stage"}` and items T-1719, T-1734, T-1718, T-1720, T-1730.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "create to ready"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id and any earlier verdict's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1533 stage create to ready` or `qa not clear E-1533 stage create to ready` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
