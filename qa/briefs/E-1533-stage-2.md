# Stage QA brief: E-1533 stage 2 — DigitalOcean on a fake API, the recipe and pool images

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers; always brace a variable before `:`). The run is local, on macOS (BSD `stat`, Node 24, `uuidgen`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, DigitalOcean API, key, credential, npm registry or network (R-1530's QA rule).** The named files use only their own fakes: the scripted fake DigitalOcean API of `hub/test/fakes/digitalocean/fake-api.ts` (loopback listener, synthetic credential, FakeClock), the fake SSH transport and fake hosts of `hub/test/ssh-host-fixture.ts`, the filesystem fake host provider, and a scripted offline `npm` stub (`host-runtime-delivery`). A loopback listener inside those files is a fake, not network. Never run `hub/bin/verify-provision.sh` or `hub/src/executor/droplet/provision.sh` on this Mac. **No real harness:** Claude Code, Codex and OpenCode run only as the build's fakes. No browser, no GUI, no Neovim.

The stage is library, CLI and test level. The run is meant to take about two to three hours: setup and E1533S2-00 to E1533S2-03 about 20 minutes (the typecheck included); the named files E1533S2-10 to E1533S2-42 about 100 minutes, one file at a time, the native T3 files under the preservation lock; scratch rows E1533S2-50 to E1533S2-58 about 20 minutes. Waits for cover-quiet admission, the preservation lock or load are not product results.

## Carried corrections

A reused kit block must be reconciled against the source brief's recorded run corrections. This brief builds on `qa/briefs/E-1533-stage-1.md` (its kit conventions and seal) and on `qa/briefs/E-1532-stage-6.md` and `qa/briefs/E-1532.md` (the fresh per-command seal). What was carried, and how, is stated here; nothing below is optional.

### From `qa/briefs/E-1533-stage-1.md`, section "Corrections from this brief's own run (qa-678, A-17199)", verbatim

The stage-1 run at `5795362b` (run qa-s1-2026-11-06-qa678-1) applied two Coordinator-approved run-copy corrections. Both come from the E-1532 stage-6 run (A-17053), whose kit this brief reused by blob without its recorded corrections. A brief that copies this kit carries them as written here:

- **Seal every command fresh.** Build every files, typecheck and scratch command through a fresh shared-builder seal, with the hub overlay inside the builder and `login:false`. Never build them from a static `env.sh` or `env-hub.sh` snapshot (T-1705). Run the credential-name count as an immediate gate before each command; a non-zero count stops the row. Redact the stdout and stderr captures while they stream. Set `QA_SESSION` inside the builder, so recorder lines name the QA session and not the rescue default.
- **Known dead TMPDIR residue.** Inventory known residue from unchanged test files before the final census, and attribute it per file. At this build that is T-1676's spoke fallback sockets and `cland-fixture-owners-<uid>` receipts from `executor-droplet` (5+5) and `executor-prepare` (1+1). Check it dead (no `lsof` Unix entry, owner PIDs gone), then remove it by literal path after row 35, and repeat row 36. Live residue, or residue attributable to a stage item, stays a finding.

How this brief applies them:

- **Fresh seal (carried, both halves).** No `env.sh` or `env-hub.sh` exists in this run. Every named file, the typecheck and every scratch command runs through `fresh.mjs`, which builds its environment with `seal()` (the shared builder, `fixtureEnvironment` wrapped by `scratchGitEnvironment`) at the moment it starts. The QA roots, `QA_SESSION` and, for scratch rows, the hub overlay (`CLAND_TEST_SKIP_ORPHAN_SWEEP=1`, `CLAND_FAKE_HOST_ROOT=$Q/fh`) go **into** the builder; nothing is added after it returns. `fresh.mjs` refuses to start (exit 2, `fresh: BLOCKED`) on any credential-prefix name, and `body.sh` repeats the count as an immediate gate before a scratch row's function runs. QA's own shell commands run through the harness exec with `login:false` (a login exec re-sources the human's shell startup and re-adds provider variables, T-1705); `fresh.mjs`'s gate catches a leak either way.
- **Streaming redaction (carried).** `fresh.mjs` pipes the child's stdout and stderr line by line: exact values of every credential-shaped variable of QA's own shell become `[redacted]`, and a line the build's publication scanner (`assertPublishable`, `.agents/skills/qa/qa-demo-policy.ts`) refuses is replaced by `# fresh: line withheld by the publication scan`. It ends with `# fresh: redacted or withheld lines <n>`. Captures in `$EV` are only ever written through it.
- **`QA_SESSION` (carried).** QA's shell exports `QA_SESSION` (the QA session's name; a rescue run sets `rescue-<job id>`) and `state.json` carries it into the builder for every sealed command; `qa-record.sh` lines therefore name the QA session in both shells.
- **Known dead TMPDIR residue (carried, re-scoped to this run).** The 5+5 and 1+1 counts are stage 1's; this run re-inventories them. `nt` snapshots `$T` after every file into `$EV/<id>.tmpdir.txt`, so each entry is attributed to the first file after which it appears. Before the final census (E1533S2-58), known T-1676 classes from unchanged files (hub/spoke fallback endpoints, `cland-run` Codex sockets, `cland-fixture-owners-<uid>` receipts, `cx-*.sock` placeholders) are checked dead (no `lsof` entry, owner PIDs gone) and removed by literal path, then E1533S2-58 is repeated. Live residue, or residue first seen after a stage-2 file (the rows' files that a stage-2 landing added or edited, listed by E1533S2-02), stays a finding.

### From `qa/briefs/E-1532-stage-6.md`, "Corrections from this brief's own run (qa-678, A-17053)"

- **S0 PATH exemption — carried.** The S0 check exempts exactly two real-HOME directories, compared by realpath: the running Node `bin` and the build-resolved pinned Neovim directory (`node nvim/bin/nvim-path.ts`). Any other real-HOME entry fails S0. (The seal drops real-HOME entries anyway; the check proves it.)
- **Manual shells are sealed per command — carried**, as the fresh seal above (the same correction stage 1 carried).
- **Host clone discovery files are designed secret holders — not carried.** No row here launches an item session on a fake host or scans for secret holders, so no clone discovery file is created.

From the same brief's "Corrections folded in from earlier E-1532 runs", carried where they apply: the overlays go into `fixtureEnvironment` with `GH_PAGER: undefined`; `TMPDIR` of every sealed command is `$T`, of the suite root's byte length (T-1677); the publication scanner refuses the word that names the HTTP Authorization scheme when a word follows it (T-1665), so this brief never writes it, and `host-secret-admission`'s one title that carries it is withheld by the redactor (see "Probes that mislead"); censuses exclude the census process and its ancestors and match only this run's `$Q` and `$W` paths; macOS socket paths stay under 104 bytes with their NUL (`$Q` is 23 bytes); rule 22 (ids from listings and files, never from a create result); TAP parsing and exact strings as below. Not applicable here: Neovim on `PATH` (no row needs it), fake-host `CLAND_FAKE_HOSTS` controls, refused pushes, the hub-side TCP census (only `transport-forwards`' own census runs, inside its test).

### Kit conventions carried from stage 1

- **Rule 22.** Every selector, test name and string below is marked VERIFIED, VERIFIED-on-branch or INFERRED under "Source provenance"; an INFERRED expectation is never a pass condition on its own.
- **TAP.** `node --test <file>` reports top-level registrations with `1..N` and `# tests/pass/fail/cancelled/skipped/todo` counters that include nested subtests; names escape `#` and `\`. `tap.mjs` parses exactly that.
- **Exact strings** are counted by `src.mjs` with `String.split`, never by shell `grep`.
- **Censuses** exclude the census process and all its ancestors and match only this run's `$Q` and `$W` paths.
- **The preservation lock** is the directory `/tmp/cland-preserve.lock`, taken with `mkdir`, an owner file naming this run and row, and an owner-checked removal by literal path. A held lock makes the row BLOCKED for now (retry it later; never remove another owner's lock).

## Decisions from this brief’s first run (qa-678, A-17342)

- **T-1676 dead residue covers an unchanged producer inside a file the stage edited.** In E1533S2-35 a `cland-fixture-owners-<uid>` receipt came from the CLI-started-hub block of `claude-code-remote.test.ts`, which is byte-identical to the stage-1 build. That counts as T-1676 found aside, once QA has shown the residue is dead (PID absent, receipt not open, fixture root gone) and that the producing block’s SHA-256 is unchanged. Residue whose producing code the stage changed stays a finding.
- **E1533S2-50 found T-1733.** `cland config set` deletes the `[hosts.*]` tables, so the stage was not clear. The rerun after T-1733 lands uses this brief’s original row order, because the fix must make row 50 pass as written. T-1733 landed as `945b974cef3badd17e582c6d3f88f7c0b73fba30` (batch e4878d6a, A-17358). It adds a tenth stage member and changes `hub/src/init/config-set.ts`, `hub/src/init/config.ts` and the other config writers its sweep found. The rerun checks its landing receipt like the other members.

## Stage

- Epic: E-1533 (Host providers, images and DigitalOcean, under R-1530).
- Exact stage name: DigitalOcean on a fake API, the recipe and pool images.
- Items, in plan order: lane 1 T-1713 (the DigitalOcean host provider's machines), T-1715 (DigitalOcean declarations and refused creates), T-1717 (DigitalOcean volumes); lane 2 T-1714 (one image recipe with an architecture parameter); lane 3 T-1716 (pool images and `cland host prepare` on the fake provider); lane 4 T-1723 (a ready host receives cland's whole code tree for its version); lane 5 T-1727 (a Claude launch refused on a host before spawn no longer stays supervised); lane 6 T-1704 (native agent restart test sees "agent closed"); lane 7 T-1670 (transport-forwards C1 census attribution). The run reads membership, counts and state from `task plan show E-1533 --json` (E1533S2-00), never from this list. QA finding fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: **affected.** The combined changed behaviour of the stage, through its named test files, the preservation files its items name, read-only source checks, and scratch checks on the real CLI where an item has a user surface. No earlier-epic regression pass beyond those files.
  - T-1713: `DigitalOceanHostProvider` (`hub/src/host/provider/digitalocean.ts`) over the executor's `DigitalOceanApi`: a droplet per host in lon1, fra1 or ams3, tagged `cland`, the project tag and `cland-pool-<pool>`, with its own SSH key; status reads the droplet; release and reap delete droplet and key, each confirmed by a GET; a lost create response is found by tag at the next reap; the token never appears in output, errors, user-data or child argv. Registered in `HostProviderRegistry`. **Coordinator decision (recorded in the provider and `docs/hub/host-providers.md`, "Pool images"):** prepare observes a configured image only; keyed pool preparation is refused (`DigitalOcean pool image preparation unsupported`) before any API call. T-1719 (stage 3) owns the real pool image build. The provider imports `executor/droplet/api.ts`, `endpoint.ts` and `droplet.ts`, so `executor-droplet`, `executor-prepare` and `executor-safety` are in its import closure and are preservation files.
  - T-1715 (landed `7d88dbc0d`; VERIFIED): declarations read through the API (`price_hourly` from `/v2/sizes`, `droplet_limit` from `/account`, 0 idle once destroyed, `stoppedBills`, per-second billing with a 60 s minimum, x86_64, no extra address), held as `unavailable` until loaded; a 429 or a 422 droplet-limit refusal pauses every create until its retry time, refused creates answer `refused` with that time and are not re-sent, and one POST per create follows the pause. Refusal texts are fixed strings; the API redacts the token from provider text.
  - T-1717 (landed `54607a4a4`; VERIFIED): the DigitalOcean provider's volume operations on DigitalOcean Volumes and the fake API. Create makes a 1 GiB volume in an allowed region tagged `cland`, the project tag and `cland-pool-<pool>` (refused `volume pool unavailable` without a pool, before any request); attach and detach are actions polled until `completed` before the attachment is reported; an attach while attached to another droplet is refused `attached elsewhere`, a machine in another region `region mismatch`; a snapshot inside the 10-minute window is refused `rate limited` with the API's retry time, and a known refusal for the same volume identity answers without a request until then; delete goes through the API's confirmed delete (GET after DELETE), reporting `incomplete` while the volume is still found; list works by project tag. Volume creates share the machine creation pause (T-1715). The fake API gains volumes, volume actions and the snapshot window; `executor/droplet/deadline.ts` gains the volume calls' deadline positions.
  - T-1714: `renderRecipe({ arch, node, harnesses? })` (`hub/src/image/recipe.ts`); the executor builder (`prepare.ts`) renders the x86_64 base, byte-identical to `provision.sh` with its Node placeholder filled, so the snapshot key does not change; the agent-host part installs OpenCode only from `https://opencode.ai/v2/install` at its pin, Codex and Claude Code at their pins, never npm `opencode-ai`; an unknown architecture is refused. **Pin owners (recipe comment and T-1716's Coordinator clarification):** T-1714 renders only; T-1716 reads the `[hosts] harnesses` pins (exact `x.y.z`, ids `claude-code`, `codex`, `opencode`); T-1719 is the pool-image caller of the agent-host rendering (stage 3). The OpenCode URL in `recipe.ts` is admitted by an exact-literal exemption in `hub/test/accounts-policy.test.ts`.
  - T-1716: the pool image key (Node version, lockfile digest, generic recipe digest, `[verification] provision` path and content digest, sorted harness pins) and its per-pool record under `.cland/run/hosts/<pool>-image.json`; the `host.prepare` frame, refused off the local human CLI or Neovim as `host.revoke` is; `cland host prepare [<pool>]` printing `<pool>: <prepared|current>; changed: <parts|none>`; prepare on the fake provider (a record under `<CLAND_FAKE_HOST_ROOT>/images/<pool>.json`); `[hosts.<pool>]` provider, size, region and transport read per command. E-1534 owns the rest of the hosts table and `cland config set` for it.
  - T-1723: `runtimeBundle`/`deliverRuntime` (`hub/src/host/code-delivery.ts`) deliver cland's whole runtime tree (CLI, spoke, `hub/mod/cland`, the hub lockfile) to `<code>/<version>` through a staging directory, a digest manifest and an atomic version link; dependencies install with `npm ci -w hub --omit=dev --ignore-scripts` (**Coordinator-approved `--ignore-scripts`**). **The fake registry keeps the installed-tree shortcut** (fake hosts use the hub's installed tree); T-1718 (stage 3) calls the ready delivery; **T-1730 owns the later version handoff** (out of scope).
  - T-1727: a host command that never acquired a process carries a typed `nativeAdmission: 'no-process'` receipt (already-aborted signal, synchronous spawn throw, error with no PID); a Claude launch maps only that typed receipt, or its own pre-entry refusal, to `claudeAdmission: refused-before-spawn` and the hub settles it as non-admission; `wire()` refuses an already-aborted signal before any write as `CLAND_AGENT_ADMISSION_REFUSED` (`cancelled before send`). **Coordinator decisions f5e95222 and 9be88778:** native known-no-process paths and pre-wire cancellation are in scope; no error-text or `AbortError` inference; an observed PID, a lost reply, a sent abort or a missing receipt stays fenced.
  - T-1704: test-only fix. `serveAgent` publishes `agent.pid` before admission by design; the native restart test now waits for an authenticated hello from the exact PID, and a deterministic held-startup test reproduces the boundary. No product change.
  - T-1670 (landed `73bd6d4f2`; VERIFIED): test-only. `transport-forwards`' C1 census names each offending PID's sources, command, parent and native start identity, with a planted listener proving it (`hub/test/tcp-listener-census.ts`, pure cases in `tcp-listener-census.test.ts`). **C2 was revised** to "20/20 next to `tracker-ready-native` in a Linux `--init` container at load 8–12 and a green droplet verify, or the cause fixed"; the cause is open as T-1732.

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what.

| criterion | proven by |
| --- | --- |
| T-1713 C1 (create carries region, size, image and tags `cland`, project tag, `cland-pool-<pool>`; a region outside lon1, fra1, ams3 refused before any call) | E1533S2-10 (test `digitalocean create carries configured inputs, isolated key and project/pool tags; invalid region makes no call`); E1533S2-03 (the region list and the pool tag) |
| T-1713 C2 (DELETE 404 with GET 200 is not deleted; GET 404 is `released`) | E1533S2-10 (test `digitalocean release confirms both droplet and key with GET after split DELETE 404`) |
| T-1713 C3 (reap deletes a project- and pool-tagged droplet with no record and its prefixed key, each confirmed by a GET; other projects left alone) | E1533S2-10 (test `digitalocean reap finds tagged droplets and pool-prefixed keys without local intents`; test `digitalocean owned host and its key survive reap while an unowned host is removed`; test `digitalocean lost create response is reaped after provider restart; other pool and project survive`; the owner-admission reap tests) |
| T-1713 C4 (a create whose response is lost is found by its tags at the next reap) | E1533S2-10 (test `digitalocean lost create response is reaped after provider restart; other pool and project survive`) |
| T-1713 C5 (sentinel token in no log line, error, user-data or child argv) | E1533S2-10 (test `digitalocean provider keeps sentinel out of output, errors and user-data, and launches no child`); E1533S2-03 (the provider reads no token variable; the API's redaction) |
| T-1713 C6 (machine cases of the contract suite pass against the fake API) | E1533S2-10 (the contract registrations `digitalocean: …`, machine cases) |
| T-1713 decision (prepare observes a configured image only; keyed prepare refused; T-1719 builds images) | E1533S2-10 (test `digitalocean keyed pool preparation refuses through preparePools and registry without publishing a recipe receipt`; test `digitalocean missing configured image fails without a preparation receipt`; test `digitalocean registry resolves and production acquisition refuses before any API request`); E1533S2-03; E1533S2-56 (the real CLI on a `digitalocean` pool) |
| T-1713 preservation (executor files in the provider's import closure, unedited) | E1533S2-02 (no executor test file in any stage landing or since the stage-1 build); E1533S2-03 (the closure imports); E1533S2-16, E1533S2-17, E1533S2-18 (whole files) |
| T-1715 C1 (live price per size equals `price_hourly`, machine limit equals `droplet_limit`, declarations pass the contract) | E1533S2-10 (test `digitalocean declarations load API prices and limit atomically and retain the last good read`; test `digitalocean unavailable declarations refuse safely and recover without partial publication`; the contract registration `digitalocean: provider declares sane prices, billing and capabilities`); E1533S2-03; E1533S2-11, E1533S2-12 (the declaration union on the interface) |
| T-1715 C2 (a create answered 429 is `refused` with its retry time and succeeds on one retry after it) | E1533S2-10 (the `429` expansion of `digitalocean <status> pauses every create until retry time without POST cascades or token leaks`; test `digitalocean initial declaration 429 holds subsequent creates without a request`) |
| T-1715 C3 (while paused a second and third create send no POST; after it exactly one POST per create) | E1533S2-10 (both `429` and `422` expansions above; test `digitalocean held create refusal cannot shorten a concurrent declaration refresh pause`; test `digitalocean accepted create followed by address GET 429 retains ownership and pauses later creates`) |
| T-1715 C4 (a 422 droplet-limit refusal is paused and retried the same way; refusal text never carries the token) | E1533S2-10 (the `422` expansion; test `digitalocean unrelated 422 is failed and does not pause creation`); E1533S2-03 (fixed refusal texts, the redacted 422); E1533S2-14 (the API's error types unchanged in behaviour) |
| T-1717 C1 (a lon1 volume with the `cland`, project and pool tags attaches to a droplet and detaches, each action awaited to `completed`) | E1533S2-41 (test `digitalocean volume create carries lon1, 1 GiB and project/pool tags`; test `digitalocean volume actions publish attachment only after completed`; test `digitalocean volume creation requires a pool, shares pause and resolves acquire pool`; the contract registrations `digitalocean: volumes create, list and confirm deletion` and `digitalocean: volumes enforce one attachment and region binding`); E1533S2-03 (the volume tags, the completed-action gate) |
| T-1717 C2 (an attach to a second droplet while attached is refused as `attached elsewhere`) | E1533S2-41 (the contract registration `digitalocean: volumes enforce one attachment and region binding`, with `otherRegion` `fra1` for the region binding); E1533S2-03 (the refusal) |
| T-1717 C3 (a second snapshot within 10 minutes is refused with its retry time, as the fake API's 429 says) | E1533S2-41 (the contract registration `digitalocean: volumes rate limit snapshots until retry time`, the shared clock advanced 600000 ms; test `digitalocean known snapshot refusal returns immediately for the exact volume identity`); E1533S2-03 (the refusal carries the API's retry time) |
| T-1717 C4 (a volume DELETE answered 404 while its GET answers 200 is reported not deleted) | E1533S2-41 (the contract registration `digitalocean: ignored volume deletion retains inventory`, with the fake's `volumeDelete404Reads` fault: `incomplete` and the volume still listed; the create, list and confirm deletion registration for the confirmed path); E1533S2-03 (the API's confirmed volume delete, the `incomplete` result) |
| T-1717 C5 (the volume cases of the contract suite pass against the fake API) | E1533S2-41 (every `digitalocean: volumes …` contract registration); E1533S2-13 (the same contract on the fake provider, unedited); E1533S2-02 (`host-provider-contract.ts` not in T-1717's landing) |
| T-1717 extra (a lost create reply leaves a discoverable volume, never a replayed POST; executor deadlines unchanged in behaviour) | E1533S2-41 (test `digitalocean lost volume create reply retains discoverable resource without replay`); E1533S2-42 (`executor-deadline`, unedited, after T-1717 added the volume calls to `deadline.ts`) |
| T-1714 C1 (x86_64 downloads `node-<v>-linux-x64.tar.xz`, arm64 `node-<v>-linux-arm64.tar.xz`, each checked against `SHASUMS256.txt`) | E1533S2-19 (the `x86_64` and `arm64` expansions of `<arch> base downloads and verifies exact Node bytes without project packages`); E1533S2-03 (arm64 differs only by the archive architecture) |
| T-1714 C2 (no `nvim` or Chromium runtime package; the base names each listed package) | E1533S2-19 (the same expansions) |
| T-1714 C3 (agent-host rendering installs OpenCode from the v2 installer at its pin, Codex and Claude Code at their pins, never npm `opencode-ai`) | E1533S2-19 (test `agent recipe pins all harnesses and installs OpenCode only from the v2 installer before ready`; test `agent defaults use doctor minimums and reject unpinned or injected harness versions`); E1533S2-20 (test `image installer exception permits only the exact v2 literal in its recipe file`; test `hub source has no provider endpoint or credential-store access`); E1533S2-03 (the URL per file, the exemption line, no `opencode-ai`) |
| T-1714 C4 (an architecture other than x86_64 or arm64 refused before rendering) | E1533S2-19 (test `unknown architectures and unsafe version pins refuse before rendering`); E1533S2-03 |
| T-1714 C5 (executor x86_64 rendering byte-identical to `provision.sh` apart from template mechanics; snapshot key unchanged) | E1533S2-19 (test `x86_64 builder preserves the committed recipe bytes and snapshot digest`); E1533S2-03 (computed byte identity, the template digest, the builder call); E1533S2-17 (the prepared key's recipe digest equals `provision.sh`'s); E1533S2-21, E1533S2-22, E1533S2-23 (unedited key, component and verify-prepare files); E1533S2-02 |
| T-1716 C1 (`cland host prepare` prints `prepared` and then `current`) | E1533S2-24 (test `pool prepare CLI publishes an image and then reports current`); E1533S2-52, E1533S2-53 (the real CLI in a scratch project) |
| T-1716 C2 (a harness pin, the lockfile or the hook changed makes the next prepare print `prepared` naming that part) | E1533S2-24 (the `harnesses`, `lock` and `provision` expansions of `pool prepare invalidates <part> and names the changed part`); E1533S2-54 (a one-byte hook edit through the real CLI) |
| T-1716 C3 (no pool prepares every configured pool; an unknown pool refused naming the configured ones) | E1533S2-24 (test `pool prepare selects all configured pools and unknown pool names the choices`); E1533S2-52, E1533S2-55; E1533S2-03 |
| T-1716 C4 (`host.prepare` from a session or a remote refused as `host.revoke` is; `cland host --help` lists `prepare`) | E1533S2-24 (the same test's help check); E1533S2-25 (test `C5 human revoke closes host peers and refuses subsequent hellos`); E1533S2-26 (test `signed-in web refuses pool preparation`); E1533S2-27 (test `cland --help retains its pre-refactor output byte for byte`, with the updated frozen usage); E1533S2-03 (the dispatch and web refusals, `HOST_USAGE`); E1533S2-51 (the real help) |
| T-1723 C1 (delivery installs `<code>/<version>` with `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts`, `hub/mod/cland`, each matching the manifest digest) | E1533S2-29 (test `C1-C3 whole runtime delivery verifies files, reuses digest and atomically replaces CLI and spoke`); E1533S2-28 (test `runtime manifest carries the hub lock, CLI, spoke and Claude mod with verified digests`) |
| T-1723 C2 (same version and digest copies nothing; a changed digest replaces the tree atomically) | E1533S2-29 (the same C1-C3 test); E1533S2-28 (the `upload abort …` expansions) |
| T-1723 C3 (delivered spoke and CLI answer `--version` with the hub's version) | E1533S2-29 (the same C1-C3 test) |
| T-1723 C4 (host-agent-restart, host-agent-closure and the version-handoff cases pass with no test edited) | E1533S2-02 (neither file in T-1723's landing nor since the stage-1 build); E1533S2-30 (the whole file, with the `version delivery` and `kill-agent` expansions of `C1-C3 <mode> reconnect reads retained table without signalling harness`); E1533S2-31 |
| T-1723 decisions (`--ignore-scripts`; fake registry keeps the installed tree; T-1730 later) | E1533S2-03 (the npm argv); E1533S2-29 (the scripted npm records the exact argv) |
| T-1727 C1 (a host Claude launch refused by the account-root fence before spawn leaves no supervised failed launch; an immediate relaunch of the same name is admitted) | E1533S2-35 (the `same-name` and `different-name` expansions of `remote Claude pre-spawn root refusal permits immediate <name> launch`; the `aborted`, `spawn-error` and `pre-wire` expansions of `remote Claude native <mode> <name> retry`; the `aborted`, `throw`, `no-pid-error` expansions of `native command admission receipt <mode>`); E1533S2-32 (test `Claude refuses nonprivate account root before any command and rejects foreign-owner metadata`; test `an already admitted Claude generation cannot claim pre-spawn refusal`); E1533S2-33 (the `matching-generation` expansion of `SSH Claude pre-spawn admission receipt <shape>`); E1533S2-34 (the expansions of `native no-PID error admission <boundary>`); E1533S2-03 (typed mapping, no error-text or `AbortError` inference) |
| T-1727 C2 (a genuinely unknown spawn outcome stays fenced with its existing message) | E1533S2-35 (the `lost-reply` and `sent-abort` expansions of `remote Claude native <mode> <name> retry`; the `pid-existed` expansion of `native command admission receipt <mode>`); E1533S2-32 (the `untyped` and `real-incomplete` expansions of `native incomplete classification honors owner proof <proof>`); E1533S2-33 (the `legacy`, `native-only` and `other-generation` expansions); E1533S2-36 (the whole SSH Host contract, its migrated Claude refusal included) |
| T-1704 C1 (cause named with a reproduction, or a differential shows no recurrence) | The item's recorded evidence (impl-1704 comments; A-17225, A-17247: cause confirmed, held-startup reproduction red then green); E1533S2-37 (test `prepared restart observation waits through identity publication before agent admission`, once) |
| T-1704 C2 (deterministic test red before and green after; loaded macOS and Linux `--init` repetitions) | E1533S2-37 (both test `prepared restart observation waits through identity publication before agent admission` and test `native agent restart cleans actual unfinished spawn and worktree preparations before publishing readiness` CLEAN once); the loaded and Linux repetitions are the item's evidence (A-17247, A-17225), out of scope here; E1533S2-02 (no product path in its landing) |
| T-1670 C1 (a census failure names each offending PID's command, start identity and reason, with a planted listener) | E1533S2-39 (test `C1 Unix and host-loopback forwards answer with no hub TCP listener; C2 cancellation removes both`: its planted listener must fail the same assertion with pid, sources, command, parent and `darwin:` start); E1533S2-38 (the pure attribution cases) |
| T-1670 C2 (revised: 20/20 next to `tracker-ready-native` in a Linux `--init` container at load 8–12 and a green droplet verify, or the cause fixed) | The item's recorded evidence (A-17294; verify 59cf32ad, A-17308), out of scope here; E1533S2-39 (the file CLEAN once on macOS); E1533S2-02 (no product path in its landing). The open cause is T-1732 (out of scope) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1533 --json` lists in stage `DigitalOcean on a fake API, the recipe and pool images`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task with a branch still needs its landing receipt even if the branch has no commits; a task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion). A dirty build, a missing required merge (**every member has a branch here, so each needs a landing**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At writing (dev `54607a4a4aa9471f8a56f6f0907f911dc138e3fd`): T-1716 landed as `4cb561cb72645aa5028cd2d54173c4efcc2c3dee`, T-1704 as `f0e7e9284c25992fbe5ecfe1a4bf56dcf8db01a6`, T-1714 as `e6e7fb44d6b78431d54d9a2e66e20ee038355b73` (tracker `dd43ad65b`), T-1713 as `30145b7c67b135268befec8f352dd603673c5c71`, T-1723 as `e4328d076885584ecbce2d4334306a434ac4bd25`, T-1727 as `a03310d3c6562b590d94fdcf8683d2de0147dd94` (tracker `261875982`), T-1715 as `7d88dbc0d43e97a7a2ba9aeed37a3487d21d7753`, T-1670 as `73bd6d4f2f1d49a116c3dd989e1cda60e030f39c` and T-1717 as `54607a4a4aa9471f8a56f6f0907f911dc138e3fd`; every member of the stage has landed. T-1715 and T-1670 were first read on their batch heads (`d8989d02e`, `80cf1151a`) and re-read at their landings: their test files and the T-1715 provider and API sources are byte-identical between head and landing. T-1717's titles, strings and test paths were read at its landing (VERIFIED). Any later dev commit touching a named file is read at the build and a difference is recorded before judging. The request names the tested dev SHA and any finding fixes added to the stage after writing.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. No named file needs `web/dist`; E1533S2-01 runs the typecheck only.

**Where things live.** All scratch state is outside the project root: `$Q` (`/private/tmp/q52-…`, realpath, 23 bytes) holds the scratch project `p1`, the fake-host root `$Q/fh`, the scratch HOME and every directory `fixtureEnvironment` synthesizes, and every helper file. `$T` is `TMPDIR` of every sealed command. The only paths under the repository are the ones QA tooling prescribes, both ignored by `.cland/.gitignore`: the detached build `$W` in `.cland/worktrees/` and the evidence tree `$EV` in `.cland/qa/E-1533/<run>/`. Nothing is written to `.cland/tasks/` of the live project; E1533S2-00 and E1533S2-58 print the root's non-tracker status, which must not change.

**Isolation (rule 15).** Every scratch check runs in a disposable project with its own HOME, XDG directories and Git config, with provider and account variables removed, through the fresh seal. Never the live project at `/Users/evgeniyivanov/Projects/cland/v0`, its hub, its config, its territory, its `hub.db` or the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). Never read or print `.cland/secrets.toml`, any `hub.json` secret, `~/.config/cland/sandbox-remote.secrets.toml` or any credential; never run a real `ssh`, `scp`, `sshd` or `npm ci`/`npm install` against a registry; never run `cland executor prepare`, `cland verify`, `cland host prepare` or `cland hub reload` against the live project. The live hub is read only by QA's own shell for the plan read and `quiet` (the live verify queue is read, nothing is submitted).

Two shells, never mixed. **QA's own shell** keeps QA's session identity and runs its commands with the harness's `login:false`: it creates the worktree and the scratch roots, runs `quiet`, the plan read and the read-only source checks, starts every sealed command through `fresh.mjs`, and records every check with `qa-record.sh`. **Every other command runs inside `fresh.mjs`**: named files and the typecheck in `plain` mode (cwd `$W`), scratch rows in `hub` mode (cwd `$Q/p1`, through `body.sh`). Never use `env -i`; never source an environment snapshot.

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json`. In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<dev SHA>                                    # the full dev SHA from the request
RUN=qa-s2-$(date +%F)-1                        # unique run id for E-1533; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}   # the QA session's name (a rescue run sets rescue-<job id> first)
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
W=$R/.cland/worktrees/qa-e1533s2-$RUN          # the clean detached build (ignored by Git)
EV=$R/.cland/qa/E-1533/$RUN                    # captures (qa-record.sh keeps its evidence here too; ignored by Git)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
NV=$(cd "$W" && node nvim/bin/nvim-path.ts 2> /dev/null); NVD=$(dirname "${NV:-/nonexistent/x}")   # the pinned Neovim directory, only for the S0 exemption
T=/private/tmp/qa-e1533-s2-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q52-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/fh"
chmod 700 "$Q/claude" "$Q/fake-claude"
: > "$Q/pids"                                  # the fixture-owned process census: every scratch hub pid is appended here
: > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
printf '{"W":"%s","Q":"%s","EV":"%s","T":"%s","R":"%s","SESSION":"%s"}\n' "$W" "$Q" "$EV" "$T" "$R" "$QA_SESSION" > "$Q/state.json"
```

**The kit, by exact line range.** The shell functions `holder`, `quiet` and `ld` (lines 133 to 136) and `tap.mjs` (lines 228 to 279) are taken unchanged from the stage-4 brief **as committed in the build** (`$W/qa/briefs/E-1532-stage-4.md`, blob `4ed467672750bf34179ed72549df863d1541eddb`, the same blob on dev at `54607a4a4`). A different blob means the ranges moved, and the setup is BLOCKED (nothing else run). **Not taken:** the kit's `nt` and `rp` (lines 137 to 140), because they source a static `env.sh` (the stage-1 run's correction); this brief's own `nt`, `pl` and `mrow` replace them. Nothing else is taken from that file.

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

**The fresh seal.** `seal.mjs` exports `seal(extra, front)`; it has no environment-file mode. `fresh.mjs` runs one command in a fresh seal, gated and redacted. `body.sh` is a scratch row's body.

```sh
cat > "$Q/seal.mjs" <<'JS'
// const { seal } = await import(`${Q}/seal.mjs`)   seal(extra, front): one launch's environment, built when called
// Overlays go INTO fixtureEnvironment(Q, base, overlays), which filters credentials after them; scratchGitEnvironment wraps it; nothing is added after.
import { dirname } from 'node:path';
import { userInfo } from 'node:os';
const base = process.env;
const [W, Q, EV, T, R] = [base.QA_W, base.QA_Q, base.QA_EV, base.QA_T, base.QA_R];
if (!W || !EV || !R || !/^\/private\/tmp\/q52-[A-Za-z0-9]+$/.test(Q ?? '') || !/^\/private\/tmp\/qa-e1533-s2-[0-9a-f-]{36}$/.test(T ?? '')) {
  console.error('seal: refused: not this run\'s scratch roots'); process.exit(2);
}
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${W}/test-support/fixture-environment.ts`);
const realHome = userInfo().homedir, nodeBin = dirname(process.execPath);
const drop = p => !p || p === nodeBin || p.startsWith('~') || p === realHome || p.startsWith(`${realHome}/`)
  || p.startsWith(`${W}/hub/test/fakes`) || p === Q || p.startsWith(`${Q}/`);
const rest = String(base.PATH ?? '').split(':').filter(p => !drop(p));
export function seal(extra = {}, front = []) {
  for (const k of Object.keys(extra)) if (!/^(CLAND_|FAKE_|QA_)/.test(k)) throw new Error(`seal: overlay ${k} refused`);
  return scratchGitEnvironment(Q, fixtureEnvironment(Q, base, { PATH: [...new Set([...front, nodeBin, ...rest])].join(':'), TMPDIR: T, QA_W: W, QA_Q: Q, QA_EV: EV, QA_T: T, QA_R: R, GH_PAGER: undefined, ...extra }), { excludesFile: `${Q}/home/.gitignore-global` });
}
JS
cat > "$Q/fresh.mjs" <<'JS'
// node "$Q/fresh.mjs" <cwd> <plain|hub> <command> [args…]   one command in a fresh shared-builder seal
// Inputs (QA roots, QA_SESSION and, in hub mode, the hub overlay) go INTO seal(); nothing is overlaid after it returns.
// Refuses (exit 2, "fresh: BLOCKED") on any credential-prefix name. Streams stdout and stderr line by line through the redactor.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const Q = dirname(fileURLToPath(import.meta.url));
const s = JSON.parse(readFileSync(`${Q}/state.json`, 'utf8'));
if (s.Q !== Q || !s.SESSION) { console.error('fresh: BLOCKED: state.json names another scratch root or no QA session'); process.exit(2); }
const CRED = /^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/;
// Exact values to redact: every credential-shaped variable of QA's own shell (read here, never printed).
const secrets = Object.entries(process.env).filter(([k, v]) => typeof v === 'string' && v.length >= 8 && (CRED.test(k) || /(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY)/i.test(k))).map(([, v]) => v);
for (const [name, key] of Object.entries({ QA_W: 'W', QA_Q: 'Q', QA_EV: 'EV', QA_T: 'T', QA_R: 'R' })) process.env[name] = s[key];
const { seal } = await import(`${Q}/seal.mjs`);
const { assertPublishable } = await import(`${s.W}/.agents/skills/qa/qa-demo-policy.ts`);
const [cwd, mode, command, ...args] = process.argv.slice(2);
if (!['plain', 'hub'].includes(mode) || !command) { console.error('fresh: usage: <cwd> <plain|hub> <command> [args…]'); process.exit(2); }
const env = seal({ QA_SESSION: s.SESSION, ...(mode === 'hub' ? { CLAND_TEST_SKIP_ORPHAN_SWEEP: '1', CLAND_FAKE_HOST_ROOT: `${Q}/fh` } : {}) });
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
cat > "$Q/body.sh" <<'SH'
# /bin/bash "$QA_Q/body.sh" <function>   inside fresh.mjs (hub mode), cwd p1: helpers and scratch functions only, the immediate gate, then the function
. "$QA_Q/helpers.sh"; . "$QA_Q/scratch.sh"
n=$(node -e 'console.log(Object.keys(process.env).filter(k=>/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)).length)')
echo "PRE gate: credential-prefix names $n; QA_SESSION set $([ -n "$QA_SESSION" ] && echo yes || echo no); HOME is Q/home $([ "$HOME" = "$QA_Q/home" ] && echo yes || echo no); TMPDIR is T $([ "$TMPDIR" = "$QA_T" ] && echo yes || echo no); fake host root $([ "$CLAND_FAKE_HOST_ROOT" = "$QA_Q/fh" ] && echo yes || echo no)"
[ "$n" = 0 ] || { echo "BLOCKED: credential-name gate"; exit 2; }
"$1"
SH
cat > "$Q/helpers.sh" <<'SH'
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
# hp: the pid in this project's .cland/hub.json (the secret is never read out)
hp() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).pid)+"\n")'; }
hubstart() { cland hub start > "$QA_Q/hubstart.out" 2>&1; local x=$?; [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; return $x; }
up() { cland hub status > /dev/null 2>&1 && echo up || echo down; }
alive() { kill -0 "$1" 2> /dev/null && echo yes || echo no; }
# run <label> <command…>: exit status, then the first lines of stdout and stderr (full text kept in $QA_Q/r.out and r.err for has)
run() { l=$1; shift; "$@" > "$QA_Q/r.out" 2> "$QA_Q/r.err"; x=$?; echo "$l exit $x"; head -n 20 "$QA_Q/r.out" | sed 's/^/  out: /'; head -n 20 "$QA_Q/r.err" | sed 's/^/  err: /'; }
# has <text>: how many lines of the last run's output contain the exact text (node, no pattern syntax)
has() { node -e 'const fs=require("fs"),q=process.env.QA_Q,n=process.argv.at(-1);let t="";for(const f of ["r.out","r.err"]){try{t+=fs.readFileSync(q+"/"+f,"utf8")+"\n"}catch{}}console.log(t.split("\n").filter(l=>l.includes(n)).length)' -- "$1"; }
# cnt <file> <text>: occurrences of the exact text in the file (String.split)
cnt() { node -e 'const fs=require("fs");let t="";try{t=fs.readFileSync(process.argv[1],"utf8")}catch{console.log("MISSING");process.exit(0)}console.log(t.split(process.argv[2]).length-1)' "$1" "$2"; }
# there <path>: present or absent
there() { [ -e "$1" ] && echo present || echo absent; }
# dg <path>: sha256 of a file, or MISSING
dg() { node -e 'try{console.log(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))}catch{console.log("MISSING")}' "$1"; }
SH
node --check "$Q/seal.mjs" && node --check "$Q/fresh.mjs" && bash -n "$Q/body.sh" && bash -n "$Q/helpers.sh" && echo "seal checked"
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
for m in plain hub; do node "$Q/fresh.mjs" "$Q" "$m" node -e 'const fs=require("fs"),os=require("os"),path=require("path");const e=process.env,h=os.userInfo().homedir,real=p=>{try{return fs.realpathSync(p)}catch{return p}};const allowed=new Set([real(path.dirname(process.execPath)),real(process.argv[1])]);console.log(process.argv[2]+": credential-prefix names "+Object.keys(e).filter(k=>/^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)/.test(k)).length+"; CLAND_ names "+Object.keys(e).filter(k=>k.startsWith("CLAND_")).sort().join(" ")+"; QA_SESSION "+(e.QA_SESSION?"set":"unset")+"; TMPDIR is T "+(e.TMPDIR===e.QA_T)+"; HOME is Q/home "+(e.HOME===e.QA_Q+"/home")+"; real-HOME PATH entries other than the Node bin and the pinned Neovim directory "+e.PATH.split(":").filter(p=>p.startsWith("~")||((p===h||p.startsWith(h+"/"))&&!allowed.has(real(p)))).length)' "$NVD" "$m"; done 2>&1 | tee "$EV/S0-env.txt"
node "$Q/fresh.mjs" "$Q" plain /bin/sh -c 'for c in claude codex opencode; do echo "$c on the sealed PATH: $(command -v "$c" || echo none)"; done' 2>&1 | tee -a "$EV/S0-env.txt"
echo "Q bytes $(printf '%s' "$Q" | wc -c | tr -d ' '); T bytes $(printf '%s' "$T" | wc -c | tr -d ' '); a suite root for comparison $(printf '%s' "/private/tmp/cland-suite-$(uuidgen | tr 'A-Z' 'a-z')" | wc -c | tr -d ' ')" | tee -a "$EV/S0-env.txt"
```

Expected (recorded as check `S0` with `qa-record.sh note`, capture `$EV/S0-env.txt`): `seal checked`; both modes `credential-prefix names 0`; `plain` `CLAND_` names exactly the builder's own (`CLAND_DISCORD_API_ROOT CLAND_ELEVENLABS_API_ROOT CLAND_EXECUTOR_STATE CLAND_TELEGRAM_API_ROOT CLAND_TEST_OWNED_ROOT`), `hub` the same plus `CLAND_FAKE_HOST_ROOT` and `CLAND_TEST_SKIP_ORPHAN_SWEEP` (any other `CLAND_` name is BLOCKED); `QA_SESSION set`; TMPDIR and HOME `true`; `0` real-HOME entries; each `# fresh: redacted or withheld lines 0`; the three harnesses `none`; `Q bytes 23`, `T bytes` equal to the suite root's. A non-zero credential count stops the run before any row (BLOCKED).

The TAP expectations. `expect.json` lists, per file, top-level names its source registers. `exact: true` lists every registration (static titles and their loop expansions); `exact: false` lists the names that prove a criterion (a subset; the rest of the file must still pass). Lists were read at dev `54607a4a4` (T-1715's, T-1670's and T-1717's names at their landings `7d88dbc0d`, `73bd6d4f2` and `54607a4a4`). Contract registrations (`<name>: …`) are generated by `hostProviderContract`/`hostProviderVolumeContract` through `register(name, run)`. A list that differs from the tested build's source is re-derived from its loops before judging, and the difference recorded.

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/host-provider-digitalocean.test.ts": {"exact": false, "names": [
  "digitalocean create carries configured inputs, isolated key and project/pool tags; invalid region makes no call",
  "digitalocean release confirms both droplet and key with GET after split DELETE 404",
  "digitalocean lost create response is reaped after provider restart; other pool and project survive",
  "digitalocean owned host and its key survive reap while an unowned host is removed",
  "digitalocean missing configured image fails without a preparation receipt",
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
  "digitalocean keyed pool preparation refuses through preparePools and registry without publishing a recipe receipt",
  "digitalocean: provider declares sane prices, billing and capabilities",
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
  "digitalocean held create refusal cannot shorten a concurrent declaration refresh pause"]},
 "hub/test/host-provider-fake.test.ts": {"exact": false, "names": [
  "fake: provider declares sane prices, billing and capabilities",
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
  "configured boot delay and refusal use typed states and the fixture clock",
  "never-boot and failed creation are typed failures and remain reapable",
  "ignored delete is incomplete after confirming read, including reap and restart",
  "registry refuses fake outside its test environment and caches registered providers",
  "fake opens no network socket for any lifecycle operation",
  "reap never calls a missing machine record a successful sweep",
  "missing provider metadata cannot turn a retained machine into released",
  "fake declarations include paid address in idle price and destroy billed stopped machines",
  "fake refuses acquisition outside its declared architectures"]},
 "hub/test/host-provider-declarations.test.ts": {"exact": true, "names": [
  "declarations reject missing fields, negative prices and misaligned minimums",
  "earliestStop respects both the created billing minimum and idle duration",
  "reusable contract rejects providers missing each declaration and invalid billing"]},
 "hub/test/host-provider-volumes.test.ts": {"exact": false, "names": [
  "fake: volumes create, list and confirm deletion",
  "fake: volumes enforce one attachment and region binding",
  "fake: ignored volume deletion retains inventory",
  "fake: volumes rate limit snapshots until retry time",
  "mandatory volume contract rejects deletion acknowledged without removal",
  "volume inventory, attachment and snapshot pacing survive provider recreation",
  "concurrent volume attachment and snapshot calls each admit one winner",
  "fake snapshot window rejects invalid durations",
  "malformed retained volume ownership and snapshot facts fail closed without writes"]},
 "hub/test/digitalocean-pacing.test.ts": {"exact": false, "names": [
  "300 queued calls share a token budget across clients in every 60 second window",
  "429 carries retry time and fences the shared token without automatic resend (http)",
  "429 carries retry time and fences the shared token without automatic resend (scripted)",
  "queued budget waits respect deadlines and cancellation without sending",
  "429 header retry time: {\"Retry-After\":\"2\"}",
  "429 header retry time: {\"ratelimit-reset\":\"5\"}",
  "a missing-header 429 preserves provider text and permits the next explicit call",
  "pacing counts actual sends when the caller blocks before continuations drain",
  "429 headers fence a sibling client before held body diagnostics complete",
  "independent API authorities do not inherit traffic from the same opaque token",
  "the real DigitalOcean endpoint ignores a high-rate fragment and still paces at 250"]},
 "hub/test/digitalocean-endpoint.test.ts": {"exact": false, "names": [
  "legacy real and custom URLs retain the 250 per minute policy",
  "endpoint declaration metadata is normalized and omitted from transport",
  "equivalent real endpoint declarations cannot increase the production cap"]},
 "hub/test/executor-droplet.test.ts": {"exact": false, "names": [
  "macOS inhibits idle sleep while the lease lives and drops the inhibitor after release"]},
 "hub/test/executor-prepare.test.ts": {"exact": false, "names": [
  "a project without pins prepares a reusable snapshot for delivery",
  "prepare keys hash committed hook bytes without Neovim fields and ignore local hook edits",
  "prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes"]},
 "hub/test/executor-safety.test.ts": {"exact": false, "names": []},
 "hub/test/image-recipe.test.ts": {"exact": true, "names": [
  "x86_64 builder preserves the committed recipe bytes and snapshot digest",
  "x86_64 base downloads and verifies exact Node bytes without project packages",
  "arm64 base downloads and verifies exact Node bytes without project packages",
  "unknown architectures and unsafe version pins refuse before rendering",
  "agent recipe pins all harnesses and installs OpenCode only from the v2 installer before ready",
  "agent defaults use doctor minimums and reject unpinned or injected harness versions",
  "baked harness installer stubs remain discoverable with a login-disk HOME"]},
 "hub/test/accounts-policy.test.ts": {"exact": true, "names": [
  "hub source has no provider endpoint or credential-store access",
  "image installer exception permits only the exact v2 literal in its recipe file",
  "account migrations contain no literal timer waits or elapsed-time assertions"]},
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
 "hub/test/executor-prepare-component.test.ts": {"exact": false, "names": [
  "project provision runs as root before runner prepare, failure=false",
  "project provision runs as root before runner prepare, failure=true",
  "previous persisted snapshot wire shape remains readable before recipe rebuild",
  "prepare captures applied provision input despite disk edits and refuses an unbound supplied key before reuse"]},
 "hub/test/verify-prepare.test.ts": {"exact": true, "names": [
  "prepare uses installed snapshot inputs and rebuilds changed or missing installs"]},
 "hub/test/host-prepare.test.ts": {"exact": true, "names": [
  "pool prepare CLI publishes an image and then reports current",
  "pool prepare invalidates harnesses and names the changed part",
  "pool prepare invalidates lock and names the changed part",
  "pool prepare invalidates provision and names the changed part",
  "pool prepare selects all configured pools and unknown pool names the choices",
  "fake image build joins the configured build receipt and records its key",
  "pool harness pins use renderer ids and exact release versions"]},
 "hub/test/host-secret-admission.test.ts": {"exact": false, "names": [
  "C3/C4 host CLI requires session credential and denies human frames",
  "C5 human revoke closes host peers and refuses subsequent hellos"]},
 "hub/test/web-authority.test.ts": {"exact": false, "names": [
  "signed-in web refuses pool preparation"]},
 "hub/test/cli-help.test.ts": {"exact": false, "names": [
  "cland --help retains its pre-refactor output byte for byte",
  "cland host serve --help exits without starting an agent",
  "cland host serve -h exits without starting an agent"]},
 "hub/test/host-runtime-bundle.test.ts": {"exact": true, "names": [
  "runtime manifest carries the hub lock, CLI, spoke and Claude mod with verified digests",
  "upload abort reclaims joined input",
  "upload abort retains input identity on incomplete cleanup"]},
 "hub/test/host-runtime-delivery.test.ts": {"exact": true, "names": [
  "C1-C3 whole runtime delivery verifies files, reuses digest and atomically replaces CLI and spoke",
  "held installer fixture teardown joins writer before removing its root"]},
 "hub/test/host-agent-restart.test.ts": {"exact": false, "names": [
  "C1-C3 kill-agent reconnect reads retained table without signalling harness",
  "C1-C3 version delivery reconnect reads retained table without signalling harness",
  "C4 corrupt and escaping bundles never become selectable",
  "C3 adopted Claude worker survives version replacement with receipt authority and no signal"]},
 "hub/test/host-agent-closure.test.ts": {"exact": true, "names": [
  "committed agent closure matches the complete source and native asset graph",
  "host registry startup imports no development-only package",
  "restart requires exact fresh native birth and refuses reused or inherited PID authority",
  "recovery handshake preserves previous hello shape and gates the additive restore operation"]},
 "hub/test/claude-agent-launch.test.ts": {"exact": false, "names": [
  "Claude refuses nonprivate account root before any command and rejects foreign-owner metadata",
  "an already admitted Claude generation cannot claim pre-spawn refusal",
  "native incomplete classification honors owner proof native",
  "native incomplete classification honors owner proof generation",
  "native incomplete classification honors owner proof untyped",
  "native incomplete classification honors owner proof real-incomplete"]},
 "hub/test/host-command-environment.test.ts": {"exact": false, "names": [
  "SSH Claude pre-spawn admission receipt legacy",
  "SSH Claude pre-spawn admission receipt native-only",
  "SSH Claude pre-spawn admission receipt other-generation",
  "SSH Claude pre-spawn admission receipt matching-generation"]},
 "hub/test/doctor-run.test.ts": {"exact": false, "names": [
  "native no-PID error admission closed",
  "native no-PID error admission missing-close",
  "native no-PID error admission pid-seen"]},
 "hub/test/claude-code-remote.test.ts": {"exact": false, "names": [
  "remote Claude pre-spawn root refusal permits immediate same-name launch",
  "remote Claude pre-spawn root refusal permits immediate different-name launch",
  "remote Claude native aborted same-name retry",
  "remote Claude native aborted different-name retry",
  "remote Claude native spawn-error same-name retry",
  "remote Claude native spawn-error different-name retry",
  "remote Claude native pre-wire same-name retry",
  "remote Claude native pre-wire different-name retry",
  "remote Claude native lost-reply same-name retry",
  "remote Claude native lost-reply different-name retry",
  "remote Claude native sent-abort same-name retry",
  "remote Claude native sent-abort different-name retry",
  "native command admission receipt aborted",
  "native command admission receipt throw",
  "native command admission receipt no-pid-error",
  "native command admission receipt pid-existed"]},
 "hub/test/host-ssh-contract.test.ts": {"exact": false, "names": [
  "ssh Host runs every shared Host behavioral contract through fake ssh",
  "C2 claude adapter sends no planted hub-only key through the SSH agent",
  "accepted spawn reconciles its durable token after the commit reply is dropped"]},
 "hub/test/host-prepared.test.ts": {"exact": false, "names": [
  "prepared restart observation waits through identity publication before agent admission",
  "native agent restart cleans actual unfinished spawn and worktree preparations before publishing readiness"]},
 "hub/test/tcp-listener-census.test.ts": {"exact": true, "names": [
  "listener attribution retains metadata only across a stable native birth",
  "listener attribution suppresses replacement metadata when birth changes during listeners",
  "listener attribution suppresses replacement metadata when birth changes during description",
  "listener attribution stays unavailable when native birth observation 0 is missing",
  "listener attribution stays unavailable when native birth observation 1 is missing",
  "listener attribution stays unavailable when native birth observation 2 is missing",
  "empty listener census returns no failure"]},
 "hub/test/transport-forwards.test.ts": {"exact": true, "names": [
  "C1 Unix and host-loopback forwards answer with no hub TCP listener; C2 cancellation removes both",
  "C3 SIGKILL restores every retained forward and excludes cancelled sessions",
  "C3 exhausted forward logs once and is forgotten on later replacement",
  "C2 acknowledged cancellation retains failed unlink for retry and stop without another cancel",
  "C3 exhausted restore logs once and retains failed cleanup without reinstalling",
  "failed initial installation retains socket cleanup until stop retry"]},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []},
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
 "hub/test/executor-deadline.test.ts": {"exact": false, "names": [
  "provider shutdown detaches an unanswered call and refuses later calls"]}
}
JSON
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked")' "$Q/expect.json"
```

The source checks. `src.mjs` counts exact strings at the build with `String.split`, walks `hub/src` for the OpenCode installer URL, and computes T-1714 C5's byte identity by importing the build's pure renderer (it renders text only; nothing runs).

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   exact-string counts at the build (String.split): ok or MISMATCH, label, file, count, expectation; then computed checks
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const W = process.argv[2];
const read = f => existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null;
const recipe = 'hub/src/executor/droplet/provision.sh', prep = 'hub/src/executor/droplet/prepare.ts', rec = 'hub/src/image/recipe.ts';
const DO = 'hub/src/host/provider/digitalocean.ts', api = 'hub/src/executor/droplet/api.ts';
const cmd = 'hub/src/host/agent/command.ts', ssh = 'hub/src/host/ssh-host.ts', claude = 'hub/src/host/agent/claude.ts', adapter = 'hub/src/adapters/claude-code.ts';
const C = [
  // T-1714
  ['T-1714 C5 builder renders the recipe for x86_64', prep, "builder = await options.builder(renderRecipe({ arch: 'x86_64', node: key.node }));", '=1'],
  ['T-1714 C5 no second template path in prepare', prep, "template.replace('__NODE_VERSION__', key.node)", '=0'],
  ['T-1714 C5 template keeps one Node placeholder', recipe, '__NODE_VERSION__', '=1'],
  ['T-1714 C5 template names linux-x64 three times', recipe, 'linux-x64', '=3'],
  ['T-1714 C3 image installer form in the recipe', rec, "https://opencode.ai/v2/install | bash -s -- --version ${pin('opencode')}", '=1'],
  ['T-1714 C3 recipe names no npm opencode-ai', rec, 'opencode-ai', '=0'],
  ['T-1714 C3 policy exemption for the recipe literal', 'hub/test/accounts-policy.test.ts', "{ name: 'OpenCode image installer', file: '/image/recipe.ts', literal: 'https://opencode.ai/v2/install', reason: ", '=1'],
  ['T-1714 C4 architecture refusal', rec, "throw new Error('unsupported image architecture')", '=1'],
  // T-1723
  ['T-1723 npm argv carries --ignore-scripts', 'hub/src/host/code-delivery.ts', "spawn('npm',['ci','-w','hub','--omit=dev','--ignore-scripts']", '=1'],
  ['T-1723 docs name the npm argv', 'docs/agents/host-agent.md', 'npm ci -w hub --omit=dev --ignore-scripts', '>=1'],
  // T-1716
  ['T-1716 C4 host prepare in HOST_USAGE', 'hub/src/cli/usage.ts', '  host prepare [pool] human-only local CLI: prepare one or all configured pool images', '=1'],
  ['T-1716 C4 frozen usage fixture names host prepare', 'hub/test/fixtures/cli-usage/commands.json', '  host prepare [pool] human-only local CLI: prepare one or all configured pool images', '=1'],
  ['T-1716 C4 host CLI usage line', 'hub/src/cli/host.ts', 'usage: cland host <prepare [pool] | serve | attach session | revoke id | git-proxy socket>', '=1'],
  ['T-1716 C4 hub refusal off the local human CLI or Neovim', 'hub/src/hub/dispatch.ts', "${frame.type === 'host.prepare' ? 'host preparation' : 'host revocation'} requires the human CLI or Neovim on a local connection", '=1'],
  ['T-1716 C4 web authority refusal', 'hub/src/hub/web-authority.ts', "'host.prepare': 'requires the local human CLI or Neovim',", '=1'],
  ['T-1716 C3 unknown pool names the configured pools', 'hub/src/host/provider/pool-image.ts', "unknown pool ${pool}; configured pools: ${names.join(', ') || 'none'}", '=1'],
  ['T-1716 CLI prints pool, state and changed parts', 'hub/src/cli/host.ts', "${result.pool}: ${result.state}; changed: ${result.changed.join(', ') || 'none'}", '=1'],
  // T-1727
  ['T-1727 typed proof precedes the text fallback', cmd, "if(result.nativeAdmission==='no-process'||result.claudeAdmission?.outcome==='refused-before-spawn')return false;", '=1'],
  ['T-1727 aborted and spawn-throw paths are typed', cmd, "nativeAdmission:'no-process' })", '=2'],
  ['T-1727 no-PID error path is typed', cmd, "nativeAdmission:'no-process' as const", '=1'],
  ['T-1727 Claude maps only the typed native receipt', claude, "if(background.nativeAdmission==='no-process'){", '=1'],
  ['T-1727 pre-wire abort is typed before any write', ssh, "if(command.signal?.aborted)throw Object.assign(new Error('cancelled before send'),{code:'CLAND_AGENT_ADMISSION_REFUSED'});", '=1'],
  ['T-1727 generic throwIfAborted gone from wire()', ssh, 'command.signal?.throwIfAborted();', '=0'],
  ['T-1727 launchClaude maps only a matching generation receipt', ssh, "if(result.claudeAdmission?.generation===generation&&result.claudeAdmission.outcome==='refused-before-spawn')throw", '=1'],
  ['T-1727 adapter settles by error code', adapter, "(err as NodeJS.ErrnoException).code==='CLAND_AGENT_ADMISSION_REFUSED')record.phase='prepared';", '=1'],
  ...[cmd, ssh, claude, adapter].map(f => ['T-1727 no AbortError name inference', f, 'AbortError', '=0']),
  ...[cmd, ssh, claude].map(f => ['T-1727 no message-text match', f, '.message.includes(', '=0']),
  // T-1713
  ['T-1713 C1 region allow-list (machines and, since T-1717, volumes)', DO, "['lon1', 'fra1', 'ams3']", '=2'],
  ['T-1713 C1 pool tag', DO, '`cland-pool-${options.pool}`', '>=1'],
  ['T-1713 decision: keyed prepare refused, configured image only', DO, "reason: 'DigitalOcean pool image preparation unsupported'", '=1'],
  ['T-1713 registry registers digitalocean', 'hub/src/host/provider/registry.ts', "this.#factories.set('digitalocean'", '=1'],
  ['T-1713 executor API in the provider closure', DO, "from '../../executor/droplet/api.ts';", '=1'],
  ['T-1713 executor endpoint in the provider closure', DO, "from '../../executor/droplet/endpoint.ts';", '=1'],
  ['T-1713 executor droplet in the provider closure', DO, "from '../../executor/droplet/droplet.ts';", '=1'],
  ['T-1713 C5 provider reads no token variable', DO, 'DIGITALOCEAN_TOKEN', '=0'],
  ['T-1713 C5 API redacts the token from provider text', api, ".split(token).join('[redacted]')", '=1'],
  // T-1715 (VERIFIED at its landing 7d88dbc0d)
  ['T-1715 C2/C3 pause refusal is a fixed text (machines, and two volume-create paths since T-1717)', DO, "reason: 'DigitalOcean creation paused'", '=3'],
  ['T-1715 C4 no refusal reason built from an error', DO, 'reason: e', '=0'],
  ['T-1715 C4 no templated refusal reason', DO, 'reason: `', '=0'],
  ['T-1715 C4 422 carries redacted id and message and its retry time', api, 'redact(value.id), redact(value.message), response.status === 422 ? rateLimited(', '=1'],
  ['T-1715 C1 machine limit from /account', DO, 'machineLimit: account.droplet_limit as number', '=1'],
  ['T-1715 C1 live price from /v2/sizes', DO, 'livePerHour: size.price_hourly, idleComputePerHour: 0', '=1'],
  // T-1717 (VERIFIED at its landing 54607a4a4)
  ['T-1717 the unsupported volume stubs are gone', DO, "reason: 'DigitalOcean volumes unsupported'", '=0'],
  ['T-1717 C1 volume create: 1 GiB with cland, project and pool tags', DO, "size_gigabytes: 1, tags: ['cland', projectTag(this.#options.root, options.project), `cland-pool-${pool}`] });", '=1'],
  ['T-1717 C1 a volume needs a pool before any request', DO, "if (!pool) return { state: 'refused', reason: 'volume pool unavailable' };", '=1'],
  ['T-1717 C1 attachment reported only after a completed action', DO, "if (action.status !== 'completed') throw new Error('volume action failed');", '=1'],
  ['T-1717 C2 attach elsewhere refused', DO, "if (v.droplet_ids.some(id => String(id) !== machine.id)) return { state: 'refused', reason: 'attached elsewhere' };", '=1'],
  ['T-1717 C3 snapshot refusal carries the API retry time', DO, "return { state: 'refused', reason: 'rate limited', retryAt: new Date(e.retryAt).toISOString() };", '=1'],
  ['T-1717 C4 unconfirmed delete is incomplete', DO, "catch { return { state: 'incomplete', reason: 'DigitalOcean volume not deleted' }; }", '=1'],
  ['T-1717 C4 volume delete is the confirmed delete', api, 'deleteVolume(id: string, deadline?: number): Promise<void> { return this.#confirmedDelete(', '=1'],
];
const judge = (n, e) => e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1));
for (const [label, file, text, e] of C) {
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  console.log(`${t !== null && judge(n, e) ? 'ok' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
// T-1727: the typed proof sits before the cleanup-incomplete text fallback in nativeCommandIncomplete
{ const t = read(cmd) ?? '', a = t.indexOf("if(result.nativeAdmission==='no-process'"), b = t.indexOf("return result.error?.includes('cleanup incomplete') === true;");
  console.log(`${a >= 0 && b > a ? 'ok' : 'MISMATCH'} T-1727 typed proof before the cleanup-incomplete text | ${cmd} | ${a} < ${b}`); }
// T-1714 C3: the OpenCode installer URL across hub/src, per file; the image-installer form only in the recipe
{ const url = 'https://opencode.ai/v2/install', hits = [];
  const walk = d => { for (const e of readdirSync(`${W}/${d}`, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (p.endsWith('.ts')) { const n = readFileSync(`${W}/${p}`, 'utf8').split(url).length - 1; if (n) hits.push(`${p}:${n}`); } } };
  walk('hub/src'); hits.sort();
  const want = 'hub/src/doctor/harnesses.ts:1 hub/src/image/recipe.ts:1 hub/src/setup/steps/harnesses.ts:1';
  console.log(`${hits.join(' ') === want ? 'ok' : 'MISMATCH'} T-1714 C3 installer URL per file | hub/src | ${hits.join(' ')} | ${want}`);
  const form = `${url} | bash -s -- --version`, elsewhere = hits.map(h => h.split(':')[0]).filter(p => p !== rec && readFileSync(`${W}/${p}`, 'utf8').includes(form));
  console.log(`${elsewhere.length === 0 ? 'ok' : 'MISMATCH'} T-1714 C3 image installer form outside the recipe | hub/src | [${elsewhere.join(' ')}] | none`); }
// T-1714 C5: the x86_64 rendering equals the deployed template with its Node placeholder filled; the template digest is the one image-recipe pins
{ const t = read(recipe) ?? '', d = createHash('sha256').update(t).digest('hex'), pinned = '3cf36474d3b4e6a42c2a9edcbfb68b44b7c08b405f82f99f755651f502f7ef3d';
  console.log(`${d === pinned ? 'ok' : 'MISMATCH'} T-1714 C5 template digest | ${recipe} | ${d} | ${pinned}`);
  const { renderRecipe } = await import(`${W}/${rec}`);
  for (const node of ['v24.21.0', 'v24.13.0']) {
    const same = renderRecipe({ arch: 'x86_64', node }) === t.replace('__NODE_VERSION__', node);
    console.log(`${same ? 'ok' : 'MISMATCH'} T-1714 C5 x86_64 rendering byte-identical to the template (${node}) | ${rec} | ${same} | true`);
  }
  const arm = renderRecipe({ arch: 'arm64', node: 'v24.21.0' }), x = renderRecipe({ arch: 'x86_64', node: 'v24.21.0' });
  const armOk = arm === x.replaceAll('linux-x64', 'linux-arm64') && arm.split('linux-arm64').length - 1 === 3;
  console.log(`${armOk ? 'ok' : 'MISMATCH'} T-1714 C1 arm64 differs only by the Node archive architecture | ${rec} | ${armOk} | true`); }
JS
node --check "$Q/src.mjs" && echo "src checked"
```

The check functions for QA's own shell and the scratch functions.

```sh
cat > "$Q/checks.sh" <<'SH'
# landing <id>: the first-parent landing receipts of <id> at the build
landing() { git -C "$W" log --first-parent --format=%H --grep "^Item: $1\$" "$S"; }
# preserved: test files this stage must leave unedited (preservation files the items name)
preserved() { printf '%s\n' hub/test/executor-droplet.test.ts hub/test/executor-prepare.test.ts hub/test/executor-safety.test.ts hub/test/executor-prepare-component.test.ts hub/test/verify-prepare.test.ts hub/test/prepare-key.test.ts hub/test/host-agent-restart.test.ts hub/test/host-agent-closure.test.ts hub/test/host-provider-fake.test.ts hub/test/host-provider-declarations.test.ts hub/test/host-provider-volumes.test.ts hub/test/digitalocean-pacing.test.ts hub/test/digitalocean-endpoint.test.ts hub/test/host-ssh-registry.test.ts hub/test/host-survival-native.test.ts hub/test/host-runtime-join.test.ts hub/test/executor-deadline.test.ts hub/test/host-provider-contract.ts; }
s00() {   # build, plan and landing receipts (QA's own shell)
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-before.txt"; echo "root non-tracker entries $(wc -l < "$EV/root-status-before.txt" | tr -d ' ')"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1533 --json) > "$EV/plan.json"; echo "plan read exit $?"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name==="DigitalOcean on a fake API, the recipe and pool images");console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,merged:s.merged,total:s.total,statuses:s.statuses}):"stage missing")' "$EV/plan.json" | tee "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do
    echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"
  done
}
s01() {   # typecheck at the integrated build, in a fresh seal; the capture streams through the redactor
  node "$Q/fresh.mjs" "$W" plain node --version
  node "$Q/fresh.mjs" "$W" plain npm run typecheck > "$EV/typecheck.log" 2>&1; echo "typecheck exit $?"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
}
s02() {   # landing diffs (read-only): test paths, product paths, package files and preserved files per landing; preserved files since the stage-1 build
  for id in T-1713 T-1715 T-1717 T-1714 T-1716 T-1723 T-1727 T-1704 T-1670; do L=$(landing "$id" | head -n 1)
    echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id test paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/test | tr '\n' ' ')"
    echo "$id product paths: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- hub/src shared | wc -l | tr -d ' ')"
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json web/package.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "commits after the stage-1 build 5795362b touching preserved files: [$(git -C "$W" log --format=%h 5795362b04395d88d08cdbb3069b16d38d4c5054.."$S" -- $(preserved) | tr '\n' ' ')]"
}
s58() {   # end check and TMPDIR residue inventory (QA's own shell)
  echo "POST HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' > "$EV/root-status-after.txt"; echo "root non-tracker status unchanged: $(cmp -s "$EV/root-status-before.txt" "$EV/root-status-after.txt" && echo yes || echo no)"
  echo "preservation lock present: $([ -e /tmp/cland-preserve.lock ] && echo "yes: $(cat /tmp/cland-preserve.lock/owner 2> /dev/null)" || echo no)"
  echo "T entries other than node-compile-cache: $(ls -A "$T" | grep -v -c -x node-compile-cache)"
  for e in $(ls -A "$T" | grep -v -x node-compile-cache); do
    echo "  T: $e type $(stat -f %HT "$T/$e") open $(lsof -t "$T/$e" 2> /dev/null | wc -l | tr -d ' ') first seen after $(awk -v e="$e" -F': ' '$2==e{print $1; exit}' $(ls "$EV"/*.tmpdir.txt))"
  done
}
SH
cat > "$Q/scratch.sh" <<'SH'
m50() {   # scratch project p1: Git repo, cland init, two fake pools and a hook written while the hub is stopped, then the scratch hub and the provision key
  echo "PRE p1 entries $(ls -A "$QA_Q/p1" | wc -l | tr -d ' '); fh entries $(ls -A "$QA_Q/fh" | wc -l | tr -d ' ')"
  cd "$QA_Q/p1" || return 1
  git init -q -b dev && git commit -q --allow-empty -m init; echo "git exit $?"
  cland init . > "$QA_EV/E1533S2-50-init.txt" 2>&1; echo "init exit $?"
  [ -f .cland/hub.json ] && hp >> "$QA_Q/pids"; cland hub stop > /dev/null 2>&1; echo "hub after init and stop: $(up)"
  echo "init template hosts tables: $(cnt .cland/config.toml '[hosts')"
  printf '%s\n' '' '[hosts]' 'harnesses = { codex = "1.0.0" }' '[hosts.agents]' 'provider = "fake"' 'size = "fake"' 'region = "fake-1"' 'transport = "ssh"' '[hosts.spare]' 'provider = "fake"' 'size = "fake"' 'region = "fake-1"' >> .cland/config.toml
  printf '# qa provision hook\n' > setup.sh
  echo "hosts tables written: agents $(cnt .cland/config.toml '[hosts.agents]') spare $(cnt .cland/config.toml '[hosts.spare]'); lockfile $(there package-lock.json)"
  hubstart; echo "hub start exit $?; hub $(up)"
  run "(provision key)" cland config set verification.provision setup.sh
  echo "  file: provision key $(cnt .cland/config.toml 'provision = "setup.sh"'); hosts tables kept: agents $(cnt .cland/config.toml '[hosts.agents]') spare $(cnt .cland/config.toml '[hosts.spare]')"
}
m51() {   # T-1716 C4: help lists host prepare
  cd "$QA_Q/p1" || return 1
  run "(a) host --help" cland host --help
  echo "  prepare usage lines: $(has '  host prepare [pool] human-only local CLI: prepare one or all configured pool images')"
  run "(b) help" cland help
  echo "  prepare usage lines: $(has '  host prepare [pool] human-only local CLI: prepare one or all configured pool images')"
}
m52() {   # T-1716 C1, C3: prepare with no pool prepares every configured pool
  cd "$QA_Q/p1" || return 1
  run "(all pools)" cland host prepare
  echo "  agents prepared line: $(has 'agents: prepared; changed: node, recipe, provision, harnesses'); spare prepared line: $(has 'spare: prepared; changed: node, recipe, provision, harnesses')"
  echo "  pool records: agents $(there .cland/run/hosts/agents-image.json) spare $(there .cland/run/hosts/spare-image.json); fake images: agents $(there "$QA_Q/fh/images/agents.json") spare $(there "$QA_Q/fh/images/spare.json")"
  dg .cland/run/hosts/agents-image.json > "$QA_Q/agents-record.1"
}
m53() {   # T-1716 C1: the same key again is current
  cd "$QA_Q/p1" || return 1
  run "(agents again)" cland host prepare agents
  echo "  current line: $(has 'agents: current; changed: none'); prepared lines: $(has 'agents: prepared')"
  echo "  pool record unchanged: $([ "$(dg .cland/run/hosts/agents-image.json)" = "$(cat "$QA_Q/agents-record.1")" ] && echo yes || echo no)"
}
m54() {   # T-1716 C2: a one-byte hook edit names provision
  cd "$QA_Q/p1" || return 1
  before=$(dg setup.sh); printf '!' >> setup.sh; echo "hook digest changed: $([ "$(dg setup.sh)" != "$before" ] && echo yes || echo no); hook bytes $(wc -c < setup.sh | tr -d ' ')"
  run "(agents after the hook edit)" cland host prepare agents
  echo "  provision line: $(has 'agents: prepared; changed: provision')"
  run "(agents once more)" cland host prepare agents
  echo "  current line: $(has 'agents: current; changed: none')"
}
m55() {   # T-1716 C3: an unknown pool is refused naming the configured pools
  cd "$QA_Q/p1" || return 1
  run "(unknown pool)" cland host prepare nope
  echo "  refusal lines: $(has 'unknown pool nope; configured pools: agents, spare')"
  echo "  records: nope $(there .cland/run/hosts/nope-image.json); fake image nope $(there "$QA_Q/fh/images/nope.json")"
}
m56() {   # T-1713 decision on the real CLI: a digitalocean pool's keyed prepare is refused before any API call (no token in the seal)
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub after stop: $(up)"
  printf '%s\n' '[hosts.do]' 'provider = "digitalocean"' 'size = "s-2vcpu-4gb"' 'region = "lon1"' >> .cland/config.toml
  echo "do table written: $(cnt .cland/config.toml '[hosts.do]')"
  hubstart; echo "hub start exit $?; hub $(up)"
  run "(digitalocean pool)" cland host prepare do
  echo "  refusal lines: $(has 'do: DigitalOcean pool image preparation unsupported'); token-required lines: $(has 'DIGITALOCEAN_TOKEN is required')"
  echo "  pool record do: $(there .cland/run/hosts/do-image.json); provider state: $(there "$QA_Q/fh/.cland/host-provider/digitalocean")"
}
m57() {   # cleanup census: the scratch hub stopped; nothing names the scratch root or this build's CLI
  cd "$QA_Q/p1" || return 1
  cland hub stop > /dev/null 2>&1; echo "hub stop exit $?; hub $(up)"
  for p in $(sort -u "$QA_Q/pids"); do echo "recorded pid $p alive $(alive "$p")"; done
  node -e 'const {execFileSync}=require("child_process");const rows=execFileSync("ps",["-axo","pid=,ppid=,command="],{encoding:"utf8"}).split("\n").filter(Boolean).map(l=>{const m=/^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l);return {pid:+m[1],ppid:+m[2],cmd:m[3]}});const by=new Map(rows.map(r=>[r.pid,r]));const anc=new Set();let p=process.pid;while(p&&by.has(p)&&!anc.has(p)){anc.add(p);p=by.get(p).ppid}const hits=rows.filter(r=>!anc.has(r.pid)&&(r.cmd.includes(process.env.QA_Q)||r.cmd.includes(process.env.QA_W+"/")));console.log("processes naming the scratch root or this build: "+hits.length);for(const h of hits)console.log("  "+h.pid+" "+h.cmd.slice(0,160))'
}
SH
. "$Q/checks.sh"; bash -n "$Q/scratch.sh" && echo "scratch checked"
```

Expected: `expect checked`, `src checked`, `scratch checked`. Record all of the setup above in `S0`.

Cleanup after the evidence is recorded and E1533S2-57 passed: print `$Q` and check it begins with `/private/tmp/q52-`, then remove it by that literal path with a non-force recursive remove; print `$T`, check it begins with `/private/tmp/qa-e1533-s2-` and holds nothing but `node-compile-cache`, and remove it by that literal path. Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). The secrets in `$Q/p1/.cland/hub.json` and `$Q/p1/.cland/secret` are never printed or posted.

## Cases

Every case is one named test file run once at the build, from QA's own shell through `nt` (or `pl` for T3 and native files, under the preservation lock), and recorded with `qa-record.sh note` (surface `hub-api`), its evidence `$EV/<id>.log`, `$EV/<id>.check.txt` and `$EV/<id>.tmpdir.txt`. A case passes only when its check line reads `CLEAN` (exit 0; `fail`, `cancelled`, `skipped` and `todo` 0; `pass` equal to `tests`; every listed name `ok`; for an `exact` list, the plan equal to the list and no unlisted name). A missing file at the build is a FAIL naming the file, never a silent drop. A `fresh: BLOCKED` line in a log makes the row BLOCKED, not FAIL. Run in table order; never two files at once.

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1533S2-10 | hub-api | QA | `nt E1533S2-10 hub/test/host-provider-digitalocean.test.ts` | `CLEAN` with every listed name (T-1713 C1 to C6 and decision; T-1715 C1 to C4). Test `digitalocean create carries configured inputs, isolated key and project/pool tags; invalid region makes no call`: `nyc1` gives `failed` with no request; the `fra1` POST carries region `fra1`, size `s-2vcpu-4gb`, image `ubuntu-24-04-x64`, first tags `cland`, the project tag, `cland-pool-agents`, and its own key. Test `digitalocean release confirms both droplet and key with GET after split DELETE 404`: `incomplete` while a GET still finds the droplet, then the key, then `released`; every DELETE is followed by a GET of its path. Test `digitalocean lost create response is reaped after provider restart; other pool and project survive`. Test `digitalocean provider keeps sentinel out of output, errors and user-data, and launches no child` (positive control first, child-process entry points mocked). Test `digitalocean keyed pool preparation refuses through preparePools and registry without publishing a recipe receipt`. The contract registrations `digitalocean: …` (declarations, lifecycle, reap isolation, refused and failed acquire, delayed boot, never boot, ignored delete). T-1715: test `digitalocean declarations load API prices and limit atomically and retain the last good read`; the `429` and `422` expansions of `digitalocean <status> pauses every create until retry time without POST cascades or token leaks` (second and third creates send no POST, 1999 ms still paused, 2000 ms exactly one POST per create, sentinel never in refusal text); test `digitalocean unrelated 422 is failed and does not pause creation` |
| E1533S2-11 | hub-api | QA | `nt E1533S2-11 hub/test/host-provider-fake.test.ts` | `CLEAN` with every listed name. The interface's `declarations` became a union with `unavailable` (T-1715) and the fake gained keyed image preparation (T-1716); the fake keeps its synchronous declarations and the contract still passes for `fake`, `fake arm64 only` and `fake x86_64 only` |
| E1533S2-12 | hub-api | QA | `nt E1533S2-12 hub/test/host-provider-declarations.test.ts` | `CLEAN` with the exact list (T-1715 C1: the declaration validator and contract unchanged in behaviour). Tests: `declarations reject missing fields, negative prices and misaligned minimums`, `reusable contract rejects providers missing each declaration and invalid billing`, `earliestStop respects both the created billing minimum and idle duration` |
| E1533S2-13 | hub-api | QA | `nt E1533S2-13 hub/test/host-provider-volumes.test.ts` | `CLEAN` with every listed name, unedited: the volume contract on the fake (T-1717 C5 companion; named by T-1713's and T-1717's guides as a preservation run) |
| E1533S2-14 | hub-api | QA | `nt E1533S2-14 hub/test/digitalocean-pacing.test.ts` | `CLEAN` with every listed name. T-1715 moved `retryAt` onto `DigitalOceanError` and gives a 422 its retry time; `RateLimited` behaviour, the 250-a-minute pacing and the 429 fence are unchanged |
| E1533S2-15 | hub-api | QA | `nt E1533S2-15 hub/test/digitalocean-endpoint.test.ts` | `CLEAN` with every listed name and the invalid-declaration expansions (the production cap cannot be raised) |
| E1533S2-16 | hub-api | QA | `pl E1533S2-16 hub/test/executor-droplet.test.ts` | `CLEAN`, the whole file, unedited (T-1713 preservation; the provider imports `api.ts`, `endpoint.ts`, `droplet.ts`). Test `macOS inhibits idle sleep while the lease lives and drops the inhibitor after release` runs on macOS and must not be skipped; the file's provider is the loopback fake API |
| E1533S2-17 | hub-api | QA | `pl E1533S2-17 hub/test/executor-prepare.test.ts` | `CLEAN`, the whole file, unedited (T-1713 preservation; T-1714 C5: test `a project without pins prepares a reusable snapshot for delivery` asserts the key's `recipe` equals the sha256 of `provision.sh`, so the builder's rendering leaves the key unchanged) |
| E1533S2-18 | hub-api | QA | `pl E1533S2-18 hub/test/executor-safety.test.ts` | `CLEAN`, the whole file, unedited, nested subtests included in the counters (T-1713 preservation) |
| E1533S2-19 | hub-api | QA | `nt E1533S2-19 hub/test/image-recipe.test.ts` | `CLEAN` with the exact list (T-1714 C1 to C5). Test `x86_64 builder preserves the committed recipe bytes and snapshot digest` (template digest `3cf36474…`, rendering equals the filled template). The `x86_64` and `arm64` expansions of `<arch> base downloads and verifies exact Node bytes without project packages` (`node-$NODE_VERSION-linux-x64.tar.xz` or `-linux-arm64`, `SHASUMS256.txt` with `sha256sum -c`, each base package, the apt timers off, the `runner` user, no `nvim` or Chromium library). Test `unknown architectures and unsafe version pins refuse before rendering`. Test `agent recipe pins all harnesses and installs OpenCode only from the v2 installer before ready` (no `opencode-ai`). Test `agent defaults use doctor minimums and reject unpinned or injected harness versions` |
| E1533S2-20 | hub-api | QA | `nt E1533S2-20 hub/test/accounts-policy.test.ts` | `CLEAN` with the exact list (T-1714 C3). Test `image installer exception permits only the exact v2 literal in its recipe file`: the literal elsewhere, twice in the recipe, or another `opencode.ai` path all fail; test `hub source has no provider endpoint or credential-store access` passes over all of `hub/src` |
| E1533S2-21 | hub-api | QA | `nt E1533S2-21 hub/test/prepare-key.test.ts` | `CLEAN` with the exact list, unedited (T-1714 C5: the key and its stale parts unchanged) |
| E1533S2-22 | hub-api | QA | `nt E1533S2-22 hub/test/executor-prepare-component.test.ts` | `CLEAN` with every listed name, unedited (T-1714 C5; the builder path now renders through `renderRecipe`) |
| E1533S2-23 | hub-api | QA | `pl E1533S2-23 hub/test/verify-prepare.test.ts` | `CLEAN`, test `prepare uses installed snapshot inputs and rebuilds changed or missing installs`, unedited (T-1714 C5 companion) |
| E1533S2-24 | hub-api | QA | `nt E1533S2-24 hub/test/host-prepare.test.ts` | `CLEAN` with the exact list (T-1716 C1 to C4). Test `pool prepare CLI publishes an image and then reports current` (`agents: prepared`, then `agents: current`). The `harnesses`, `lock` and `provision` expansions of `pool prepare invalidates <part> and names the changed part` (`agents: prepared; changed: <part>`). Test `pool prepare selects all configured pools and unknown pool names the choices` (exit 1 with `unknown pool missing; configured pools: first, second`; `cland host --help` lists `host prepare [pool]`). Test `fake image build joins the configured build receipt and records its key`. Test `pool harness pins use renderer ids and exact release versions` |
| E1533S2-25 | hub-api | QA | `nt E1533S2-25 hub/test/host-secret-admission.test.ts` | `CLEAN` with every listed name (T-1716 C4). Test `C5 human revoke closes host peers and refuses subsequent hellos`: `host.prepare` with an `as` from the host client and from the session UI is refused `forbidden`, and from the remote host client without `as` is refused. This file's C1 title carries the Authorization-scheme word, so its `ok` line is withheld by the redactor (`# fresh: line withheld …`; the withheld count is 1 or more); the counters still judge it |
| E1533S2-26 | hub-api | QA | `nt E1533S2-26 hub/test/web-authority.test.ts` | `CLEAN` with every listed name (T-1716 C4). Test `signed-in web refuses pool preparation`: `ok` false with code `cli-neovim-only` |
| E1533S2-27 | hub-api | QA | `nt E1533S2-27 hub/test/cli-help.test.ts` | `CLEAN` with every listed name (T-1716 C4: `cland --help` equals the frozen usage fixture T-1716 updated with `host prepare [pool]`) |
| E1533S2-28 | hub-api | QA | `nt E1533S2-28 hub/test/host-runtime-bundle.test.ts` | `CLEAN` with the exact list (T-1723 C1, C2). Test `runtime manifest carries the hub lock, CLI, spoke and Claude mod with verified digests`; the expansions `upload abort reclaims joined input` and `upload abort retains input identity on incomplete cleanup` |
| E1533S2-29 | hub-api | QA | `pl E1533S2-29 hub/test/host-runtime-delivery.test.ts` | `CLEAN` with the exact list, nested subtest included in the counters (T-1723 C1 to C3). Test `C1-C3 whole runtime delivery verifies files, reuses digest and atomically replaces CLI and spoke`: every delivered file matches its manifest digest, `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts` and `hub/mod/cland/.claude-plugin/plugin.json` present, both bins answer `--version` with the hub's version, the scripted npm records exactly `ci -w hub --omit=dev --ignore-scripts`, a second delivery copies nothing, a bad digest and a failing install leave the old version selected, a valid change switches the link and old readers keep a complete tree. Test `held installer fixture teardown joins writer before removing its root` |
| E1533S2-30 | hub-api | QA | `pl E1533S2-30 hub/test/host-agent-restart.test.ts` | `CLEAN`, the whole file, unedited (T-1723 C4: the version-handoff cases are the `version delivery` and `kill-agent` expansions of `C1-C3 <mode> reconnect reads retained table without signalling harness`) |
| E1533S2-31 | hub-api | QA | `nt E1533S2-31 hub/test/host-agent-closure.test.ts` | `CLEAN` with the exact list, unedited (T-1723 C4). Tests: `committed agent closure matches the complete source and native asset graph`, `host registry startup imports no development-only package`, `restart requires exact fresh native birth and refuses reused or inherited PID authority`, `recovery handshake preserves previous hello shape and gates the additive restore operation` |
| E1533S2-32 | hub-api | QA | `nt E1533S2-32 hub/test/claude-agent-launch.test.ts` | `CLEAN` with every listed name (T-1727 C1, C2). Test `an already admitted Claude generation cannot claim pre-spawn refusal`; the `native`, `generation`, `untyped` and `real-incomplete` expansions of `native incomplete classification honors owner proof <proof>` (only typed proof clears; untyped and real-incomplete stay incomplete) |
| E1533S2-33 | hub-api | QA | `nt E1533S2-33 hub/test/host-command-environment.test.ts` | `CLEAN` with every listed name (T-1727): the `legacy`, `native-only`, `other-generation` and `matching-generation` expansions of `SSH Claude pre-spawn admission receipt <shape>` (only the matching generation maps to non-admission) |
| E1533S2-34 | hub-api | QA | `nt E1533S2-34 hub/test/doctor-run.test.ts` | `CLEAN` with every listed name (T-1727 decision f5e95222): the `closed`, `missing-close` and `pid-seen` expansions of `native no-PID error admission <boundary>` |
| E1533S2-35 | hub-api | QA | `pl E1533S2-35 hub/test/claude-code-remote.test.ts` | `CLEAN` with every listed name, the whole file (T-1727 C1, C2). The `same-name` and `different-name` expansions of `remote Claude pre-spawn root refusal permits immediate <name> launch` (0755 root refused with zero native background calls, root fixed, immediate launch admitted with a pinned birth); `remote Claude native <mode> <name> retry` for `aborted`, `spawn-error` and `pre-wire` (admitted) and for `lost-reply` and `sent-abort` (still fenced with their existing messages); the `aborted`, `throw`, `no-pid-error` and `pid-existed` expansions of `native command admission receipt <mode>` |
| E1533S2-36 | hub-api | QA | `pl E1533S2-36 hub/test/host-ssh-contract.test.ts` | `CLEAN`, the whole file, run **alone** in its own row (T-1727 C2: the `claude` expansion of `C2 <name> adapter sends no planted hub-only key through the SSH agent` now expects a typed `CLAND_AGENT_ADMISSION_REFUSED` rejection). T-1731 is a known mix-only flake of test `accepted spawn reconciles its durable token after the commit reply is dropped`; see "Probes that mislead" |
| E1533S2-37 | hub-api | QA | `pl E1533S2-37 hub/test/host-prepared.test.ts` | `CLEAN` with every listed name, the whole file (T-1704 C1, C2, once). Test `prepared restart observation waits through identity publication before agent admission` (a real refused hello while watch startup is held, then an authenticated hello and a successful identity request); test `native agent restart cleans actual unfinished spawn and worktree preparations before publishing readiness` (no `agent closed`) |
| E1533S2-38 | hub-api | QA | `nt E1533S2-38 hub/test/tcp-listener-census.test.ts` | `CLEAN` with the exact list (T-1670 C1): the stable-birth case attributes pid, sources, start, parent and command; the `listeners` and `description` expansions and the missing-birth expansions suppress unproven metadata; an empty census returns no failure |
| E1533S2-39 | hub-api | QA | `pl E1533S2-39 hub/test/transport-forwards.test.ts` | `CLEAN` with the exact list (T-1670 C1). Test `C1 Unix and host-loopback forwards answer with no hub TCP listener; C2 cancellation removes both`: the planted 127.0.0.1 listener is seen by `lsof`, fails the same assertion with `pid=<worker>`, `source=worker, control-socket holder`, a command naming `transport-forwards`, `nativeStart=darwin:…` and a parent, then the real census of the worker and every control-socket holder finds no TCP listener |
| E1533S2-40 | hub-api | QA | `nt E1533S2-40 hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Both runs `CLEAN`: every new stage test file (`host-provider-digitalocean`, `image-recipe`, `host-prepare`, `host-runtime-bundle`, `host-runtime-delivery`, `tcp-listener-census`, `host-provider-digitalocean-volumes`) is in `hub/test/tiers.json` with a guide under `docs/agents/tests/` |
| E1533S2-41 | hub-api | QA | `nt E1533S2-41 hub/test/host-provider-digitalocean-volumes.test.ts` | `CLEAN` with the exact list (T-1717 C1 to C5). The contract registrations from `hostProviderVolumeContract('digitalocean', …)` (region `lon1`, other region `fra1`, snapshot retry time 600000 ms on the shared FakeClock): `digitalocean: volumes create, list and confirm deletion`, `digitalocean: volumes enforce one attachment and region binding` (`attached elsewhere`, wrong detach, attached-delete refusal, `region mismatch`), `digitalocean: ignored volume deletion retains inventory` (DELETE 404 with GET 200 gives `incomplete`, inventory kept), `digitalocean: volumes rate limit snapshots until retry time`. Test `digitalocean volume create carries lon1, 1 GiB and project/pool tags` (POST `/v2/volumes` with `size_gigabytes` 1, region `lon1`, tags `cland`, the project tag, `cland-pool-agents`). Test `digitalocean volume actions publish attachment only after completed` (delayed attach and detach keep the old attachment until the 100 ms poll finds the action `completed`). Test `digitalocean volume creation requires a pool, shares pause and resolves acquire pool` (`volume pool unavailable` with no request; a volume 429 pauses both volume and droplet creates until its retry time). Test `digitalocean lost volume create reply retains discoverable resource without replay` (one POST; list finds it). Test `digitalocean known snapshot refusal returns immediately for the exact volume identity` (no request and no clock advance until the retry time, no replay at expiry) |
| E1533S2-42 | hub-api | QA | `nt E1533S2-42 hub/test/executor-deadline.test.ts` | `CLEAN` with every listed name, the whole file, unedited (T-1713 and T-1717 each added provider calls to `hub/src/executor/droplet/deadline.ts`; T-1717's guide names the executor deadline tests as preservation). Test `provider shutdown detaches an unanswered call and refuses later calls` |

### Web cases (when in scope)

none. The stage changes no web surface; no browser runs.

## Manual checks

Run in table order: E1533S2-00 to E1533S2-03 before the cases, E1533S2-50 to E1533S2-58 after them. Scratch rows depend on the state the rows before them leave. Record each with `sh .agents/skills/qa/qa-record.sh note E-1533 "$RUN" <id> hub-api "<the command you ran>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence file>` from `$W`. Every scratch row's evidence begins with its `PRE gate` line (`credential-prefix names 0`, `QA_SESSION set yes`, HOME, TMPDIR and fake host root `yes`) and ends with `# fresh: redacted or withheld lines 0` and `row exit 0`; anything else is read before judging, and a gate refusal is BLOCKED.

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1533S2-00 | hub-api | QA | `s00 > "$EV/E1533S2-00.txt" 2>&1` (QA's own shell) | PRE line: HEAD, dev and the request's SHA the same 40 hex; `dirty entries 0`; the root's non-tracker count recorded (E1533S2-58 compares). `plan read exit 0`; the stage line shows `name` `DigitalOcean on a fake API, the recipe and pool images`, `qa` `{"scope":"affected","when":"after-stage"}`, `items` holding T-1713, T-1715, T-1717, T-1714, T-1716, T-1723, T-1727, T-1704 and T-1670 plus any finding fixes the request names, `merged` equal to `total`, and `state` not `closed`. Every member line reads `landings 1` with its commit; any other count is BLOCKED |
| E1533S2-01 | hub-api | QA | `s01 > "$EV/E1533S2-01.txt" 2>&1` (QA's own shell; the typecheck runs in a fresh seal) | Node 24; `typecheck exit 0` (the whole workspace at the integrated build); `dirty entries 0` |
| E1533S2-02 | hub-api | QA | `s02 > "$EV/E1533S2-02.txt" 2>&1` (QA's own shell, read-only) | Every landing `package.json and lockfiles: 0`. `preserved files edited at its landing: []` for every landing, and `commits after the stage-1 build 5795362b touching preserved files: []` (a non-empty list is read before judging; it is a finding unless the item's criteria or a recorded decision allow it). `product paths: 0` for T-1704 and T-1670 (test-only fixes). Test paths per landing, against these sets (VERIFIED at the landings): T-1713 `hub/test/fakes/digitalocean/fake-api.ts hub/test/host-provider-digitalocean.test.ts hub/test/tiers.json`; T-1715 `hub/test/fakes/digitalocean/fake-api.ts hub/test/host-provider-digitalocean.test.ts`; T-1717 `hub/test/fakes/digitalocean/fake-api.ts hub/test/host-provider-digitalocean-volumes.test.ts hub/test/tiers.json`; T-1714 `hub/test/accounts-policy.test.ts hub/test/image-recipe.test.ts hub/test/tiers.json`; T-1716 `hub/test/fixtures/cli-usage/commands.json hub/test/host-prepare.test.ts hub/test/host-secret-admission.test.ts hub/test/tiers.json hub/test/web-authority.test.ts`; T-1723 `hub/test/durations.json hub/test/host-runtime-bundle.test.ts hub/test/host-runtime-delivery.test.ts hub/test/lint-version-source.ts hub/test/tiers.json`; T-1727 `hub/test/claude-agent-launch.test.ts hub/test/claude-code-remote.test.ts hub/test/doctor-run.test.ts hub/test/durations.json hub/test/host-command-environment.test.ts hub/test/host-ssh-contract.test.ts hub/test/ssh-host-fixture.ts`; T-1704 `hub/test/durations.json hub/test/host-prepared.test.ts`; T-1670 `hub/test/durations.json hub/test/tcp-listener-census.test.ts hub/test/tcp-listener-census.ts hub/test/tiers.json hub/test/transport-forwards.test.ts` |
| E1533S2-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1533S2-03.txt" 2>&1` (QA's own shell, read-only) | Every line reads `ok`. T-1714: the builder renders `renderRecipe({ arch: 'x86_64', node: key.node })`; the x86_64 rendering is byte-identical to `provision.sh` with `__NODE_VERSION__` filled (two Node versions) and the template digest is `3cf36474d3b4e6a42c2a9edcbfb68b44b7c08b405f82f99f755651f502f7ef3d` (C5); arm64 differs only by `linux-arm64` (C1); the OpenCode installer URL appears in `hub/src/doctor/harnesses.ts`, `hub/src/image/recipe.ts` and `hub/src/setup/steps/harnesses.ts` once each, each under its own exact-literal entry in `accounts-policy.test.ts`, and its image-installer form (`… \| bash -s -- --version`) only in `recipe.ts`, with no `opencode-ai` (C3); the architecture refusal (C4). T-1723: the npm argv holds `--ignore-scripts`. T-1716: `host prepare [pool]` in `HOST_USAGE` and the frozen fixture, the usage line, the dispatch and web refusals, the unknown-pool text, the printed line shape. T-1727: the typed receipts on the aborted, spawn-throw and no-PID paths; the typed proof before the `cleanup incomplete` text fallback; the pre-wire refusal; generation-matched mapping; the adapter settles by error code; no `AbortError` and no `.message.includes(` in the mapping files. T-1713: the region list, the pool tag, the keyed-prepare refusal, the registry entry, the executor imports (the preservation closure), no token variable in the provider, the API's redaction. T-1715: the fixed pause refusal, no reason built from an error or a template, the redacted 422 with its retry time, the API-read limit and prices. T-1717: no `DigitalOcean volumes unsupported` stub left; the 1 GiB create with the `cland`, project and pool tags and its pool requirement; the completed-action gate (C1); `attached elsewhere` (C2); the snapshot refusal with the API's retry time (C3); the confirmed volume delete and its `incomplete` result (C4). A `MISMATCH` is read at the build before judging (a renamed string is followed to its new text) and is a FAIL unless the landing changed it with a recorded decision |
| E1533S2-50 | hub-api | Human | `mrow E1533S2-50 m50` | **Scratch project.** `PRE p1 entries 0; fh entries 0`; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `init template hosts tables: 0` (the init template writes no `[hosts` table, so the appended tables edit no existing key); `hosts tables written: agents 1 spare 1; lockfile absent`; `hub start exit 0; hub up`; `(provision key) exit 0` with `verification.provision = "setup.sh"; applies now`; `provision key 1`; `hosts tables kept: agents 1 spare 1`. A hub start failure makes E1533S2-52 to E1533S2-56 BLOCKED |
| E1533S2-51 | hub-api | Human | `mrow E1533S2-51 m51` | **T-1716 C4, help.** `(a) host --help exit 0` and `prepare usage lines` 1 or more; `(b) help exit 0` and `prepare usage lines` 1 or more |
| E1533S2-52 | hub-api | Human | `mrow E1533S2-52 m52` | **T-1716 C1, C3: every configured pool.** `(all pools) exit 0`; `agents prepared line: 1`, `spare prepared line: 1` (a first prepare names every key part present: `node, recipe, provision, harnesses`, with no `lock` since p1 has no lockfile); `pool records: agents present spare present; fake images: agents present spare present` |
| E1533S2-53 | hub-api | Human | `mrow E1533S2-53 m53` | **T-1716 C1: then `current`.** `(agents again) exit 0`; `current line: 1`; `prepared lines: 0`; `pool record unchanged: yes` |
| E1533S2-54 | hub-api | Human | `mrow E1533S2-54 m54` | **T-1716 C2: a hook byte edit names its key part.** `hook digest changed: yes`; `(agents after the hook edit) exit 0` with `provision line: 1` (`agents: prepared; changed: provision`); `(agents once more) exit 0` with `current line: 1` |
| E1533S2-55 | hub-api | Human | `mrow E1533S2-55 m55` | **T-1716 C3: unknown pool.** `(unknown pool) exit 1`; `refusal lines` 1 or more (`unknown pool nope; configured pools: agents, spare`); `records: nope absent; fake image nope absent` |
| E1533S2-56 | hub-api | Human | `mrow E1533S2-56 m56` | **T-1713 decision on the real CLI.** `hub after stop: down`; `do table written: 1`; `hub start exit 0; hub up`; `(digitalocean pool)` exit non-zero with `refusal lines` 1 or more (`do: DigitalOcean pool image preparation unsupported`) and `token-required lines: 0` (the refusal comes before any API call; a token-required line means a call was attempted and is a FAIL); `pool record do: absent; provider state: absent`. The seal holds no provider token, and the API refuses any call without one before sending (`api.ts`), so no request can leave the machine |
| E1533S2-57 | hub-api | Human | `mrow E1533S2-57 m57` | `hub stop exit 0; hub down`; every recorded pid `alive no`; `processes naming the scratch root or this build: 0`. A hit is listed and is a FINDING unless its command is unrelated (pid reuse, recorded) |
| E1533S2-58 | hub-api | QA | `s58 > "$EV/E1533S2-58.txt" 2>&1` (QA's own shell) | HEAD, dev and the request's SHA still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock present: no`; `T entries other than node-compile-cache 0`. Each leftover is listed with its type, open count and the first file after which it appeared. Known dead T-1676 residue from unchanged files (open 0, owner PIDs gone) is removed by literal path and the row repeated; live residue, or residue first seen after a file a stage-2 landing added or edited (E1533S2-02), is a finding. A moved dev keeps the evidence and makes the run BLOCKED |

Before requesting QA, run `cland qa lint` with this filled brief at the build under test: from the root, `node hub/bin/cland.ts qa lint qa/briefs/E-1533-stage-2.md --commit <dev SHA>`, with a dev SHA that includes every stage landing (T-1717's `54607a4a4` is the last). The brief is complete only when qa lint passes at the build.

## Probes that mislead

- **Generated names cannot be certified by `qa lint`.** The contract registrations (`digitalocean: …`, `fake: …`) come from `hostProviderContract`/`hostProviderVolumeContract` through the caller's `register(name, run)`; loop titles (`<arch> base …`, `pool prepare invalidates <part> …`, `digitalocean <status> pauses …`, `remote Claude native <mode> <name> retry`, `native command admission receipt <mode>`, `SSH Claude pre-spawn admission receipt <shape>`, `native no-PID error admission <boundary>`, `native incomplete classification honors owner proof <proof>`, `C1-C3 <mode> reconnect …`, `upload abort …`, `listener attribution …`) are expanded in `expect.json` and checked by `tap.mjs` at the run; a list that differs from the build's loops is re-derived before judging.
- **T-1717 has no CLI surface at this stage.** Volumes are reached only through the provider interface (E-1534 and later stages own their callers), so no scratch row exists for it; E1533S2-41 carries its criteria. Its fake API's snapshot window and action delays run on the FakeClock; no wall-clock wait proves anything here.
- **The DigitalOcean keyed-prepare refusal is the decision, not a defect.** T-1713's prepare observes a configured image only; the real pool image build is T-1719 (stage 3). E1533S2-56's refusal is the expected outcome.
- **Two different hook readers.** `cland host prepare`'s pool key hashes the hook's working-tree bytes (`pool-image.ts`), so E1533S2-54's uncommitted one-byte edit changes it; the executor's snapshot key hashes the committed hook (T-1709), which this run never exercises on the live project.
- **The first prepare's `changed` list is every key part present**, not a diff against anything: `node, recipe, provision, harnesses` (plus `lock` only when the project holds `package-lock.json`).
- **Hand-written `[hosts]` tables are additions, not edits.** The init template writes no `[hosts` table (E1533S2-50 prints 0) and `cland config set` has no hosts keys at this build (E-1534 owns them), so the tables are appended while the hub is stopped; `[verification] provision` goes through `cland config set` only.
- **The npm in `host-runtime-delivery` is a scripted offline stub.** It proves the exact argv (`--ignore-scripts` included) and the atomic tree, not a real `npm ci`. No production path calls the ready delivery yet (T-1718), and fake hosts keep the hub's installed tree, so there is no scratch row for T-1723; the version handoff is T-1730.
- **T-1727 has no scratch row.** Its refusal happens on a host's Claude launch; `claude-code-remote` drives it through the real fake SSH agent, the UI frame seam and the scripted Claude, which a scratch hub would only repeat. The account-root fence wants 0700 roots: this run's `$Q/claude` and `$Q/fake-claude` are 0700 already (qa-678's DoD run, T-1727's origin).
- **Known flakes by signature, not by guess.** `host-ssh-contract` runs alone because T-1731 (its test `accepted spawn reconciles its durable token after the commit reply is dropped` resolving with a raw `process-exited` event) showed only in a four-file mix. `transport-forwards` C1's two unattributed `MainThrea` loopback listeners are T-1732's open cause; T-1670 now attributes them. If either signature appears, keep the full output (for transport-forwards, the attribution lines: pid, sources, nativeStart, parent, command, raw rows), rerun the row once alone under the lock, and report both runs; the second result stands for the row and both are findings for the requester. Any other failure is judged as it stands.
- **Evidence criteria are the items' evidence.** T-1704 C1/C2 and T-1670 C2 are loaded-repetition and container or droplet evidence already recorded on the items (A-17225, A-17247; A-17294, A-17308). This run runs each file once on macOS; it repeats nothing under load.
- **The redactor withholds whole lines.** A `missing:` name in a check line next to a `# fresh: line withheld …` marker is read before judging: `host-secret-admission`'s C1 title is expected to be withheld (it is not listed); any other withheld `ok` line makes the row INCONCLUSIVE, never a silent pass. The `# pass`/`# fail` counters are never withheld.
- **The provider's no-child test mocks entry points.** `digitalocean provider keeps sentinel out of output, errors and user-data, and launches no child` mocks child-process functions and console; it says nothing about a real droplet's user-data path.
- **The executor files run a loopback fake DigitalOcean API.** Their `127.0.0.1` listener and synthetic credential are fixtures; no request leaves the machine. A real DigitalOcean variable in a seal is a BLOCKED gate.
- **Plain `node --test` is not the suite runner.** It enforces no duration allowance and no resource tripwire preload: a slow pass is not a finding and a fast one proves no budget.
- Process cleanup probes use the fixture-owned pid census registered at launch (`$Q/pids`) and checked through exit; a machine-wide `pgrep` counts other sessions too.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file. E1533S2-53 compares record digests, not mtimes.
- Speed criteria use measured wall times, never projections; this stage has none.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases: `executor-droplet`'s macOS idle-sleep case runs here; `transport-forwards` uses `lsof` on macOS; no listed file skips on macOS at writing.
- Re-check helper and function names with grep at the tested build; renames happen. The kit's line ranges are pinned by the stage-4 brief's blob; a different blob is a setup BLOCKED, never a reason to guess new ranges.

## Out of scope

- The real DigitalOcean API, real droplets, volumes, snapshots, keys and tokens, and any network.
- Real npm installs on hosts (the delivery's `npm ci` runs only as the scripted stub).
- T-1730 (the later version handoff installing the whole runtime tree).
- T-1731 and T-1732 (found-aside bugs: the raw `process-exited` shape after a dropped commit reply, and the owner of `transport-forwards`' loopback listeners). Their signatures are handled as in "Probes that mislead"; their fixes are not judged here.
- Stage 3 (`create to ready`) and its items, T-1719, T-1718, T-1720 and T-1730 among them; E-1534's hosts table, `cland config set` for hosts and the scheduler.
- Linux and container runs, the stage covers and the items' loaded repetitions: their evidence; this run is macOS only and says so in the verdict.
- Duration allowances (`hub/test/durations.json`) as pass conditions.
- Any `cland executor prepare`, `cland verify`, `cland host prepare` or `cland hub reload` on the live project.

Missing authorization (a real-browser or GUI step, a droplet, a real provider token) is out of scope, not BLOCKED, because none of these cases needs one.

## Grants

none. No grant is needed: every case runs on this Mac against fakes with a disposable HOME and no credential.

## Source provenance

VERIFIED = read in source at the named commit. VERIFIED-on-branch = read on the branch head named under "Build" before its landing; re-read at the build. INFERRED = not read at the tested build or not proven by a named test; re-read it at the build and record the difference before judging.

- T-1713 (VERIFIED at its landing `30145b7c6` and dev `54607a4a4`): `hub/test/host-provider-digitalocean.test.ts` titles at lines 31, 56, 72, 86, 97, 102, 123, 131, 140, 159, 173, 190, 202, 240, 271, 294 and the contract call at 45 (at dev `54607a4a4`, after T-1715's landing); `hub/test/host-provider-contract.ts` registrations at 14, 18, 37, 50 (the `refused`/`failed-acquire` loop), 59 (the `delayed-boot`/`never-boot`/`ignored-delete` loop); every T-1713 `src.mjs` string in `digitalocean.ts` and `registry.ts`; the provider's imports of `executor/droplet/api.ts`, `endpoint.ts`, `droplet.ts`; `docs/hub/host-providers.md` "Pool images" (keyed preparation rejected before any provider API call); the API's token gate (`DIGITALOCEAN_TOKEN is required` before any send, `hub/src/executor/droplet/api.ts:88`–`89`) and redaction (`:102`).
- T-1715 (VERIFIED at batch head `d8989d02e` and again at its landing `7d88dbc0d`, byte-identical): its titles in `host-provider-digitalocean.test.ts` at 322, 345 (the `429`/`422` loop), 371, 396, 407, 415, 439; `refreshDeclarations`, `#pauseUntil`, `#paused` and every T-1715 `src.mjs` string in `digitalocean.ts` and `api.ts`; the declaration union in `declarations.ts` and `provider.ts`; its guide section "T-1715 declaration and pause cases".
- T-1714 (VERIFIED at its landing `e6e7fb44d` and dev): `hub/src/image/recipe.ts`; the builder call in `prepare.ts`; `provision.sh` digest `3cf36474…`, one `__NODE_VERSION__`, three `linux-x64`; `hub/test/image-recipe.test.ts` titles at 8, 15 (loop), 30, 37, 47, 57; `hub/test/accounts-policy.test.ts` titles at 26, 39, 48 and the exemption entry; the per-file installer URL set; the pin-owner comment in `recipe.ts`.
- T-1716 (VERIFIED at its landing `4cb561cb7` and dev): `hub/test/host-prepare.test.ts` titles at 12, 29 (loop over `harnesses`, `lock`, `provision`), 44, 59, 80; `host-secret-admission.test.ts` C5 at 88 with the `host.prepare` refusals; `web-authority.test.ts` at 464 (`cli-neovim-only`); `cli-help.test.ts` at 17 and 66 (loop); `HOST_USAGE` in `hub/src/cli/usage.ts:45`; `hub/src/cli/host.ts` prepare branch and output line; `hub/src/host/provider/pool-image.ts` (key parts, working-tree hook read, record path, first-prepare part list, unknown-pool text); `hub/src/hub/dispatch.ts` `host.prepare` gate; the fake's image record path in `fake.ts`; `hub/src/cli/hub.ts:137` spawning `hub serve` with the CLI's environment (so the seal's `CLAND_FAKE_HOST_ROOT` reaches the scratch hub); no `[hosts` in the init template (`hub/src/init/config.ts`).
- T-1723 (VERIFIED at its landing `e4328d076` and dev): `hub/test/host-runtime-delivery.test.ts` titles at 46 and 91 (nested subtest at 97); `hub/test/host-runtime-bundle.test.ts` at 8 and 23 (loop); the npm argv in `hub/src/host/code-delivery.ts`; `docs/agents/host-agent.md`; `host-agent-restart.test.ts` at 25 (loop), 118, 185 and `host-agent-closure.test.ts` at 9, 16, 38, 53, neither in the landing.
- T-1727 (VERIFIED at its landing `a03310d3c` and dev): `claude-agent-launch.test.ts` at 29, 133, 142 (loop); `host-command-environment.test.ts` at 77 (loop); `doctor-run.test.ts` at 103 (loop); `claude-code-remote.test.ts` at 91, 108 and 675 (loops); `host-ssh-contract.test.ts` at 14, 88 (loop), 153 and the migrated Claude refusal; every T-1727 `src.mjs` string; decisions f5e95222 and 9be88778 in the item's comments.
- T-1704 (VERIFIED at its landing `f0e7e9284` and dev): `host-prepared.test.ts` at 81 and 109; no `hub/src` path in the landing; the guide's held-startup description.
- T-1670 (VERIFIED at batch head `80cf1151a` and again at its landing `73bd6d4f2`, byte-identical): `transport-forwards.test.ts` at 69, 120, 134, 153, 168, 191 and the C1 attribution assertions; `tcp-listener-census.test.ts` at 5, 14 (loop), 30 (loop), 43; no `hub/src` path in the landing; the revised C2 in the item.
- T-1717 (VERIFIED at its landing `54607a4a4`): `hub/test/host-provider-digitalocean-volumes.test.ts` (T2 in `tiers.json`) with the `hostProviderVolumeContract('digitalocean', …)` call at line 26 (registrations at `host-provider-contract.ts` 95, 109, 132, 141, unedited) and titles at 33, 42, 98, 120, 133; its guide under `docs/agents/tests/` (the file named after the test); every T-1717 `src.mjs` string in `digitalocean.ts` and `api.ts`; the deadline positions in `deadline.ts`; the landing's test paths; no stub `DigitalOcean volumes unsupported` left.
- Preservation files (VERIFIED at dev `54607a4a4`): no commit after `5795362b` touches any `preserved` file; the `executor-*`, `prepare-key`, `executor-prepare-component`, `verify-prepare`, `host-provider-*`, `digitalocean-*` name lists equal stage 1's (the static ones read literally; the generated ones from their loops); `executor-prepare.test.ts:62` asserts the key's `recipe` equals the sha256 of `provision.sh`.
- The kit (VERIFIED at dev `54607a4a4`): `qa/briefs/E-1532-stage-4.md` blob `4ed467672750bf34179ed72549df863d1541eddb`, lines 133 to 136 (`holder`, `quiet`, `ld`) and 228 to 279 (`tap.mjs`); `fixtureEnvironment` and `scratchGitEnvironment` in `test-support/fixture-environment.ts` (CLAND_ and QA_ overlays kept, credentials filtered after the overlays); `assertPublishable` exported by `.agents/skills/qa/qa-demo-policy.ts`; `QA_SESSION` read by `.agents/skills/qa/qa-record.sh`.
- INFERRED: the preservation lock's path and owner-file shape (stage 1's definition; the guides name "the stage preservation lock" without a path); `applies now` printed by `config set` (depends on the scratch reload); the exact exit code of a refused `cland host prepare do` (non-zero); `fh entries` before m50 being 0; the 5+5 and 1+1 residue counts at this build.
- Plan JSON (VERIFIED at dev `54607a4a4`): a stage carries `name`, `state`, `qa`, `items`, `merged`, `total`, `statuses`; lanes are in `plan.stages[].lanes`.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`--stage "DigitalOcean on a fake API, the recipe and pool images"`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Read the request's id and any earlier verdict's id from the epic topic's `history`, never from a `send` result (rule 22). Report `qa clear E-1533 stage DigitalOcean on a fake API, the recipe and pool images` or `qa not clear E-1533 stage DigitalOcean on a fake API, the recipe and pool images` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
