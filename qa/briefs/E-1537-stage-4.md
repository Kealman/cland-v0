# Stage QA brief: E-1537 stage 4 — the tour and the hosts docs

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (start `bash` first; zsh reads `$S:q`, `$B:h` or `${B}:hub` as modifiers, does not split unquoted path lists and does not split `set -- $pair`; always brace a variable before `:`). The run is local, on macOS (BSD `stat`, Node 24, `uuidgen`, `shasum`, `getconf DARWIN_USER_TEMP_DIR`). A platform skip is a FAIL, not a pass. **No real SSH, host, droplet, volume, snapshot, DigitalOcean API, key, credential, harness login, browser sign-in, sudo, mount, Telegram, Discord, speech API, npm registry or network (R-1530's QA rule).** The named test files use only their own fakes (the fake host provider, injected hub clients, FakeClock, temporary projects). The scratch rows use one CLI-started scratch hub whose only host provider is the fake one (`provider = "fake"`, `CLAND_FAKE_HOST_ROOT` from the seal); no row creates a host, an image or a login, and no row sets a token anywhere. **No browser and no Neovim:** neither landed member touches `web/`, `nvim/`, `hub/src` or `shared/` (VERIFIED: `git diff --name-only 932f3018c 1114abeff -- hub/src shared web nvim` is empty; E1537S4-02 reads it again), so no row starts a browser or a workbench; the tour's sentences about both workbenches are read against their built components' source (E1537S4-03). Never the human's browser, profile or Neovim, no GUI, no computer use. Never read, print or log `DIGITALOCEAN_TOKEN` or any key value; no secret is ever an argv element.

**Every member has landed.** T-1832 landed as `0d1390dde` (batch `fe0ff273`), T-1833 as `5cd48f9de` (batch `c3154209`) and T-1834 as `6cc0fa816` (batch `ba1ed164`); all three read `closed`, `done`, with no claim (VERIFIED with `task view --json` and `git log --first-parent --grep` at `1114abeff`). The T-1832 and T-1833 lines were drafted at `0a5e25c7d` and every one was re-read at `1114abeff`; the T-1834 lines were filled from its landing there. "Landing markers" at the end records that. E1537S4-04 expects `open T-1834 markers: 0`; a non-zero count makes the run BLOCKED.

**Drafted at dev `0a5e25c7d4f370f6385e06545d729ab52a5c9b44`** ("Tracker: T-1833 landed (5cd48f9de)"); **completed and verified at dev `1114abeff4518aad8889d94e71de07ae07265bab`** ("Durations: E-1537 stage-4 add-only refresh (A-19454, A-19456, A-19470, A-19460, A-19462, A-19473)", durations-only after T-1834's landing and its tracker commit `5c81cfc54`). Markers: VERIFIED = read in source, Git, the tracker or the artifacts at `1114abeff` (each landed member's lines read with `git show <landing>`; the landing checks, the commit classes, the batch-candidate trees and every block SHA-1 computed with plain Git in bash on the root checkout, whose only uncommitted entry was one `.cland/tasks/` file; `src.mjs`, `voc.mjs`, the expectation lists and the publication precheck run read-only over a `git archive` of `1114abeff`; the plan and items with `task plan show` and `task view`; the verify and batch logs in `.cland/artifacts`); INFERRED = a reasoned expectation no read or run has proven (rule 22: an INFERRED line is never a pass condition on its own). Any dev SHA later than `1114abeff` is re-read there before the run; E1537S4-02 names which later commits are acceptable.

The stage teaches and documents agent hosts. **T-1832** adds the onboarding tour's tenth stage, "Agent hosts": where the Hosts row is in both workbenches and that the web's hosts view opens from it; a waiting launch as an inbox status line with the three reasons the hub emits (`waiting for a host`, `waiting for a login <harness>`, `waiting for host <id> to boot`) and the "Not enough <harness> logins. Create one?" card; `cland login add <harness> --pool <pool>` or the web's Add; setup's agent-hosts step or `cland config set` by hand; ending "Look now: the Hosts row in the sessions panel." SKILL.md's tour offer and the skill test move from nine stages to ten; the E-616 and E-1313 briefs' replay selectors follow. **T-1833** adds the docs page "Hosts, pools and logins" (`site/src/content/docs/docs/hosts.md`) under Features in the sidebar and linked from the features overview, with sections on configuration, role placement, commands, lifecycle and failures, money and logins (per-harness rules, the Codex one-place warning), and doctor's host lines and setup's agent-hosts step as built; its marked walkthrough block (`sh host-pool`) configures a second pool. The site guard `site/test/hosts-docs.test.ts` runs through the shared T1 wrapper `hub/test/remote-docs.test.ts`; the T2 file `hub/test/hosts-docs-pool.test.ts` runs the marked block on a fake pool; the closed-item wording lint now scans `site/src/content/docs/**/*.md`. **T-1834** fills the page's "Provider price table" (checked on 2026-11-15: `agents` and `qa` at the default `s-4vcpu-8gb`, $0.07143 per hour and $48.00 per month; login volumes $0.10 and volume snapshots $0.06 per GiB-month, equal to `DIGITALOCEAN_STORAGE_PRICES` in `hub/src/host/provider/digitalocean.ts`; the default $3.00 sub-cap as about 42.00 host-hours), adds a "Hosts and logins" section to `site/src/content/docs/docs/cli.md` listing the 16 `cland host` and `cland login` subcommands their usage names, rewrites the page's setup paragraph to follow `hub/src/setup/steps/hosts.ts` (see "The setup paragraph" under "How this brief applies them"), and adds three titles to `site/test/hosts-docs.test.ts`. The run takes about 85 minutes: setup and E1537S4-00 to -08 about 35 minutes (the typecheck and the web build included), the sealed cases about 15 minutes, the scratch rows about 25 minutes, the end checks about 10 minutes. Waits for cover-quiet admission or load are not product results.

## Carried corrections

A reused block must be reconciled against the source brief's recorded run corrections. This brief reuses blocks from fixed commits, never by blob (A-17643): the kits exactly as stage 3 takes them from `K`, `M3` and `M4`, and its Git wrapper text. The stage-3 brief is read at `P3` (`932f3018c335d620fc6afd268c5f9abb846c9d13`, "QA brief: E-1537 stage 3 (doctor and setup's hosts step)", its only commit, also the stage-3 QA SHA; VERIFIED: `qa/briefs/E-1537-stage-3.md` is unchanged from `P3` to `1114abeff`). It carries the whole chain, read into the evidence at setup and followed as written:

- the E-1537 stage-3 chain at `P3` (`qa/briefs/E-1537-stage-3.md` from `## Carried corrections` up to `## Stage`; 62 lines; SHA-1 `10f1860a8972e7a79209f5b9e8b33870fa130d41`), `$EV/carried-from-P3.md`;
- the E-1537 stage-2 chain at `P2` (55 lines; `6bcd1b899225aaad4379ecbd772ee66cf6fa7cdf`) and stage-1 chain at `P1` (63; `a9c55f181e9d43d438d23b087950630dec632359`), `$EV/carried-from-P2.md` and `$EV/carried-from-P1.md`;
- the E-1535 chains `M2` (127; `98f38398667ed6b1192f2d9d20e131a30eb88bdc`), `M3` (55; `51da4c95a6b8c380b7b11e4536c7d23f93986701`), `M4` (80; `e4ad4448829797e25c364afad87b0f3f2cf3b06e`), `M5` (76; `7555a12ef6902bbfe8dd2094d14e08d2ea93c61a`) and `M6` (59; `82535892ef7a00b2e4762a0d4515eebe1ca64a90`), `$EV/carried-from-M2.md` to `$EV/carried-from-M6.md`.

Every line count and SHA-1 above was computed in bash at `0a5e25c7d` from fixed commits (VERIFIED; the `P2`, `P1` and `M2` to `M6` figures equal stage 3's).

### From the E-1537 stage-3 run (qa-e1537s3-2026-11-14-qa678-1, A-19436, clear at `932f3018c`)

The run's report and `corrections.json` (SHA-1 `446fe83636c2133f9b00d8fea4a96ff724379b47` and `81a9906eedf89f17d37a31180ebef62c2911cacd`, VERIFIED) record seven run-copy corrections. This brief bakes each in from the start; none is applied as a run correction again.

- **R-1 (decision `1d683b85`; fresh seals and capture-boundary redaction).** Every child process of a brief helper gets its environment from `fixtureEnvironment(Q, base, overlays)` then `scratchGitEnvironment`, with every `CLAND_*` and `PATH` input inside the builder and nothing overlaid after: the kit's `fresh.mjs` and `seal.mjs` for every sealed command; inside a sealed helper, children either inherit the sealed environment unchanged (`scratch.sh` passes no overlay and no `env` prefix to any child) or call `seal()` again (`voc.mjs`, `census4.mjs`). Every capture passes the redactor and the unchanged publication policy (`.agents/skills/qa/qa-demo-policy.ts`, `assertPublishable`) before it is written: command output streams through `fresh.mjs` (or `std.mjs`) into the row file; every other capture this brief writes goes through `pubw.mjs`; the scratch functions keep command output in shell variables and write no capture file. A withheld or redacted line (`# fresh: redacted or withheld lines <n>` or `# pubw <name>: withheld lines <n>` with `n` above 0) makes its row INCONCLUSIVE; E1537S4-99 counts them across the run.
- **R-2 (decision `cf8fe88e`; exact lists from loops).** Every exact list in `expect.json` was expanded from the loops and the imports that register titles in the same process, and checked against the source at `1114abeff` with a registration scan (`site/test/remote-docs.test.ts` registers three titles from one loop over `landing feature`, `README feature`, `Features entry`; `site/test/hosts-docs.test.ts` has seven top-level registrations, no loop, four from T-1833 and three from T-1834; `hub/test/remote-docs.test.ts` imports the three site guard files, so its one TAP plan holds 3 + 7 + 22 + 1 = 33 titles). Each list was also found passing, name by name, in the verify logs A-19454 (T-1832) and A-19470 (T-1834, which ran after T-1833's landing), VERIFIED; the log attributes the imported titles to their own site files.
- **R-3 and R-6 (decisions `cf8fe88e`, `543aa5a3`, `105f9995`, `43923560`; publishable titles and fixed lines).** Every expected title and every line of this brief, fixed helper output included, passed the unchanged publication policy before commit (see "Publication precheck" under Build); no title needs a presentation mapping, so no mapping is recorded. Fixed labels avoid the forms the policy refuses or that a runtime value could complete into a refusal (no "token" or "api_key" directly followed by `=`, no uppercase name ending in TOKEN followed by `:` or `=`, no word that the policy reads as an authorization header). E1537S4-04 reruns the same precheck on the committed brief at the build.
- **R-4 (decision `2f7bec37`; the web bundle precondition).** `web/dist` is git-ignored. E1537S4-08 runs a fresh-sealed `npm run build` in the QA worktree before any scratch row and confirms the stamp, `bundle state current` and a clean `git status`; the scratch hub and doctor then read a current bundle.
- **R-5 (decision `6e4e793b`; receipts and residue for every row).** This stage has no native row. E1537S4-86 compares the whole run against the setup snapshot `$EV/S0-inv`: every new fixture-owner receipt with its owner and roots, every new `ct-`, `cland-h-` and `hc-` name in `/private/tmp`, attributed or recorded; T-1805 receipts and T-1806 directories are recorded as known and never removed (the stage-3 receipt `f68a3881-c9e3-4be1-86c4-00344d909b3a.json` and its six T-1806 directories stay where they are).
- **R-7 (decisions `6289f7d3`, `7aa4e2c0`; detached host watchdogs).** The census (E1537S4-85, `census4.mjs`) expects host watchdogs (T-1748, detached by design) as possible survivors and identity-checks each before any TERM: the argv lease input under `$Q/p1/.cland/run/host-leases/`, the lease's recorded watchdog pid equal to the process pid, and the process birth (`ps -o lstart=`, local time) equal to the lease's `startedUtc` (UTC, in `ps` format) to the second once both are normalised to UTC with `Date`. An unidentified watchdog is never signalled and makes the row BLOCKED. No row here creates a host, so the expected count is 0 (INFERRED from the rows: `min_hosts = 0` everywhere, no `host create`, no `host prepare`, no `login add`).

### Carried from stages 1 to 3 and how it moves here

- **E-1535 stage-4 R-1 (every Git call from an embedded script is sealed).** Applied through `$Q/git.mjs`, whose text equals stages 1 to 3's (setup checks it against `P2` lines 173 to 180 and `P3` lines 174 to 181, body SHA-1 `fb90a63cd2675accf22dce86c05ced2987dd44ab` at both, VERIFIED), and `git() { node "$Q/git.mjs" "$@"; }` in QA's own shell; the bootstrap call goes through `$Q/git0.mjs`.
- **The fake-host root is the scratch project root** (stages 2 and 3): `$Q/fh` is a symlink to `$Q/p1`.
- **Stage-2 R-1 (landing classification).** `s02` classes every first-parent commit after `BASE` (`932f3018c`); a non-member `Item:` trailer is `landing <id>`, accepted only when its full SHA is in `ACCEPT` (empty at `1114abeff`) or named by SHA in the request; any other `landing` or `other` commit makes E1537S4-02 BLOCKED until the Coordinator answers through the epic topic. Keep the original output and record a correction file beside it; never reclass in place.
- **Stage-3 Coordinator decisions** (T-1830 C2's wording, the configured-pool `open` under `--yes` or no terminal, and T-1860) stand. T-1860 (a role placed on a missing pool reads `skip`; doctor stays silent) is recorded as known; this stage checks only that the page does not document it as intended (E1537S4-03).

### Known flakes for this stage

Carried by exact signature only: T-1731 (`hub/test/host-ssh-contract.test.ts`) and T-1770 (`hub/test/host-provider-digitalocean.test.ts`, the `422` expansion); neither runs here. **Regressions, never reruns:** T-1735, T-1732, T-1797, T-1810, T-1818, T-1845. Any other failure is judged as it stands.

### Known non-blocking items (record if seen; never a stage failure on their own)

Each read with `task view <id> --json` at `0a5e25c7d`, T-1861 at `1114abeff` (VERIFIED: each `backlog`, label `needs-triage`; T-1676, T-1860 and T-1861 also `qa-found`):

- **T-1805:** fixture-owner receipts naming a removed root or the source worktree; recorded by E1537S4-86, never removed.
- **T-1806:** `cland-h-*` directories in `/private/tmp`; recorded by E1537S4-86, never removed; QA removes no `ct-*` except this run's recorded alias (none expected: no host is created).
- **T-1676:** dead fixture endpoints in `$T` from unchanged producers; inventoried and removed by literal path in `$T` only at cleanup.
- **T-1808:** no shared evidence-publish helper with a positive-control scan yet; QA publishes only after E1537S4-90's clean scan with its positive control (rule 15).
- **T-1816:** `startServer`'s port retry spins without bound; a sealed row (E1537S4-10 and -13 use `projectHub`) that ends in `RangeError: Map maximum size exceeded` after about 30 s is this item: the row is INCONCLUSIVE, never a pass.
- **T-1856:** hub stop cannot cancel a hung `git worktree prune`; a scratch `hub stop` that leaves a prune child is this item, recorded in E1537S4-85's census.
- **T-1857:** a long verify result truncates its executor, lifetime and cost line; E1537S4-06 reads receipts from `task view` and the suite logs only.
- **T-1860:** see above; E1537S4-03 reads the code as built and the page's silence about it.
- **T-1861 (filed at `c8b3b3c5a`: "qa lint reads a per-test docs path (.test.ts.md) as a missing test file"), the E-1313 brief's new qa-lint finding.** T-1832's replay note in `qa/briefs/E-1313.md` names the skills-onboarding per-test note (a Markdown file under `docs/agents/tests/`); `cland qa lint` reads that path, without its Markdown suffix, as a test file "absent from the build" (VERIFIED: the finding sets of `qa/briefs/E-1313.md` at `15ba0cef9` and at `1114abeff` differ by exactly that one finding; `qa/briefs/E-616.md`'s set is unchanged; both briefs already had lint findings before T-1832). E1537S4-07 records the delta as T-1861, never as a stage failure.

### How this brief applies them

- **One environment for tests.** Every test file of this stage runs sealed through the kit's `nt` (`fresh.mjs`, `TMPDIR=$T`, `HOME=$Q/home`), one file at a time. Neither member's per-test note asks for a native preservation slot (VERIFIED at `1114abeff`: the skills-onboarding note says "No native host fixture or preservation lock is needed"; the hosts-docs-pool note names no slot and states "There are no real hosts, watchdogs, keys, credentials, paid calls or external requests"), so no row takes `/tmp/cland-preserve.lock` and no row runs `ns` or `std.mjs` beyond the setup probe.
- **Kit pins.** Exactly the blocks and SHA-1s stage 3 takes from `K`, `M3` and `M4` that this run uses (`kit-shell`, `kit-tap`, `seal.mjs`, `fresh.mjs`, `body.sh`, `helpers.sh`, `std.mjs`, `invd.mjs`, `kit2-fns`, `kit2-mrow`, `kit2-s0`, `kit2-checks`, `kit3-checks`), each SHA-1 recomputed at `0a5e25c7d` (VERIFIED). Not taken: `frame.mjs`, `rcp.mjs`, `kit3-r80`, `kit4-own`, `n2-waitfor`, `n2-q57`, `p1-*` and every stage-3 helper (`src.mjs`, `ids.mjs`, `dq.mjs`, `sd.mjs`, `scratch.sh`, `checks.sh`); this brief writes its own. `r80` and `q57` are replaced by `r100` and `census4.mjs` because both write raw captures (R-1) and `q57` signals watchdogs without identity (R-7). M3's `s99` and M4's `s00` are replaced by this brief's.
- **Reconciliation.** Every member is byte-identical to its reviewed tip over its own files (VERIFIED at `1114abeff` with `git diff --quiet <tip> <landing> -- <files>`: T-1832 `71eba552a` against `0d1390dde` over 7 files, T-1833 `37a9884b4` against `5cd48f9de` over 13 files, T-1834 `a14379994` against `6cc0fa816` over 4 files; own lines equal).
- **The setup paragraph (T-1834).** T-1833's sentence "A configured but incomplete pool reads `open` unattended; missing placement reads `agent hosts need role placement`" is gone (VERIFIED: `reads \`open\` unattended` occurs 0 times at `1114abeff`). T-1834's paragraph states, case by case: untouched with `--yes` reads `skip` `optional agent hosts; default No`; untouched without a terminal and without `--yes` reads `skip` with the exact commands; with provider metadata available, an `agents` pool without placed roles reads `open` `agent hosts need role placement` without a terminal and `skip` `optional agent hosts; default No` under `--yes` in a terminal; placed roles with a current image and ready role logins read `ok`; otherwise the main `agent hosts` row reads `open` without a terminal and `ok` in a terminal; the image and sign-in offers read `open` without a terminal and `skip` under `--yes` in a terminal; an unpriced builder stays `open`; missing provider metadata leaves the step `open` before the placement checks. Each sentence is read against the source line that builds it (E1537S4-03, eleven lines). The scratch rows reach three cases with the fake provider and no terminal, and check each runtime row against its sentence: untouched (E1537S4-82), an `agents` pool without placed roles and a pool with the Implementer placed, with its image and login offers (E1537S4-84). Source-only (no scratch row can reach them safely): every `--yes` case (`--yes` starts the hub and accepts harmless defaults; see "Out of scope"), every terminal case, the `ok` with a current image and a ready login (it needs a prepared image and a signed-in login: stage 3's E1537S3-88 showed it on its scratch hub), the unpriced builder and the missing provider metadata (both DigitalOcean only).
- **T-1833 C4 at the build.** "The page names … setup's agent-hosts step as built" is judged on the page as it stands at the build, that is with T-1834's paragraph; T-1833's replaced sentence is history (read in `git show 5cd48f9de`), not a check.
- **Expected registrations.** Exact lists only where every registration is known (R-2); the rest `exact: false` with the whole file `CLEAN`.
- **Evidence split (this release's standing rule).** T1, T2 and Web come from each member's mode-free `cland verify` on the Linux droplet at its reviewed tip; full T3 from the merge batch that landed it (T-1832: batch `fe0ff273`, suite `661103e8`, logs A-19459 and A-19460; T-1833: batch `c3154209`, suite `2200e1cb`, logs A-19461 and A-19462; T-1834: batch `ba1ed164-b64b-4456-8c70-83dd4bdb9d03`, suite `28fe5bc3`, logs A-19472 and A-19473 (ams3, $0.1712 per the Coordinator; not a pass condition); each `occasion batch`, `executor droplet`, Linux, T0, T1 and T3 each `exit 0`, VERIFIED); T-1834's mode-free verify is `f88316e8` (A-19470) at its reviewed head `a14379994`. The stage's complete scope, T4 included, comes from the Coordinator's stage cover pair at the requested dev SHA (a Linux `verify all --occasion stage` and a macOS `--executor local --workers 1` run). **QA starts none of them**: E1537S4-06 reads them.
- **Cleanup order, removals and sockets (carried).** QA removes only dead `$T` residue, the recorded alias (if any) and its own scratch roots, by literal path, and nothing else in the shared system TMPDIR or `/private/tmp`.

### Kit conventions carried

- **Rule 22.** Every selector, test name and string is marked VERIFIED or INFERRED.
- **TAP.** Plans count top-level registrations; counters include nested subtests; `tap.mjs` parses exactly that. A file that imports other test files registers their titles in its own TAP plan.
- **Exact strings** are counted by `src.mjs` with `String.split` on the worktree's files; tree-wide checks use Git at `$S` through the wrapper.

## Stage

- Epic: E-1537 (Workbenches, doctor, setup and docs for hosts).
- Exact stage name: the tour and the hosts docs.
- Items, in plan order, by lane (VERIFIED in `task plan show E-1537 --json` at `1114abeff`): [T-1832 (the onboarding tour's stage on agent hosts)], [T-1833 (the hosts, pools and logins page), T-1834 (the price table and the CLI reference for `cland host` and `cland login`)]. The run reads membership, counts and state from `task plan show E-1537 --json` (E1537S4-00), never from this list. QA finding fixes added after writing are listed in the request.
- Policy: affected/after-stage (no item override; every member's `qaPolicy` is `{"scope":"affected","when":"after-stage"}` with `qaCriteria` `[]`, VERIFIED at `1114abeff`).
- Scope: **affected.** The combined changed behaviour through the stage's named test files and their unedited consumers (the site guards that read the sidebar and the features overview, the shared T1 wrapper, the task-selection guard of site prebuild tests, the tier and test-docs indexes), read-only source checks of the tour and the page against the code they describe, an independent read of every `cland` command and `hosts.*` key in the tour's tenth stage and on the page against the built CLI's help and the pool parser, of the CLI page's Hosts and logins inventory against the built usage, and of the price table against the pool parser's defaults and the provider's storage declaration read as text, the wording and qa lints, the evidence read of E1537S4-06, and the stage demo on a scratch project: the page's marked blocks run in order on a CLI-started hub with the fake provider, ending in `cland host status` listing the second pool, then the page's role placement command, doctor's host lines read against the page's table, and setup's unattended rows read against the page's setup paragraph for an untouched project, an `agents` pool without placed roles and one with the Implementer placed.
  - T-1832 (landed `0d1390dde`, `0d1390dde3e21a62356cdcdb146a6df7efe274f9`, on `15ba0cef9`, trailers `Item: T-1832` and `Reviewed-by: rev-35 (rev-35-1832-final-1)`, exactly one `Item: T-1832` commit on dev's first-parent history; VERIFIED; byte-identical to its reviewed tip `71eba552a` (`71eba552a327a148aa95e3c8ff05e2c5bffaccdc`, merge base `15ba0cef9`; rev-35 `rev-35-1832-source-1` not clear at `960dc2c95` (setup's `--yes` and custom-size price claims unqualified; the E-1313 and E-616 replays still on nine stages; the link/code presentation claim unqualified), `rev-35-1832-source-2` clear at `540e8fdef`, `rev-35-1832-source-3` and `rev-35-1832-final-1` clear at `71eba552a`, C1 to C3 verified there); 7 files). `.agents/skills/onboarding/TOUR.md` gains `## 10. Agent hosts`; `.agents/skills/onboarding/SKILL.md` says "teach the ten stages"; `hub/test/skills-onboarding.test.ts` (T2) renames its stage test to `the onboarding tour has ten stages ending with Look now`, asserts ten stages, the ninth and tenth endings, the tenth stage's facts and `commandProblems(hosts)` empty, and bounds the remote-stage read before stage ten; its per-test note in `docs/agents/tests/`; `qa/briefs/E-616.md` and `qa/briefs/E-1313.md` gain replay notes and ten-stage selectors; `hub/test/durations.json` drops the old nine-stage title. No new test file, tier or index row.
  - T-1833 (landed `5cd48f9de`, `5cd48f9de1ba30bd34bd8cefb4fcf925e78a31e7`, on `ec5f96d10`, trailers `Item: T-1833` and `Reviewed-by: rev-36 (rev-36-1833-final-1)`, exactly one `Item: T-1833` commit on dev's first-parent history; VERIFIED; byte-identical to its reviewed tip `37a9884b4` (`37a9884b416107215582281c3786a061dd1d19ff`, merge base `15ba0cef9`; rev-36 `rev-36-1833-source-1` clear at `a9f3e0d53`, `rev-36-1833-evidence-1` not clear at `a9f3e0d53` (the site guard registered in a separate wrapper; `hub/test/suite-task-selection.test.ts` failed), `rev-36-1833-source-2` and `rev-36-1833-final-1` clear at `37a9884b4`, C1 to C4 verified there); 13 files). New `site/src/content/docs/docs/hosts.md` (235 lines); `site/astro.config.mjs` adds `['Hosts, pools and logins', 'docs/hosts']` to the Features group after Accounts; `site/src/content/docs/docs/features.md` links it under "The crew"; new `site/test/hosts-docs-source.ts` (`hostsPath`, `poolSteps`) and `site/test/hosts-docs.test.ts` (4 titles, imported by `hub/test/remote-docs.test.ts`, T1); new `hub/test/hosts-docs-pool.test.ts` (T2, 1 title; tier row, index row and per-test note); `hub/test/lint-closed-item-wording.ts` and `docs/agents/tests.md` add `site/src/content/docs/**/*.md`; the remote-docs per-test note. Its page left `### Provider price table` with an insertion-point comment, which T-1834 replaced.
  - T-1834 (landed `6cc0fa816`, `6cc0fa8161f6b9412cb378d07bf04d41376ba0fe`, on `c8b3b3c5a`, trailers `Item: T-1834` and `Reviewed-by: rev-35 (rev-35-1834-final-1)`, exactly one `Item: T-1834` commit on dev's first-parent history; VERIFIED; byte-identical to its reviewed tip `a14379994` (`a14379994c44c02f6af55eec7ac98db0beefee41`, merge base `0a5e25c7d`; rev-35 `rev-35-1834-source-1` clear at `664a01b65` (A-19465: public quotes, declared storage rates, parser-owned defaults), `rev-35-1834-source-2` not clear at `b25b12119` (A-19468: the untouched no-terminal sentence lacked "without `--yes`"), `rev-35-1834-source-3` clear at `a14379994` (A-19469), `rev-35-1834-final-1` clear there (A-19471), C1 to C3 verified there); 4 files). `site/src/content/docs/docs/hosts.md`: the "Provider price table" (`DigitalOcean USD prices, checked on 2026-11-15:`; `agents` and `qa` at `s-4vcpu-8gb`, $0.07143 and $48.00; `Login volume` $0.10/GiB-month and `Volume snapshot` $0.06/GiB-month; the $3.00 sub-cap as about 42.00 host-hours; links to the public Droplets, Volumes and Snapshots pricing pages) and the rewritten setup paragraph; `site/src/content/docs/docs/cli.md`: `## Hosts and logins` with one table row per subcommand, 10 `cland host` and 6 `cland login`; `site/test/hosts-docs.test.ts` (imported by the T1 wrapper): `hosts price table dates public pool rates and computes default host-hours`, `hosts storage table matches provider declared GiB-month rates without native imports` (reads `DIGITALOCEAN_STORAGE_PRICES` from `hub/src/host/provider/digitalocean.ts` as text) and `CLI Hosts and logins lists exactly the built usage subcommands` (from `HOST_USAGE` and `LOGIN_USAGE`, with extra and duplicate controls); the remote-docs per-test note gains "Host pricing and CLI inventory". No new test file, tier or index row. Its batch candidate `09271f1bd` ("Batch candidate T-1834", on `c8b3b3c5a`) has the landing's tree `bbb63a96a`; the verify and batch logs both record the normalised tree `baaa4d38ead4511ed1d0d2e4ba76f68dae20f440`.
- **Merge watch** (VERIFIED with `git log` per file from each landing to `1114abeff`): T-1833's landing touches none of T-1832's files. T-1834's landing touches three of T-1833's files (`site/src/content/docs/docs/hosts.md`, `site/test/hosts-docs.test.ts`, the remote-docs per-test note), so `s02` lists `6cc0fa816` under "T-1833 commits after its landing touching its files", and every T-1833 `src.mjs` line and the hosts-docs exact list were re-read at `1114abeff`: the untouched no-terminal line gained "and without `--yes`", the replaced placement sentence became T-1834's lines, the `skip` count went from 2 to 4; the rest read `ok` unchanged. The durations commit `1114abeff` touches `hub/test/durations.json`, one of T-1832's files, so `s02` lists it under T-1832; it is add-only (3 entries added, nothing changed or removed).

### Criteria map

The stage verdict carries no item or epic marks; this tells the run which check proves what. E1537S4-04 checks that every row id named here exists in the tables below. VERIFIED at `1114abeff` (every criterion read with `task view <id> --json`, each `checked` with its final verified mark at its reviewed tip; every title read from the test files there and found passing in the verify logs A-19454 and A-19470).

| criterion | proven by |
| --- | --- |
| T-1832 C1 (TOUR.md has ten numbered stages, the tenth on agent hosts, each with exactly one "Look now" line, the tenth naming the Hosts row) | E1537S4-10: test `the onboarding tour has ten stages ending with Look now`; E1537S4-03 (`\n## ` 10 times, `## 10. Agent hosts`, `\nLook now: ` 10 times, the tenth ending `Look now: the Hosts row in the sessions panel.`, the ninth still `…the Remotes row…`); E1537S4-06 (T-1832's verify and batch) |
| T-1832 C2 (the tenth stage names the Hosts row, the three waiting-launch reasons as the hub emits them, `cland login add` and the web's hosts view) | E1537S4-10 (the same test's list: `Neovim`, `web`, `Sessions`, `Hosts row`, `hosts view`, the three reason templates, `Create one?`, `cland login add <harness> --pool <pool>`, `cland setup`, `cland config set`, "status line in the inbox, not an ask"); E1537S4-03 (each sentence against the code it describes: `hub/src/host/scheduler.ts`'s three reasons, `hub/src/host/login-cards.ts`'s card, the login usage, the Neovim and web Hosts rows rendering only with pools, the web Sessions area order Remotes then Hosts, the web hosts view behind the Hosts fold, setup's step order and `docs/hub/cland-setup.md`) |
| T-1832 C3 (every `cland` command and config key in the stage passes the onboarding command check against the CLI help and the config keys; SKILL.md's stage count reads ten) | E1537S4-10: tests `onboarding names only shipped commands or explicitly pending release work`, `the onboarding command check rejects unknown commands, config keys and secret names` and the ten-stage test's `commandProblems(hosts)`; E1537S4-05 (the stage's six commands against the built `cland <command> --help`, independently, with a negative control); E1537S4-03 (SKILL.md `teach the ten stages of \`TOUR.md\``, `nine stages` 0) |
| T-1833 C1 (the page is in the sidebar under Features, linked from the features overview, with sections on configuration, role placement, commands, lifecycle and failures, money, and logins with the per-harness rules and the Codex one-place warning) | E1537S4-11 and E1537S4-12: `site/test/hosts-docs.test.ts`'s test `hosts guide is linked under Features and covers the built host and login workflow`; E1537S4-03 (the Features group lines, the overview link, the seven `## ` sections, the harness table, the Codex sentence); E1537S4-11's unedited consumers of the sidebar and the overview (`site/test/remote-docs.test.ts`: `Remote control is under Features and linked from the overview and web Remotes section`, `every landing feature points to an existing documentation page`); E1537S4-83 (the page's role placement command works as written on the scratch hub) |
| T-1833 C2 (every `cland` command and config key on the page exists in the CLI help and the config keys; every waiting-launch reason it quotes is one the hub emits) | E1537S4-11 and E1537S4-12: tests `hosts vocabulary guard rejects invented command, flag and setting`, `hosts guide quotes emitted waiting reasons and doctor/setup rows`, `hosts guide defaults match the shared pool parser and slot policy`; E1537S4-05 (the page's 25 distinct commands against the built help, its 22 `hosts.*` keys against the parser's pool and global keys, independently); E1537S4-03 (the three quoted reasons against the scheduler, and the page's numeric facts against their constants); E1537S4-81 (every `config set` key of the walkthrough accepted by the real CLI) |
| T-1833 C3 (the page's marked command blocks, run in order in a scratch project on the fake host provider, configure a second pool that `cland host status` then lists) | E1537S4-13: test `published pool commands configure a second fake pool and host status lists it`; E1537S4-81 (the manual reader check: QA's own extraction of the marked block equals the T2 parser's; each step exits 0 on a CLI-started hub; `cland host status` lists `first: 0 hosts · slots 0/0` and `second: 0 hosts · slots 0/0`; the saved `second` pool equals the T2 test's settings; no host, machine, lease or image); E1537S4-80 (its preconditions: a running hub, a managed config, an existing pool) |
| T-1833 C4 (the page names doctor's host lines and setup's agent-hosts step as they are built; the closed-item wording lint passes on it) | E1537S4-03 (each doctor label template on the page against `hub/src/doctor/hosts.ts`, the no-pool line, the setup rows and every sentence of the setup paragraph, as T-1834 rewrote it, against the line of `hub/src/setup/steps/hosts.ts` that builds it); E1537S4-83 (doctor's host rows on the scratch hub each map onto one line of the page's doctor table); E1537S4-82 (setup's untouched unattended row on the CLI: `skip` with the exact commands, nothing written); E1537S4-84 (setup's unattended rows for an `agents` pool without placed roles and with the Implementer placed, each runtime row matched to its page sentence, nothing written); E1537S4-07 (the wording lint over `site/src/content/docs/**/*.md`: 0 findings, its document count equal to QA's count of the three globs, the hosts page included) |
| T-1833's documented behaviours (the Coordinator's list) | `--yes` on an untouched project reads `skip` `optional agent hosts; default No`: E1537S4-03 (the page sentence and the `if (yes)` line, unchanged since `P3`; the in-process proof is `hub/test/setup-hosts.test.ts`'s `C2 yes skips agent hosts with and without a terminal`, run clear by stage 3 and unedited since (E1537S4-02's preserved list), and in the stage cover pair); untouched without a terminal and without `--yes` reads `skip` with the exact commands: E1537S4-82 and E1537S4-03; T-1860 (a role placed on a missing pool) is not documented as intended: E1537S4-03 (`skip` named four times on the page, in the untouched `--yes` and no-terminal sentences, the unplaced pool under `--yes` and the offers under `--yes`; none describes a role placed on a missing pool; no T-1860 reference; the code as built recorded) |
| T-1834's setup paragraph (the Coordinator's list: provider metadata missing reads `open`; a pool without placed roles reads `open` without a terminal and `skip` under `--yes` in a terminal; placed roles with everything ready read `ok`; otherwise the main row reads `open` without a terminal and `ok` in a terminal, and the image and sign-in offers `open` without a terminal and `skip` under `--yes` in a terminal) | E1537S4-03 (each sentence and its source line, eleven lines); E1537S4-84 at runtime for the cases the fake provider reaches without a terminal (the unplaced pool's `open` `agent hosts need role placement` with its image offer `open`; the placed pool's main row `open` `agents; roles implementer` with its image and login offers `open`); E1537S4-82 (untouched); the `--yes`, terminal, ready `ok`, unpriced-builder and missing-metadata cases are source-only (see "How this brief applies them") |
| T-1834 C1 (the hosts page has a price table of the `agents` and `qa` pool sizes per hour and per month, volumes and snapshots per GiB-month and the default sub-cap in host-hours, with a "checked on <date>" line) | E1537S4-11 and E1537S4-12: `site/test/hosts-docs.test.ts`'s test `hosts price table dates public pool rates and computes default host-hours`; E1537S4-05 (independently: the check-date line; each pool row's size equal to the pool parser's default, its hourly rate equal to its monthly rate over 672 hours to five places, the host-hours equal to the parser's default sub-cap over that rate and present on the page; setup's declared $0.0714/h equal to the table's rate to four places); E1537S4-03 (the date line, both rows, the sub-cap sentence, the source links, the insertion-point comment gone) |
| T-1834 C2 (the table's volume and snapshot rates equal the DigitalOcean provider's declared storage prices) | E1537S4-11 and E1537S4-12: test `hosts storage table matches provider declared GiB-month rates without native imports`; E1537S4-05 (independently: `DIGITALOCEAN_STORAGE_PRICES` read from `hub/src/host/provider/digitalocean.ts` as text, never imported: `volumePerGiBMonth` 0.1 and `snapshotPerGiBMonth` 0.06 equal to the table's `Login volume` and `Volume snapshot` rows); E1537S4-03 (the declaration line and both rows) |
| T-1834 C3 (the CLI reference lists each `cland host` and `cland login` subcommand that their usage text names, and no other) | E1537S4-11 and E1537S4-12: `site/test/hosts-docs.test.ts`'s test `CLI Hosts and logins lists exactly the built usage subcommands`; E1537S4-05 (independently: the section's `cland host …` and `cland login …` inventory, duplicates kept, equal to the subcommands the built `cland host --help` and `cland login --help` print, 16 of each, with extra-command and duplicate controls); E1537S4-03 (the section heading and its link to the hosts page); E1537S4-11's unedited `site/test/remote-docs.test.ts` (`CLI reference lists exactly the remote and secret subcommands in usage` still holds beside the new section) |
| Stage demo (the epic: "a pool configured from a fresh reading of the page") | E1537S4-81 on the setup of E1537S4-80, then E1537S4-83 (placement and doctor), E1537S4-84 (setup's rows) and E1537S4-85 (census) |
| Stage demo (the epic: "the tour's stage text reads against the built workbench") | E1537S4-03 (the Neovim `hosts.lua` and `panels.lua`, the web `HostsLine.tsx` and `SessionsArea.tsx` lines the tour describes) and E1537S4-05; the rendered rows are stage 1's QA and the cover pair's Neovim and Web files (see "Out of scope") |
| Rule 15 and the stage-3 corrections | E1537S4-04 (R-3/R-6 precheck), E1537S4-08 (R-4), E1537S4-85 (R-7), E1537S4-86 (R-5), E1537S4-90 and E1537S4-99 (R-1) |

## Build

Use a clean detached worktree at the full dev SHA named in the request: `<dev SHA>` (40 hex). HEAD must equal that SHA and refs/heads/dev before and after running. Every listed task needs a dev landing receipt: for every member that `task plan show E-1537 --json` lists in stage `the tour and the hosts docs`, `git log --first-parent --format=%H --grep "^Item: <id>$" <dev SHA>` prints exactly one commit. A task closed `done` with no branch and no landing receipt must have no `Item:` trailer on dev (evidence-only completion; none in this stage). A dirty build, a missing required merge (**every member needs a landing here, T-1834 included**) or moved dev blocks this run: retain any collected evidence and report to the requester. The brief names no run id on purpose.

At dev `1114abeff4518aad8889d94e71de07ae07265bab` (VERIFIED): T-1832 landed as `0d1390dde`, T-1833 as `5cd48f9de` and T-1834 as `6cc0fa816` (full SHAs under "Stage"), each with exactly one `Item:` and one `Reviewed-by:` trailer naming its final clear review. The plan read just before (at `5c81cfc54`, the tracker commit after T-1834's landing; `1114abeff` changes only `hub/test/durations.json`) shows the stage `open`, `items` `["T-1832","T-1833","T-1834"]`, lanes `[["T-1832"],["T-1833","T-1834"]]`, `merged 3`, `total 3`, `statuses {"done":3}`, cover `tree 7343fd40735c3b586417133ddb0c9dfee681fb6b`, `missing ["macOS"]`, `pending ["Linux droplet"]`; stages 1 to 3 read `closed`. No stage cover had finished then: the request must name a dev SHA whose covers have finished (E1537S4-06).

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step. E1537S4-08 builds `web/dist` (R-4); no row needs Neovim, a browser or the site's own `site/node_modules`.

**Where things live.** All scratch state is under `$Q` (`/private/tmp/q53-…`, realpath, 23 bytes; the stage-3 kit's seal accepts exactly this prefix) and `$T` (`/private/tmp/qa-e1533-s3-<uuid>`, the prefix the seal accepts). The scratch project is `$Q/p1`; `$Q/fh` (the seal's `CLAND_FAKE_HOST_ROOT`) is a symlink to it. The only paths under the repository are `$W` in `.cland/worktrees/` and the evidence `$EV` in `.cland/qa/E-1537/<run>/`, both ignored by Git; nothing is written to `.cland/tasks/` except through the verdict.

**Isolation (rule 15).** Every scratch command runs in the disposable project p1 with its own HOME, XDG directories and Git config, through the fresh seal; every Git call goes through `$Q/git0.mjs` (the one bootstrap call) or `$Q/git.mjs`. Never the live project's hub, config, roles, territory, `hub.db`, secrets or discovery, and never the human's HOME (`~/.cland`, `~/.ssh`, `~/.claude`, `~/.codex`, `~/.opencode`, `~/.local/state`, `~/.config/cland`). Never read or print a credential. Never run `cland login …`, `cland secret …`, `cland config set`, `cland role launch`, `cland setup`, `cland doctor`, `cland host …` or `cland hub …` against the live project. Two shells, never mixed: **QA's own shell** keeps QA's session identity (worktree, roots, `quiet`, the plan and item reads, the Git checks, every record); **every other command** runs through `$Q/fresh.mjs`.

**Removals.** Every `rm` names one literal path, written out in full after it was printed and checked; never a glob, a variable, a command substitution or `xargs` (the project's literal-rm hook refuses them).

### Environment

Put Node from `/Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin` first on `PATH` and check `node --version` against the qa skill's `node-engines.json` (`>=24.13.0 <25`). If TMPDIR is unset in QA's shell, export it to the value `getconf DARWIN_USER_TEMP_DIR` prints. In QA's own shell (bash):

```sh
R=/Users/evgeniyivanov/Projects/cland/v0
S=<dev SHA>                                    # the full dev SHA from the request
WROTE=1114abeff4518aad8889d94e71de07ae07265bab # the dev this brief was completed at (drafted at 0a5e25c7d; completed after T-1834's landing and the stage-4 durations refresh)
K=f43f4e21049e9c62a97c8dec1ebf37f9c7035a62     # the fixed kit commit (A-17643: pin a commit, never a blob)
M2=0d0618042fae7b76919d1be152e252b09e4a43ad    # the E-1535 stage-1 brief's carried corrections
M3=18911bda46c7c0dc332619e93d25041069d3704a    # the E-1535 stage-2 brief: its helpers and carried corrections
M4=85e60f6cb34ec320cc7a1f5456de3a4693acbe17    # the E-1535 stage-3 brief: landing, durdelta and carried corrections
M5=a72e34d9a83781f1ef7d87c273aaf5f281723046    # the E-1535 stage-4 brief's carried corrections
M6=d5c59e2c73b61f7e72e7a25b533f3945d2f1fcb0    # the E-1535 Definition-of-done brief's carried corrections
P1=628574fe8c2ed439e11461b6152175fcf4e9a2d3    # the E-1537 stage-1 brief as folded after its clear run: its carried corrections
P2=07035ec39329c513ce97d7114b385db29f3f99ce    # the E-1537 stage-2 brief (its only commit): its carried corrections and its git.mjs
P3=932f3018c335d620fc6afd268c5f9abb846c9d13    # the E-1537 stage-3 brief (its only commit, the stage-3 QA SHA): its carried corrections and its git.mjs
RUN=qa-e1537s4-$(date +%F)-1                   # unique run id for E-1537; bump the suffix on a rerun
export QA_SESSION=${QA_SESSION:-${CLAND_SESSION_NAME:-}}
[ -n "$QA_SESSION" ] || echo "BLOCKED: no QA session name"
echo "QA shell credential-prefix names: $(env | cut -d= -f1 | grep -c -E '^(DIGITALOCEAN_|DO_|ANTHROPIC_|OPENAI_|CODEX_API|CODEX_ACCESS|GH_|GITHUB_|AWS_|GOOGLE_|GEMINI_|SSH_)')"
W=$R/.cland/worktrees/qa-e1537s4-$RUN
EV=$R/.cland/qa/E-1537/$RUN
ST=$(cd "$(getconf DARWIN_USER_TEMP_DIR)" && pwd -P)
T=/private/tmp/qa-e1533-s3-$(uuidgen | tr 'A-Z' 'a-z'); mkdir -m 700 "$T"
Q=$(cd "$(mktemp -d /tmp/q53-XXXXXX)" && pwd -P); chmod 700 "$Q"
mkdir -p "$Q/home" "$Q/config" "$Q/opencode" "$Q/state" "$Q/cache" "$Q/claude" "$Q/codex" "$Q/fake-claude" "$Q/fake-codex" "$Q/fake-opencode" "$Q/executor-state" "$Q/p1" "$Q/bin" "$Q/kit"
ln -s "$Q/p1" "$Q/fh"                          # the fake-host root is the scratch project root
chmod 700 "$Q/claude" "$Q/fake-claude"
: > "$Q/pids"; : > "$Q/home/.gitconfig"; : > "$Q/home/.gitignore-global"
cat > "$Q/git0.mjs" <<'JS'
// bootstrap only: the one Git call before $W exists, under the same seal imported from the root checkout at dev (the stage-1 run's practice)
import { spawnSync } from 'node:child_process';
const [R, Q] = [process.env.QA_R0, process.env.QA_Q0];
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${R}/test-support/fixture-environment.ts`);
const env = scratchGitEnvironment(Q, fixtureEnvironment(Q, process.env), { excludesFile: `${Q}/home/.gitignore-global` });
const p = spawnSync('git', process.argv.slice(2), { env, stdio: 'inherit' });
process.exit(p.status ?? 1);
JS
QA_R0=$R QA_Q0=$Q node "$Q/git0.mjs" -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
ln -s "$W/hub/test/fakes/fake-ssh.ts" "$Q/bin/ssh"; ln -s "$W/hub/test/fakes/fake-scp.ts" "$Q/bin/scp"
printf '#!/bin/sh\nexec "$@"\n' > "$Q/bin/setsid"
printf "#!/bin/sh\nln -s '%s/node_modules' node_modules\n" "$W" > "$Q/bin/npm"
chmod 700 "$Q/bin/setsid" "$Q/bin/npm"
printf '{"W":"%s","Q":"%s","EV":"%s","T":"%s","R":"%s","ST":"%s","SESSION":"%s"}\n' "$W" "$Q" "$EV" "$T" "$R" "$ST" "$QA_SESSION" > "$Q/state.json"
cat > "$Q/git.mjs" <<'JS'
// node "$Q/git.mjs" <git args…>: Git under the shared seal (fixtureEnvironment + scratchGitEnvironment), every argument unchanged (E-1535 stage-4 run correction R-1)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(new URL('./state.json', import.meta.url), 'utf8'));
const { fixtureEnvironment, scratchGitEnvironment } = await import(`${s.W}/test-support/fixture-environment.ts`);
const env = scratchGitEnvironment(s.Q, fixtureEnvironment(s.Q, process.env), { excludesFile: `${s.Q}/home/.gitignore-global` });
const p = spawnSync('git', process.argv.slice(2), { env, stdio: 'inherit' });
process.exit(p.status ?? 1);
JS
git() { node "$Q/git.mjs" "$@"; }                # from here on every Git call in this shell, kit functions included, is sealed
echo "git wrapper: $(type -t git); $(git -C "$W" rev-parse HEAD); fh is a link to p1: $([ -L "$Q/fh" ] && [ "$(cd "$Q/fh" && pwd -P)" = "$Q/p1" ] && echo yes || echo no)"
carried() { git -C "$R" show "$1:qa/briefs/$2.md" | awk -v e="$5" '/^## Carried corrections/{f=1} $0==e{exit} f' > "$EV/carried-from-$3.md"; echo "$3 commit $(git -C "$R" rev-parse "$1^{commit}"); carried lines $(wc -l < "$EV/carried-from-$3.md" | tr -d ' ') want $4; sha1 $(shasum < "$EV/carried-from-$3.md" | cut -c1-40)"; }
carried "$P3" E-1537-stage-3 P3 62 '## Stage'; carried "$P2" E-1537-stage-2 P2 55 '## Stage'; carried "$P1" E-1537-stage-1 P1 63 '## Stage'; carried "$M2" E-1535-stage-1 M2 127 '## Stage'; carried "$M3" E-1535-stage-2 M3 55 '## Stage'; carried "$M4" E-1535-stage-3 M4 80 '## Stage'; carried "$M5" E-1535-stage-4 M5 76 '## Stage'; carried "$M6" E-1535 M6 59 '## Build'
```

Expected: the worktree is added (`HEAD is now at …`); `git wrapper: function; <S>; fh is a link to p1: yes`; the eight commits equal `P3`, `P2`, `P1` and `M2` to `M6`; carried lines 62, 55, 63, 127, 55, 80, 76 and 59; SHA-1s `10f1860a8972e7a79209f5b9e8b33870fa130d41`, `6bcd1b899225aaad4379ecbd772ee66cf6fa7cdf`, `a9c55f181e9d43d438d23b087950630dec632359`, `98f38398667ed6b1192f2d9d20e131a30eb88bdc`, `51da4c95a6b8c380b7b11e4536c7d23f93986701`, `e4ad4448829797e25c364afad87b0f3f2cf3b06e`, `7555a12ef6902bbfe8dd2094d14e08d2ea93c61a` and `82535892ef7a00b2e4762a0d4515eebe1ca64a90` (all VERIFIED in bash at `0a5e25c7d`). The bootstrap wrapper is stage 3's text (`P3` lines 157 to 163); that it reaches `git worktree add` with unchanged arguments is INFERRED from stages 1 to 3.

**The kits, from fixed commits.** A missing block or a SHA-1 other than `want` is a setup BLOCKED.

```sh
for b in E-1532-stage-4 E-1533-stage-3; do git -C "$R" show "$K:qa/briefs/$b.md" > "$Q/kit/$b.md"; done
git -C "$R" show "$M3:qa/briefs/E-1535-stage-2.md" > "$Q/kit/E-1535-stage-2.md"
git -C "$R" show "$M4:qa/briefs/E-1535-stage-3.md" > "$Q/kit/E-1535-stage-3.md"
git -C "$R" show "$P2:qa/briefs/E-1537-stage-2.md" > "$Q/kit/E-1537-stage-2.md"
git -C "$R" show "$P3:qa/briefs/E-1537-stage-3.md" > "$Q/kit/E-1537-stage-3.md"
kitr() { sed -n "$3" "$Q/kit/$1.md" > "$Q/$2.sh"; echo "$2: sha1 $(shasum < "$Q/$2.sh" | cut -c1-40) want $4"; }
kitb() { awk -v n="$2" 'BEGIN{h="cat > \"$Q/" n "\" <<"} index($0,h)==1{f=1} f{print} f&&/^(JS|SH|JSON)$/{exit}' "$Q/kit/$1.md"; }
kitr E-1532-stage-4 kit-shell '133,136p' 7f1efd434e4b03d68de661f7ca1afdd3c726c88d                  # holder, quiet, ld
kitr E-1532-stage-4 kit-tap '228,279p' bcd8eb8a9a2928f775e88807a5cb77aa0ed1fbc4                    # the tap.mjs heredoc
for n in seal.mjs fresh.mjs body.sh helpers.sh; do kitb E-1533-stage-3 "$n" > "$Q/kit3-$n.sh"; echo "kit3 $n: lines $(wc -l < "$Q/kit3-$n.sh" | tr -d ' ') sha1 $(shasum < "$Q/kit3-$n.sh" | cut -c1-40)"; done
for n in std.mjs invd.mjs; do kitb E-1535-stage-2 "$n" > "$Q/kit2-$n.sh"; echo "kit2 $n: lines $(wc -l < "$Q/kit2-$n.sh" | tr -d ' ') sha1 $(shasum < "$Q/kit2-$n.sh" | cut -c1-40)"; done
kitr E-1535-stage-2 kit2-fns '308,332p' 7d3265fb3617e213677b78ee5a78cb95aa12eae6                   # snapt, snaps, nt, slot, unslot, ns
kitr E-1535-stage-2 kit2-mrow '336,337p' 9f2fc5c7c2f7ba41f5fbec54a9db636cfe014e57                  # mrow
kitr E-1535-stage-2 kit2-s0 '345,347p' 6ec8beed74eb77e5f2620b034a1373099ab3e63e                    # the S0 environment probes
kitr E-1535-stage-2 kit2-checks '857,861p;870p;901,915p' eff5097fdb01c670d784454447777dd771be3dbd  # ownlines, s01 (its s99 is replaced below)
kitr E-1535-stage-3 kit3-checks '737p;743,745p;748,755p' 3a747a75f89dd49791888683cae6949c55dd9647  # landing, durdelta (its s00 is replaced below)
echo "git.mjs equals the stage-2 wrapper: $(sed -n '173,180p' "$Q/kit/E-1537-stage-2.md" | cmp -s - "$Q/git.mjs" && echo yes || echo no); equals the stage-3 wrapper: $(sed -n '174,181p' "$Q/kit/E-1537-stage-3.md" | cmp -s - "$Q/git.mjs" && echo yes || echo no)"
. "$Q/kit-shell.sh"; . "$Q/kit-tap.sh"
for n in seal.mjs fresh.mjs body.sh helpers.sh; do . "$Q/kit3-$n.sh"; done; for n in std.mjs invd.mjs; do . "$Q/kit2-$n.sh"; done
. "$Q/kit2-fns.sh"; . "$Q/kit2-mrow.sh"
node --check "$Q/tap.mjs" && node --check "$Q/seal.mjs" && node --check "$Q/fresh.mjs" && node --check "$Q/std.mjs" && node --check "$Q/invd.mjs" && node --check "$Q/git.mjs" && bash -n "$Q/body.sh" && bash -n "$Q/helpers.sh" && bash -n "$Q/kit2-checks.sh" && bash -n "$Q/kit3-checks.sh" && echo "kits checked"
. "$Q/kit2-s0.sh"
snaps "$EV/S0-inv"                              # the run-wide residue snapshot E1537S4-86 compares against (R-5)
```

Expected (every figure VERIFIED in bash at `0a5e25c7d`; the commits are fixed): `kit-shell` and `kit-tap` each with `sha1` equal to `want`; `kit3 seal.mjs: lines 20 sha1 af271e579f596814e8aac1cd45aa499601716339`, `fresh.mjs: lines 42 sha1 9b30902c50cb2d8c0e3f1cf55794afb3f4fe3fb3`, `body.sh: lines 9 sha1 a116493f3e16eeae0ea45be73eae074a135f12c0`, `helpers.sh: lines 23 sha1 1605a54198b78a6587303c906f5ffca998d3cabc`; `kit2 std.mjs: lines 58 sha1 46256dc5346a0bf6202b40b7019cfd2e4d92fb10`, `invd.mjs: lines 25 sha1 c56924ca7fbc8d50f6408c24fa0a119b5b2ebeb2`; every other `sha1` equal to its `want`; `git.mjs equals the stage-2 wrapper: yes; equals the stage-3 wrapper: yes`; `kits checked`; the S0 lines with both seals at `credential-prefix names 0`, `TMPDIR is T true`, `HOME is Q/home true`, `std` with the user HOME and system TMPDIR and `NODE_COMPILE_CACHE set false`, `Q bytes 23`, each redaction count 0. A `std: BLOCKED` line or a non-zero credential count stops the run (BLOCKED).

**This brief's own helpers.** The TAP expectations (R-2: `exact: true` lists every registration, expanded; `exact: false` with names requires them; with `[]` the whole file must be `CLEAN`), read at `1114abeff`. T-1834's three titles are in both the `site/test/hosts-docs.test.ts` list and the `hub/test/remote-docs.test.ts` list (which imports it); T-1834 does not edit `site/test/remote-docs.test.ts` (its 22 titles are unchanged).

```sh
cat > "$Q/expect.json" <<'JSON'
{
 "hub/test/skills-onboarding.test.ts": {"exact": true, "names": [
  "onboarding names only shipped commands or explicitly pending release work",
  "the onboarding command check rejects unknown commands, config keys and secret names",
  "onboarding verification instructions are independent of npm",
  "the onboarding tour has ten stages ending with Look now",
  "onboarding records crew settings through commands",
  "onboarding stages explicit files and performs start and import without human keystrokes",
  "the onboarding Aide sets human epic plan approval through the config CLI",
  "the onboarding Aide records the stack verification commands verbatim through the config CLI",
  "the onboarding Aide records staffing through the crew CLI",
  "the onboarding Aide records launch fields through the role CLI",
  "the onboarding Aide own launch change returns the next-launch note",
  "the onboarding Aide launches the Coordinator with the first release brief through its own shell",
  "the onboarding Aide plans imported open GitHub issues in its first release",
  "remote tour explains voice notes and the hidden speech key command",
  "remote tour includes Discord setup and local approval with shipped commands"]},
 "site/test/hosts-docs.test.ts": {"exact": true, "names": [
  "hosts vocabulary guard rejects invented command, flag and setting",
  "hosts guide is linked under Features and covers the built host and login workflow",
  "hosts guide quotes emitted waiting reasons and doctor/setup rows",
  "hosts guide defaults match the shared pool parser and slot policy",
  "hosts price table dates public pool rates and computes default host-hours",
  "hosts storage table matches provider declared GiB-month rates without native imports",
  "CLI Hosts and logins lists exactly the built usage subcommands"]},
 "site/test/onboarding-claims.test.ts": {"exact": true, "names": [
  "an unconditional Aide commit claim is detected",
  "current root Git write access qualifies only the Aide committing clause",
  "the site and docs agree on who commits the onboarding at the root"]},
 "site/test/remote-docs.test.ts": {"exact": true, "names": [
  "remote documentation guard rejects unknown commands, config keys and secret names",
  "remote guide and web Remotes section use shipped commands, config keys and secret names",
  "Remote control is under Features and linked from the overview and web Remotes section",
  "remote guide distinguishes missed cards from outage replacements after 150 seconds",
  "CLI reference lists exactly the remote and secret subcommands in usage",
  "remote media guide documents shipped speech and upload settings and exact data-use lines",
  "web guide names composer file attachments and inline image formats",
  "remote guide explains the setup speech offer and nonterminal command",
  "doctor guide names Discord fatal codes and local-only recovery instructions",
  "Discord setup guide names application checks, invite permissions and local pairing commands",
  "both public remote pages describe Discord media, voice and local diagnostics",
  "README remote commands describe the built-in Discord client and both setup offers",
  "documentation vocabulary guard rejects an invented command flag",
  "README public remote commands, settings, secrets and flags use shipped vocabulary",
  "chat guide distinguishes Telegram typed ask answers from Discord topic replies",
  "landing feature names both shipped remotes and links their guide",
  "README feature names both shipped remotes and links their guide",
  "Features entry names both shipped remotes and links their guide",
  "landing shows all eleven features in the chosen order without carousel controls",
  "feature cards keep anchors and only number, title, text and docs link in a responsive grid",
  "feature link clicks use GoatCounter feature ids and privacy wording includes clicks",
  "every landing feature points to an existing documentation page"]},
 "hub/test/remote-docs.test.ts": {"exact": true, "names": [
  "an unconditional Aide commit claim is detected",
  "current root Git write access qualifies only the Aide committing clause",
  "the site and docs agree on who commits the onboarding at the root",
  "hosts vocabulary guard rejects invented command, flag and setting",
  "hosts guide is linked under Features and covers the built host and login workflow",
  "hosts guide quotes emitted waiting reasons and doctor/setup rows",
  "hosts guide defaults match the shared pool parser and slot policy",
  "hosts price table dates public pool rates and computes default host-hours",
  "hosts storage table matches provider declared GiB-month rates without native imports",
  "CLI Hosts and logins lists exactly the built usage subcommands",
  "remote documentation guard rejects unknown commands, config keys and secret names",
  "remote guide and web Remotes section use shipped commands, config keys and secret names",
  "Remote control is under Features and linked from the overview and web Remotes section",
  "remote guide distinguishes missed cards from outage replacements after 150 seconds",
  "CLI reference lists exactly the remote and secret subcommands in usage",
  "remote media guide documents shipped speech and upload settings and exact data-use lines",
  "web guide names composer file attachments and inline image formats",
  "remote guide explains the setup speech offer and nonterminal command",
  "doctor guide names Discord fatal codes and local-only recovery instructions",
  "Discord setup guide names application checks, invite permissions and local pairing commands",
  "both public remote pages describe Discord media, voice and local diagnostics",
  "README remote commands describe the built-in Discord client and both setup offers",
  "documentation vocabulary guard rejects an invented command flag",
  "README public remote commands, settings, secrets and flags use shipped vocabulary",
  "chat guide distinguishes Telegram typed ask answers from Discord topic replies",
  "landing feature names both shipped remotes and links their guide",
  "README feature names both shipped remotes and links their guide",
  "Features entry names both shipped remotes and links their guide",
  "landing shows all eleven features in the chosen order without carousel controls",
  "feature cards keep anchors and only number, title, text and docs link in a responsive grid",
  "feature link clicks use GoatCounter feature ids and privacy wording includes clicks",
  "every landing feature points to an existing documentation page",
  "site vocabulary extraction matches the runtime config and secret names"]},
 "hub/test/hosts-docs-pool.test.ts": {"exact": true, "names": [
  "published pool commands configure a second fake pool and host status lists it"]},
 "hub/test/suite-task-selection.test.ts": {"exact": false, "names": [
  "mode-free docs and site selections include every site prebuild guard"]},
 "hub/test/test-docs.test.ts": {"exact": false, "names": []},
 "hub/test/suite-tiers.test.ts": {"exact": false, "names": []}
}
JSON
node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("expect checked: files "+Object.keys(v).length+"; exact lists "+Object.values(v).filter(x=>x.exact).map(x=>x.names.length).join(" "))' "$Q/expect.json"
```

The source checks (`src.mjs`), counted with `String.split` on the files of the worktree it is given (it calls no Git). At `1114abeff` every line reads `ok`, 129 in all (VERIFIED with this `src.mjs` over a read-only `git archive` of `1114abeff`: T-1832's 34 lines, T-1833's 69, T-1834's 26). The T-1833 lines T-1834's landing edited were re-read there and are labelled "re-read at T-1834": the untouched no-terminal sentence (now "without a terminal and without `--yes`") and the `skip` count (now 4); T-1833's "missing placement reads" sentence is replaced by T-1834's eleven setup-paragraph lines (each page sentence and the source line that builds it), and the drafts' text of those lines reads `MISMATCH` at `1114abeff`.

```sh
cat > "$Q/src.mjs" <<'JS'
// node "$Q/src.mjs" <W>   ok, MISMATCH or MISSING per line; counts use String.split on the worktree's files; no Git, no hub
import { readFileSync, existsSync } from 'node:fs';
const [W] = process.argv.slice(2);
const read = f => existsSync(`${W}/${f}`) ? readFileSync(`${W}/${f}`, 'utf8') : null;
const TOUR = '.agents/skills/onboarding/TOUR.md', SKILL = '.agents/skills/onboarding/SKILL.md', SOT = 'hub/test/skills-onboarding.test.ts', SON = ['docs/agents/tests/hub-test-skills-onboarding', 'test', 'ts', 'md'].join('.');   // note paths spelled in parts: qa lint reads a whole spelling as a test file
const SCH = 'hub/src/host/scheduler.ts', LC = 'hub/src/host/login-cards.ts', LU = 'hub/src/cli/usage/login.ts', NH = 'nvim/lua/cland/hosts.lua', NP = 'nvim/lua/cland/panels.lua', WH = 'web/src/sessions/HostsLine.tsx', WS = 'web/src/sessions/SessionsArea.tsx';
const HS = 'hub/src/setup/steps/hosts.ts', RU = 'hub/src/setup/runner.ts', DH = 'hub/src/doctor/hosts.ts', PG = 'site/src/content/docs/docs/hosts.md', AC = 'site/astro.config.mjs', FE = 'site/src/content/docs/docs/features.md';
const DO = 'hub/src/host/provider/digitalocean.ts', CLI = 'site/src/content/docs/docs/cli.md', HDT = 'site/test/hosts-docs.test.ts', RDN = ['docs/agents/tests/hub-test-remote-docs', 'test', 'ts', 'md'].join('.');
const PN = 'hub/src/host/pool-name.ts', MEM = 'hub/src/host/agent/memory.ts', BG = 'hub/src/host/boot-gate.ts', HH = 'hub/src/host/host-health.ts', WA = 'hub/src/hub/web-authority.ts', PO = 'hub/src/host/pools.ts';
const LINT = 'hub/test/lint-closed-item-wording.ts', TD = 'docs/agents/tests.md', RDW = 'hub/test/remote-docs.test.ts', HDP = 'hub/test/hosts-docs-pool.test.ts', HDS = 'site/test/hosts-docs-source.ts', TI = 'hub/test/tiers.json', HDN = ['docs/agents/tests/hub-test-hosts-docs-pool', 'test', 'ts', 'md'].join('.'), IX = 'docs/agents/tests/index.md';
const C = [
  // T-1832 (the onboarding tour's stage on agent hosts)
  ['T-1832 C1 the tour has ten numbered stages', TOUR, '\n## ', '=10'],
  ['T-1832 C1 the tenth stage is agent hosts', TOUR, '\n## 10. Agent hosts\n', '=1'],
  ['T-1832 C1 the ninth stage is still remote control', TOUR, '\n## 9. Remote control\n', '=1'],
  ['T-1832 C1 one Look now line per stage', TOUR, '\nLook now: ', '=10'],
  ['T-1832 C1 the tenth stage ends naming the Hosts row', TOUR, '\nLook now: the Hosts row in the sessions panel.\n', '=1'],
  ['T-1832 C1 the ninth stage still ends naming the Remotes row', TOUR, '\nLook now: the Remotes row in the sessions panel.\n', '=1'],
  ['T-1832 C2 the stage names the Hosts row in both workbenches', TOUR, "In Neovim's sessions panel and the web's Sessions area, the Hosts row sits beside Remotes when pools are configured.", '=1'],
  ['T-1832 C2 the Neovim Hosts row renders only with pools', NH, "if type(pools) ~= 'table' or #pools == 0 then return end", '=1'],
  ['T-1832 C2 the Neovim Hosts row header', NH, "'Hosts', 'ClandDim' } }, nil, { fold = 'hosts' })", '=1'],
  ['T-1832 C2 the Neovim sessions panel renders Hosts', NP, "require('cland.hosts').render(c, wrapped)", '=1'],
  ['T-1832 C2 the web Hosts row renders only with pools', WH, 'if (!pools.length) return null;', '=1'],
  ['T-1832 C2 the web Hosts row folds under the label Hosts', WH, '<Fold area="sessions" id="hosts" label="Hosts"', '=1'],
  ['T-1832 C2 the web Sessions area puts Hosts right after Remotes', WS, '<RemotesLine {...props} /><HostsLine {...props} />', '=1'],
  ['T-1832 C2 the stage names the web hosts view', TOUR, "In the web, expanding Hosts opens the hosts view, with hosts and logins, their state and actions.", '=1'],
  ['T-1832 C2 expanding the web Hosts row opens the hosts view', WH, '{open => open ? <HostsView connection={connection} pools={pools} /> : null}', '=1'],
  ['T-1832 C2 a waiting launch is a status line, not an ask', TOUR, 'A waiting launch is a status line in the inbox, not an ask.', '=1'],
  ['T-1832 C2 the three reasons as templates in the stage', TOUR, 'Its current reason says "waiting for a host", "waiting for a login <harness>" or "waiting for host <id> to boot"', '=1'],
  ['T-1832 C2 the hub emits waiting for a host', SCH, "return { kind: 'wait', reason: 'waiting for a host' };", '=1'],
  ['T-1832 C2 the hub emits waiting for a login <harness>', SCH, "reason: `waiting for a login ${input.harness}` };", '=1'],
  ['T-1832 C2 the hub emits waiting for host <id> to boot', SCH, "reason: `waiting for host ${booting.id} to boot` };", '=1'],
  ['T-1832 C2 the stage names the create-one card', TOUR, '"Not enough <harness> logins. Create one?" card', '=1'],
  ['T-1832 C2 the hub raises that card', LC, '`Not enough ${demand.harness} logins. Create one?`', '=1'],
  ['T-1832 C2 the stage names cland login add', TOUR, '`cland login add <harness> --pool <pool>`', '=1'],
  ['T-1832 C2 the login usage has that form', LU, 'login add <harness> [--name <name>] [--pool <pool>] [--account <account>] [--kind disk|key]', '=1'],
  ['T-1832 C2 setup in one run, after remotes and speech, before the Aide, default No', TOUR, 'To set hosts up, run `cland setup` in your terminal: after remotes and speech, before the Aide, it offers agent hosts with No as the default;', '=1'],
  ['T-1832 C2 setup step order', RU, 'const STEPS: readonly SetupStep[] = [project, harnesses, logins, accounts, favourite, trust, hub, remotes, discord, speech, hosts, aide];', '=1'],
  ['T-1832 C2 the setup guide the per-test note names has its agent-hosts section', 'docs/hub/cland-setup.md', '\n### Agent hosts in setup\n', '=1'],
  ['T-1832 C2 the stage names cland config set by hand', TOUR, 'For manual configuration, use `cland config set` for pool settings,', '=1'],
  ['T-1832 C3 SKILL.md offers ten stages', SKILL, 'teach the ten stages of `TOUR.md`', '=1'],
  ['T-1832 C3 SKILL.md no longer says nine stages', SKILL, 'nine stages', '=0'],
  ['T-1832 C1 the test counts ten stages', SOT, 'assert.equal(stages.length, 10);', '=1'],
  ['T-1832 C3 the test applies the command check to stage ten', SOT, 'assert.deepEqual(commandProblems(hosts), []);', '=1'],
  ['T-1832 the remote-stage read stops before stage ten', SOT, ".split('## 9. Remote control')[1]!.split('## 10.')[0]!;", '=1'],
  ['T-1832 the per-test note', SON, 'T-1832: `the onboarding tour has ten stages ending with Look now` covers C1–C3:', '=1'],
  // T-1833 (the hosts, pools and logins page)
  ['T-1833 C1 the page is in the Features sidebar group', AC, "group('Features', [\n    ['Overview', 'docs/features'],\n    ['Items and the tracker', 'docs/items'],\n    ['Topics and the inbox', 'docs/topics'],\n    ['Sessions and harness access', 'docs/sessions'],\n    ['Accounts and limits', 'docs/accounts'],\n    ['Hosts, pools and logins', 'docs/hosts'],\n", '=1'],
  ['T-1833 C1 the features overview links the page', FE, '- **[Hosts, pools and logins](/docs/hosts/).**', '=1'],
  ['T-1833 C1 the page title', PG, '\ntitle: Hosts, pools and logins\n', '=1'],
  ['T-1833 C1 section Configuration', PG, '\n## Configuration\n', '=1'],
  ['T-1833 C1 section Role placement', PG, '\n## Role placement\n', '=1'],
  ['T-1833 C1 section Commands', PG, '\n## Commands\n', '=1'],
  ['T-1833 C1 section Lifecycle and failures', PG, '\n## Lifecycle and failures\n', '=1'],
  ['T-1833 C1 section Money', PG, '\n## Money\n', '=1'],
  ['T-1833 C1 section Logins', PG, '\n## Logins\n', '=1'],
  ['T-1833 C1 section Workbench, doctor and setup', PG, '\n## Workbench, doctor and setup\n', '=1'],
  ['T-1833 C1 the per-harness login rules table', PG, '\n| Harness | Login rule |\n', '=1'],
  ['T-1833 C1 the Codex one-place warning', PG, 'One ChatGPT account keeps one login in use at **one place**, the human’s Mac included.', '=1'],
  ['T-1833 C2 the page quotes waiting for a host', PG, '\n- `waiting for a host`\n', '=1'],
  ['T-1833 C2 the page quotes waiting for host <id> to boot', PG, '\n- `waiting for host <id> to boot`\n', '=1'],
  ['T-1833 C2 the page quotes waiting for a login <harness>', PG, '\n- `waiting for a login <harness>`\n', '=1'],
  ['T-1833 C3 the page has one marked command block', PG, '```sh host-pool\n', '=1'],
  ['T-1833 C3 the walkthrough ends in cland host status', PG, 'cland hub reload\ncland host status\n```', '=1'],
  ['T-1833 C3 the walkthrough heading the T2 note names', PG, '\n### Configure a second pool\n', '=1'],
  ['T-1833 C3 the T2 test substitutes the fake provider and splits on whitespace', HDP, "const args = step.slice(6).replace('<provider>', 'fake').split(/\\s+/);", '=1'],
  ['T-1833 C3 the T2 test requires the second pool in host status', HDP, 'assert.match(status, /second: 0 hosts.*slots 0\\/0/);', '=1'],
  ['T-1833 C3 the shared marked-block parser', HDS, 'return [...text.matchAll(/```sh host-pool\\n([\\s\\S]*?)\\n```/g)]', '=1'],
  ['T-1833 C4 doctor line host <name> image on the page', PG, '| `host <name> image` |', '=1'],
  ['T-1833 C4 doctor builds host <pool> image', DH, 'const name = `host ${pool} image`, fix = `cland host prepare ${pool}`;', '=1'],
  ['T-1833 C4 doctor line host <name> token on the page', PG, '| `host <name> token` |', '=1'],
  ['T-1833 C4 doctor builds host <provider> token', DH, 'const name = `host ${provider} token`;', '=1'],
  ['T-1833 C4 doctor line host login <name> on the page', PG, '| `host login <name>` |', '=1'],
  ['T-1833 C4 doctor builds host login <name>', DH, "if (login.state === 'signed-out') out.push(warn(`host login ${login.name}`, 'signed-out', `cland login signin ${login.name}`));", '=1'],
  ['T-1833 C4 doctor line host <name> <name> logins on the page', PG, '| `host <name> <name> logins` |', '=1'],
  ['T-1833 C4 doctor builds host <pool> <harness> logins', DH, 'const name = `host ${pool.name} ${harness} logins`;', '=1'],
  ['T-1833 C4 doctor line host <name> reachability on the page', PG, '| `host <name> reachability` |', '=1'],
  ['T-1833 C4 doctor builds host <id> reachability', DH, 'const name = `host ${host.id} reachability`;', '=1'],
  ['T-1833 C4 doctor line host spend on the page', PG, '| `host spend` |', '=1'],
  ['T-1833 C4 doctor builds host spend', DH, "warn('host spend', detail,", '=1'],
  ['T-1833 C4 doctor without pools on the page', PG, "Without pools doctor's `hosts` line reads `no host pool`.", '=1'],
  ['T-1833 C4 doctor builds the no-pool line', DH, "if (!Object.keys(config.hosts.pools).length) return [ok('hosts', 'no host pool')];", '=1'],
  ['T-1833 C4 setup step after remote setup and before the Aide on the page', PG, '`cland setup` includes the optional **agent hosts** step after remote setup and\nbefore the Aide.', '=1'],
  ['T-1833 C4 setup image row named on the page', PG, 'The image row is `agent hosts image`;', '=1'],
  ['T-1833 C4 setup builds the image row', HS, "lines.push({ name: 'agent hosts image', verdict: 'done', detail: `agents: ${result.state}` });", '=1'],
  ['T-1833 documented: --yes on an untouched project reads skip optional agent hosts; default No', PG, 'With `--yes`, an untouched project reads `skip` with\n`optional agent hosts; default No`.', '=1'],
  ['T-1833 documented: setup builds that --yes skip', HS, "if (yes) return [{ name, verdict: 'skip', detail: 'optional agent hosts; default No' }];", '=1'],
  ['T-1833 documented: no terminal and no --yes, untouched: skip with the exact commands (re-read at T-1834: "and without `--yes`" added)', PG, 'Without a terminal and without `--yes`, untouched hosts read\n`skip` and include exact configuration/placement/reload commands.', '=1'],
  ['T-1833 documented: setup builds the untouched commands', HS, "if (!pool) fix = commands(defaultPool, ['implementer']);", '=1'],
  ['T-1833 documented: setup builds the no-terminal skip with the commands', HS, "if (!interactive) return [{ name, verdict: pool ? 'open' : 'skip', detail: `${pool ? 'agent hosts need a terminal' : 'optional agent hosts'}; ${fix}`, fix }];", '=1'],
  ['T-1834 setup paragraph: a pool without placed roles, no terminal: open, agent hosts need role placement; --yes in a terminal: skip (re-read at T-1834: replaces the "reads `open` unattended" sentence)', PG, 'With provider metadata available, an `agents` pool without placed roles reads\n`open` without a terminal with `agent hosts need role placement`; with `--yes`\nin a terminal it reads `skip` with `optional agent hosts; default No`.', '=1'],
  ['T-1834 setup paragraph: the old unattended sentence is gone', PG, 'reads `open` unattended', '=0'],
  ['T-1834 setup paragraph: placed roles with image and logins ready read ok', PG, 'A pool with placed roles reads `ok` when its image and role logins are ready.', '=1'],
  ['T-1834 setup builds that ok', HS, "if (placed.every(role => status?.roleLogins?.[role.role] === true) && (await machine.image?.('agents', pool.provider).catch(() => undefined))?.state === 'current') return [{ name, verdict: 'ok', detail: `agents; current image; roles ${placed.map(r => r.role).join(', ')}; ready logins` }];", '=1'],
  ['T-1834 setup paragraph: otherwise the main row is open without a terminal, ok in a terminal', PG, 'Otherwise its main `agent hosts` row reads `open` without a terminal and `ok`\nin a terminal.', '=1'],
  ['T-1834 setup builds that main row', HS, "if (pool && placed.length) return [{ name, verdict: interactive ? 'ok' : 'open', detail: `agents; roles ${placed.map(r => r.role).join(', ')}`, fix }, ...await finishPool(options, placed, hostPoolsDocument(config.hosts).agents as Record<string, unknown>)];", '=1'],
  ['T-1834 setup paragraph: offers open without a terminal, skip under --yes in a terminal', PG, 'offers read `open` without a terminal and `skip` under `--yes` in a\nterminal.', '=1'],
  ['T-1834 setup builds the offer outcomes (no terminal first)', HS, "    if (!o.interactive) return 'open' as const;\n    if (o.yes || !await o.prompter.confirm(question, false)) return 'skip' as const;", '=1'],
  ['T-1834 setup paragraph: an unpriced builder stays open', PG, 'An unpriced image builder remains `open`.', '=1'],
  ['T-1834 setup builds that open', HS, "const answer = current ? 'current' : paid && !builderPrice ? 'open' :", '=1'],
  ['T-1834 setup paragraph: missing provider metadata leaves the step open first', PG, 'Missing required provider\nmetadata leaves the step `open` before these placement checks.', '=1'],
  ['T-1834 setup builds that open before placement', HS, "if (pool?.provider === 'digitalocean' && !configuredProvider?.present) return [...missingToken(),", '=1'],
  ['T-1833 documented: setup builds that row', HS, "if (pool && !interactive) return [{ name, verdict: 'open', detail: 'agent hosts need role placement', fix }, ...await finishPool(options, placed, hostPoolsDocument(config.hosts).agents as Record<string, unknown>)];", '=1'],
  ['T-1833 T-1860 is not documented as intended: the page names skip four times, in the untouched --yes and no-terminal sentences, the unplaced pool under --yes and the offers under --yes (re-read at T-1834)', PG, '`skip`', '=4'],
  ['T-1833 T-1860 is not documented as intended: no tracker id on the page for it', PG, 'T-1860', '=0'],
  ['T-1833 T-1860 behaviour as built (known, accepted at stage 3): a placed role without the agents pool gets only the pool commands', HS, 'if (!pool && placed.length) fix = commands(defaultPool, []);', '=1'],
  ['T-1833 page fact: pool names 1 to 64, letter or digit first', PG, 'Pool names contain 1–64 letters,\ndigits or hyphens, starting with a letter or digit.', '=1'],
  ['T-1833 source: the pool-name rule', PN, '/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/', '=1'],
  ['T-1833 page fact: the 1.3 GB memory floor', PG, '**1.3 GB** available-memory floor', '=1'],
  ['T-1833 source: the memory floor', MEM, 'export const MEMORY_FLOOR_BYTES = 1_300_000_000;', '=1'],
  ['T-1833 page fact: the five-minute boot gate', PG, 'A create has a five-minute boot gate.', '=1'],
  ['T-1833 source: the boot gate', BG, 'export const HOST_BOOT_MS = 300000;', '=1'],
  ['T-1833 page fact: unreachable after 3 minutes, named in General', PG, 'After **3 minutes**, General says `host <id> unreachable`.', '=1'],
  ['T-1833 source: the 3-minute notice', HH, "o.notice(`host ${id} unreachable`);\n  },remaining(bound('CLAND_TEST_HOST_UNREACHABLE_MS',180000)))};", '=1'],
  ['T-1833 page fact: destruction at 15 minutes', PG, 'At 15 minutes the hub stops renewal,', '=1'],
  ['T-1833 source: the 15-minute loss', HH, "remaining(bound('CLAND_TEST_HOST_LOST_MS',900000))", '=1'],
  ['T-1833 page fact: the web can stop hosts', PG, 'Local Neovim and authenticated web users can also stop hosts.', '=1'],
  ['T-1833 source: host.stop admitted to the web', WA, "  'host.stop': true,", '=1'],
  ['T-1833 page fact: key logins OpenCode-only, no pool or image', PG, 'OpenCode-only and need no pool or image.', '=1'],
  ['T-1833 source: key logins in the login usage', LU, 'key: OpenCode only in 0.4.x; stdin or hidden prompt, never value arguments', '=1'],
  ['T-1833 C2 the guard reads the pool keys from source', PO, "export const POOL_KEYS = ['provider', 'size', 'region', 'transport', 'slots', 'min_hosts', 'max_hosts', 'idle_stop', 'spread'] as const;", '=1'],
  ['T-1833 C2 the guard reads the global keys from source', PO, "const GLOBAL_KEYS = ['harnesses', 'daily_spend_usd', 'lease', 'weights', 'relaunch_after_signin'];", '=1'],
  ['T-1833 C4 the wording lint scans site Markdown', LINT, "glob(['**/README*.md', 'docs/**/*.md', 'site/src/content/docs/**/*.md'], {", '=1'],
  ['T-1833 C4 the tests guide says so', TD, 'repository `README*.md` files, `docs/**/*.md` and `site/src/content/docs/**/*.md`', '=1'],
  ['T-1833 the shared T1 wrapper imports the hosts guard', RDW, ["import '../../site/test/hosts-docs", "test", "ts';"].join('.'), '=1'],
  ['T-1833 the T2 file has its tier', TI, '"hub/test/hosts-docs-pool.test.ts": "T2",', '=1'],
  ['T-1833 the T2 file has its index row', IX, ['| [`hub/test/hosts-docs-pool.test.ts`](../../../hub/test/hosts-docs-pool', 'test', 'ts) | [Notes](hub-test-hosts-docs-pool', 'test', 'ts', 'md) |'].join('.'), '=1'],
  ['T-1833 the T2 note points QA at the published steps', HDN, 'QA can find the published steps under “Configure a second pool” on the Hosts,', '=1'],
  // T-1834 (the price table and the CLI reference), read at its landing 6cc0fa816 (dev 1114abeff); every T-1833 line above was re-read there
  ['T-1834 C1 the table names its check date', PG, 'DigitalOcean USD prices, checked on 2026-11-15:', '=1'],
  ['T-1834 C1 the agents row', PG, '| `agents` | `s-4vcpu-8gb` | $0.07143 | $48.00 |', '=1'],
  ['T-1834 C1 the qa row', PG, '| `qa` | `s-4vcpu-8gb` | $0.07143 | $48.00 |', '=1'],
  ['T-1834 C1 the default sub-cap in host-hours', PG, 'The default `hosts.daily_spend_usd` sub-cap of $3.00 represents approximately\n42.00 host-hours at either table rate', '=1'],
  ['T-1834 C1 the source links', PG, '[Droplets](https://www.digitalocean.com/pricing/droplets)', '=1'],
  ['T-1834 C1 the insertion-point comment is gone', PG, 'Price table insertion point', '=0'],
  ['T-1834 C2 the volume row', PG, '| Login volume | $0.10/GiB-month |', '=1'],
  ['T-1834 C2 the snapshot row', PG, '| Volume snapshot | $0.06/GiB-month |', '=1'],
  ['T-1834 C2 the provider declares the storage rates', DO, 'export const DIGITALOCEAN_STORAGE_PRICES=Object.freeze({volumePerGiBMonth:0.10,snapshotPerGiBMonth:0.06});', '=1'],
  ['T-1834 C3 the CLI reference section', CLI, '\n## Hosts and logins\n', '=1'],
  ['T-1834 C3 the section links the hosts page', CLI, 'See [Hosts, pools and logins](/docs/hosts/) for configuration, paid operations,', '=1'],
  ['T-1834 C1 C2 C3 the guard reads the storage declaration as text', HDT, "/DIGITALOCEAN_STORAGE_PRICES=Object.freeze\\(\\{([^}]+)\\}\\)/.exec(source('hub/src/host/provider/digitalocean.ts'))", '=1'],
  ['T-1834 C3 the guard derives the inventory from the usage text', HDT, 'const expected = [...(HOST_USAGE + LOGIN_USAGE).matchAll(/^  ((?:host|login) [a-z-]+)\\b/gm)].map(match => match[1]!).sort();', '=1'],
  ['T-1834 the per-test note section', RDN, '\n### Host pricing and CLI inventory\n', '=1'],
];
for (const [label, file, text, e] of C) {
  const t = read(file), n = t === null ? 'MISSING' : t.split(text).length - 1;
  const pass = t !== null && (e.startsWith('>=') ? n >= Number(e.slice(2)) : n === Number(e.slice(1)));
  console.log(`${pass ? 'ok' : t === null ? 'MISSING' : 'MISMATCH'} ${label} | ${file} | ${n} | ${e}`);
}
JS
cat > "$Q/ids.mjs" <<'JS'
// node "$Q/ids.mjs" <brief>   every E1537S4-NN the criteria map names exists as a row; the drafting markers left for T-1834 (spelled in parts, so this script holds none)
import { readFileSync } from 'node:fs';
const t = readFileSync(process.argv[2], 'utf8'), map = t.slice(t.indexOf('### Criteria map'), t.indexOf('\n## Build'));
const named = new Set(map.match(/E1537S4-\d+/g) ?? []), rows = new Set([...t.matchAll(/^\| (E1537S4-\d+) \|/gm)].map(m => m[1]));
const missing = [...named].filter(id => !rows.has(id)), mark = ['TO', 'DO(', 'T-1834', ')'].join('');
console.log(`criteria-map ids ${named.size}; table rows ${rows.size}; missing from the tables: ${missing.length}${missing.length ? ' ' + missing.join(' ') : ''}`);
console.log(`open T-1834 markers: ${t.split(mark).length - 1}`);
JS
cat > "$Q/pub.mjs" <<'JS'
// node "$Q/pub.mjs" <W> <expect.json> <brief>   R-3/R-6 precheck: every expected title and every line of the brief through the unchanged publication policy,
// plus the lines holding a fragment that a runtime value could turn into a refusal; a positive control is built in memory and never printed or written
import { readFileSync } from 'node:fs';
const [W, ex, brief] = process.argv.slice(2);
const { assertPublishable } = await import(`${W}/.agents/skills/qa/qa-demo-policy.ts`);
const refused = s => { try { assertPublishable(s); return false; } catch { return true; } };
const titles = Object.values(JSON.parse(readFileSync(ex, 'utf8'))).flatMap(v => v.names);
const lines = readFileSync(brief, 'utf8').split('\n');
const joinable = /(?:\b(?:token|access_token|api_key)=|\bbearer\s|[a-z0-9_](?:token|api_key|secret_access_key)["']?\s*[:=])/i;
const control = ['Bear', 'er ', 'q'.repeat(24)].join('');
console.log(`expected titles ${titles.length}; refused ${titles.filter(refused).length}`);
console.log(`brief lines ${lines.length}; refused ${lines.filter(refused).length}; with a joinable fragment ${lines.filter(l => joinable.test(l)).length}`);
console.log(`positive control refused: ${refused(control)}`);
for (const [i, l] of lines.entries()) if (refused(l) || joinable.test(l)) console.log(`  brief line ${i + 1}: ${refused(l) ? 'refused' : 'joinable fragment'}`);
for (const t of titles.filter(refused)) console.log(`  refused title (length ${t.length})`);
JS
cat > "$Q/pubw.mjs" <<'JS'
// <command> | node "$Q/pubw.mjs" <file>   stdin to <file>, line by line through the redactor and the unchanged publication policy (R-1); a refused line is withheld
// Prints "# pubw <name>: withheld lines <n>" on stderr; a non-zero count makes the row that wrote it INCONCLUSIVE.
import { readFileSync, writeFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(new URL('./state.json', import.meta.url), 'utf8'));
const { assertPublishable } = await import(`${s.W}/.agents/skills/qa/qa-demo-policy.ts`);
const secrets = Object.entries(process.env).filter(([k, v]) => typeof v === 'string' && v.length >= 8 && /(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY)/i.test(k)).map(([, v]) => v);
let input = ''; process.stdin.setEncoding('utf8'); for await (const c of process.stdin) input += c;
let withheld = 0;
const out = input.split('\n').map(line => {
  let o = line;
  for (const v of secrets) if (o.includes(v)) o = o.split(v).join('[redacted]');
  try { assertPublishable(o); } catch { o = '# pubw: line withheld by the publication scan'; }
  if (o !== line) withheld++;
  return o;
}).join('\n');
writeFileSync(process.argv[2], out);
console.error(`# pubw ${process.argv[2].split('/').pop()}: withheld lines ${withheld}`);
JS
cat > "$Q/pubscan.mjs" <<'JS'
// node "$QA_Q/pubscan.mjs" <dir>…   every regular file under each <dir>, line by line, through the unchanged publication policy; names of refusing files only, never their lines
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
const { assertPublishable } = await import(`${process.env.QA_W}/.agents/skills/qa/qa-demo-policy.ts`);
const refused = s => { try { assertPublishable(s); return false; } catch { return true; } };
const files = [];
const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isSymbolicLink()) continue; if (e.isDirectory()) walk(f); else if (e.isFile()) files.push(f); } };
for (const d of process.argv.slice(2)) if (lstatSync(d, { throwIfNoEntry: false })?.isDirectory()) walk(d);
let lines = 0, bad = 0;
for (const f of files) { const ls = readFileSync(f, 'utf8').split('\n'); lines += ls.length; const n = ls.filter(refused).length; if (n) { bad += n; console.log(`  refusing lines ${n} in ${f}`); } }
console.log(`files scanned ${files.length}; lines ${lines}; lines refused ${bad}`);
console.log(`positive control refused: ${refused(['Bear', 'er ', 'q'.repeat(24)].join(''))}`);
JS
cat > "$Q/voc.mjs" <<'JS'
// node "$QA_Q/voc.mjs" <W>   inside fresh.mjs (plain): every `cland` command in TOUR stage 10 and on the hosts page against the built CLI's own help, every hosts.* key against the pool parser's key lists
// T-1832 C3 and T-1833 C2, independently of the tests: each help is the built CLI answering `cland <command> --help` in a child sealed by seal() (R-1); nothing is written, the output goes through fresh.mjs
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const W = process.argv[2], q = process.env.QA_Q;
const { seal } = await import(`${q}/seal.mjs`);
const tour = readFileSync(`${W}/.agents/skills/onboarding/TOUR.md`, 'utf8').split('\n## 10. ')[1] ?? '';
const page = readFileSync(`${W}/site/src/content/docs/docs/hosts.md`, 'utf8');
const cmds = t => [...new Set([...t.matchAll(/`(cland [^`\n]+)`/g)].map(m => m[1]).concat([...t.matchAll(/^cland [^\n]+/gm)].map(m => m[0])))];
const helps = new Map();
const help = a => {
  if (!helps.has(a)) { const r = spawnSync(process.execPath, [`${W}/hub/bin/cland.ts`, a, '--help'], { cwd: q, env: seal(), encoding: 'utf8', timeout: 60000 }); helps.set(a, { code: r.status, text: `${r.stdout ?? ''}${r.stderr ?? ''}` }); }
  return helps.get(a);
};
for (const [label, text] of [['tour stage 10', tour], ['hosts page', page]]) {
  const list = cmds(text); let bad = 0;
  for (const c of list) {
    const w = c.slice(6).split(/\s+/), a = w[0], b = w[1], h = help(a), lines = h.text.split('\n').map(l => l.trim());
    const sub = b && !b.startsWith('-') && !b.startsWith('<') ? b : null;
    const known = h.code === 0 && (sub ? lines.some(l => l === `${a} ${sub}` || l.startsWith(`${a} ${sub} `)) : lines.some(l => l === a || l.startsWith(`${a} `)));
    const badFlags = w.filter(x => x.startsWith('--')).filter(f => !new RegExp(`${f}(?![a-z-])`).test(h.text));
    if (!known || badFlags.length) { bad++; console.log(`  ${label}: not in the built help: ${c}${badFlags.length ? `; flags ${badFlags.join(' ')}` : ''}`); }
  }
  console.log(`${label}: distinct cland commands ${list.length}; not in the built help ${bad}`);
}
{ const h = help('host'), lines = h.text.split('\n').map(l => l.trim()), invented = ['inv', 'ented'].join('');
  console.log(`negative control: an invented host subcommand rejected ${!lines.some(l => l.startsWith(`host ${invented}`))}; an invented flag rejected ${!/--invented(?![a-z-])/.test(h.text)}`); }
console.log(`helps read: ${[...helps].map(([a, h]) => `${a} exit ${h.code}`).join(', ')}`);
const pools = readFileSync(`${W}/hub/src/host/pools.ts`, 'utf8');
const poolKeys = JSON.parse((/POOL_KEYS = (\[[^\]]+\])/.exec(pools)?.[1] ?? '[]').replaceAll("'", '"'));
const globalKeys = JSON.parse((/GLOBAL_KEYS = (\[[^\]]+\])/.exec(pools)?.[1] ?? '[]').replaceAll("'", '"'));
for (const [label, text] of [['tour stage 10', tour], ['hosts page', page]]) {
  const keys = [...new Set([...text.matchAll(/\bhosts\.(?:<pool>|[a-z0-9_-]+)(?:\.[a-z_]+)?/g)].map(m => m[0]))].filter(k => k !== 'hosts.<pool>');
  const unknown = keys.filter(k => { const p = k.split('.'); return p.length === 2 ? !globalKeys.includes(p[1]) : !poolKeys.includes(p[2]); });
  console.log(`${label}: hosts keys ${keys.length}; not pool or global keys ${unknown.length}${unknown.length ? ' ' + unknown.join(' ') : ''}`);
}
// T-1834 C3: the CLI page's Hosts and logins section against the subcommands the built `cland host --help` and `cland login --help` name; a list with duplicates kept, compared exactly
const cli = readFileSync(`${W}/site/src/content/docs/docs/cli.md`, 'utf8');
const section = /^## Hosts and logins\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(cli)?.[1] ?? '';
const built = ['host', 'login'].flatMap(a => help(a).text.split('\n').map(l => /^  ((?:host|login) [a-z][a-z-]*)(?=\s|$)/.exec(l)?.[1]).filter(Boolean)).sort();
const inventory = s => [...s.matchAll(/`cland ((?:host|login) [a-z][a-z-]*)(?=[\s`])/g)].map(m => m[1]).sort();
const listed = inventory(section), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
console.log(`CLI Hosts and logins: section found ${section.length > 0}; listed ${listed.length}; built usage subcommands ${built.length}; missing [${built.filter(c => !listed.includes(c)).join(', ')}]; extra [${listed.filter(c => !built.includes(c)).join(', ')}]; duplicates [${listed.filter((c, i) => listed.indexOf(c) !== i).join(', ')}]; equal ${same(listed, built)}`);
console.log(`CLI negative controls: an extra command changes the list ${!same(inventory(section + ['`cland host inv', 'ented`'].join('')), built)}; a duplicate changes the list ${!same(inventory(section + '`cland login list`'), built)}`);
// T-1834 C1 and C2: the price table against the pool parser's defaults and the provider's storage declaration read as text (never imported)
const { readHostPools } = await import(`${W}/hub/src/host/pools.ts`);
const table = page.split('### Provider price table\n')[1]?.split('\n## ')[0] ?? '';
const cfg = readHostPools({ agents: { provider: 'digitalocean' }, qa: { provider: 'digitalocean' } });
console.log(`price table: check date line ${/checked on \d{4}-\d{2}-\d{2}:/.test(table)}; default sub-cap ${cfg.dailySpendUsd}`);
for (const name of ['agents', 'qa']) {
  const m = new RegExp(`^\\| \`${name}\` \\| \`([^\`]+)\` \\| \\$([0-9.]+) \\| \\$([0-9.]+) \\|$`, 'm').exec(table);
  const size = m?.[1], hourly = Number(m?.[2]), monthly = Number(m?.[3]);
  console.log(`price row ${name}: size ${size} equals the parser default ${size === cfg.pools[name].size}; hourly ${m?.[2]} equals monthly / 672 to 5 places ${(monthly / 672).toFixed(5) === m?.[2]}; host-hours ${(cfg.dailySpendUsd / hourly).toFixed(2)} on the page ${table.includes(`${(cfg.dailySpendUsd / hourly).toFixed(2)} host-hours`)}`);
}
const decl = /DIGITALOCEAN_STORAGE_PRICES=Object.freeze\(\{([^}]+)\}\)/.exec(readFileSync(`${W}/hub/src/host/provider/digitalocean.ts`, 'utf8'))?.[1] ?? '';
for (const [label, key] of [['Login volume', 'volumePerGiBMonth'], ['Volume snapshot', 'snapshotPerGiBMonth']]) {
  const declared = Number(new RegExp(`${key}:([0-9.]+)`).exec(decl)?.[1]), shown = Number(new RegExp(`^\\| ${label} \\| \\$([0-9.]+)/GiB-month \\|$`, 'm').exec(table)?.[1]);
  console.log(`storage ${label}: declared ${declared}; table ${shown}; equal ${declared === shown}`);
}
const setupHourly = /hourly: '([0-9.]+)'/.exec(readFileSync(`${W}/hub/src/setup/steps/hosts.ts`, 'utf8'))?.[1];
console.log(`setup's declared default hourly ${setupHourly} equals the table's agents hourly to 4 places ${Number(/^\| `agents` \| `[^`]+` \| \$([0-9.]+)/m.exec(table)?.[1]).toFixed(4) === setupHourly}`);
JS
cat > "$Q/census4.mjs" <<'JS'
// node "$QA_Q/census4.mjs" [alias]   inside fresh.mjs (hub mode), cwd p1, after the scratch hub stopped: every process naming Q, this build or the recorded alias.
// R-7: a host watchdog of this run's leases (T-1748: detached by design) is identity-checked before any TERM: argv lease input under p1, the lease's watchdog pid,
// and the process birth (ps lstart, local time) equal to the lease's startedUtc (ps format, UTC) to the second after both are normalised to UTC.
// An unidentified watchdog is never signalled. Every ps child gets its environment from seal() (R-1). Nothing is written; the output goes through fresh.mjs.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const q = process.env.QA_Q, w = process.env.QA_W, alias = process.argv[2] ?? '';
const { seal } = await import(`${q}/seal.mjs`);
const sh = args => { try { return execFileSync('ps', args, { env: seal(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };
const census = () => {
  const rows = sh(['-axo', 'pid=,ppid=,command=']).split('\n').map(l => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l)).filter(Boolean).map(m => ({ pid: +m[1], ppid: +m[2], cmd: m[3] }));
  const by = new Map(rows.map(r => [r.pid, r])), anc = new Set(); let p = process.pid;
  while (p && by.has(p) && !anc.has(p)) { anc.add(p); p = by.get(p).ppid; }
  return rows.filter(r => !anc.has(r.pid) && (r.cmd.includes(q) || r.cmd.includes(`${w}/`) || (alias && r.cmd.includes(alias))));
};
const leaseDir = `${q}/p1/.cland/run/host-leases/`;
const watchdog = h => {
  const input = h.cmd.split(/\s+/).find(x => x.startsWith(leaseDir) && x.endsWith('.json.watchdog-input'));
  if (!h.cmd.includes('/hub/src/host/host-watchdog.ts')) return null;
  let lease = null; try { lease = JSON.parse(readFileSync(input.slice(0, -'.watchdog-input'.length), 'utf8')); } catch {}
  const lstart = sh(['-o', 'lstart=', '-p', String(h.pid)]).trim();
  const born = lstart ? new Date(lstart).toISOString().slice(0, 19) : 'unknown';
  const recorded = lease?.watchdog?.startedUtc ? new Date(`${lease.watchdog.startedUtc} UTC`).toISOString().slice(0, 19) : 'unknown';
  const same = born !== 'unknown' && recorded !== 'unknown' && Math.abs(Date.parse(`${born}Z`) - Date.parse(`${recorded}Z`)) <= 1000;
  return { input: input ?? 'none under p1', leasePid: lease?.watchdog?.pid ?? 'none', born, recorded, identified: !!input && lease?.watchdog?.pid === h.pid && same };
};
const first = census();
console.log(`processes naming the scratch root, the alias or this build: ${first.length}`);
const term = [];
for (const h of first) {
  const wd = watchdog(h);
  console.log(`  survivor ${h.pid} parent ${h.ppid} ${h.cmd.slice(0, 160)}`);
  if (wd) console.log(`    host watchdog: lease input ${wd.input}; lease pid ${wd.leasePid}; birth UTC ${wd.born}; lease startedUtc ${wd.recorded}; identified ${wd.identified}`);
  if (!wd || wd.identified) term.push(h.pid); else console.log(`    not signalled: identity not established`);
}
console.log(`host watchdogs naming this run's leases: ${first.filter(h => h.cmd.includes('/hub/src/host/host-watchdog.ts')).length}; TERM sent to ${term.length}`);
for (const pid of term) { try { process.kill(pid, 'SIGTERM'); } catch {} }
await new Promise(r => setTimeout(r, 3000));
const after = census();
console.log(`after TERM: processes naming the scratch root, the alias or this build: ${after.length}`);
for (const h of after) console.log(`  remaining ${h.pid} ${h.cmd.slice(0, 160)}`);
JS
cat > "$Q/res.mjs" <<'JS'
// node "$QA_Q/res.mjs" <S0 prefix>   inside fresh.mjs (plain): R-5 residue and receipts since the setup snapshot, for every row of the run; reads names and receipts only, removes nothing
// Kinds: the system TMPDIR, /private/tmp and the TMPDIR's cland-fixture-owners-<uid> receipts. Known classes: T-1805 (receipts naming a source worktree or repository),
// T-1806 (cland-h- directories); a ct- alias is attributed by its realpath. Names other sessions create are counted, never attributed to this run.
import { readFileSync, readdirSync, existsSync, realpathSync, lstatSync } from 'node:fs';
const s = JSON.parse(readFileSync(`${process.env.QA_Q}/state.json`, 'utf8'));
const pre = process.argv[2], uid = process.getuid(), D = `${s.ST}/cland-fixture-owners-${uid}`;
const set = f => new Set(existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean) : []);
const ls = d => { try { return readdirSync(d); } catch { return []; } };
const real = p => { try { return realpathSync(p); } catch { return null; } };
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const ours = p => !!p && [s.W, s.R, s.Q, s.T].some(r => p === r || p.startsWith(`${r}/`));
const fh = real(`${s.Q}/fh/.fixture-sockets`);
const newR = ls(D).filter(n => !set(`${pre}.rcp`).has(n));
let live = 0, mine = 0;
for (const n of newR) {
  let v = null; try { v = JSON.parse(readFileSync(`${D}/${n}`, 'utf8')); } catch {}
  const roots = Array.isArray(v?.roots) ? v.roots : [], named = roots.filter(ours).length, a = v ? alive(v.pid) : false;
  if (named) { mine++; if (a) live++; }
  console.log(`receipt ${n}: owner alive ${a}; roots ${roots.length}; roots naming this run or the source ${named}${named ? ' (T-1805 class, left)' : ' (not this run)'}`);
}
console.log(`new receipts ${newR.length}; naming this run or the source ${mine}; with a live owner ${live}`);
const tmp = ls('/private/tmp').filter(n => !set(`${pre}.tmp`).has(n));
const fam = p => tmp.filter(n => n.startsWith(p));
for (const n of fam('ct-')) { const f = `/private/tmp/${n}`, link = lstatSync(f, { throwIfNoEntry: false })?.isSymbolicLink(), r = link ? real(f) : null; console.log(`ct- ${n}: link ${!!link}; resolves to this run's fake-host sockets ${!!fh && r === fh}`); }
for (const n of fam('cland-h-')) console.log(`cland-h- ${n}: T-1806 class, left`);
for (const n of fam('hc-')) console.log(`hc- ${n}: recorded`);
console.log(`/private/tmp new: ct- ${fam('ct-').length}; cland-h- ${fam('cland-h-').length}; hc- ${fam('hc-').length}; other names ${tmp.length - fam('ct-').length - fam('cland-h-').length - fam('hc-').length}`);
const st = ls(s.ST).filter(n => !set(`${pre}.st`).has(n));
console.log(`system TMPDIR new names ${st.length}; own-family (q53-, qa-e1533-s3-) ${st.filter(n => /^(q53-|qa-e1533-s3-)/.test(n)).length}`);
JS
for f in src ids pub pubw pubscan voc census4 res; do node --check "$Q/$f.mjs" || echo "BLOCKED: $f.mjs"; done; echo "helpers checked"
```

The check functions for QA's own shell (`landing` and `durdelta` from `M4`; `ownlines` and `s01` from `M3`; everything else this brief's own). The landed members' reviewed tips are written in; the merge-batch suites and candidates are named in `s06` (VERIFIED: each batch log's `suite provenance` head is a `Batch candidate T-<id>` commit; T-1832's candidate `3a7085fa9` on `15ba0cef9` has a tree equal to T-1832's landing tree `550c26410`; T-1833's candidate `9021b7669` on `0d1390dde` differs from T-1833's landing tree only in `.cland/tasks/T-1832-…` and `.cland/tasks/T-1833-…`, because the tracker commit `ec5f96d10` sits between the candidate's parent and the landing's parent).

```sh
cat > "$Q/checks.sh" <<'SH'
. "$Q/kit2-checks.sh"; . "$Q/kit3-checks.sh"     # ownlines and s01 from M3, landing and durdelta from M4; their s00 and s99 are replaced below
BASE=932f3018c335d620fc6afd268c5f9abb846c9d13    # "QA brief: E-1537 stage 3 …": the stage-3 QA SHA (A-19436), the parent of the stage's first commit
MEMBERS="T-1832 T-1833 T-1834"
STAGE="the tour and the hosts docs"
WROTE=1114abeff4518aad8889d94e71de07ae07265bab   # the dev this brief was completed at ("Durations: E-1537 stage-4 add-only refresh", after T-1834's landing)
ACCEPT=""                                         # non-member landings after BASE accepted by SHA (none at WROTE); the request may name more
# reviewed tips: the commit of each final clear verdict, read with task view (rev-35-1832-final-1, rev-36-1833-final-1, rev-35-1834-final-1)
TIPS="T-1832 71eba552a327a148aa95e3c8ff05e2c5bffaccdc T-1833 37a9884b416107215582281c3786a061dd1d19ff T-1834 a14379994c44c02f6af55eec7ac98db0beefee41"
# the unedited files this brief runs or reads as built: unchanged from BASE to WROTE (VERIFIED)
preserved() { printf '%s\n' hub/src/host/provider/digitalocean.ts site/test/remote-docs.test.ts site/test/remote-docs-source.ts site/test/onboarding-claims.test.ts hub/test/suite-task-selection.test.ts hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts hub/test/harness.ts hub/test/fake-clock.ts hub/src/init/config.ts hub/src/cli/host.ts hub/src/cli/usage.ts hub/src/cli/usage/login.ts hub/src/host/pools.ts hub/src/host/pool-name.ts hub/src/host/scheduler.ts hub/src/host/login-cards.ts hub/src/setup/steps/hosts.ts hub/src/setup/runner.ts hub/src/doctor/hosts.ts nvim/lua/cland/hosts.lua nvim/lua/cland/panels.lua web/src/sessions/HostsLine.tsx web/src/sessions/SessionsArea.tsx hub/src/web-bundle.ts test-support/fixture-environment.ts .agents/skills/qa/qa-demo-policy.ts hub/test/fakes/fake-ssh.ts hub/test/fakes/fake-scp.ts hub/test/fakes/opencode/opencode shared/fake-host-directory.ts hub/src/host/agent/memory.ts hub/src/host/boot-gate.ts hub/src/host/host-health.ts hub/src/hub/web-authority.ts; }
s00() {   # build, plan and landing receipts (captures through pubw, R-1)
  echo "PRE HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' | node "$Q/pubw.mjs" "$EV/root-status-before.txt"; echo "root non-tracker entries $(grep -c . "$EV/root-status-before.txt")"
  (cd "$R" && node "$W/hub/bin/cland.ts" task plan show E-1537 --json) | node "$Q/pubw.mjs" "$EV/plan.json"; echo "plan read exit ${PIPESTATUS[0]}"
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=(v.stages??[]).find(x=>x.name===process.argv[2]);const p=(v.plan?.stages??[]).find(x=>x.name===process.argv[2]);console.log(s?JSON.stringify({name:s.name,state:s.state,qa:s.qa,items:s.items,lanes:p?.lanes,merged:s.merged,total:s.total,statuses:s.statuses,cover:s.cover}):"stage missing");console.log("earlier stages: "+(v.stages??[]).slice(0,3).map(x=>x.name+" "+x.state).join("; "))' "$EV/plan.json" "$STAGE" | node "$Q/pubw.mjs" "$EV/stage-members.json"; cat "$EV/stage-members.json"
  for id in $(node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8").split("\n")[0]);console.log((v.items??[]).join(" "))' "$EV/stage-members.json"); do
    echo "$id landings $(landing "$id" | wc -l | tr -d ' ') $(landing "$id" | head -n 1)"
    (cd "$R" && node "$W/hub/bin/cland.ts" task view "$id" --json) | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const v=JSON.parse(s).item;console.log("  "+v.id+" state "+v.state+"; status "+v.status+"; claim "+(v.claim?"held":"none")+"; qaPolicy "+JSON.stringify(v.qaPolicy)+"; qaCriteria "+JSON.stringify(v.qaCriteria??null)+"; criteria checked "+(v.criteria??[]).filter(c=>c.checked).length+" of "+(v.criteria??[]).length)})'; done
}
s02() {   # landing diffs (read-only), the stage-wide invariants, the landing check and every first-parent commit after the stage-3 QA SHA
  for id in $MEMBERS; do L=$(landing "$id" | head -n 1); echo "$id landing ${L:-none}"; [ -n "$L" ] || continue
    echo "$id package.json and lockfiles: $(git -C "$W" diff --name-only "${L}^1" "${L}" -- package.json package-lock.json hub/package.json web/package.json nvim/package.json site/package.json site/package-lock.json | wc -l | tr -d ' ')"
    echo "$id preserved files edited at its landing: [$(git -C "$W" diff --name-only "${L}^1" "${L}" -- $(preserved) | tr '\n' ' ')]"
  done
  echo "preserved files changed in the stage: [$(git -C "$W" diff --name-only "$BASE" "$S" -- $(preserved) | tr '\n' ' ')]"
  echo "stage paths under hub/src, shared, web or nvim: [$(git -C "$W" diff --name-only "$BASE" "$S" -- hub/src shared web nvim | tr '\n' ' ')]"
  set -- $TIPS
  while [ $# -ge 2 ]; do id=$1; head=$2; shift 2; L=$(landing "$id" | head -n 1)
    [ -n "$L" ] && [ "$head" != none ] && git -C "$W" cat-file -e "$head^{commit}" 2> /dev/null || { echo "$id landing ${L:-none} tip $head: BLOCKED (no landing or no tip)"; continue; }
    F=$(git -C "$W" diff --name-only "$L^1" "$L" | grep -v '^\.cland/' | tr '\n' ' ')
    echo "$id own lines at its landing $L equal its tip $head: $(ownlines "$L" "$head")"
    echo "$id files byte-identical to $head at its landing: $(git -C "$W" diff --quiet "$head" "$L" -- $F && echo yes || echo "no: $(git -C "$W" diff --name-only "$head" "$L" -- $F | tr '\n' ' ')")"
    echo "$id commits after its landing touching its files: [$(git -C "$W" log --format=%h "$L..$S" -- $F | tr '\n' ' ')]"
    echo "$id trailers: [$(git -C "$W" log -1 --format=%B "$L" | grep -E '^(Item|Reviewed-by): ' | tr '\n' ';')]"; done
  echo "writing dev is an ancestor of the request: $(git -C "$W" merge-base --is-ancestor "$WROTE" "$S" && echo yes || echo no)"
  echo "first-parent commits from BASE to the request: $(git -C "$W" rev-list --first-parent --count "$BASE..$S"); after the writing dev: $(git -C "$W" rev-list --first-parent --count "$WROTE..$S")"
  others=0
  for c in $(git -C "$W" rev-list --first-parent --reverse "$BASE..$S"); do P=$(git -C "$W" diff --name-only "$c^1" "$c" | LC_ALL=C sort | tr '\n' ' ')
    it=$(git -C "$W" log -1 --format=%B "$c" | grep -E '^Item: ' | tr '\n' ' '); k=other
    if [ -n "$it" ]; then case "$it" in "Item: T-1832 "|"Item: T-1833 "|"Item: T-1834 ") k=member;; *) k="landing ${it#Item: }"; case " $ACCEPT " in *" $c "*) k="accepted ${it#Item: }";; esac;; esac
    else
      [ -n "$P" ] && ! printf '%s' "$P" | tr ' ' '\n' | grep -v -x '' | grep -q -v -x -E '\.cland/tasks/[^/]+\.md' && k=tracker
      [ "$P" = "hub/test/durations.json " ] && k=durations
      [ "$P" = "qa/briefs/E-1537-stage-4.md " ] && k=brief-only
      [ "$P" = "hub/test/durations.json qa/briefs/E-1537-stage-4.md " ] && k=brief-and-durations
    fi
    case "$k" in other|landing*) others=$((others+1));; esac
    echo "  commit $(git -C "$W" rev-parse --short=9 "$c") class $k trailers [$it] paths $(printf '%s' "$P" | wc -w | tr -d ' ')"
    case "$k" in durations|brief-and-durations) echo "    $(durdelta "$c")";; esac; done
  echo "commits of class other or unaccepted landing: $others"
}
s05() {   # T-1832 C3 and T-1833 C2 independently of the tests: the built CLI's help and the pool parser's keys (sealed; voc.mjs seals each child)
  node "$Q/fresh.mjs" "$Q" plain node "$Q/voc.mjs" "$W"
}
s06() {   # evidence to read, never to start: member verify receipts, merge-batch logs and candidates, the Coordinator's cover pair at the requested dev SHA
  for pair in "T-1832 71eba552a327a148aa95e3c8ff05e2c5bffaccdc" "T-1833 37a9884b416107215582281c3786a061dd1d19ff" "T-1834 a14379994c44c02f6af55eec7ac98db0beefee41"; do set -- $pair
    (cd "$R" && node "$W/hub/bin/cland.ts" task view "$1" --json) | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const v=JSON.parse(s).item.verify??{};console.log(process.argv[1]+" verify "+v.id+" executor "+v.executor+" state "+v.state+" result "+v.result+" artifact "+v.artifact+" head is the reviewed tip "+(v.head===process.argv[2]))})' "$1" "$2"; done
  # suites: the members' verifies (T-1832 cdbbfbb5, T-1833 c3509fac, T-1834 f88316e8), the merge-batch runs (fe0ff273's 661103e8, c3154209's 2200e1cb, ba1ed164's 28fe5bc3), then the stage covers from the plan
  for id in cdbbfbb5-5721-478e-84a5-1fbb49762204 c3509fac-6914-4e99-a0e3-17f5d7345bcd f88316e8-33d4-4841-87e5-a1c8a6c1ebb7 661103e8-89a0-4f42-b7f9-395179674b76 2200e1cb-2040-4e86-9db8-8e4924251930 28fe5bc3-9da6-4954-8a95-05e30a24d528 $(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8").split("\n")[0]);console.log([s.cover?.linux,s.cover?.macos].filter(Boolean).join(" "))' "$EV/stage-members.json"); do
    for f in $(ls "$R/.cland/artifacts" | grep -F -- "-suite-$id-"); do
      node -e 'const fs=require("fs"),t=fs.readFileSync(process.argv[1],"utf8"),line=t.split("\n").find(l=>l.startsWith("suite provenance "));let p={};try{p=JSON.parse(line.slice(17))}catch{}const L=t.split("\n"),fails=L.filter(l=>/^ℹ fail [1-9]/.test(l)).length,zero=L.filter(l=>/^ℹ fail 0$/.test(l)).length,tiers=L.filter(l=>/^tier (T[0-4]|Web): exit /.test(l)).map(l=>l.slice(5,l.indexOf(";"))).join(", "),batch=(t.match(/merge-batches\/([0-9a-f]{8})/)??[,"none"])[1];console.log(process.argv[2].slice(0,8)+" "+process.argv[1].split("/").pop().slice(0,7)+" head "+p.head+" occasion "+p.occasion+" executor "+p.executor+" os "+(p.platform??{}).os+" batch "+batch+" ["+tiers+"] failing phase lines "+fails+"; passing phase lines "+zero+"; head is the request "+(p.head===process.argv[3]))' "$R/.cland/artifacts/$f" "$id" "$S"; done; done
  # each batch candidate: its subject, and the paths in which its tree differs from its member's landing tree (only .cland/tasks/ is acceptable: tracker commits sit between)
  for pair in "T-1832 3a7085fa9df1216f208e6913a9b544ba47741c70" "T-1833 9021b76695bb5236c1a7beb37d6415ffcbb67993" "T-1834 09271f1bd8b780f703a7362f20cb6176aae8c79b"; do set -- $pair
    L=$(landing "$1" | head -n 1); echo "$1 candidate ${2:0:9} [$(git -C "$W" log -1 --format=%s "$2")] differs from the landing outside .cland/tasks/: [$(git -C "$W" diff --name-only "$2" "$L" | grep -v '^\.cland/tasks/' | tr '\n' ' ')]"; done
}
s07() {   # notes, index rows and tiers of the stage's new files; the closed-item wording lint over site Markdown (sealed); the qa lint delta T-1832 brought to E-616 and E-1313
  echo "per-test notes for hosts-docs-pool and skills-onboarding: $(git -C "$W" ls-tree --name-only "$S" docs/agents/tests/ | grep -c -E '^docs/agents/tests/hub-test-(hosts-docs-pool|skills-onboarding)\.test\.ts\.md$')"
  echo "index rows naming them: $(git -C "$W" show "$S:docs/agents/tests/index.md" | grep -c -E 'hub/test/(hosts-docs-pool|skills-onboarding)\.test\.ts`\]')"
  echo "tiers: $(git -C "$W" show "$S:hub/test/tiers.json" | grep -E '"hub/test/(hosts-docs-pool|skills-onboarding|remote-docs)\.test\.ts"' | tr -d ' ' | tr '\n' ' ')"
  node "$Q/fresh.mjs" "$W" plain node hub/test/lint-closed-item-wording.ts 2>&1 | node "$Q/pubw.mjs" "$EV/wording-lint.txt"; echo "closed-item wording lint exit ${PIPESTATUS[0]}"; grep -E '^closed-item wording lint: ' "$EV/wording-lint.txt"
  node "$Q/fresh.mjs" "$W" plain node -e 'const fs=require("fs");(async()=>{const s=new Set();for await (const p of fs.promises.glob(["**/README*.md","docs/**/*.md","site/src/content/docs/**/*.md"],{cwd:process.cwd(),exclude:["**/node_modules/**","**/.git/**","**/.cland/**"]}))s.add(p);console.log("QA count of the three globs "+s.size+"; site docs "+[...s].filter(p=>p.startsWith("site/src/content/docs/")).length+"; hosts page included "+s.has("site/src/content/docs/docs/hosts.md"))})()'
  for b in E-1313 E-616; do for c in 15ba0cef9e2123836e0bb1e3c01bac0647e0469d "$S"; do
    git -C "$W" show "$c:qa/briefs/$b.md" > "$Q/lint-$b-${c:0:9}.md"
    node "$Q/fresh.mjs" "$W" plain node hub/bin/cland.ts qa lint "$Q/lint-$b-${c:0:9}.md" --commit "$c" 2>&1 | sed -E 's#^[^ ]*\.md:[0-9]+: ##' | grep -v '^# fresh: ' | LC_ALL=C sort | node "$Q/pubw.mjs" "$Q/lint-$b-${c:0:9}.txt"; done
    echo "$b qa lint findings: before T-1832 $(grep -c . "$Q/lint-$b-15ba0cef9.txt"); at the build $(grep -c . "$Q/lint-$b-${S:0:9}.txt"); new at the build:"
    comm -13 "$Q/lint-$b-15ba0cef9.txt" "$Q/lint-$b-${S:0:9}.txt" | while IFS= read -r l; do echo "    $l (sha1 $(printf '%s' "$l" | shasum | cut -c1-12))"; done; done
}
s08() {   # R-4: web/dist is git-ignored; build it once in the QA worktree before any scratch row and confirm the stamp, the bundle state and a clean tree
  node "$Q/fresh.mjs" "$W" plain npm run build 2>&1 | node "$Q/pubw.mjs" "$EV/S0-build.txt"; echo "build exit ${PIPESTATUS[0]}"
  echo "HEAD $(git -C "$W" rev-parse HEAD); dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  node "$Q/fresh.mjs" "$W" plain node --input-type=module -e 'const fs=await import("node:fs");const s=JSON.parse(fs.readFileSync("web/dist/build-stamp.json","utf8"));console.log("stamp version "+s.version+"; sources "+String(s.sources).length+" hex; built "+new Date(s.builtAt).toISOString());const {webBundleState}=await import(process.env.QA_W+"/hub/src/web-bundle.ts");console.log("bundle state "+(await webBundleState(process.env.QA_W)).state)'
}
s86() {   # R-5: residue and fixture-owner receipts since the setup snapshot, for every row; nothing is removed here
  node "$Q/fresh.mjs" "$Q" plain node "$Q/res.mjs" "$EV/S0-inv"
}
s90() {   # rule 15 and R-1: every evidence file through the unchanged publication policy before publication, with a positive control
  node "$Q/fresh.mjs" "$Q" plain node "$Q/pubscan.mjs" "$EV"
}
s99() {   # end check with $Q and $T still present (cleanup order); replaces M3's s99 (this stage has no native row and takes no preservation slot)
  echo "POST HEAD $(git -C "$W" rev-parse HEAD) dev $(git -C "$R" rev-parse refs/heads/dev) request $S"
  echo "dirty entries $(git -C "$W" status --porcelain --untracked-files=all | grep -v -c -x '?? node_modules')"
  git -C "$R" status --porcelain | grep -v ' \.cland/tasks/' | node "$Q/pubw.mjs" "$EV/root-status-after.txt"; echo "root non-tracker status unchanged: $(cmp -s "$EV/root-status-before.txt" "$EV/root-status-after.txt" && echo yes || echo no)"
  echo "preservation lock owned by this run: $(grep -c -F "qa $RUN " /tmp/cland-preserve.lock/owner 2> /dev/null || echo 0)"
  echo "own-family new entries across all rows: $(cat "$EV"/*.inventory-delta.txt | awk -F': ' '/^own-family new entries in all files: /{s+=$2} END{print s+0}')"
  echo "other new entries across all rows: $(cat "$EV"/*.inventory-delta.txt | awk -F': ' '/^other new entries in all files: /{s+=$2} END{print s+0}')"
  echo "withheld or redacted lines across all captures: $(cat "$EV"/*.txt "$EV"/*.log 2> /dev/null | grep -E '^# (fresh|std): redacted or withheld lines [1-9]|^# pubw .*: withheld lines [1-9]' | wc -l | tr -d ' ')"
  echo "T entries other than node-compile-cache: $(ls -A "$T" | grep -v -c -x node-compile-cache)"
  for e in $(ls -A "$T" | grep -v -x node-compile-cache); do echo "  T: $e type $(stat -f %HT "$T/$e")"; done
  echo "recorded fake-host alias: $(cat "$Q/alias.txt" 2> /dev/null || echo none)"
}
SH
cat > "$Q/scratch.sh" <<'SH'
# this stage's scratch rows (E1537S4-80 to -84), sourced by the kit's body.sh inside fresh.mjs (hub mode), cwd p1; helpers.sh gives cland, up, alive, cnt, dg and machines
# R-1: every child inherits the fresh seal unchanged (no overlay, no env prefix); no output is written to a file: c4 and c4j keep it in shell variables and print through fresh.mjs
c4() { C4OUT=$(cland "$@" < /dev/null 2>&1); C4X=$?; }                 # one CLI call, stdout and stderr together, in memory only
c4j() { C4OUT=$(cland "$@" < /dev/null 2> /dev/null); C4X=$?; }        # one CLI call whose stdout is JSON; its stderr (narration) is dropped, not kept
show() { printf '%s\n' "$C4OUT" | head -n "${1:-12}" | sed 's/^/    /'; }
gate4() { echo "  gate: CLAND_ names outside the seal and the hub overlay $(node -e 'const ok=new Set(["CLAND_EXECUTOR_STATE","CLAND_DISCORD_API_ROOT","CLAND_TELEGRAM_API_ROOT","CLAND_ELEVENLABS_API_ROOT","CLAND_TEST_OWNED_ROOT","CLAND_TEST_SKIP_ORPHAN_SWEEP","CLAND_FAKE_HOST_ROOT","CLAND_SSH_BIN","CLAND_SCP_BIN","CLAND_OPENCODE_BIN"]);const x=Object.keys(process.env).filter(k=>k.startsWith("CLAND_")&&!ok.has(k));console.log(x.length+(x.length?" ("+x.join(" ")+")":""))'); cwd is p1 $([ "$(pwd -P)" = "$QA_Q/p1" ] && echo yes || echo no)"; }
pid4() { printf '%s\n' "$C4OUT" | sed -n 's/^hub started for .* (pid \([0-9][0-9]*\))$/\1/p' | tail -n 1; }
rows4() { printf '%s' "$C4OUT" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{const v=JSON.parse(s);console.log(Array.isArray(v)?v.filter(r=>r.state!=="destroyed").length:"not an array")}catch{console.log("not JSON")}})'; }
r100() {   # p1: a Git repository, cland init, the existing fake pool "first" (min_hosts 0) written while the hub is stopped, then one CLI-started hub (the page's "Start with a running hub, a cland-managed config file and an existing pool")
  echo "PRE p1 entries $(ls -A "$QA_Q/p1" | wc -l | tr -d ' ')"
  cd "$QA_Q/p1" || return 1
  gate4
  git init -q -b dev && git commit -q --allow-empty -m init; echo "git exit $?"
  c4 init .; echo "init exit $C4X; output lines $(printf '%s\n' "$C4OUT" | wc -l | tr -d ' ')"; p=$(pid4); [ -n "$p" ] && echo "$p" >> "$QA_Q/pids"
  c4 hub stop; echo "hub after init and stop: $(up)"
  echo "managed config present: $(there .cland/config.toml); pool tables before: first $(cnt .cland/config.toml '[hosts.first]'), second $(cnt .cland/config.toml '[hosts.second]'), agents $(cnt .cland/config.toml '[hosts.agents]')"
  printf '%s\n' '' '[hosts.first]' 'provider = "fake"' 'min_hosts = 0' >> .cland/config.toml
  echo "pool first written: $(cnt .cland/config.toml '[hosts.first]')"
  c4 hub start; echo "hub start exit $C4X; hub $(up)"; p=$(pid4); [ -n "$p" ] && echo "$p" >> "$QA_Q/pids"; echo "  hub pid recorded: $([ -n "$p" ] && echo yes || echo no)"
  c4j host list --json; echo "(host list json) exit $C4X; host rows $(rows4)"
  c4 host status; echo "(host status) exit $C4X"; show 4
  echo "fake machines $(machines); host leases $(ls -A .cland/run/host-leases 2> /dev/null | wc -l | tr -d ' ')"
}
r101() {   # T-1833 C3 and the stage demo: the page's marked blocks, read from the page at the build, run in order from p1 with <provider> = fake, split on whitespace as hub/test/hosts-docs-pool.test.ts does
  cd "$QA_Q/p1" || return 1
  gate4
  P="$QA_W/site/src/content/docs/docs/hosts.md"
  STEPS=$(awk '/^```sh host-pool$/{f=1;next} f&&/^```$/{f=0} f&&NF&&!/^#/' "$P")
  T2=$(node --input-type=module -e 'const m=await import(process.env.QA_W+"/site/test/hosts-docs-source.ts");console.log(m.poolSteps(m.source(m.hostsPath)).join("\n"))')
  echo "marked steps read by QA: $(printf '%s\n' "$STEPS" | grep -c .); equal to the T2 parser's steps: $([ "$STEPS" = "$T2" ] && echo yes || echo no)"
  printf '%s\n' "$STEPS" | sed 's/^/    page step: /'
  echo "second pool tables before: $(cnt .cland/config.toml '[hosts.second]')"
  k=0; fails=0; STATUS=''
  while IFS= read -r line; do
    k=$((k+1))
    case "$line" in "cland "*) ;; *) echo "  step $k is not a cland command"; fails=$((fails+1)); continue;; esac
    set -f; set -- $(printf '%s' "${line#cland }" | sed 's/<provider>/fake/'); set +f
    c4 "$@"; echo "  step $k: cland $* | exit $C4X"; [ "$C4X" = 0 ] || { fails=$((fails+1)); show 6; }
    [ "$line" = "cland host status" ] && STATUS=$C4OUT
  done <<< "$STEPS"
  echo "steps run $k; steps not exiting 0: $fails"
  printf '%s\n' "$STATUS" | sed 's/^/    status: /'
  echo "status lists first with 0 hosts and slots 0/0: $(printf '%s\n' "$STATUS" | grep -c '^first: 0 hosts · slots 0/0 ')"
  echo "status lists second with 0 hosts and slots 0/0: $(printf '%s\n' "$STATUS" | grep -c '^second: 0 hosts · slots 0/0 ')"
  node --input-type=module -e 'const {parseConfig}=await import(process.env.QA_W+"/hub/src/init/config.ts");const fs=await import("node:fs");const c=parseConfig(fs.readFileSync(".cland/config.toml","utf8"),"p1");const got=c.hosts.pools.second;const want={provider:"fake",size:"s-4vcpu-8gb",region:"lon1",transport:"ssh",slots:8,minHosts:0,maxHosts:2,idleStop:"20m",idleStopMs:1200000,spread:false};console.log("saved second pool: "+JSON.stringify(got));console.log("saved second pool equals the T2 test settings: "+(JSON.stringify(got)===JSON.stringify(want)));console.log("pools saved: "+Object.keys(c.hosts.pools).sort().join(", "))'
  c4j host list --json; echo "(host list json) exit $C4X; host rows $(rows4)"
  echo "fake machines $(machines); host leases $(ls -A .cland/run/host-leases 2> /dev/null | wc -l | tr -d ' '); image record second $(there .cland/run/hosts/second-image.json); hub $(up)"
}
r102() {   # the page's documented unattended behaviour on the CLI: no agents pool and no role placed on agents (untouched), no terminal: skip with the exact commands, nothing written
  cd "$QA_Q/p1" || return 1
  gate4
  b1=$(dg .cland/config.toml); b2=$(dg .cland/roles.toml); hb=$(ls -A "$QA_Q/home" | LC_ALL=C sort | shasum | cut -c1-12)
  echo "agents pool tables: $(cnt .cland/config.toml '[hosts.agents]'); roles placed on agents: $(cnt .cland/roles.toml 'pool = "agents"')"
  c4j setup --json --no-aide --no-accounts; echo "(setup json, no terminal) exit $C4X (not a pass condition)"
  printf '%s' "$C4OUT" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log("  setup: not JSON");return}const n=v.steps.map(x=>x.name),r=v.steps.find(x=>x.name==="agent hosts");console.log("  agent hosts | "+(r?.verdict??"missing")+" | "+(r?.detail??"-")+" | "+(r?.fix??"-"));console.log("  agent hosts image or login rows: "+v.steps.filter(x=>x.name.startsWith("agent hosts ")).length);console.log("  order: "+n.join(", "));console.log("  after speech "+(n.indexOf("agent hosts")>n.indexOf("speech"))+"; before aide "+(n.indexOf("agent hosts")<n.indexOf("aide")))})'
  echo "config.toml unchanged $([ "$(dg .cland/config.toml)" = "$b1" ] && echo yes || echo no); roles.toml unchanged $([ "$(dg .cland/roles.toml)" = "$b2" ] && echo yes || echo no); HOME entries unchanged $([ "$(ls -A "$QA_Q/home" | LC_ALL=C sort | shasum | cut -c1-12)" = "$hb" ] && echo yes || echo no)"
}
r103() {   # the page's role placement command, then doctor's host lines on this hub mapped onto the page's doctor table (T-1833 C1 role placement, C4 "as built")
  cd "$QA_Q/p1" || return 1
  gate4
  c4 role launch implementer --pool second; echo "(role launch implementer --pool second) exit $C4X"; show 3
  c4 hub reload; echo "(hub reload) exit $C4X"
  c4j role list --json; H=$(printf '%s' "$C4OUT" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{const x=JSON.parse(s).roles.find(r=>r.role==="implementer");console.log(x.launch.harness+" "+x.launch.pool)}catch{console.log("unknown unknown")}})')
  echo "implementer launch: harness ${H% *}; pool ${H#* }"
  c4j doctor --json; echo "(doctor json) exit $C4X (not a pass condition: rows outside the hosts block may warn)"
  printf '%s' "$C4OUT" | node -e 'const fs=require("fs");let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log("  doctor: not JSON");return}const page=fs.readFileSync(process.env.QA_W+"/site/src/content/docs/docs/hosts.md","utf8");const table=new Set([...page.matchAll(/^\| `(host[^`]*)` \|/gm)].map(m=>m[1]));const fixed=new Set(["host","image","token","login","logins","reachability","spend"]);const rows=v.checks.filter(c=>c.name==="hosts"||c.name.startsWith("host "));let unmapped=0;for(const c of rows){const t=c.name.split(" ").map(w=>fixed.has(w)?w:"<name>").join(" ");const m=table.has(t);if(!m)unmapped++;console.log("  row "+c.name+" | "+c.verdict+" | "+c.detail+" | "+(c.fix??"-")+" | page line "+(m?t:"none"))}console.log("  host rows "+rows.length+"; rows without a page line "+unmapped+"; page table lines "+table.size)})'
  c4 host status; echo "(host status) exit $C4X"; show 4
  c4j host list --json; echo "(host list json) exit $C4X; host rows $(rows4)"
  echo "fake machines $(machines); host leases $(ls -A .cland/run/host-leases 2> /dev/null | wc -l | tr -d ' ')"
}
sr4() {    # every agent hosts row of the setup JSON report in C4OUT, and each one's page sentence (the page's setup paragraph, whitespace-normalised)
  printf '%s' "$C4OUT" | node -e 'const fs=require("fs");let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log("  setup: not JSON");return}const page=fs.readFileSync(process.env.QA_W+"/site/src/content/docs/docs/hosts.md","utf8").replace(/\s+/g," ");const says={"agent hosts open placement":"an `agents` pool without placed roles reads `open` without a terminal with `agent hosts need role placement`","agent hosts open roles":"Otherwise its main `agent hosts` row reads `open` without a terminal","offer open":"offers read `open` without a terminal"};const rows=v.steps.filter(x=>x.name.startsWith("agent hosts"));for(const r of rows){const k=r.name==="agent hosts"?(r.verdict==="open"&&r.detail==="agent hosts need role placement"?"agent hosts open placement":r.verdict==="open"&&/^agents; roles /.test(r.detail)?"agent hosts open roles":"none"):(r.verdict==="open"?"offer open":"none");console.log("  "+r.name+" | "+r.verdict+" | "+r.detail+" | "+(r.fix??"-")+" | page sentence "+(k==="none"?"none":"present "+page.includes(says[k])))}const n=v.steps.map(x=>x.name);console.log("  agent hosts rows "+rows.length+"; aide after them "+(n.lastIndexOf("aide")>n.lastIndexOf(rows.at(-1)?.name)))})'; }
r104() {   # T-1834's setup paragraph on the CLI, for the cases a scratch hub with the fake provider reaches without a terminal: an agents pool without placed roles, then with the Implementer placed
  cd "$QA_Q/p1" || return 1
  gate4
  c4 hub stop; echo "hub stop exit $C4X; hub $(up)"
  echo "agents pool tables before: $(cnt .cland/config.toml '[hosts.agents]')"
  printf '%s\n' '' '[hosts.agents]' 'provider = "fake"' 'min_hosts = 0' >> .cland/config.toml
  echo "agents pool written (fake, min_hosts 0): $(cnt .cland/config.toml '[hosts.agents]')"
  c4 hub start; echo "hub start exit $C4X; hub $(up)"; p=$(pid4); [ -n "$p" ] && echo "$p" >> "$QA_Q/pids"
  b1=$(dg .cland/config.toml); b2=$(dg .cland/roles.toml)
  c4j setup --json --no-aide --no-accounts; echo "(setup json, no terminal, agents pool without placed roles) exit $C4X (not a pass condition)"; sr4
  echo "setup 1 left config.toml and roles.toml unchanged: $([ "$(dg .cland/config.toml)" = "$b1" ] && [ "$(dg .cland/roles.toml)" = "$b2" ] && echo yes || echo no)"
  c4 role launch implementer --pool agents; echo "(role launch implementer --pool agents) exit $C4X"
  c4 hub reload; echo "(hub reload) exit $C4X"
  c4j role list --json; H=$(printf '%s' "$C4OUT" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{const x=JSON.parse(s).roles.find(r=>r.role==="implementer");console.log(x.launch.harness+" "+x.launch.pool)}catch{console.log("unknown unknown")}})')
  echo "implementer launch: harness ${H% *}; pool ${H#* }"
  b1=$(dg .cland/config.toml); b2=$(dg .cland/roles.toml)
  c4j setup --json --no-aide --no-accounts; echo "(setup json, no terminal, implementer placed on agents) exit $C4X (not a pass condition)"; sr4
  echo "setup 2 left config.toml and roles.toml unchanged: $([ "$(dg .cland/config.toml)" = "$b1" ] && [ "$(dg .cland/roles.toml)" = "$b2" ] && echo yes || echo no)"
  c4j host list --json; echo "(host list json) exit $C4X; host rows $(rows4)"
  echo "fake machines $(machines); host leases $(ls -A .cland/run/host-leases 2> /dev/null | wc -l | tr -d ' '); image record agents $(there .cland/run/hosts/agents-image.json); project logins $(c4j login list --json; printf '%s' "$C4OUT" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{console.log(JSON.parse(s).length)}catch{console.log("not JSON")}})')"
}
r105() {   # stop the scratch hub; record the fake-host alias if one exists; the census with R-7's watchdog identity before any TERM (no host was created, so none is expected)
  cd "$QA_Q/p1" || return 1
  c4 hub stop; echo "hub stop exit $C4X; hub $(up)"
  for p in $(sort -u "$QA_Q/pids"); do echo "recorded hub pid $p alive $(alive "$p")"; done
  al=$(node -e 'const fs=require("fs");let t;try{t=fs.realpathSync(process.env.QA_Q+"/fh/.fixture-sockets")}catch{process.exit(0)}for(const n of fs.readdirSync("/private/tmp")){if(!/^ct-[0-9a-f]{32}$/.test(n))continue;const f="/private/tmp/"+n;try{if(fs.lstatSync(f).isSymbolicLink()&&fs.realpathSync(f)===t)console.log(f)}catch{}}')
  [ -n "$al" ] && printf '%s\n' "$al" > "$QA_Q/alias.txt"; echo "fake-host aliases resolving to this run's sockets: $(printf '%s' "$al" | grep -c .)"
  node "$QA_Q/census4.mjs" "$al"
}
SH
. "$Q/checks.sh"; bash -n "$Q/checks.sh" && bash -n "$Q/scratch.sh" && echo "checks and scratch checked"
```

Expected: `expect checked: files 9; exact lists 15 7 3 22 33 1`, `helpers checked` with no `BLOCKED` line, `checks and scratch checked`.

**Publication precheck (R-3/R-6), run before the brief is committed and again in E1537S4-04.** `pub.mjs` runs every expected title in `expect.json` and every line of this brief through the unchanged `assertPublishable`, and lists the lines holding a fragment that a runtime value could complete into a refusal. At completion (VERIFIED: `node pub.mjs <archive of 1114abeff> expect.json <this file>`, with the policy imported from the archive, T-1834's titles and lines included): `expected titles 82; refused 0`, `brief lines 989; refused 0; with a joinable fragment 0`, `positive control refused: true`, and no `brief line` or `refused title` line. The stage's fixed helper output lines are lines of this brief, so they are covered; their runtime values are host ids, pool names, harness names, counts, prices, paths and commands, none of which follows a refused prefix.

**Cleanup, in this order.** Step 1, after E1537S4-90 passes: if `$Q/alias.txt` exists, print it, check that it is a symlink named `/private/tmp/ct-` plus 32 hex resolving to the realpath of `$Q/fh/.fixture-sockets`, and remove that symlink by its literal path (none is expected); inventory `$T` (`ls -A "$T"`) and remove by literal path the dead T-1676 residue there only (`rm -r` for a directory). Step 2: E1537S4-99 with `$Q` and `$T` present. Step 3, after the verdict: `git -C "$R" worktree remove "$W"` (through the wrapper; its `node_modules` symlink first if Git refuses; `web/dist` is ignored and goes with the worktree), then `unset -f git`, then remove `$Q` and `$T` by their printed literal paths (prefix checks `/private/tmp/q53-` and `/private/tmp/qa-e1533-s3-`; `$T` holding nothing but `node-compile-cache`). Nothing in `$ST` or `/private/tmp` outside `$Q`, `$T` and the recorded alias is removed, ever (the T-1805 receipts and T-1806 directories included). If any inventory shows a new own-family name, nothing is removed.

## Cases

Every case is one or more named test files run once at the build, from QA's own shell through the kit's `nt` (sealed, `TMPDIR=$T`, one file at a time), recorded with `qa-record.sh note` (surface `hub-api`), with the evidence files `$EV/<id>.log`, `$EV/<id>.check.txt` and `$EV/<id>.inventory-delta.txt`. A case passes only when every check line reads `CLEAN`, its delta reads `own-family new entries in all files: 0`, and the log's `# fresh: redacted or withheld lines` lines all read 0 (R-1). A missing file is a FAIL naming it. A skipped test is a FAIL, never a pass. Run in table order after E1537S4-08; never two files at once. Tiers are read from `hub/test/tiers.json` at `1114abeff` (VERIFIED); the site guard files are outside `tiers.json` and run in the site prebuild and through the T1 wrapper. A slow but positive file is recorded with its wall time.

| case | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1537S4-10 | hub-api | QA | `nt E1537S4-10 hub/test/skills-onboarding.test.ts` | `CLEAN hub/test/skills-onboarding.test.ts run 1 plan 15` with its exact list of 15 titles (T2; edited by T-1832; component cases use `tempProject` and `projectHub` in the seal): `the onboarding tour has ten stages ending with Look now` (ten stages, the ninth ending on the Remotes row, the tenth on the Hosts row, one final Look now each, SKILL.md `ten stages`, the tenth stage's facts, `commandProblems(hosts)` empty), `remote tour explains voice notes and the hidden speech key command` (its read now stops before stage ten), `onboarding names only shipped commands or explicitly pending release work` and `the onboarding command check rejects unknown commands, config keys and secret names` (the command check and its negative controls), and the eleven unedited titles. `own-family new entries in all files: 0`. (T-1832 C1, C2, C3) |
| E1537S4-11 | hub-api | QA | `nt E1537S4-11 site/test/hosts-docs.test.ts site/test/onboarding-claims.test.ts site/test/remote-docs.test.ts` | Each `CLEAN` with its exact list: `site/test/hosts-docs.test.ts` plan 7 (new by T-1833, three titles added by T-1834): `hosts vocabulary guard rejects invented command, flag and setting`, `hosts guide is linked under Features and covers the built host and login workflow`, `hosts guide quotes emitted waiting reasons and doctor/setup rows`, `hosts guide defaults match the shared pool parser and slot policy`, `hosts price table dates public pool rates and computes default host-hours`, `hosts storage table matches provider declared GiB-month rates without native imports`, `CLI Hosts and logins lists exactly the built usage subcommands`; `site/test/onboarding-claims.test.ts` plan 3 (unedited); `site/test/remote-docs.test.ts` plan 22 (unedited consumer of the sidebar and the features overview T-1833 edits; its loop expands to `landing feature …`, `README feature …` and `Features entry names both shipped remotes and links their guide`). These are the site's prebuild guards run directly, as the site's `npm test` runs them. (T-1833 C1, C2, C4; T-1834 C1, C2, C3) |
| E1537S4-12 | hub-api | QA | `nt E1537S4-12 hub/test/remote-docs.test.ts` | `CLEAN hub/test/remote-docs.test.ts run 1 plan 33` with its exact list (T1; edited by T-1833 to import `site/test/hosts-docs.test.ts`; it also imports `site/test/onboarding-claims.test.ts` and `site/test/remote-docs.test.ts`, so its plan holds 3 + 7 + 22 + 1 titles, T-1834's three included, the last `site vocabulary extraction matches the runtime config and secret names`). This is how mode-free task selection runs the site guards. (T-1833 C1, C2; T-1834 C1, C2, C3) |
| E1537S4-13 | hub-api | QA | `nt E1537S4-13 hub/test/hosts-docs-pool.test.ts` | `CLEAN hub/test/hosts-docs-pool.test.ts run 1 plan 1` with `published pool commands configure a second fake pool and host status lists it` (T2; new by T-1833; a `tempProject` with a rendered managed config and a fake `first` pool, `projectHub` with `CLAND_FAKE_HOST_ROOT` and a FakeClock, every marked step through the harness CLI with `<provider>` as `fake`, the status `first: 0 hosts` and `second: 0 hosts … slots 0/0`, the persisted `second` pool deep-equal to its settings). `own-family new entries in all files: 0`. (T-1833 C3) |
| E1537S4-14 | hub-api | QA | `nt E1537S4-14 hub/test/suite-task-selection.test.ts hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts` | Each `CLEAN` (T1 each; unedited, VERIFIED `preserved`): `suite-task-selection` includes `mode-free docs and site selections include every site prebuild guard` (the prebuild guard inventory against the wrapper imports, the check that failed T-1833's first evidence run); `test-docs` checks every test file's index row and per-test note (the new `hub/test/hosts-docs-pool.test.ts` row and note) and its consumers, `qa/briefs` included; `suite-tiers` checks every test file's tier (`hub/test/hosts-docs-pool.test.ts` `T2`). (T-1833's selection, index and tier contract) |

### Web cases (when in scope)

none. Neither landed member touches `web/` or `nvim/` (E1537S4-02), and the stage's checks need no browser or workbench (see "Out of scope" for the rendered Hosts rows and the rendered site).

## Manual checks

Every check is recorded with `qa-record.sh note` under E-1537 and `$RUN`, surface `hub-api`, with its evidence file. Run them in this order: E1537S4-00 to -08, then the cases above, then E1537S4-80 to -86, -90, cleanup step 1, -99. `mrow` runs one scratch function in a fresh hub seal (cwd p1) after cover-quiet admission and the load gate, and writes `$EV/<id>.txt` from `fresh.mjs`'s redacted output; its last line is `row exit <n>`. Every scratch row passes only when its `# fresh: redacted or withheld lines` line reads 0 and its gate line reads `CLAND_ names outside the seal and the hub overlay 0` and `cwd is p1 yes` (body.sh's own `PRE gate` line must read credential-prefix names 0, `QA_SESSION set yes`, `HOME is Q/home yes`, `TMPDIR is T yes`, `fake host root yes`, and the fake `ssh`, `scp` and stub `npm`).

| id | surface | role | command | expected |
| --- | --- | --- | --- | --- |
| E1537S4-00 | hub-api | QA | `s00 > "$EV/E1537S4-00.txt" 2>&1` | PRE line: HEAD, dev and request the same 40 hex; `dirty entries 0`; `root non-tracker entries <n>` (recorded; E1537S4-99 compares); `plan read exit 0`; the stage line with name `the tour and the hosts docs`, `qa` `{"scope":"affected","when":"after-stage"}`, `items` `["T-1832","T-1833","T-1834"]`, `lanes` `[["T-1832"],["T-1833","T-1834"]]`, `merged` equal to `total` (3), `statuses` `{"done":3}`, and a `cover` with `linux` and `macos` ids and `missing` `[]`; `earlier stages:` all three `closed`; each member `landings 1 <sha>` and `state closed; status done; claim none; qaPolicy {"scope":"affected","when":"after-stage"}; qaCriteria []; criteria checked 3 of 3` (T-1832), `4 of 4` (T-1833), `3 of 3` (T-1834) (VERIFIED at `1114abeff`); each `# pubw … withheld lines 0`. A missing landing, a non-closed member or a cover missing a platform is BLOCKED. |
| E1537S4-01 | hub-api | QA | `s01 > "$EV/E1537S4-01.txt" 2>&1` | Node `v24.…`; `typecheck exit 0` (the root `typecheck`: `hub`, `nvim`, `shared/wire` and the web workspace); `dirty entries 0`. |
| E1537S4-02 | hub-api | QA | `s02 > "$EV/E1537S4-02.txt" 2>&1` | Every landing `package.json and lockfiles: 0` and `preserved files edited at its landing: []`; `preserved files changed in the stage: []`; `stage paths under hub/src, shared, web or nvim: []`; T-1832, T-1833 and T-1834 each `own lines … equal its tip …: yes` and `files byte-identical … at its landing: yes`; `commits after its landing touching its files`: T-1832 `[1114abeff ]` (the stage-4 durations refresh touches `hub/test/durations.json`), T-1833 `[6cc0fa816 ]` (T-1834's landing), T-1834 `[]`; trailers `[Item: T-1832;Reviewed-by: rev-35 (rev-35-1832-final-1);]`, `[Item: T-1833;Reviewed-by: rev-36 (rev-36-1833-final-1);]` and `[Item: T-1834;Reviewed-by: rev-35 (rev-35-1834-final-1);]`; `writing dev is an ancestor of the request: yes`. Commit classes (VERIFIED at `1114abeff`, 11 first-parent commits after `BASE`): `8e137459a tracker` (4 paths), `9f6afca80 durations` with `entries outside allow changed or removed 0; added 63; allowances removed 0; changed 0 …; added 0; version same true` (the stage-3 cover add-only refresh), `15ba0cef9 tracker` (4), `0d1390dde member [Item: T-1832 ]` (7), `ec5f96d10 tracker` (2), `5cd48f9de member [Item: T-1833 ]` (13), `0a5e25c7d tracker` (1), `c8b3b3c5a tracker` (2; T-1861 filed), `6cc0fa816 member [Item: T-1834 ]` (4), `5c81cfc54 tracker` (1), `1114abeff durations` with `entries outside allow changed or removed 0; added 3; allowances removed 0; changed 0 …; added 0; version same true` (the stage-4 add-only refresh); every later commit `member`, `tracker`, `durations` (add-only or renewal lines, no allowance removed), `brief-only` or `brief-and-durations` (this brief's commit); `commits of class other or unaccepted landing: 0`. Any `other` or unaccepted `landing` is BLOCKED (stage-2 R-1). |
| E1537S4-03 | hub-api | QA | `node "$Q/src.mjs" "$W" > "$EV/E1537S4-03.txt" 2>&1` | Every line `ok`, 129 in all (VERIFIED over a `git archive` of `1114abeff`): T-1832's 34 lines from `ok T-1832 C1 the tour has ten numbered stages` to `ok T-1832 the per-test note`, T-1833's 69 from `ok T-1833 C1 the page is in the Features sidebar group` to `ok T-1833 the T2 note points QA at the published steps`, T-1834's 26: eleven setup-paragraph lines (from `ok T-1834 setup paragraph: a pool without placed roles, no terminal: open, …` to `ok T-1834 setup builds that open before placement`, among the T-1833 lines) and fifteen price-table, storage and CLI-reference lines from `ok T-1834 C1 the table names its check date` to `ok T-1834 the per-test note section`. Each line names its file, count and wanted count; a `MISMATCH` or `MISSING` line is a FAIL of the criterion it names. |
| E1537S4-04 | hub-api | QA | `{ node "$Q/ids.mjs" "$W/qa/briefs/E-1537-stage-4.md"; node "$Q/fresh.mjs" "$W" plain node "$Q/pub.mjs" "$W" "$Q/expect.json" "$W/qa/briefs/E-1537-stage-4.md"; } > "$EV/E1537S4-04.txt" 2>&1` | `missing from the tables: 0` and `open T-1834 markers: 0` (a non-zero marker count is BLOCKED); the precheck at the build: `expected titles <n>; refused 0`, `brief lines <n>; refused 0; with a joinable fragment 0`, `positive control refused: true`, no `brief line` or `refused title` line (R-3/R-6). |
| E1537S4-05 | hub-api | QA | `s05 > "$EV/E1537S4-05.txt" 2>&1` | VERIFIED over a `git archive` of `1114abeff` with the same script: `tour stage 10: distinct cland commands 6; not in the built help 0`; `hosts page: distinct cland commands 25; not in the built help 0`; `negative control: an invented host subcommand rejected true; an invented flag rejected true`; `helps read:` each command `exit 0` (`login`, `setup`, `config`, `role`, `hub`, `host`, `doctor`); `tour stage 10: hosts keys 0; not pool or global keys 0`; `hosts page: hosts keys 22; not pool or global keys 0`; **T-1834 C3:** `CLI Hosts and logins: section found true; listed 16; built usage subcommands 16; missing []; extra []; duplicates []; equal true` (the built `cland host --help` names `host create`, `status`, `stop`, `list`, `prepare`, `destroy`, `revoke`, `git-proxy`, `attach`, `serve`; `cland login --help` names `login signin`, `remove`, `set`, `snapshot`, `list`, `add`) and `CLI negative controls: an extra command changes the list true; a duplicate changes the list true`; **T-1834 C1:** `price table: check date line true; default sub-cap 3`, `price row agents: size s-4vcpu-8gb equals the parser default true; hourly 0.07143 equals monthly / 672 to 5 places true; host-hours 42.00 on the page true` and the same line for `qa`; **T-1834 C2** (the declaration read as text, never imported): `storage Login volume: declared 0.1; table 0.1; equal true`, `storage Volume snapshot: declared 0.06; table 0.06; equal true`; `setup's declared default hourly 0.0714 equals the table's agents hourly to 4 places true`; `# fresh: redacted or withheld lines 0`. (T-1832 C3, T-1833 C2, T-1834 C1 to C3, independently of the tests) |
| E1537S4-06 | hub-api | QA | `s06 > "$EV/E1537S4-06.txt" 2>&1` (after E1537S4-00; reads only) | **Member verify receipts** (VERIFIED at `1114abeff`): `T-1832 verify cdbbfbb5-5721-478e-84a5-1fbb49762204 executor droplet state finished result passed artifact A-19454 head is the reviewed tip true`; `T-1833 verify c3509fac-6914-4e99-a0e3-17f5d7345bcd … artifact A-19456 head is the reviewed tip true`; `T-1834 verify f88316e8-33d4-4841-87e5-a1c8a6c1ebb7 … artifact A-19470 head is the reviewed tip true`. **Suite logs:** `cdbbfbb5 A-19454`, `c3509fac A-19456` and `f88316e8 A-19470` (SHA-1 `5fed25756409ed413aeec4cbfadd85cc15f8fde0`): `occasion null executor droplet os linux batch none [T0: exit 0, T1: exit 0, T2: exit 0, Web: exit 0] failing phase lines 0; passing phase lines 4`; `661103e8 A-19459` and `A-19460` (equal SHA-1 `08c3ae6525ffe110e03be98d41e776f997002402`): `occasion batch executor droplet os linux batch fe0ff273 [T0: exit 0, T1: exit 0, T3: exit 0] failing phase lines 0; passing phase lines 3`; `2200e1cb A-19461` and `A-19462` (equal SHA-1 `07f07e280976369614a610d43f2d965370e97291`): the same with `batch c3154209`; `28fe5bc3 A-19472` and `A-19473` (equal SHA-1 `5d57d91d1c4505fc8e5fc8e8fbe3d05bff4f47e9`): the same with `batch ba1ed164`. **Candidates:** `T-1832 candidate 3a7085fa9 [Batch candidate T-1832] differs from the landing outside .cland/tasks/: []`, `T-1833 candidate 9021b7669 [Batch candidate T-1833] … []`, `T-1834 candidate 09271f1bd [Batch candidate T-1834] … []`. **Stage covers** (the plan's `cover.linux` and `cover.macos`, read from the plan at the request): each log `head` equal to the request (`head is the request true`), the Linux log `occasion stage executor droplet os linux`, the macOS log `executor local os darwin`, each `failing phase lines 0`, T0 to T3, T4 and Web each `exit 0` where the log has them; their skips are only the named platform skips each log's provenance lists. A missing or red cover is BLOCKED (QA never starts one). |
| E1537S4-07 | hub-api | QA | `s07 > "$EV/E1537S4-07.txt" 2>&1` | `per-test notes for hosts-docs-pool and skills-onboarding: 2`; `index rows naming them: 2`; `tiers: "hub/test/hosts-docs-pool.test.ts":"T2", "hub/test/remote-docs.test.ts":"T1", "hub/test/skills-onboarding.test.ts":"T2",` (VERIFIED at `1114abeff`); `closed-item wording lint exit 0` with `closed-item wording lint: fixture diagnostics passed` and `closed-item wording lint: <n> documents, <m> tracker items, 0 findings`, where `<n>` equals the next line's `QA count of the three globs <n>` and that line reads `hosts page included true` (VERIFIED at `1114abeff`: 768 documents, 1860 tracker items, 12 site docs, 0 findings; the count changes with every docs commit, so compare the two lines, never 768); the qa lint deltas: `E-1313 qa lint findings: before T-1832 6; at the build 7; new at the build:` followed by exactly one line, the skills-onboarding per-test note's path read as a test file `… is absent from the build` with `(sha1 9500e1078706)` (T-1861, recorded, not a failure), and `E-616 qa lint findings: before T-1832 6; at the build 6; new at the build:` followed by nothing (VERIFIED at `15ba0cef9` and `1114abeff`; T-1834 edits neither brief); each `# pubw … withheld lines 0`. (T-1833 C4; T-1832's replay notes) |
| E1537S4-08 | hub-api | QA | `s08 > "$EV/E1537S4-08.txt" 2>&1` (before any scratch row) | **R-4.** `build exit 0` (`$EV/S0-build.txt` holds the build output, `# pubw S0-build.txt: withheld lines 0`); `HEAD <S>; dirty entries 0`; `stamp version 1; sources 64 hex; built <now>`; `bundle state current` (INFERRED from stage 3's R-4 run). A failed build is BLOCKED, never a product failure. |
| E1537S4-80 | hub-api | Human | `mrow E1537S4-80 r100` | **The page's preconditions on a scratch project.** `PRE p1 entries 0`; the gate line; `git exit 0`; `init exit 0`; `hub after init and stop: down`; `managed config present: present; pool tables before: first 0, second 0, agents 0`; `pool first written: 1`; `hub start exit 0; hub up` and `hub pid recorded: yes`; `(host list json) exit 0; host rows 0`; `(host status) exit 0` with `    first: 0 hosts · slots 0/0 · today …` (the spend figures INFERRED `$0.0000`; not a pass condition); `fake machines 0; host leases 0`; `row exit 0`. |
| E1537S4-81 | hub-api | Human | `mrow E1537S4-81 r101` | **T-1833 C3 and the stage demo: a pool configured from a fresh reading of the page.** `marked steps read by QA: 10; equal to the T2 parser's steps: yes`, then the ten `page step:` lines exactly `cland config set hosts.second.provider <provider>`, `… size s-4vcpu-8gb`, `… region lon1`, `… slots 8`, `… min_hosts 0`, `… max_hosts 2`, `… idle_stop 20m`, `… spread false`, `cland hub reload`, `cland host status` (VERIFIED at `0a5e25c7d` and re-read at `1114abeff`: T-1834's landing leaves the marked block unchanged); `second pool tables before: 0`; ten `step <k>: cland … | exit 0` lines with `<provider>` replaced by `fake`; `steps run 10; steps not exiting 0: 0`; the `status:` lines; `status lists first with 0 hosts and slots 0/0: 1`; `status lists second with 0 hosts and slots 0/0: 1`; `saved second pool: {"provider":"fake","size":"s-4vcpu-8gb","region":"lon1","transport":"ssh","slots":8,"minHosts":0,"maxHosts":2,"idleStop":"20m","idleStopMs":1200000,"spread":false}` and `saved second pool equals the T2 test settings: true` (the T2 test's deep-equal, VERIFIED against `readHostPools` at `0a5e25c7d`; `hub/src/host/pools.ts` unchanged to `1114abeff`); `pools saved: first, second`; `(host list json) exit 0; host rows 0`; `fake machines 0; host leases 0; image record second absent; hub up` (the page: "these commands configure capacity without preparing an image or creating a machine"); `row exit 0`. Compare with E1537S4-13: the same steps, the same status lines and the same saved pool. |
| E1537S4-82 | hub-api | Human | `mrow E1537S4-82 r102` | **The page's untouched unattended sentence on the CLI** ("Without a terminal and without `--yes`, untouched hosts read `skip` and include exact configuration/placement/reload commands", as T-1834 qualified it). `agents pool tables: 0; roles placed on agents: 0` (untouched); `(setup json, no terminal) exit <n>` (not a pass condition: other steps of the scratch machine may be open); `  agent hosts \| skip \| optional agent hosts; cland config set hosts.agents.provider digitalocean; cland config set hosts.agents.size s-4vcpu-8gb; cland config set hosts.agents.region lon1; cland config set hosts.agents.transport ssh; cland config set hosts.agents.slots 8; cland config set hosts.agents.min_hosts 1; cland config set hosts.agents.max_hosts 2; cland config set hosts.agents.idle_stop 20m; cland config set hosts.agents.spread false; cland role launch implementer --pool agents; cland hub reload \|` followed by the same commands as the fix (VERIFIED from `hub/src/setup/steps/hosts.ts` and `hostPoolsDocument` at `0a5e25c7d`, both unchanged to `1114abeff`; stage 3's E1537S3-85 read the same row); `agent hosts image or login rows: 0`; `after speech true; before aide true`; `config.toml unchanged yes; roles.toml unchanged yes; HOME entries unchanged yes`; `row exit 0`. (T-1833 C4; the documented no-terminal behaviour) |
| E1537S4-83 | hub-api | Human | `mrow E1537S4-83 r103` | **The page's role placement command, then doctor's host lines against the page's table.** `(role launch implementer --pool second) exit 0`; `(hub reload) exit 0`; `implementer launch: harness <h>; pool second` (`<h>` read from `cland role list --json`, never assumed); `(doctor json) exit <n>` (not a pass condition); exactly these host rows, in this order (doctor's order: images by pool, tokens by provider, signed-out logins, then per pool the free-login rows, then spend; VERIFIED in `hub/src/doctor/hosts.ts` at `1114abeff`; the image state `absent` and the spend detail INFERRED from stage 3's scratch rows): `row host first image \| warn \| absent \| cland host prepare first \| page line host <name> image`, `row host second image \| warn \| absent \| cland host prepare second \| page line host <name> image`, `row host fake token \| ok \| not required \| - \| page line host <name> token`, `row host second <h> logins \| warn \| 0 free \| cland login add <h> --pool second \| page line host <name> <name> logins`, `row host spend \| ok \| $0.0000 today / $3.0000 daily cap \| - \| page line host spend`; `host rows 5; rows without a page line 0; page table lines 6`; `(host status) exit 0` with `first: 0 hosts · slots 0/0 …` and `second: 0 hosts · slots 0/0 …` (placement alone creates no demand); `(host list json) exit 0; host rows 0`; `fake machines 0; host leases 0`; `row exit 0`. (T-1833 C1 role placement, C4 doctor's lines as built) |
| E1537S4-84 | hub-api | Human | `mrow E1537S4-84 r104` | **T-1834's setup paragraph on the CLI, for the cases the fake provider reaches without a terminal** (each expected row VERIFIED from `hub/src/setup/steps/hosts.ts` at `1114abeff`: `finishPool` and lines 106 to 114; the fake provider needs no token, so line 106 does not apply; the image state `absent` INFERRED as in E1537S4-83). The gate line; `hub stop exit 0; hub down`; `agents pool tables before: 0`; `agents pool written (fake, min_hosts 0): 1`; `hub start exit 0; hub up`. **An `agents` pool without placed roles:** `(setup json, no terminal, agents pool without placed roles) exit <n>` (not a pass condition), then exactly `  agent hosts \| open \| agent hosts need role placement \| cland role launch implementer --pool agents; cland hub reload \| page sentence present true` and `  agent hosts image \| open \| cland host prepare agents \| cland host prepare agents \| page sentence present true`, `  agent hosts rows 2; aide after them true`; `setup 1 left config.toml and roles.toml unchanged: yes`. **The Implementer placed:** `(role launch implementer --pool agents) exit 0`; `(hub reload) exit 0`; `implementer launch: harness <h>; pool agents`; `(setup json, no terminal, implementer placed on agents) exit <n>` (not a pass condition), then exactly `  agent hosts \| open \| agents; roles implementer \| cland setup in a terminal \| page sentence present true`, `  agent hosts image \| open \| cland host prepare agents \| cland host prepare agents \| page sentence present true`, `  agent hosts <h> login \| open \| cland login add <h> --pool agents \| cland login add <h> --pool agents \| page sentence present true`, `  agent hosts rows 3; aide after them true`; `setup 2 left config.toml and roles.toml unchanged: yes`; `(host list json) exit 0; host rows 0`; `fake machines 0; host leases 0; image record agents absent; project logins 0`; `row exit 0`. Each `page sentence present true` is the page's whitespace-normalised paragraph holding the sentence for that runtime row ("an `agents` pool without placed roles reads `open` without a terminal with `agent hosts need role placement`", "Otherwise its main `agent hosts` row reads `open` without a terminal", "offers read `open` without a terminal"); `page sentence none` or `present false` on any row is a FAIL of the paragraph. The `--yes`, terminal, ready `ok`, unpriced-builder and missing-metadata cases are source-only (E1537S4-03). |
| E1537S4-85 | hub-api | Human | `mrow E1537S4-85 r105` | `hub stop exit 0; hub down`; each `recorded hub pid <p> alive no`; `fake-host aliases resolving to this run's sockets: <n>` (0 or 1, recorded, not a pass condition: INFERRED 0 because no host was created; a recorded alias is checked and removed at cleanup step 1); `processes naming the scratch root, the alias or this build: 0`; `host watchdogs naming this run's leases: 0; TERM sent to 0`; `after TERM: processes naming the scratch root, the alias or this build: 0`; `row exit 0`. **R-7:** a survivor that is a host watchdog prints its `host watchdog:` identity line; it is signalled only with `identified true`; `identified false` prints `not signalled: identity not established` and makes the row BLOCKED (report the pid and lease input to the requester; never signal it by hand). Any watchdog or fake-machine survivor at all is a FINDING of the stage demo (the page's walkthrough must create no host); a `git worktree prune` survivor is T-1856. |
| E1537S4-86 | hub-api | QA | `s86 > "$EV/E1537S4-86.txt" 2>&1` (after E1537S4-85) | **R-5, for every row of the run.** `new receipts <n>; naming this run or the source <m>; with a live owner 0`: every receipt line printed with its owner and roots; a receipt naming this run or the source is `(T-1805 class, left)` and stays; `/private/tmp new: ct- <a>; cland-h- <b>; hc- <c>; other names <d>` with every `ct-` line `resolves to this run's fake-host sockets false` except a recorded alias, every `cland-h-` line `T-1806 class, left`; `system TMPDIR new names <e>; own-family (q53-, qa-e1533-s3-) 0`. Names that other sessions create during the run are counted, never attributed to this run and never removed. Pass: no live-owner receipt naming this run, no unrecorded `ct-` alias of this run, no own-family name in the TMPDIR, `# fresh: redacted or withheld lines 0`. |
| E1537S4-90 | hub-api | QA | `s90 > "$EV/E1537S4-90.txt" 2>&1` (after E1537S4-86) | **Rule 15 and R-1 before publication.** `files scanned <n>; lines <m>; lines refused 0`; `positive control refused: true`; no `refusing lines` line (a refusing file is named, never its lines; that file stays private and its row is INCONCLUSIVE); `# fresh: redacted or withheld lines 0`. |
| E1537S4-99 | hub-api | QA | `s99 > "$EV/E1537S4-99.txt" 2>&1` (after cleanup step 1) | `POST` HEAD, dev and request still the same 40 hex; `dirty entries 0`; `root non-tracker status unchanged: yes`; `preservation lock owned by this run: 0`; `own-family new entries across all rows: 0`; `other new entries across all rows: <n>` (recorded); `withheld or redacted lines across all captures: 0` (R-1); `T entries other than node-compile-cache: 0` after step 1; `recorded fake-host alias: none`. |

Before requesting QA, run `cland qa lint qa/briefs/E-1537-stage-4.md --commit <sha>` with this filled brief at the build under test; the brief is complete only when it passes there.

## Probes that mislead

- Process cleanup probes use a census of processes naming this run's roots, the build or the recorded alias, through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2). A detached host watchdog outlives the hub by design (T-1748); it is identified against its lease before any signal (R-7), and here none is expected.
- `hub/test/remote-docs.test.ts` imports three site guard files, so its one TAP plan holds all 33 titles; the suite logs attribute the imported titles to their own site files. A per-file plan of 1 there would mean the imports failed.
- T-1833's verify log A-19456 also holds `the onboarding tour has nine stages ending with Look now`: that verify ran on T-1833's tip, whose base predates T-1832's landing. It is not a regression.
- T-1833's batch candidate `9021b7669` has a tree that differs from T-1833's landing tree, only in two `.cland/tasks/` files (the tracker commit `ec5f96d10` sits between); compare outside `.cland/tasks/`, as `s06` does.
- The wording lint's document count moves with every docs commit; compare it with QA's own count of the same three globs at the build, never with a number written here.
- `cland doctor` exits 1 when any check anywhere fails; only its host rows are judged in E1537S4-83. A `warn web bundle` row means E1537S4-08 did not run first.
- The walkthrough splits each step on whitespace exactly as the T2 test does; a quoted value would break both the same way. The page asks for `<provider>` = `digitalocean`; the fake provider stands in for it here and in the T2 test, so the DigitalOcean branch of the walkthrough is not exercised (see "Out of scope").
- `cland setup --json` keeps its report on stdout and its narration on stderr; `c4j` keeps stdout only. A `setup: not JSON` line means the report did not parse, not that the step is missing.
- An accessibility-tree count does not prove visible reachability; no row here reads a rendered page.
- File-change probes use digests, never mtimes; live sessions rewrite shared files.
- Edit existing keys in initialized configs; this brief appends `[hosts.first]` (E1537S4-80) and `[hosts.agents]` (E1537S4-84) to the scratch config while its hub is stopped, as stage 3's `r80` did, each with `min_hosts = 0`: `cland config set hosts.agents.provider fake` on a running hub would apply the `agents` default `min_hosts` 1 at once.
- E1537S4-84's rows depend on what is configured when it runs: it comes after E1537S4-83 (which moved the Implementer to `second`) and moves the Implementer to `agents` itself. Run the scratch rows in table order only.
- The setup paragraph's `skip` cases need `--yes` or a terminal; a `skip` row in E1537S4-84 (which runs neither) is a finding, not a paragraph case.
- Slots due or queued before the build count even when their results arrive later.
- "No skip" names platform-only cases and where they are covered: the cover pair lists its platform skips by name.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

- **The rendered site.** No `astro build`: the site's dependencies live only in the root's `site/node_modules` and its build may fetch. The page's sidebar placement and overview link are read from source and by the site guards (E1537S4-03, -11, -12); the rendering is not checked. Missing authorization is not the reason; the check is excluded, not BLOCKED.
- **The rendered Hosts rows in Neovim and the web.** T-1832 changes no workbench code; the tour's sentences are read against the components' source (E1537S4-03). The rows themselves were demonstrated by stage 1's QA (closed) and run in the cover pair (`nvim/test/hosts.test.ts` T2, `nvim/test/hosts-native.test.ts` T3, `web/test/hosts.test.ts` and `web/test/hosts-view.test.ts` Web).
- **A live tour.** The tour is prose an Aide follows; a model giving it live is not run (the static read is the substitute, as E-616's brief records for C6).
- **The DigitalOcean branch of the walkthrough, prices and paid offers.** No token, no provider call: the page's DigitalOcean token, builder and price statements are source-checked only. The price table's compute quotes ($0.07143 per hour, $48.00 per month, checked on 2026-11-15) are checked for internal consistency (hourly equals monthly over 672 hours; the host-hours follow from the parser's sub-cap) and against setup's declared $0.0714/h, never against the public pricing pages: QA fetches nothing. The storage rates are checked against the provider's declaration read as text. Whether the public pages still show these prices is the reviewer's record (A-19465), not this run's.
- **`cland setup --yes` and setup in a terminal on the CLI.** With `--yes` setup starts the hub and accepts harmless defaults that can run harness trust steps, and a terminal run needs a scripted PTY; the setup paragraph's `--yes` and terminal sentences (untouched `skip`, the unplaced pool's `skip`, the main row's `ok`, the offers' `skip`), the ready `ok`, the unpriced builder and the missing provider metadata are proven by their source lines (E1537S4-03) and by `hub/test/setup-hosts.test.ts` (`C2 yes skips agent hosts with and without a terminal`, `C6 configured pool with ready placed-role logins asks nothing, even with yes`, `T1831 builder unpriced uses declared price or remains open`, `C5 missing hub token stops before roles and asks for hub environment and restart`, and the rest of its 33 titles; stage 3's clear run, unedited since, and the cover pair). Stage 3's E1537S3-88 showed the terminal path and the ready `ok` on its scratch hub.
- **Real logins, sign-in cards and per-harness login behaviour.** The page's login rules are documentation checked against usage text and source strings; no sign-in runs.
- **Suites.** QA starts no `cland verify`, no `npm test` and no T3 or T4 file; E1537S4-06 reads the members' verifies, the batches and the Coordinator's cover pair.

## Grants

none. Every row uses fakes and scratch roots only; no grant is needed.

## Rows to verify after landing

Every member has landed; nothing remains to fill. Completed at `1114abeff` from T-1834's landing `6cc0fa816`:

- "Stage": T-1834's landing, parent, trailers, batch, reviewed tip, review history and files; "Merge watch": the three T-1833 files it edits and the durations commit.
- "Criteria map": T-1834 C1 to C3, and its setup paragraph, each with its test titles, its `src.mjs` lines and the rows that run them.
- `expect.json`: T-1834's three titles in `site/test/hosts-docs.test.ts` (plan 7) and in `hub/test/remote-docs.test.ts` (plan 33), checked against source and found passing in A-19470 (R-2).
- `src.mjs`: 26 T-1834 lines; every T-1833 line re-read, two relabelled, one replaced; 129 in all.
- `voc.mjs` (E1537S4-05): the CLI inventory against the built help, the price rows against the parser, the storage rates against the declaration read as text.
- `scratch.sh`: the new `r104` (E1537S4-84) for the setup paragraph; the census moved to `r105` (E1537S4-85) and the residue row to E1537S4-86.
- `checks.sh`: `WROTE`, `TIPS`, `preserved` (with `hub/src/host/provider/digitalocean.ts`), the `s06` verify, batch suite and candidate; `s02`'s expected lines.
- The publication precheck and `qa lint`, rerun at `1114abeff`.

## Source provenance

Read at dev `0a5e25c7d4f370f6385e06545d729ab52a5c9b44` and re-read at `1114abeff4518aad8889d94e71de07ae07265bab` (between them only `docs/agents/tests/hub-test-remote-docs` note, `hub/test/durations.json`, `site/src/content/docs/docs/cli.md`, `site/src/content/docs/docs/hosts.md` and `site/test/hosts-docs.test.ts` changed outside `.cland/`): `.agents/skills/onboarding/TOUR.md` and `SKILL.md`; `hub/test/skills-onboarding.test.ts` and its per-test note; `site/src/content/docs/docs/hosts.md`, `features.md`, `site/astro.config.mjs`; `site/test/hosts-docs.test.ts`, `site/test/hosts-docs-source.ts`, `site/test/remote-docs.test.ts`, `site/test/remote-docs-source.ts`, `site/test/onboarding-claims.test.ts`; `hub/test/hosts-docs-pool.test.ts`, `hub/test/remote-docs.test.ts`, `hub/test/lint-closed-item-wording.ts`, `tiers.json`, `docs/agents/tests/index.md` and the two per-test notes; `hub/src/host/scheduler.ts`, `login-cards.ts`, `pools.ts`, `pool-name.ts`, `boot-gate.ts`, `host-health.ts`, `agent/memory.ts`; `hub/src/cli/usage.ts`, `usage/login.ts`, `host.ts`; `hub/src/setup/steps/hosts.ts`, `runner.ts`; `hub/src/doctor/hosts.ts`; `hub/src/hub/web-authority.ts`; `hub/src/web-bundle.ts`; `nvim/lua/cland/hosts.lua`, `panels.lua`; `web/src/sessions/HostsLine.tsx`, `SessionsArea.tsx`; `test-support/fixture-environment.ts`; `.agents/skills/qa/qa-demo-policy.ts`. The landings with `git show 0d1390dde` and `git show 5cd48f9de`; the kits at `K`, `M3`, `M4`; the briefs at `P1`, `P2`, `P3`; the stage-3 report and corrections in A-19436; the verify and batch logs A-19454, A-19456, A-19459 to A-19462, A-19470, A-19472 and A-19473; the items with `task view --json` and the plan with `task plan show E-1537 --json`. T-1834's landing with `git show 6cc0fa816` (`site/src/content/docs/docs/cli.md`, `site/src/content/docs/docs/hosts.md`, `site/test/hosts-docs.test.ts`, the remote-docs per-test note), `hub/src/host/provider/digitalocean.ts` (its storage declaration, as text) and the built `cland host --help` and `cland login --help`.

## Verdict

Fix nothing. Clear only when every case and check in scope passes. Otherwise not clear, with the failing, blocked or inconclusive case ids and findings. On the epic record one QA verdict with the exact stage name (`stage` / `--stage`: `the tour and the hosts docs`), full tested dev SHA, unique run id and case table. Stage QA carries no epic criterion marks. Report the stage result to the requester in the epic topic. Publish evidence only after E1537S4-90's clean scan; keep recorded evidence if publication fails and follow the qa skill's recovery procedure.

## Landing markers

This brief was drafted at `0a5e25c7d` before T-1834 landed, with a marker on every line that needed its landing. Each was filled from T-1834's landing (`git show 6cc0fa816`, `task view T-1834 --json`, its verify A-19470 and batch logs A-19472 and A-19473) and verified at `1114abeff`; none is left. E1537S4-04 counts the markers at the run and a non-zero count makes the run BLOCKED.
