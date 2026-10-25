# Running tests

Per-test guidance lives in the [test-file index](tests/index.md). Add test-specific paragraphs to the file named after the repository test path (slashes become hyphens, followed by `.md`). Keep shared tiers, budgets, cover-quiet and conventions here.

The tracked `.gitattributes` uses Git’s built-in `union` merge driver for the index and per-test documents. Independent index rows and guidance paragraphs survive parallel additions, including two branches creating the same document, through ordinary merges, rebases and cland’s object-based merge queue. List each document once in the index; entry order has no meaning and is not checked. When two branches add the same row, union keeps it twice; the test-docs guard counts identical rows once and rejects missing, dangling and conflicting entries (one document listed against two test files). Keep paragraphs independent and review the combined guidance when branches edit the same advice: union retains both sides of overlapping edits.

The root `npm run typecheck` uses native TypeScript 7.0.2 for the hub's bin, src
and test files, Neovim's bin and test files, and the web workspace, through their respective
`tsconfig.json` files. It also checks `shared/wire/tsconfig.json` with DOM libraries
and `types: []`, so the browser leaf has no ambient Node types.
`npm run typecheck --workspace hub` checks only the hub, including the compile-time
wire conformance assertions in `hub/test/wire-conformance.ts`. These compare the
independently restated shapes (including nested and optional fields) to their hub
owners; keep the assertions outside the browser leaf. New snapshot and delta
types belong in `shared/wire/` when their protocol extensions are implemented.
`web.link` and its `{url}` result have explicit conformance assertions there too.
The scripts use `hub/bin/typecheck.ts` to resolve the pinned `typescript7` npm
alias, including from task worktrees that inherit the root install. This avoids
the two compilers' shared `tsc` executable name. TypeScript 5.9.3 stays installed as
`typescript` because `hub/test/executor.test.ts` and
`hub/test/lint-tracker-container-source.ts` use its compiler API, which 7 does
not provide. T-427 records matching diagnostics on both clean projects and
planted strict-option/import errors before the switch.

## This repository's verification commands

This repository records these `[verification]` values in `.cland/config.toml`:

```toml
prepare = "node hub/bin/verify-prepare.ts"
check = "npm run check"
test = "npm test"
```

`npm run check` runs `npm run typecheck`, builds `web/dist`, then runs static/test lint.
The web typecheck keeps the hub strict flags, adds DOM/JSX and browser-only types,
and runs the colour fixtures, text contrast checks and oxlint React hooks rules
(including a rejected conditional-hook fixture). The T0 workspace guard checks
the build order. Root `npm install` builds the bundle through `prepare`; the
post-typecheck build also runs on local verification, where remote prepare is absent.
`web/dist` is ignored. See [the web workspace](../../web/README.md). Prepare installs
dependencies and seeds the pinned Neovim on the builder and before every droplet
delivery; it never runs during local verification. See
[Verification commands](../../hub/README.md#verification-commands) for the shell,
clean-tree and snapshot-key contract.

The T0 skill provenance gate (`hub/test/lint-skill-provenance.ts`) checks the
kept upstream skills' origin/MIT headers, `LICENSE`, stable `metadata.changes: CHANGES`
pointers, nonempty `CHANGES` files and per-skill union merge attributes. For a
skill edit, append a new change/item line in its sibling `CHANGES`, as described
in [skill maintenance](../../skills/README.md). The T1 lint fixture rejects missing
or empty records; `skill-provenance-merge.test.ts` proves native Git merge,
`merge-tree` and one-parent squash preservation after copying the shipped skills.

The closed-item wording guard (`hub/test/lint-closed-item-wording.ts`) checks
repository `README*.md` files and `docs/**/*.md` against `.cland/tasks/*.md`,
excluding dependency, Git and worktree directories. It fails with file/line
diagnostics when a line combines a closed item reference with `until`, `stand-in`,
`pending` or `later ticket`. Default tracker prefixes and numeric `T-n` aliases
share identity; open and unknown references are ignored. This is a lexical
same-line check, so unrelated clauses, runtime state and historical records need
a same-line or immediately preceding standalone HTML comment:
`<!-- cland-allow-closed-wording: reason -->`. Keep the reason specific; blank
reasons do not exempt a line. An inline exemption applies only to its own line.
In-memory fixture tracker controls run at T0 without a test worker; `--self-test`
runs only those controls, and `--help` describes the command. The guard uses the
candidate checkout's tracker state, without contacting a running hub.

The T0 dictionary membership guard (`hub/test/lint-dictionary-membership.ts`)
checks every `in` expression in `hub/src` with the TypeScript compiler API.
String-indexed dictionaries (including `Record<string, …>`), `any`, `unknown`,
bare object types and dynamic or undeclared keys require `Object.hasOwn(record, key)`
or `Map.has(key)`. Structural narrowing by a declared finite key is allowed automatically.
A genuine prototype-chain check may carry `// cland-allow-in: <reason>` on the
same or immediately preceding line. The reason is mandatory; strings containing
the marker do not exempt code. Diagnostics name the source file and line.
The guard's in-memory compiler cases run as T0 self-checks, without a test worker.

The T0 copied-tracker guard (`hub/test/lint-copied-tracker.ts`) syntax-scans
`*.test.ts` under hub, web and Neovim. In a `test`/`it` callback containing a
`cp`/`cpSync` call whose source names `.cland/tasks`, literal E-/T- ids must be
derived from the copy. Strings, selectors, template fragments and regexp literals
are checked;
comments and sibling synthetic tests are excluded. A seeded row may use a real
same-line or immediately preceding `// cland-allow-tracker-id: <seeding owner>`
comment. Each exception names the fixture that plants the row; no fixture id
range is implicitly trusted. Reviewers check those owners. In-memory planted
negative controls require file/line diagnostics at T0, without a worker or child
process. `--help` describes the guard. This is a direct-source guard: helper-hidden
copies and computed ids still require review. Keep copied sources read-only and
perform all tracker writes under the sealed disposable root.

The T0 child-environment guard (`hub/test/lint-child-environment.ts`) checks
native Node child-process launches throughout `hub/test` (TypeScript and JavaScript,
including helpers, fakes and manual tools). Named, renamed, namespace, default,
dynamic-import, CommonJS and promisified child-process functions are resolved
through the compiler, including call/apply forwarding. Dynamic method lookups
need an explicit exemption. Supply `env: fixtureEnvironment(disposableRoot, base, extras)` or
`env: await accountFixtureEnvironment(extras)` after the final overlay.
Extras contain explicit owned inputs; passing `process.env` or its full spread as
extras is refused because it can restore account paths. The guard checks the
third argument of `fixtureEnvironment` and the first argument of
`accountFixtureEnvironment`, including renamed imports and captured const extras. Fresh runner children use
`runnerFixtureEnvironment(root, inherited)` instead: it filters the inherited base
and retains only `CLAND_SUITE_*`, `CLAND_TEST_*`, `CLAND_LOAD_GATE_*`,
`CLAND_COVERAGE_*`, hub admission FILE/URL/SECRET and session NAME/ID/ROLE/LAUNCH_TOKEN
controls. HOME, XDG,
Claude/Codex/fake profiles and executor state still come from the disposable root. A local
const alias is accepted only when used directly as a native launch's `env`;
mutating or escaping it requires an explicit exemption. Environment spreads after
the builder and options spreads after `env` are refused.
The phase and repetition launch boundaries provision its owned directories with
`prepareRunnerFixture(root)` before spawning; environment construction stays pure.
The init machine deliberately removes `CLAND_EXECUTOR_STATE` to exercise the
product default ledger under its scratch XDG state directory.
The pure builders live in `test-support/fixture-environment.ts`; the hub test
entry point re-exports them, and the guard resolves both entry points to those
trusted declarations. Native Claude attach and replacement-process launches use
`accountFixtureEnvironment(fake.env)` so the launch and later account discovery
select the same worker-owned configuration. Re-sealing under the project root
would change that account even when `FAKE_CLAUDE_HOME` is unchanged.
The prepare-script fixture writes legacy snapshot inputs below the sealed HOME,
as production reads them there. The init/setup machine preserves a deliberately
empty provider variable as a disabled-provider input; non-empty provider values
are still removed at launch. Keep these product inputs and their assertions when
changing fixture sealing.

A real line comment `// cland-allow-child-env: <reason>` on the launch's line or
immediately preceding line exempts an intentional seam. Every exemption names
its reason: typed synthetic-provider/native-credential contracts, sealed lifecycle
or setup helpers, or another justified boundary such as an OS-only probe or
read-only repository metadata. No whole-file exemptions apply. Keep owned scratch
paths and synthetic inputs explicit; an exemption does not waive rule 15. Reviewers
check the sealing owner and preserved assertions. `--inventory` lists every
recognized launch with file, line and builder/exemption reason. `--help` describes
this tool. Diagnostics never include source expressions or environment values.
Embedded generated programs are covered at their parent launch boundary; this
is a source guard, not whole-program runtime taint analysis. Its negative and
positive compiler cases run in memory at T0, without workers or subprocesses.

`npm test` enters `hub/test/run-suite.ts auto`. Whole-suite `hub`, `nvim`, `all`,
coverage-selected runs and close-run shards use that same runner, with the
admitted selection in `CLAND_SUITE_SELECTION` (or `CLAND_SUITE_SELECTION_FILE`
for large selections). Package modes choose hub or Neovim; `all` chooses the full
admitted tier set. Coverage chooses files, and shards partition those files;
neither changes the project command contract.

This repository also sets `test_unit`, `test_component`, `test_integration` and
`test_soak` to `node hub/test/run-suite.ts --tier T1` through `--tier T4`.
These explicit tier commands replace the whole `npm test` step in tiered plans,
using the same selection and runner. The table below describes when each runs;
`test = "npm test"` remains the whole-suite entry when no tier plan applies.
These values control the release path and go through review like code.

## Tiers and the merge queue

### Project commands

`[verification]` records POSIX shell command strings, independent of the stack.
`check` is the fast gate. Before creating a droplet, the host runs the recorded
command and logs `Host gate: <command>`; a failure reports
`host check failed (exit <n>); no droplet created`. An unset check logs
`Host gate: check not set` and continues. `prepare` installs dependencies on the remote executor.
Stage, epic and release closes shard only candidates carrying cland's own runner.
Other projects log `sharding skipped: project commands are not sharded` and run
their recorded test once on one machine.
Set available runtime tiers with `cland config set verification.test_unit '<command>'`
and the corresponding `test_component`, `test_integration` and `test_soak` keys.
Empty tier commands are unset. A candidate worktree with a nonempty `test` and
no nonempty tier commands keeps its whole-test execution even under a tiered
hub root. Candidates with no test commands inherit the root's commands.
Commands are pinned at admission, including the
selected tier plan; queued runs keep those commands after a config reload.

| Run | Commands after check |
| --- | --- |
| Task with hosting merge queue enabled | `test_unit`, `test_component` |
| Merge batch | Commands matching `merge.batch_tiers` (default unit/integration; this repo unit only), plus Web after T1 for web/ diffs |
| Periodic `dev-t3` | `test_integration` |
| Integrated dev, explicit all, or task without batch protection | unit, component, integration |
| Stage, epic, release or nightly soak | all four |

Each executed tier reports its exit code, duration and output tail. Projects
without cland file/duration manifests still use the command plan; the configured
`run_timeout` bounds their nightly run without cland-specific repetition estimates. A project
with only `test` set runs that whole command per task and retains the default
`[merge] queue = false`; it has no tier split. Set `merge.queue = true` for batch
landing. `merge.batch` (default 3) caps heads per batch; `merge.batch_wait`
(default `"10m"`) starts a partial batch after the oldest request has waited.
Both settings are writable with `cland config set`.

This repository uses `node hub/test/run-suite.ts --tier T1` through `T4`.
The runner narrows the admitted file selection to that tier, preserving all T1
rules and coverage-selected T2 files.

### Test levels (D53)

Every test belongs to one of four runtime tiers, T1–T4. T0 is the static check before a run. D53 (docs/spec/v0.1.4.md) makes moving tests to the lowest adequate tier the project's top priority. The study is A-4143. `hub/test/tiers.json` declares runtime tiers; manifest lint, source guards and the resource tripwire check their boundaries. Reviewers apply the rules below where enforcement is still report-only.

| Tier | What it holds | What it may use | Budget per test |
| --- | --- | --- | --- |
| T0 static | typecheck, manifest and test lint; deterministic whole-repository source guards | no test process | |
| T1 unit | pure modules, tracker, store, planners, hub rules in-process | a fake clock and in-memory fakes; no sockets, child processes or real time | 0.5 s |
| T2 component | a hub served in the test process (`projectHub`) with real socket edges; the CLI as a subprocess only when the CLI itself is the subject | an in-process fake adapter and a fake clock; no `startDaemon`, `spawnSpoke`, fake harness binaries or Neovim (except the stub-hub client below) | 2 s |
| T3 integration | a curated set of real-process scenarios, plus true process-lifecycle files and one real-binary contract file per harness | anything | 10 s |
| T4 soak | load repetitions, long waits, macOS-only checks | anything | |

`hub/test/durations.json` declares the tier budgets. File budgets sum top-level
test-seconds; wall budgets project whole-file scheduling at the run's workers.

| Tier | Per test | Per file | Projected wall |
| --- | --- | --- | --- |
| T1 | 0.5 s | 10 s | 120 s |
| T2 | 2 s | 30 s | 480 s |
| T3 | 10 s | 120 s | 900 s |
| T4 | none | none | none |

This repository's budget manifest uses report mode until after v0.1.4 (D73);
enforcement returns under E-880. The duration-budget section below describes
allowances, enforcement and the T3 growth ratchet.

Task branches with `tiers.json` and `[merge] queue = true` verify T0–T2: the check step, all T1 files, coverage-selected hub T2 files and diff-selected Neovim T2 files. Coverage fallbacks run all T2 across both packages, clearing inherited Neovim subsets. Tasks also run added/changed T3/T4 test files and mapped T4 read-path guards once (selection mapping below); fallback never widens that set. Successful coverage keeps diff-selected Neovim T2. T3 runs in batches whose configured tiers include it, in periodic `dev-t3` runs, and at integrated `dev`, stage, epic and release runs; T4 runs nightly and at occasions. The hosting hub must also have its effective merge queue enabled; a candidate-only opt-in keeps prior process coverage until the host provides batch protection. Task reports name whether T3 is in the merge batch or deferred to periodic dev and integrated occasions, with the queue state; that line is deferred evidence, not a passing process receipt. A task's same-head green receipt plus its green batch landing supplies merge evidence. T1 uses the serial hermetic phase, T2–T4 use the machine phase, and Neovim retains its package phase. Candidate packages with only the legacy resource manifest retain their existing file sets.

| Run kind | Plan after T0 |
| --- | --- |
| Queue-enabled task, no mode | All T1, selected T2; fallback is all T2 in both packages; added/changed T3/T4 files and mapped T4 guards once |
| Hub-owned merge batch | Configured `batch_tiers` (default T1 and T3; this repository T1), plus Web after T1 for web/ diffs; five repetitions of T3 identities absent from the last green batch or stage receipt |
| Ordinary integrated `dev` or explicit `all` | T1–T3 |
| Stage, epic or release occasion | T1–T4; five repetitions of identities absent from the last green stage receipt |
| Periodic dev (`dev-t3`) | T2 and T3, one droplet; no load repetitions |
| Nightly soak | T1–T4; five repetitions of identities absent from the last green soak |

T4 files run only in their selected base soak phase. They never acquire extra
parallel load-gate repetitions: latency assertions under self-generated load
would otherwise measure contention with the base phase. The selection and run
result name this choice as `load gate: T4 repetitions skipped`, with the file
count. Nightly deadline planning excludes those repetitions before budgeting.

Task load repetitions cover new T1/T2 identities against the duration baseline
plus durable 5/5 load proofs from task heads that have landed on dev.
The hub owns batch, dev-t3 and soak occasions. The Coordinator requests stage, epic and
release occasions; QA may request epic for its demo. An explicit `all` on a task
head requires authorization and retains T3. A flaky-gate second task receipt
uses the same mode-free selection. Unchanged T3 smoke files are filtered out of task plans.

### Periodic dev T2/T3 and release gate

`[merge] batch_tiers` selects a nonempty set of T1–T4 tiers for each batch.
Its default is `["T1", "T3"]`; this repository sets `["T1"]` (D67).
Task verification adds changed T3/T4 files and mapped T4 guards once to T0–T2 (selection mapping and duration check below). A green batch with T1 only supplies no T3 receipt.
With this repository's T1-only batches, automated T2 coverage after merge runs
only in the periodic dev run, the nightly soak and close occasions (stage, epic
and release). Ordinary integrated `dev` or explicit `all` remains available for
manual checks. This catches interactions between separately verified task heads
that their selected task T2 runs cannot catch before landing.

`[verification] dev_t3_every = "2h"` enables a hub-owned `dev-t3` occasion;
`""` (the default) disables it. The first attempt is due one interval after
activation. Later runs are due after the interval since the last attempt/start,
only when dev's verification candidate tree differs from the last started run's
tree. This uses the shared exclusions in `hub/src/verification-tree.ts`, so
tracker-only commits do not start another run. The cursor survives restart, and a queued,
running or unreported periodic run prevents another. A refused admission is
throttled for one interval. The hub requires clean root dev at freshly fetched
origin/dev and retries unavailable candidates on later clock ticks. It uses one
droplet under the ordinary shared remote budget and daily spend cap, selects T2
and T3 without load repetitions, and never holds or rebuilds a merge batch.
Nightly soak still runs T1–T4 independently.

Once admitted, periodic dev bundles the captured commit from Git objects. Later
root dev source or administrative commits and dirty files cannot change those
bytes. Its recorded check runs remotely on the detached commit, without a
live-root host gate. A bundle/delivery failure before execution is **not run ·
infrastructure**: durable `outcome.notRun: "infrastructure"` retains the cause
alongside the existing exit code. It supplies no cover or release evidence,
does not advance the last executed green/red markers, and starts no culprit
search. After the attempt interval the hub retries the next eligible tip; an
eligible tree that never started remains retryable across restart.

A provider capacity refusal at size/spend admission or acquisition follows the same lifecycle with
`outcome.notRun: "provider-capacity"` and its original `cause`. Periodic notices
say **not run: provider capacity**; task suite results say **unavailable: provider
capacity**, and the task verify `result` is `"unavailable"`. Neither is executed
failure evidence. No executor, region or size fallback applies to that refusal.
An explicit `--size` slug absent from the provider catalog instead refuses
submission (exit 1, "unavailable", no job or droplet). Listed unavailable sizes
and sizes not offered in configured regions retain the capacity outcome.

Each periodic result goes to the Coordinator in Agents with head, previous green
periodic head, first-parent commits since that green, outcome and failing files.
The `verification-dev-t3-result` message detail exposes `run`, `head`, `tree`,
`previousGreenHead`, `previousGreenRun`, `merges: [{head, subject}]`, `result`,
`failingFiles`, `artifact` and `path` for T-887. Missing baseline or unavailable
Git range is explicit (`null`), including timeout or I/O rejection; it cannot
block publication or the next periodic run. The previous
green is pinned at admission and retained with the durable job. Infrastructure
results use `result: "not-run"`, `notRun: "infrastructure"`, `cause` and an empty
`failingFiles` list; the existing fields remain present.

A red periodic result starts a separate durable culprit search for T2 and T3
failures alike, retaining the `DevT3Result` interface above. Each failing file
first probes the current local dev tip before any historical search. A complete
executed pass reports `already fixed on dev at <commit>` and files no Bug. An
executed pass at the original red head remains a flake. A red tip receipt allows
the file to rerun at the red head (reusing that probe when dev is still there), then at the pinned
last green head (a failure is pre-existing), then bisects the intervening landed
commits. Before filing a culprit, it repeats only the adjacent green/red boundary
with fresh run ids. A changed result is inconclusive (flaky boundary). This adds
at most two droplet runs per failing file reaching a boundary; it stops on the
first changed or unavailable receipt. A file absent from the pinned commit has
an explicit `absent` receipt with head/tree and null run/artifact/path; it is
not executed and supplies no passing runtime evidence. Absence narrows the green
side so an immediately failing new file lands at its introducing commit.
Confirming an absent predecessor adds only the red-side droplet run. Hub and Neovim probes run only that file; `web/test/*.test.ts`
probes select the Web tier on each candidate, requiring the requested file's own
execution receipt. All retain test-root and parent-traversal checks, with no load
repetitions or full-suite cache proof, through the shared droplet budget and queue.
Interrupted or missing execution, unavailable baselines/ranges and preparation
failures are inconclusive;
they never assign blame. The known Linux `needs macOS sandbox-exec` exclusion
requires matching skip finish and reason records. Such receipts remain `partial`,
retaining the excluded identities/reasons, full executor platform and the
executed subset outcome. The search uses that subset only when the exact
exclusion set and OS/architecture match across both ends and their confirmations.
For partial receipts, changed, missing or unknown exclusions, an absent compared
file, missing platform facts and all-skipped green files remain inconclusive. Skips supply no passing
runtime or load evidence. Probe admission skips the hosting hub's manifest and test lints and tier
projections, explicitly recorded in each log; detached candidate commands,
including its own check and runner rules, still execute. Ordinary verification
and batch diagnostics retain hosting admission lint. Search state and probe
receipts survive restart, including the two boundary confirmation phases. The
hub checks the current dev ref again before publishing the diagnosis; any moved
tip gets its own file probe before filing. Missing, absent or partial-green tip
receipts supply no fixed or failing proof and file no Bug. Each filed Bug retains
the current tip's red receipt alongside the historical boundary receipts. This
adds one probe per distinct tip/file visited; the stable original red tip uses
its existing rerun. No integrated/stage cache is reused for tip evidence.
Historical probe checkouts are standalone detached repositories sharing Git
objects, so candidate checks read allowance owners from the pinned tracker
rather than the hosting hub's live tracker. Existing linked-worktree checkpoints
convert before idle probe admission. Incomplete standalone clones get one
recreation attempt there; HEAD equality also requires clean tracked-file status.
Complete preparations are reused; admitted workers finish before removal.
The hub files one Bugs item per culprit merge, retaining both heads, files, run ids
and artifact paths, and reports in Agents to the Coordinator and the merge's
last claimant if live. Merges continue while the search runs. Filing errors
report a blocked search to the Coordinator and retry without holding batches.

`cland release`, including `--dry-run`, refuses with `release-t3` unless a
completed, reported green dev-t3, soak, stage or release occasion covers the
pinned release head's verification tree (excluding `.cland/tasks` and
`.cland/RULES.md`, exactly as verification admission does). A different commit
with the same build tree qualifies;
T1-only batches, partial selections, cancelled or incomplete runs do not. The
refusal names the head/tree and the needed `cland verify all --occasion release
--report agents` run. Evidence has no age limit. Recovery of an already published
release finishes its original receipt even after dev moves.

### Nightly soak

`[verification] soak = "03:00"` enables a nightly UTC run; `""` disables it
(the default for new projects). The hub attempts at most once per UTC day after
that time, including when it starts late, and persists the attempt across restarts.
It requires clean `dev` at freshly fetched `origin/dev` and skips an unchanged
candidate tree. A soak uses one droplet with Coordinator priority, plans T1–T4
with `CLAND_TEST_SOAK=1`, and load-repeats measured identities absent from the last
green soak. Admission pins the timeout/configuration and a five-repetition identity
list from `durations.json`. Its estimate uses the package phase worker projection for the base run (including
the manifest median for missing files), then charges each repeated identity its
whole file cost (or identity cost, if greater) serially, plus one second per fresh
process. It reserves 20% of `run_timeout` for load variance
and 60 seconds for check/coverage/runner overhead, trimming repetitions to fit.
Unmeasured identities still run in the base phase but do not acquire repetitions;
a missing duration manifest or a base projection beyond that budget refuses admission
with a reason before any machine is created. The plan and omitted counts stay in
the selection/log. The executor reserves shared daily spend before creating the machine;
a cap refusal skips the night with one notice naming `daily_spend_usd`'s cap.
Results go to the Coordinator in Agents. Green coverage maps feed task selection.
A red soak leaves queued merges intact and does not prevent another batch.

Soak quarantine proposals are Agents reports, one per failing identity with an
observed last green and no executable-code change since it (unknown Git facts
produce no proposal). A last green requires explicit completed-pass progress;
timing-only, skipped, TODO, cancelled, unfinished, quarantined non-pass and mixed
repetition/descendant outcomes cannot establish it. Finish-only cancellation
is retained; unknown or ambiguous child ancestry withholds greens for that file,
and malformed/unknown outcome receipts supply no green evidence. The shared
`quarantineProposal` builder carries `identity`,
`run`, `tree`, `lastGreen: { run, head, tree, log: { artifact, path } }` and
`log: { artifact, path }` in the `quarantine-proposal` detail. These are proposals
for Coordinator triage; the independent receipts, isolated repetitions, owner
item, reason and expiry required below still govern manifest additions.

### Test placement and review

**When you write or change a test (Implementer):**

- Choose the lowest tier that can prove the behaviour, and state it in the file header or the test's comment. A new file is T1 or T2 unless its header names the process-lifecycle behaviour it proves.
- Wait on an event, a frame or a journal record, never on elapsed time. Timer behaviour uses the fake clock. A test injects one complete Clock for timestamps and scheduling, never a bare `now` callback. A new literal `sleep(n)`, a `setTimeout` used as a wait, or a `Date.now()` difference in an assertion is a finding.
- Prove persistence by reopening the store or tracker in-process, not by stopping and restarting a hub.
- Prove a hub rule once through one real frame per tool or refusal family. Its duplicates call the dispatcher or tracker directly. Don't repeat a hub-side rule through each harness's fake.
- A test proves one behaviour. A title with "and" twice is a finding. Permutations over inputs are a table inside one fixture, not a fixture per cell.
- A new duration allowance carries a non-TODO reason, an open owner item, and UTC `added`/`expires` dates at most seven days apart (31 days for the configured legacy owner under D72); it lands with the test.
- Before review, run typecheck and the touched files one at a time. Put each file's seconds into the review request.

**When you move or split tests:**

- Map each original test title and its assertions to their destinations; account for every assertion.
- Report timing and process starts across every destination file, including retained originals, so a split cannot hide cost.
- Keep each native claim at a named T3 boundary. Declare fixture native resources and verification commands, and cite the hub's tripwire report as tier evidence.
- Keep shared fakes faithful by importing production semantics and round-tripping their output through the real decoder.

**When you review a test (Reviewer):**

- Count `startDaemon(`, `spawnSpoke(`, `cland(` and `sleep(` in each new or changed test. For each one, ask which is the frame proof and why a lower tier can't prove the rest.
- A new file that spawns a process with no lifecycle sentence in its header, or a new wall-clock wait, is a finding of at least medium severity.
- Use the task's same-head verify receipt and the hub's green merge batch as the runtime evidence for a queued landing.

Deterministic whole-repository source guards run through `npm run test:static`, included in the task host gate’s `npm run test:lint`.

The wire import guard (`hub/test/lint-wire-imports.ts`) rejects imports and
re-exports outside `shared/wire/`, including type-only and dynamic imports,
Node built-ins, package imports and ambient type references. Its negative source
fixtures exercise these refusals without starting a test process. Add wire
dependencies only within that directory; restate hub shapes there and add
conformance assertions in the hub's typecheck instead of re-exporting hub types.

### Queued merge batches

On an item's final `ready` event, its supervising Lead or the Coordinator calls
`cland merge T-<n>`. Reviewed heads with paths outside the documentation/tracker
allowlist enqueue; the CLI returns `queued <n>`, their current FIFO position.
Allowlisted-only changes still use the immediate gate with their required
verdicts. The allowlist is the human-override scope in the merge skill; skills
and role configuration are outside it. `cland merge queue [--json]` lists pinned
heads, requesters and the current batch. `cland merge T-<n> --cancel` removes a
request through the same role/subtree permission check as merge. Cancellation
waits for any active worker to finish before the candidate checkout is replaced.
A changed or deleted head, a closed item or a not-clear verdict drops its entry.

Enqueue's advisory `merge-demo-warning` names open epics with running or due
demos and the overlapping landed files; it goes to the candidate's topic and
Coordinator/item lead without blocking enqueue. Due means all task children
closed, last ticket landed on dev and no hub QA demo verdict (stage QA excluded).
Use the sealed public merge/topic-history seam in `hub/test/merge-queue.test.ts`;
inject Git history and seed lease/landing receipts in the disposable root.
Damaged lease/history evidence must keep enqueue successful and post
`merge-demo-warning-unavailable`; scope read-error handling to diagnostic reads,
preserving authorization, lane and freshness refusals.

With `[merge] queue = true`, reviewed code heads wait in a durable FIFO. The hub
starts the oldest `batch` entries (default 3) when full, or after `batch_wait`
(default `"10m"`) from the oldest request. It prepares squash objects in order,
checks immutable merged-tree lint and duration budgets, and verifies a detached
candidate with the hub-owned `batch` occasion. That run selects
T0 first through the candidate's resolved `[verification] check` command, then
`[merge] batch_tiers` (default T1 and T3), with five load repetitions only for T3
identities absent from the last green batch or stage receipt. It uses the configured executor and Coordinator
priority, occupying one suite slot.

T0 is mandatory whenever a check command is configured, regardless of
`batch_tiers`. This repository's `npm run check` runs typecheck, the Web build
and the T0 static/test lints on the combined candidate checkout. Local workers
record `tier T0: exit <code>; duration <seconds> s; output tail: ...` before the
runtime tiers. Droplet batches record the same timed step at the host gate;
the worker reuses it only for the matching candidate tree and command, otherwise
it runs T0 again. A failed check stops the tiers and makes the batch red.
Batch results retain the executed step names and durations. A successful original
or recovered batch requires passing receipts for its configured T0 and planned Web;
missing or conflicting step proof holds as inconclusive, never a zero-duration pass.

On green, each member lands through the existing merge receipt, checkout,
territory publication and cleanup path. Dev movement reuses green candidate
evidence when the immutable candidate diff stays within `refusedOverridePaths`'s
documentation/tracker allowlist, the same policy that selects immediate merges.
Other changed paths rebuild and rerun, with a notice naming the forcing commit.
The reused receipt retains its original head and tree. Conflicts or
landing gate refusals drop their member with a reason and rebuild the rest.
Recoverable landing errors (`merge-dirty`, `merge-checkout`, `merge-git`,
`merge-unpublished`, `merge-recovery`) retain members, completed landings and
green evidence across restart. The notice names the cause and automatic retry;
later ticks recheck the candidate and retry without cancelling a member.
Other held failures name the required human or Coordinator action.
Blocked-report fault injection must throw at the report boundary, independently
of closed-item lead routing. Assert the tick resolves, the original reason and
separate report error survive reopen, and public queue/status reads still reply.
Periodic T3-search blocked notices and nightly/periodic skip notices get the same
throwing-boundary regression; inspect their log receipts before asserting recovery.
Queue and batch state survive reopening the hub store. `cland merge queue` and
`cland verify queue` show the current batch and its members. Results and logs go
to Agents and each member's requester and item lead. A
red batch of one refuses its member with `merge-bisected`, naming the failed
tests or T0/Web. Larger red batches rerun only the failing files or failed T0/Web step on each leave-one-out
tree, pinned to the original integration base. A unique green removal refuses
that member and selects the green tree for the others. Otherwise those files
rerun once on the original batch tree: completed passing receipts for every
original failure select that tree, while red or incomplete proof refuses every
member with `merge-bisect-unresolved` and sends the Coordinator one evidence
notice. File jobs retain their run, tree, log, seconds and provider cost, use the
same queue, and supply no full-suite cache proof.
T0 diagnostics run the complete check command rather than a file subset and
require an explicit passing T0 receipt. If two members typecheck alone but fail
together, both leave-one-out checks are green: a red original-tree repeat then
refuses both as `merge-bisect-unresolved`. A green static omission or original-tree
repeat only selects a candidate: the hub starts a full confirmation batch on that
exact head/tree before landing. It retains the original batch's pinned commands
and tier selection across config changes and restart. A later red runtime tier
is handled as a red batch; static success never substitutes for those tiers.
Web runs only when a candidate diff path starts with `web/` and the candidate
supports the named Web command. It follows T1 (or the configured tiers if T1 is
absent), runs once without load repetitions, and retains its timed `tier Web`
receipt. A red Web step uses the same `diagnostic.steps` list as T0: rerun the
complete Web tier on leave-one-out trees, then the original tree if needed.
Two members green alone and red together are refused after a red repeat.
A green step diagnosis or file-only diagnosis of a Web-containing plan requires
the original pinned full-plan confirmation (T1 can fail before Web starts);
Web not-run/missing/conflicting success receipts hold the batch as inconclusive.
Batches with no web/ path retain their existing tiers and add no Web wall time.
Test-identity flakes keep their separate quarantine observation rules.
Aborted, timed-out, unavailable or otherwise inconclusive original runs or file
jobs hold the batch with their retained receipts and one Coordinator notice. They establish
neither a red alternative nor an unresolved red repeat; recovery is an explicit
Coordinator decision. `merge-bisected` goes to the rejected item's lead for a fix,
fresh review and task verification. `merge-bisect-unresolved` goes to the
Coordinator for diagnosis before re-enqueueing. A `merge-conflict` goes to the
item lead to integrate dev in its worktree, then repeat review and verification.
Measured `duration budget` failures naming a test identity or test file use the
same file-rerun policy, even when all assertions passed. Refusals and diagnostic
reports retain the budget line with its observed seconds and threshold.
For `merge-budget`, the item lead reduces the named tier growth or records a
valid allowance under the budget rules before retrying. The supervising Lead or
Coordinator submits the repaired item through the gate again. The merge skill
has the command and refusal workflow.

Executed passing identities on a green batch-tree rerun record a flake
observation with both failure and green receipts. Two different batches produce
one quarantine question to the Coordinator carrying those receipts. The
Coordinator still needs five isolated greens, an owner item, a non-TODO reason
and an expiry within seven days before editing `quarantine.json`; the hub never
edits it. The merge queue remains opt-in for other projects; this repository enables it together with the T0–T2 task protocol.

### Named T3 scenarios

The eleven scenarios below prove process seams once the rules are covered in T1/T2. Each is one manifest entry with tier T3 and a unique scenario name, one whole-file scheduling unit, at most 120 seconds of manifest test time, and at most one live hub. Headers name the flow, lower-tier rule coverage and the expected hub process starts. Other T3 lifecycle regressions and the three harness contracts remain separate. The target cadence is T3 in configured merge batches, periodic dev runs, and at stage, epic and release; task admission excludes these T3 scenarios, which run in periodic dev and integrated occasions, plus batches configured for T3.

| Scenario | File | Seam proved |
| --- | --- | --- |
| hub-lifecycle | [hub/test/scenarios/hub-lifecycle.test.ts](../../hub/test/scenarios/hub-lifecycle.test.ts) | Start, discovery, graceful stop, explicit restart and startup orphan sweep |
| startup-smoke | [hub/test/scenarios/startup-smoke.test.ts](../../hub/test/scenarios/startup-smoke.test.ts) | Detached CLI startup serves status and tracker, then stops and reaps its PID |
| crew-launch | [hub/test/scenarios/crew-launch.test.ts](../../hub/test/scenarios/crew-launch.test.ts) | Coordinator launches Claude Code, Codex and OpenCode; native role clauses and correlated replies cross each bridge |
| ticket-flow | [hub/test/scenarios/ticket-flow.test.ts](../../hub/test/scenarios/ticket-flow.test.ts) | Claim, criteria, review, real verify/cache evidence and verdict-gated merge |
| stage-close | [hub/test/scenarios/stage-close.test.ts](../../hub/test/scenarios/stage-close.test.ts) | Three review-only merges, stage QA retry, persisted stage evidence and separate epic demo |
| release | [hub/test/scenarios/release.test.ts](../../hub/test/scenarios/release.test.ts) | Atomic push to a bare GitHub remote and sync/replay into the local territory |
| droplet-verify | [hub/test/scenarios/droplet-verify.test.ts](../../hub/test/scenarios/droplet-verify.test.ts) | HTTP fake provider with real process machines: acquire, deliver, execute, collect, release and watchdog reaping |
| hook-bridge | [hub/test/scenarios/hook-bridge.test.ts](../../hub/test/scenarios/hook-bridge.test.ts) | A native mod bridge reconnects across hub replacement and expires while its parent stays alive |
| workbench | [nvim/test/scenarios/workbench.test.ts](../../nvim/test/scenarios/workbench.test.ts) | Real Neovim attaches, sends and receives, answers an ask, opens an artifact, explorer, graph and plan approval |
| message-tracer | [hub/test/scenarios/message-tracer.test.ts](../../hub/test/scenarios/message-tracer.test.ts) | Real spokes carry message metadata and a correlated reply through the hub |
| setup | [hub/test/scenarios/setup.test.ts](../../hub/test/scenarios/setup.test.ts) | CLI prompts, fake installation/login, account decline, trust, one hub/Aide, launcher and idempotent terminal/nonterminal reruns |

Add a scenario only for a new flow across processes whose rules are already covered in T1/T2. Reuse existing steps and assertion meanings; add a header with those rule files and expected hub starts, a unique scenario manifest entry, measured duration and reasoned dated allowances. Record a declaration-to-step assertion audit and a spawn census; an extra hub start needs a lifecycle reason in the header. Run the entire file five times serially on the Mac at one-minute load below 15. For Linux proof, cite a droplet merge-batch or integrated-occasion receipt that actually executes the scenario file, naming its tested head/tree and log artifact. Input and refusal permutations stay in the lower tiers.

HUB_SMOKE selects hub-lifecycle, startup-smoke and message-tracer. NVIM_SMOKE selects workbench (attach and the main views) and `nvim/test/startup-budget.test.ts` (the thousand-item startup budget).

### Neovim workbench startup budget (T-1010)

See [nvim/test/startup-budget.test.ts](tests/nvim-test-startup-budget.test.ts.md) and the [per-test index](tests/index.md).

Correctness regressions bound counted operations, allocations or bytes; keep instrumentation inside a measured callback bounded too. Machine-speed ratios belong in deliberately unloaded benchmarks. Preserve the existing budget guards rather than raising them to accommodate a change (A-8634 R5; T-963, T-1007, T-1010, T-1003, T-983, T-1037, T-1038, T-1045).

### Test lint reports

`npm run check` runs typecheck, then `npm run test:lint` once. This repository
names it as `[verification] check` and names `npm test` as `test`. Verification
resolves each nonempty command from the candidate's `.cland/config.toml`, then
falls back to the hub root's value. Without `test`, submission refuses before
queueing; an empty `check` is skipped. Resolved `prepare`, `check` and `test` are
recorded at submission and survive config changes and restarts. A matching host
gate reuses the whole check on the droplet, including lint, so it is not repeated.
Local runs never execute `prepare`. All request modes run the same configured
`test` line; cland's runner receives its phases through `CLAND_SUITE_SELECTION`.

By default, test lint prints a short census with counts by finding kind,
reachable-resource counts by kind (diagnostic only), and the refusal count.
Every refusal still prints its full file, line, rule and message and fails the
check. Use `npm run test:lint -- --details` for per-file tiers, the first twelve
census findings and every reachable-resource path. `--details` also combines
with `--shrink`. The summary names this opt-in command.

The direct-source census remains a report of existing debt. The policy gate
refuses growth, before verify reserves a queue slot or merge changes refs:
`verify-test-lint` and `merge-test-lint` name the file, line and rule.
Dry runs perform the same admission and return the same refusal lines.
A test absent from the base `tiers.json` must obey its T1/T2 resource rules;
a new T3 file needs `// T3: <process behaviour>` in its first comment block.
A valid contract or scenario manifest entry supplies that lifecycle declaration.

`hub/test/lint-baseline.json` freezes counts by file and category:
`wall-clock-wait`, `wall-clock-assertion`, `startDaemon`, `spawnSpoke`,
`fakeClaude`, `fakeCodex` and `fakeOpenCode`. Missing categories mean zero.
No count may exceed its frozen allowance. Process-helper growth is permitted
only with a T3 lifecycle header or contract/scenario entry; wall-clock growth
still needs a trailing reasoned `// lint-allow-wall-clock: <reason>`.
The baseline itself may only shrink, including in lifecycle files; it cannot
be removed to disable enforcement. After removing debt, run
`npm run test:lint -- --shrink` and commit the reduced baseline. The tool
takes the minimum of the current count and existing allowance, so it cannot
bless new debt. Files and categories can independently be lowered to zero.
While the first freeze awaits publication on dev, lint validates it against its
original sources and retains that reference across dev merges. Once dev carries
a baseline, that baseline supplies the branch's reference.

The log, result and admitted `cland verify --dry-run` retain
`test lint (report only): <n> findings in <m> files`. Suite check logs now record
the compact CLI census above; their former per-file tiers, first twelve census
findings and full reachable paths require the opt-in command. Dry-run reporting
is unchanged: it retains the first twelve census findings and each file's lowest
qualifying resource tier. Delivered results put counts, tier and tier-share summaries,
lint summary and budget lines first; one detail count line points to the log
artifact instead of repeating per-file tiers or individual lint findings.
Dry-run puts the same summaries before its detail. Those census lines describe
existing debt; policy refusals are separate, stay named in full and fail the check.
Budget summaries count missing baselines instead of copying per-file diagnostics;
the run log retains every diagnostic. Oversized fresh and cached result messages
keep their priority summaries and log id before optional execution/selection detail
when those summaries fit the configured cap.
It inspects the entire tier manifest, independently of the selected test phases.
Import and call syntax distinguish the in-process fake harness and FakeClock
from process helpers and real timers; comments and planted source strings do not
count as resource use. The existing T1 hermetic admission still refuses real
machine resources.

Rules report disallowed tier imports/process helpers, numeric wall-clock waits,
elapsed-clock assertions (including local timestamp/delta variables), and T3
files without a lifecycle sentence in their first comment block. Contract and
scenario manifest entries are exempt from the header rule. A wall-clock finding
may be suppressed by a trailing `// lint-allow-wall-clock: <reason>` on the call's
line. A blank reason does not suppress it. This is syntax analysis, not a proof
of runtime reachability. A separate **reachable** diagnostic follows repository-local literal runtime
imports transitively (including helpers, fixtures and re-exports). Named imports
follow the exported declaration and its local value dependencies; unused helper
exports do not contribute resources. Module-level execution is always included.
Namespace, dynamic/require and `export *` imports may charge the whole module and
name that fallback in their diagnostics. The analysis does not evaluate branches,
injected arguments or method overrides; selected class declarations include their
members. Allowed seams and wait reasons do not suppress reachable resources.
It caches module analysis, export slices and resolution for one lint run; cycles
retain all resources. Declaration-only type imports/exports, external packages
and data imports are not followed. Resource diagnostics name the import chain and
location. `test:lint -- --details` lists every resource path; diagnostic dry runs summarize
resource kinds and show one highest-tier path per file to fit the protocol frame.
They never change the direct-source `qualifies` value or policy findings used by
admission and the tier lint gate. The qualifying tier never automatically retags
a file. The legacy hermetic manifest admission checks each test's own source only.

The default dry-run keeps all refusal-relevant checks but omits the report-only
reachability graph. Use `cland verify --dry-run --diagnostics` (or MCP `verify`
with `dryRun: true, diagnostics: true`) to include it, with a separate 120-second
request deadline. The default admission deadline remains 15 seconds. Direct
facts are cached by path, source digest and tier entry, bounded to 1024 compact
records without compiler ASTs. After startup and each observed dev-tip move,
the hub warms dev's facts in the background, yielding between files; admission
still reads current disk sources and judges each baseline independently.

Neovim files that use only `nvim/test/stub-hub.ts` may use the documented
`startClient` headless Neovim launch at T2. This exception covers that client
boundary only, not real hubs, sessions, arbitrary children or native process
probes. Stub-client teardown uses the owned child handle and observes its
process group's exit before directory removal; a restarted server retains
identity-based cleanup and belongs at T3.

### Neovim recorded frames

See the [per-test index](tests/index.md) for file-specific coverage and fixtures.

T2 client tests use `nvim/test/stub-client.ts` and `nvim/test/fixture.ts` for
scratch projects, condition waits and client ownership. Native/T3 callers keep
`nvim/test/harness.ts`. The hub's `tier-nvim.ts` compatibility export and the
Neovim client share one exact synchronous launch marker.

Both Neovim fixture entry points (`tempProject` and `createClient`) await the
neutral `test-support/admission.ts` guard before allocating directories or
starting the client. Its read-only discovery, transport and clock primitives
live under `shared/`; hub compatibility exports preserve their identities and
the typed `AdmissionTimeout`. Cached Neovim admission returns a fresh async
promise for each caller, preserving node:test resource attribution. Changes to
these shared paths keep full package selection, and the T2 import guard follows
them transitively.

`createClient` seals its launch environment by default with the shared
`fixtureEnvironment`: each client owns a disposable HOME, XDG and account roots,
synthetic Git identity and isolated Git configuration. Its environment argument
contains explicit scratch-owned inputs, not a copy of the parent environment;
credentials and Git overrides are filtered again after those inputs. Both the
direct binary and `cland-nvim` launcher use that final environment. The QA CLI
fixture, resolver fixtures and direct Lua hosts also use sealed environments and
disposable working directories. Stub replay delay controls remain explicit
runner inputs; ordinary inherited CLAND/NVIM variables do not reach the client.

`nvim/test/stub-hub.ts` replays committed JSON recordings for config, criteria,
visibility counts and frame projections. It retains scripted actions and frame
barriers, with no runtime hub import. A missing recording fails with the refresh
command. The T1 boundary guard reads every current T2 import closure, including
the stub; the workbench T3 recorder checks the catalog against hub-owned
producers and real `projectHub` attach snapshots. Ordinary T2 tests never load
those producers. The human QA CLI keeps its arbitrary/read-only scenario API
through the explicit T3 `qa-stub-hub.ts` adapter; it is outside T2 client imports.

Run `npm run test:nvim-fixtures` to capture existing stub consumers serially and
rewrite the live attach baseline. Full discovery follows runtime imports and stub
launch URLs through helpers, including non-T2 consumers. Test tiers alone do not
select recording files. Type-only dependencies and the shared client launcher
(`nvim/test/client.ts`, which only validates the stub command) do not make a
native real-hub test a recording consumer; `artifact-browser.test.ts` is excluded.
The named local-only checks `explorer-summary.test.ts` and
`hub-read-component.test.ts` are also excluded: they launch the stub client but
assert local Lua summary/decoder results without awaiting a stub frame. Incidental
startup traffic is not recording coverage. Other selected consumers still fail
if they record zero frames.
This maintenance command requires one-minute load below 15. A trailing test file refreshes that file while retaining the
catalog; `--from-recordings` regenerates existing inputs and the live baseline
without replaying client assertions. Use the full command after adding scenarios.
Capture runs must finish successfully with at least one test and no skips. The
recorder validates every requested file before replacing any fixture: each file
must record at least its existing slice's frame count (and at least one frame),
and the replacement catalog must contain at least as many frames as the current
catalog. An unavailable Neovim binary, incomplete run or reduced capture refuses
the refresh and names the affected file, leaving the fixtures unchanged. A
deliberate reduction of recorded scenarios requires updating the expected fixture
counts through a reviewed fixture change.
For an expensive consumer, `npm run test:nvim-fixtures -- --slice <test-file>`
also commits a per-file catalog under `nvim/test/fixtures/protocol-frames/`.
The parent test selects that slice for its stub processes; consumers without a
slice use the full catalog. A slice miss lazily loads the main committed catalog
once, so another recorded request ordering can still replay; a frame absent
from both catalogs is refused. Refreshing a
consumer updates its existing slice, and `--from-recordings` regenerates slices
from their recorded keys. The workbench recorder checks every slice against the
full catalog as well as checking that catalog against the hub producers.
Review the generated JSON with the assertions that consume it. The catalog
interns repeated JSON nodes, binds transient machine paths, UUIDs and timestamps,
and retains the seven-day visibility age class and original wire values.

`node hub/test/nvim-selection-replay.ts [dev-ref]` reports the latest 40 task
landings against the current importer graph, failing an incomplete window or any
T2 selection decided by a runtime hub import.

### Runtime tier resource report

The suite runner preloads a resource tripwire in each manifest-declared T1/T2
worker before loading its test file. It runs in ordinary package phases, explicit
manifest test targets and load-gate repetitions. T3/T4 workers retain their native
APIs. T1 reports child-process starts and socket listen/connect
entry points (including HTTP, HTTPS, TLS and fetch through the shared net boundary); T2 reports child-process starts. The documented `cland` and
`clandWithEnv` helpers exempt only their synchronous CLI launch in T2. Calling the
same CLI directly is still a mismatch. The `clandCliLaunch` boundary also admits
exactly two shipped CLI subjects: `/bin/sh .agents/skills/qa/qa-record.sh …` and
`node --import hub/test/v01-migration-cli-preload.ts hub/bin/migrate-v01-release.ts …`.
Commands and entry paths are resolved against the worker cwd; the migration
preload is mandatory. This closed set grants only the synchronous `execFile`
launch, with no permission for altered entries, other process APIs or async
descendants. Incidental executable discovery uses filesystem PATH facts.
In Neovim T2 workers, `startClient` also
exempts only its synchronous `spawn` with the exact headless client arguments.
A direct lookalike, altered arguments, a different process API or async work
outside that launch still trips; native Git/ps probes and fake harness binaries
are not exempt.

Each `tier-mismatch {…}` line carries file, full test name, declared tier,
resource, mode and the first stack for that test/resource pair. It never includes
call arguments, environment values or command lines. `CLAND_TEST_TIER_MODE` is
the single rollout setting: `report-only` by default, `enforce` when D53 goes
hard. Report-only delegates to the real API without changing the test result;
enforce reports and throws at the call. Its receipt remains a hard run failure
after assertion quarantine, even if the error is caught or the worker exit code
is reset. Each load repetition checks its own receipt before excusing assertions.

Names use Node's public [`getTestContext()`](https://nodejs.org/docs/latest-v24.x/api/test.html#gettestcontext) when available. On Node before 24.19,
the tripwire stays active with file-only attribution and one missing-API warning
per instrumented worker. Import-time calls and file cleanup have an explicit
file-level label. Node 24.21 attributes global hooks to their owning scope (for
example `<root>` for file-level `beforeEach`), while test bodies use their full
nested names. No global async hook or per-test instrumentation is added.

### In-process harnesses

Hub rules use `projectHub(t, root, env, { clock })` by default,
with a `FakeClock`. It replaces Claude Code, Codex and OpenCode under their real
harness names, so `roles.toml` launch choices still work. The returned `fakes`
map exposes each adapter. `probes: 'fake'` supplies no-repository Git answers and
an in-process lock identity, so startup and teardown spawn no infrastructure
processes either. A test needing branch/provenance facts may override `git` and
`readBase`; a lock test may override `processes` (`alive` and `started`).
`projectHub` defaults to fake harnesses and probes; explicitly supplied adapters,
Git, base-reader, territory and process facts take precedence. T3 contracts and lifecycle
files opt into production defaults by importing `nativeProjectHub` (which passes
`harnesses: 'native', probes: 'native'`). Either option can also be selected
independently. Receipt-only suite fixtures may inject `compatibility` holder/occupied
observations and a process table for lease identity reads. `serveProject` retains
its production Git, lock and ps defaults. Import `NO_PS` only from
`hub/test/native-process.ts` in native tests; importing the generic harness never
probes the OS. For a lower-level fixture, use
`fakeHarness(flavour, { host, clock })` from `hub/test/fakes/harness.ts`.
Capabilities and first-clause semantics come from the production adapters.

The test drives `busy(name)`, `idle(name)`, `turn(name, { afterMs, usage, model })`,
`exit(name, code)` and `crash(name)`. No process or automatic turn starts.
`spawns` records full launch requests (including clause, brief, cwd and policy).
`scriptInject(name, ...outcomes)` queues `accept`, `reject`, `uncertain` or `hold`;
`{ outcome, afterMs }` schedules an outcome on the injected clock. A held inject
settles through `settle(name, messageId, outcome)` or the adapter's `confirm`.
Use `feedUsage`, `model` and `scriptResume(name, 'found' | 'gone')` for reports and
recovery. Inspect `injections`, `stops` and `resumes` for adapter receipts.
The fake supplies the harness adapter only: connect the session's protocol peer
in-process or over a test socket and acknowledge delivered frames as usual.

For a role-bearing MCP caller, use `inProcessSpoke(t, { discover: true, cwd: root,
name: 'impl', role: 'implementer', sessionId: 'impl-id' })` after `projectHub`.
It accepts the same options and returns the same `Session` API as `spawnSpoke`:
tool calls, channel events, presence waits and logs. The real spoke handlers run
over an in-memory MCP transport; their `HubClient` uses the real WebSocket edge.
Each spoke closes automatically before the hub's teardown and checks its owned
resources. `close()` is idempotent and can be called early to test offline routing.
Its `pid` is 0 because there is no child: use `spawnSpoke` in T3 for process signals
or a real stdio binary contract.

The fake harness **binaries** in `hub/test/fakes/{claude-code,codex,opencode}`
are reserved for one real-binary adapter contract file per harness and T3
scenarios. They are not the default for routing, roles, subscriptions or tracker
rules. Existing files migrate under E-677; new tests use the in-process adapter.

### Human kinds and queued withdrawal

See [hub/test/topics-component.test.ts](tests/hub-test-topics-component.test.ts.md) and the [per-test index](tests/index.md).

### Waiting for an observable condition

Use `until(predicate, { what })` from `hub/test/harness.ts` for a condition
without an event API. It yields to I/O between observations and owns one deadline,
including asynchronous predicate time. The failure names `what`; the final
assertion still states the behaviour proved. `timeoutMs` defaults to the harness
wait budget (15 seconds, or `CLAND_TEST_WAIT_MS`). The deadline is multiplied by
`CLAND_TEST_LOAD_FACTOR`; absent an override, the executor default is 2 on a
droplet and 1 locally. Invalid factors fall back to 1. Tests of the helper inject
one complete `Clock` and a `loadFactor`, without waiting for real time.

The heartbeat reconnect regression in `hub/test/hygiene.test.ts` is the worked
example. Its hand-written loop slept 25 ms after each probe. It now waits for
the observable fresh hello, then keeps both identity assertions:

```ts
await until(async () => {
  after = await connectedAt('alpha');
  return after !== undefined && after !== before;
}, { what: 'a fresh alpha hello after heartbeat reconnect' });
assert.ok(after !== undefined && after !== before);
assert.equal(await connectedAt('beta'), betaBefore);
```

For live journal file observations, `hub.status { flushLogs: true }` drains the
accepted prefix; later producers can already be appending when the reply arrives.
Use `completeJournalLines` from `hub/test/journal-lines.ts` before parsing: it
defers only the unterminated tail and still fails on malformed complete JSON.
Wait with `eventually` for the exact record ids/events being asserted, keeping the
final assertions. `subscription-frame.test.ts` and `subscriptions.test.ts` wait
for both `event-delivery` and `injected` for their message id; the T1 regression
in `journal-flush.test.ts` exercises every cut of a following record.

Prefer a frame, journal receipt or fake clock when one exists. A negative assertion
needs a positive completion boundary or fake time; an already-true predicate does
not prove that nothing happens later. Existing intentional expiry waits remain
part of the baseline until migrated.

Rule 9's boundary depends on the assertion. Worked examples:

- **Neovim rows:** after navigation or resize, use `waitScreen` for the anchored
  item row and the fields the assertion reads, then keep the exact row, order or
  highlight assertion. A connected client or updated panel title can precede the
  content render; see the row wait in `nvim/test/vboard.test.ts`'s `select` helper.
- **Worker PID:** after `f.launch()`, use `await f.workerPid(job.id)` to read the
  matching live job record and register ownership for cleanup. The launch reply
  can still have a null PID. Before fault injection, also observe the relevant
  package-start log or filesystem marker; keep the crash/recovery assertions
  (`hub/test/suite.test.ts` and `hub/test/suite-recovery.test.ts`).
- **Tracker frames:** subscribe before the mutation, then wait for a `task` frame
  matching both the item id and the expected transition, such as released holds
  and `status === 'review'`. Assert the resulting claim/status as before; request
  acceptance or an attempt timestamp does not prove the continuation published
  its result (`hub/test/tracker-ready.test.ts`).
- **Demo setup:** successful `demo.start` calls use `startDemo` from
  `hub/test/demo-start.ts`. It arms a lease observer before sending and waits
  for a new matching lease with `state: active`, `execution.delivered` and
  `demo.ready`, excluding leases from earlier starts. Setup has the remote
  fixture's load-scaled 30-second bound; the correlated result has a separate
  load-scaled five-second bound after that durable receipt. Keep the caller's
  result and behaviour assertions. Refusal tests use the ordinary request seam
  because a refused start must never produce a ready lease. Set
  `CLAND_TEST_DEMO_START_TIMINGS=1` for observed lease/provision/delivery/ready/reply
  times and persisted preparation/provider timings. Observation times are
  sampled upper bounds; scripted lease timestamps use the fake clock.

### Real-binary adapter contract checklist

Each harness has one T3 manifest entry `{ "tier": "T3", "contract": "<harness>" }`.
Its header maps each of these steps to the test that proves it once through the
fake binary and the real spoke, hooks/mod or native protocol:

- Launch and the harness's attach command.
- Role clause in the first native turn.
- Delivery through the adapter bridge to `injected`, with the reply correlated to its input.
- Harness signals reaching session state, including approval and failure where supported.
- Model and usage reports, matching the advertised capabilities.
- Stop; resume across a hub-process restart; native-conversation relaunch.

Input permutations use a table at the environment/planning seam, with one binary
frame proof. Hub-owned brief ordering, artifact envelopes and Lead claims belong
in `hub/test/adapter-composition.test.ts`, shared across all three flavours.
Contract files retain assertions about the native first-turn/transport boundary;
they do not repeat the shared hub rule. Negative assertions wait for a positive
completion receipt or use fake time. Record a declaration-by-declaration assertion
map, before/after file seconds and process-start call sites in the review evidence.

## Fixtures

See the [per-test index](tests/index.md) for file-specific coverage and fixtures.

Cleanup requires positive ownership receipts: a child-owning helper settles after its process and pipes close, including deadline and spawn-error paths. Close writer admission before draining a process-backed fixture, and register each invocation before its first write; regressions cover both present and missing ownership evidence. Missing evidence does not authorize orphan cleanup; see rule 12 for directory removal (A-8634 R7; T-552, T-972, T-974, T-1035).

Tests consuming generated assets, build outputs or copied projects declare and check their own prerequisites on every shard, with fixture-owned output directories for present and missing cases. Resolve paths and lists from shipped scripts and workspace metadata. Put static wording/size contracts at T1 and only delivery at the live boundary; runner prerequisites name the consuming worker (A-8634 R11; T-955, T-978, T-1019, T-1023, T-1031; A-9063 R8 source T-1096).

Rule 15: shared fixtures use the pure `test-support/fixture-environment.ts`
(`hub/test/fixture-environment.ts` remains a compatibility export) to replace
inherited HOME, XDG, account roots and Git configuration with worker-owned scratch
paths. Every inherited `GIT_*` override is removed, including `GIT_DIR`,
`GIT_COMMON_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, object directories, templates
and inline/system config. Filtering runs again after extras. An inherited
`GIT_DIR` plus an implicit `git init --bare` can rewrite a parent repository's
shared config even when cwd and HOME are scratch-owned. A linked worktree of the
live project is not a disposable repository for these probes.
Git system/config injection and inherited identities are removed.
The builder supplies `Fixture Test <fixture@example.test>` as both author and
committer so commits, rebases and releases never depend on host identity detection.
Tests may override these defaults with explicit synthetic Git identities in extras.
Ambient SSH-agent, askpass, npm/yarn configuration and other credential-file
handles are removed from both parent input and extras too.
`accountFixtureEnvironment(extra)` admits the worker and applies that builder;
use its complete result for child launches, with no later environment overlays.
Explicit profile/fake paths and Git identities must be scratch-owned. Provider
and account credentials are filtered after extras, including the shared
`withoutExecutorCredentials` filter. HOME and Git configuration cannot be
overridden. The T0 child-environment guard above enforces the builder boundary
for native launches, with reasoned inline exemptions for reviewed seams.
The sealed init/setup machine seam preserves its owned HOME and deliberately
unset profile inputs through `machineEnvironment`; re-rooting it at the project
would change the product's default-account and trust-file contract. Its native
self-tests may deliberately supply synthetic poison inputs, with an adjacent
exemption. The scratch-machine constructor filters inherited credentials first. The init
machine clears worker-default Git identities so its absent/configured Git identity
contracts use only its disposable HOME configuration.

Account product contracts may supply `projectHub`'s typed `scratchAccountPaths`
dependency for HOME fallback and a conflicting OpenCode database. Both paths
must be absolute and contained in that fixture's disposable project. Ordinary
HOME/OPENCODE_DB extras stay sealed; these explicit inputs preserve default,
exclusion and restart assertions without exposing a machine account.
Native Git contracts may supply `projectHub`'s typed `scratchGitConfig` with an
`excludesFile` inside the disposable project. `scratchGitEnvironment` admits only
that named `core.excludesFile` setting through `GIT_CONFIG_COUNT/KEY_0/VALUE_0`;
arbitrary Git config extras remain filtered. The remote fixture's `gitExcludes`
option writes that file inside its own project and reapplies the typed setting
after sealing the hub environment. Provider fixtures must pass their typed
`syntheticProvider` dependency again on daemon restart; env extras alone do not
preserve its sentinel token.

The pure T1 poisoned-parent/overlay test is `fixture-environment.test.ts`.
The native T3 bare-init/clone proof in `territory-cli.test.ts` compares the scratch
parent's config bytes after each operation, including clone from a linked cwd.
`init-machine.ts` and `init-fixture.ts` also use the shared builder; child extras
must never be spread onto an already sealed result. The scratch machine removes
the builder's `CLAND_EXECUTOR_STATE` default so its own scratch HOME/XDG ledger
and legacy migration paths remain the product defaults under test.
`claude-code-accounts.test.ts` deliberately injects three synthetic auth variables
at the native adapter seam to prove default-account inheritance and named-account
exclusion. Such credential-handling tests never inject into shared fixture defaults
or use real credentials. Diagnostics print variable names or counts, never values.
Fake DigitalOcean transport records in `machine-calls.jsonl` keep sorted environment
variable names only. The shared writer has a T1 durable-file regression proving
that a synthetic credential value and other environment values never reach the log.

Provider contracts use the separate typed `syntheticProvider` fixture dependency
(`projectHub`/`startDaemon`) or `clandWithProvider` for the provider CLI. It accepts
only `cland-test-…` sentinel tokens, paired with an explicit HTTP loopback endpoint
with a port, or the exact fake API injected through `droplet.api` for an embedded
hub. Arbitrary env extras cannot enable this exception. `synthetic-provider.ts`
validates the dependency before adding its sentinel to a sealed environment;
its pure rejection proof lives in `fixture-environment.test.ts`.
Migrated seams are the remote fixture and its restart callers, executor lifecycle,
executor liveness, native/component preparation (including reopen paths), and
suite dry-run contracts.
The manual `inbox-load.ts` probe uses the same pure builder under its disposable
project; run it only on a quiet machine through the project's load policy.

Use `projectHub(t, root, env?)` from `hub/test/harness.ts` for project tests by
default. Each test serves its own project through `serveProject` in the test
process, with normal discovery, Unix socket and WebSocket edges. Real CLI
subprocesses, discovering spokes and fake harnesses keep their production
protocols. Pass environment overrides to the fixture; never temporarily mutate
`process.env` for one hub. Teardown stops the served hub, disposes the fixture's
owned processes, then fails on surviving owned handles, timers or process
listeners, with `process.getActiveResourcesInfo()` diagnostics.

Hub scheduling tests pass one complete clock at the fixture boundary:
`projectHub(t, root, env, { clock: new FakeClock() })` (`hub/test/fake-clock.ts`).
`await clock.advance(ms)` runs due hub timers in deadline order and yields to
real I/O between callbacks; then await the expected frame or journal record.
The clock covers timestamps and hub schedules together, including heartbeat,
inbox notifications, archive/usage windows and retention. Use the same clock
for every time-dependent collaborator in a fixture. Bare `now` overrides are
refused; inject a complete Clock instead. A real-process fixture that needs
progressing native schedules may explicitly supply an offset real clock.

Give that shared clock one advancing driver. Before advancing, observe the timer
wait under test and native I/O receipts from every participant sharing the clock.
`FakeClock.advance` is not a completion barrier; repeated advances must not stand
in for those receipts.

`Suites.#check` coalesces: a due interval during an in-flight check returns that
check instead of queueing another tick. A check extended by avoidable I/O can
therefore swallow the rest of an advance window, and a stall, timeout or admission
assertion then misses the tick it expected. Keep new awaits off the check and
queue-publish path; refresh caches between ticks and let explicit reads pay for
themselves.

Do not mock global timers in a `projectHub` scheduling test: sockets, journal
flush and I/O retries, native transport/reconnect and kill deadlines, AccountPoller child-process deadlines and suite
execution keep real time. AccountPoller eligibility and Claude directory schedules
use the hub Clock. Verification-wait metrics alone use hub time.

Keep `startDaemon` only when an assertion concerns the hub process: startup,
shutdown, signals, crash/restart, lock/discovery/PID identity, orphan sweeping,
watchdog behavior, or CLI behavior with the hub down or unreachable. Session
stop, resume and native harness crashes alone do not require a spawned hub.
New tests using `startDaemon` must name the process lifecycle behavior they
prove. Do not share one project hub across unrelated tests. Validation duplicates
may call the existing dispatcher or tracker directly while retaining one real
frame proof per tool/refusal family; adapter parsing edges use a fake native
transport while launch/inject/turn/stop/resume retain frame coverage.

Package runners set a 120-second default per-test timeout (`[verification].test_timeout`).
The local verification worker stops a command after ten minutes without stdout
or stderr (`[verification].stall_timeout`), reports the last started tests, and
reaps the verified process tree before releasing its leases. Both settings accept
positive durations such as `"120s"` and `"10m"`; explicit test-level timeouts
override Node's default. Droplet runs also have their enforced total `run_timeout`.
Droplet verification uses the same admitted `stall_timeout` (default `10m`). The
hub watches new stdout/stderr bytes in the mirrored suite log; status replies
and failed log reads do not renew it. Collection normally polls every 10 seconds and checks
earlier when the silence deadline falls between polls. With a responsive
transport, detection is bounded by `stall_timeout` plus that 10-second progress
interval. The hub checkpoints observed output before appending mirror bytes;
replaying bytes after restart retains that original silence boundary. It reports a
`timeout` with in-flight file/test receipts, cancels the run and releases its
droplet through the ordinary confirmed-release path. Cleanup/accounting can take
additional time after detection. Each shard has its own silence bound.
A deadline interruption reports `timeout: N tests completed, M failed` before
in-flight diagnostics, preserving completed pass/fail/skip counts. An unfinished
test is labelled `in flight`; `hung` requires an observed native `testTimeoutFailure` receipt for that
identity, proving its own effective timeout expired (including explicit overrides).
Elapsed time beyond the run-wide default alone and unknown per-test budgets never
establish a hang.
When an inherited-pipe writer cannot be verified, the result explicitly says
cleanup is incomplete, Agents and the inbox receive one warning, and the queue
is released. Unknown processes are preserved; exact fast-writer ownership is
the follow-up T-410.

Implementers run verification through the hub, one invocation at a time per session:

```sh
cland verify --report <item-topic> --to <reviewer-name> --to <your-name>
```

D29: submit task runs with no mode. The diff and coverage selector chooses T2 files under the queue-enabled T0–T2 protocol above. A flaky-gate second receipt uses that same selection. The hub verifies T3 in configured merge batches and periodic dev runs; the Coordinator requests integrated occasions at stage and epic close and before release. `all` is reserved to the Coordinator, the human and authorized occasions.

Task runs may report `hub-selected`: changed hub tests and tests covering the
changed functions, filtered to T2 after selection. All T1 files still run.
A changed hub source imported by Neovim selects the Neovim T2 files reaching it
directly or through `nvim/test` helpers. Declaration-level `import type` and
`export type` do not create runtime dependencies. Inline type specifiers retain
module execution under Node type stripping, so those imports and re-exports
still count. A coverage fallback selects all T2 in both packages, including for
harness or process-cleanup changes. The report names the deciding functions,
selected Neovim tests and coverage artifact. T3 smoke remains in integrated and
legacy package plans.

### Shared read-path load selection (T-1203)

`hub/test/tiers.json` may declare an optional `loadGuards` object mapping
repository-relative source globs to nonempty arrays of T4 test-file paths:

```json
"loadGuards": {
  "hub/src/adapters/sessions.ts": ["hub/test/inbox-verifier-load.test.ts"]
}
```

Globs use Node's `path.matchesGlob` syntax, including `**` and brace alternatives.
Task admission matches the same fetched-dev/dirty/untracked diff paths used by
package selection. Each matched guard joins the changed T3/T4 duration-check file
set once, independently of coverage or fallback, and the selection report says
`T4 hub/test/inbox-verifier-load.test.ts guards hub/src/adapters/sessions.ts`.
Overlapping globs and a changed guard do not duplicate its execution. Unmatched
T4 files stay deferred; fallback never selects the whole T4 tier. Queue protection
must be enabled in both the candidate and hosting hub, as for changed T3/T4 files.
The selected T4 base phase enables soak and receives no load-gate repetitions.
Manifest lint and admission reject malformed maps and missing or non-T4 targets.

T-1147's `session.list` read path is mapped at `hub/src/adapters/requests.ts`,
`hub/src/adapters/sessions.ts` and `hub/src/hub/core.ts` to
`hub/test/inbox-verifier-load.test.ts`. That guard exercises sustained delivery/list
bursts and bounds pending reads, indexed queries and coalesced updates. Keep this
map beside tier assignments when extending a shared read path or its cost guard.

### Coverage ancestry and fallback

Clean integrated `dev` full runs record per-test-file V8 coverage, including the
CLI, lifecycle daemons, spokes and fake harness descendants, and publish a
function-range map with their head and canonical candidate tree. Close-run shard
maps merge into one artifact. Task runs never refresh the map.

Admission reads the newest artifact whose head is an ancestor of the task's merge
base. `[verification].coverage_max_age` is a positive duration, default `"2d"`.
This is a reporting threshold: an older ancestor map still selects when every
hunk maps through the intervening diff, with its age and the limit in the report.
Missing, invalid, future-dated or unrelated maps keep the package rules and name
the reason. Protocol/contract, package, harness, fixture, runner and executor changes,
unsupported paths, unknown source files, missing covering tests and hunks changed
since the map also keep those rules. A top-level insertion or edit, or a hunk in
an untested function of a mapped `hub/src` file, instead selects all tests covering
any function of that file, plus `HUB_SMOKE`; the report names this widening. A
file with no covering tests still falls back.
Unchanged lines are translated from the merge base back to the map across the
intervening diff. Integrated full runs remain the regression backstop; a selected
run can miss a regression which the next batch detects.

Coverage artifacts remain the source of truth; `.cland/run/coverage-maps/` holds
rebuildable pointers shared by linked task worktrees.
Pointers record the artifact's `created` and `head`; ordering uses `created`,
with the pointer mtime as the fallback for legacy pointers. Admission lists only
these small pointers, then parses one artifact at a time, newest first, stopping
at the first valid ancestor. Shard aggregation retains one incoming map beside
its result accumulator. `[verification].coverage_map_retention` is a positive
integer (default `10`); after config reload, the next map publication keeps that
many newest pointers. Each removed pointer emits `coverage-pointer-expired` with
its pointer path and artifact id. Artifact copies remain governed by ordinary
artifact retention; pointer expiration never deletes or archives them.
`hub/test/suite-coverage-selection.test.ts` counts maps parsed and retained at the
loader seam, asserts the retained pointer set and expiration events, and preserves
shard attribution. Use these deterministic receipts instead of RSS/GC assertions.
Cache reuse for
`hub-selected` also requires the same selected tests and Neovim phase, including
its explicit importer subset.
`node hub/test/selection-replay.ts <first-parent-range> --coverage` prints the last
40 task landings from a disposable mirror clone with private HOME/XDG/Git config
and filtered inherited Git redirects and credentials. The caller stays read-only;
checkouts use committed sources, while coverage maps, durations, retained logs and
`--failures` inputs are read from the caller. It needs no network or harness login.
It reports the selecting count, missing-map fallbacks, deciding functions and each selected share
of hub test-time. `--nearest` explicitly labels retrospective maps that may postdate
the merge; live admission always requires an ancestor and mappable hunks. Supply
`--failures <json>` to include historical failed test paths keyed by full/short
merge SHA. The replay also reads retained suite logs by item and names their count; old logs
without source identities remain unavailable rather than guessed.
An optional positional selector git ref loads both its package and coverage selectors
for before/after comparisons on the same range and maps.
`--count N` changes the replay window (default 40); an incomplete window exits 2.
Exit 1 reports own or historical misses for inspection; the agreed own-test bar
and historical miss causes are reported separately.
Shares use the current duration manifest, rather than claiming historical wall
times. The replay bar is zero misses on those merges' own changed/added tests;
every wider miss must be listed with its cause.

Close runs on integrated `dev` use `cland verify all --occasion stage|epic|release --report <topic>`. The Coordinator sets any occasion; QA may set `epic` for the epic demo. The hub requires the clean project-root `dev` head to match freshly fetched `origin/dev` and refuses other roles or task heads. The MCP `verify` request accepts the same `occasion` field. An ordinary Coordinator integrated `cland verify all` on the same clean root `dev` head may shard too, with no occasion or stage provenance. The hub-owned merge batch and nightly soak each use one slot. Task heads and non-Coordinator requests without an authorized occasion use one slot. A local executor still uses one local slot.

Every `after-stage` stage, even with `qa.scope: none`, needs green integrated full-suite receipts at one verification tree from a Linux droplet `--occasion stage` run and a macOS local run. Non-none scopes additionally need a clear stage QA verdict on that tree. Per-item stage gates are unchanged. `task plan show` and stage-run results name missing platforms and the expected tree. Submit the missing run separately: the usual stage request for Linux and `cland verify all --occasion stage --executor local --report <topic>` on the Mac. Stage-request cache reuse preserves executor/platform; Linux stage evidence must come from a stage run (sharded, or the documented one-slot fallback). A completed stage retains its tested tree across later descendant builds while its plan and landing evidence remain valid.

After a restart, stage tree and ancestry checks run in the background. `task plan show`
labels unresolved platform evidence `pending`, separately from a genuinely missing
cover. JSON stage covers expose optional `pending` platform names beside `missing`;
unresolved stage QA verdicts omit `current`. Pending evidence cannot close a stage
or advance its next stage. The restart proof is in `stage-qa.test.ts`; tree and
landing checks have lower-tier coverage in `stage-closure-component.test.ts`.

A remote close run or ordinary Coordinator integrated full run uses the free remote slots up to `[verification] shards` (default 2), balances hub files largest-first by `hub/test/durations.json` (unknown files use its median), and places Neovim on the lightest hub shard. Each droplet preserves the free/machine resource classes. Before creating any droplet, the hub atomically reserves every shard's lifetime cost in the shared spend ledger against the project's daily cap ($3 here). Fewer than two free slots or an insufficient cap gives one whole run on one slot and one warn notice, `sharding skipped: fewer than 2 remote slots free` or `sharding skipped: daily spend cap $3 would be exceeded`. Other executor unavailability follows the configured local fallback.

One result sums counts, labels failures by shard, and includes each machine, size, duration and cost, total cost, and wall time from admission through final collection. Each `shard duration` spans admission through the durable remote finish, for successful and failed receipts alike; live polling and restored receipts use the same boundary. A separate `shard collection` line spans remote finish through final log/coverage collection and machine release (or the bounded accounting wait). Missing timestamps are labelled `unavailable`. Collection completion is persisted independently, so reporting retries do not extend it. The merged `suite duration` remains the overall wall from parent admission through collection of every shard. Recovery downtime never extends a finished run’s `runMs` or the queue estimates based on it. Each shard has a log artifact beside the merged log. A failed or lost shard fails the run without an automatic retry; cleanup must be confirmed before its slot is released. At $0.25/hour per c-8, two ten-minute droplet lifetimes estimate $0.0833 total (provisioning and cleanup count too); read the measured cost in the result. Cache reuse requires identical tree, mode and soak coverage, so an ordinary T1–T3 integrated run cannot satisfy a T1–T4 occasion; stage requests additionally match executor/platform and require stage provenance for Linux cache hits.

An entirely unexecuted shard group finishes unavailable with every shard's cause:
`provider-capacity` when all refusals are capacity, `infrastructure` when any
bundle admission, acquisition or delivery fails before worker submission. Restored
delivered leases and start acknowledgement failures retain their
executed-or-unknown outcome. An unexecuted group supplies no red/green cover or
culprit search. Partial execution
keeps executed counts/failures and `shard not run` causes in the summary, including
the compact priority summary, and never passes. Use the sealed T1 scheduler seam
in [suite-cover.test.ts](tests/hub-test-suite-cover.test.ts.md); the T2
`suite-close-component.test.ts` pre-lease refusal case retains the public notice.

Before the first source review, fetch and merge `origin/dev` into the task branch, then commit and push the head to review. After that review, take dev changes only through shared fixes posted by the Coordinator; merge dev again only on its request or after a merge-conflict refusal. Request source review first. Only after a clear source verdict, run `cland verify` at the exact reviewed head. A fix or later merge that changes the head needs a new source review before a new run. The Reviewer settles the final verdict when the same-head result arrives; source-only criteria may be verified earlier, while run-dependent criteria stay unverified until then. The CLI prints the run id, worker PID (null while queued) and hub queue position, then exits. Go idle: the hub delivers one result with the exit code, test counts, failures, branch/head and durable log artifact.

If the CLI writes a submission but receives no reply within 15 seconds, it exits
75 with ``submission sent; no reply within 15 s; check `cland verify queue` before resubmitting``.
This is an unconfirmed submission, not a failed run. Check the queue first. The
hub persists an idempotency key for the session, worktree, head and requested
mode: retrying while that run is queued or running returns the same run id and prints
`already queued/running: <id>; no new run` (`reused: true` in JSON).
After a terminal run, ordinary cache and `--fresh` rules apply, so a red run can
receive another receipt. Dry-run and pre-write timeouts retain their ordinary
failure outcome because they did not submit a run.

`cland verify` uses the project's `[verification] executor` (`local` by default).
`--executor local|droplet` overrides it for one run; use `--executor local` on a
macOS host for a macOS-only question or when the human asks. The result's executor
line follows its branch/head, for example:

```text
Executor local · <os> <arch> · Node <version> · Neovim <pin>
Executor droplet · c-8 lon1 · <machine> · linux x64 <release> · Node <version> · Neovim <pin> · lifetime 1398 s · cost $0.0971
```

The worker measures Node on its PATH and the candidate's Neovim pin (`none` for
fixtures without a pin); cache hits retain the original executor and platform.
A green same-head Linux result supplies gate suite evidence. It lists macOS-only
cases as `suite skip` records; they run in the release's final local suite
("Release v0.1.2 from the item"). A full suite costs about $0.10 on c-8 at $0.25/hour;
c-16 is $0.50/hour, twice the hourly price, with cost depending on elapsed lifetime.
These are estimates; see [executor costs and configuration](../../hub/README.md#remote-executors-droplets).

When droplets are unavailable (missing token, refused create, no prepared snapshot,
unavailable size, daily cap or dirty candidate), the hub posts a warning:
`verify <id>: droplet unavailable (<cause>); running locally`. The requested run
still happens, through the local queue; wait for its result rather than resubmitting
or handling a droplet yourself. This fallback applies when the executor flag is omitted and
`[verification].local_fallback` is `true` (the default). This project sets it to
`false`: default droplet requests wait for remote capacity and never run locally.
Other acquisition failures are reported without local execution. An explicit
`--executor local` still uses the local slot, and human `npm test` is unchanged.
An explicit `--executor droplet` never falls back: it waits for remote capacity,
refuses submission if the daily spend cap cannot cover its reservation (naming
the cap), and reports other remote acquisition failures without running locally.
Acquisition rechecks and reserves spend atomically, so a cap reached after
submission fails that run rather than moving it to the local queue.
Only the hub creates, lists and deletes droplets; `cland executor status|prepare|reap`
belongs to the human and Coordinator.

The worker survives the caller's shell exiting. The hub keeps its run record across restart; a killed worker produces a result naming the signal while the hub is live, or a missing-exit-receipt crash report after restart. A permission change can hold reporting: `cland hub status --history --json` exposes pending runs and their reporting error; restoring permission lets the hub retry without duplicating a committed result. A recipient hygiene refusal holds the whole result until every intended recipient is admissible, so a partially muted recipient cannot lose its report.

Omitting the mode selects phases from the branch diff against freshly fetched `origin/dev`, including working changes. Linked worktrees share one in-flight dev fetch per canonical Git common directory, bounded to five seconds; each admission diffs against its captured commit. A failed fetch may use the last known `origin/dev` only if it has a merge base with the candidate, with an explicit warning. That ref does not count as fresh-fetch proof for an integrated occasion. Without a usable base, selection falls back to full. Fallback warnings retain sanitized Git stderr and appear in the first result lines, including capped and cached reports. `all` or `--all` forces full only for the Coordinator, the human shell or an authorized `--occasion` request. Other sessions receive `verify-all-reserved` with the automatic diff selection and no queue entry. A flaky-gate second receipt is another ordinary diff-selected verify, with no mode. Integrated `dev`, shared or ambiguous changes, empty diffs and fetch failures without a usable base run full. A package-local diff runs that package plus the cross-package smoke baseline; `hub` and `nvim` reduce only matching qualifying diffs. The duration line and report include the mode, reason and deciding files. See [phase rules and smoke baselines](../../hub/README.md#tests). Each run first executes `npm run check` (typecheck and test lint) when the candidate declares it and `test:lint`, otherwise `npm run typecheck`, then the package test script from the calling worktree. For queue-enabled tiered task branches the task tier cap applies after package selection: all T1 and selected T2, plus changed T3/T4 files and mapped T4 guards once; remaining process smoke is deferred. `--report` names the result topic (default Agents, addressed to the Coordinator); repeat `--to` to name recipients. With a session name in `--report`, the hub uses the caller's claimed item topic and addresses that session. Log and coverage artifact chips follow that topic. Automatic run reports, search/blocked/skip notices, merge-batch notices and quarantine proposals use Agents. General retains the Coordinator harness-exit and ten-minute vacancy/recovery notices because they need the human's action. Reporting uses the caller's stable session identity and current artifact/send permissions; an Implementer needs its own item topic or a topic with a delivered request.

The hub persists the request, exact head, item, diff selection, enqueue time and priority in its database before acknowledging it. Admission gives the Coordinator's integrated dev requests first priority, then human `npm test` waiters in enqueue order, then the item rank captured at submission, then other requests in enqueue order. The local slot admits one run; `[verification].remote_budget` admits parallel
droplet runs beside it (a positive integer, 4 by default; this project's D27 build value is 2). The scheduler walks the
ordered queue past waiters whose slot is busy. Remote acquisition reserves a slot
through confirmed release and each acquire checks the shared daily spend cap.
When remote slots are full and the local slot is free, a default droplet request with
`local_fallback = true` falls back
locally with a warn notice naming `remote budget <n>/<n> full` and a
`verification-executor-fallback` record with cause `remote budget full`.
A request that already recorded a `remote budget full` local fallback, but has
not been admitted locally, reclaims a freed remote slot in its original queue
order, including across hub restart. Its topic and recipients receive
`verify <id>: remote capacity available; moving queued local fallback to droplet`,
and the journal records `verification-executor-reclaimed`. Other acquisition
failures stay local, and explicit `--executor local` requests stay local.
An explicit droplet request, or a default droplet request with `local_fallback = false`,
remains a remote waiter, including when preparation
or unconfirmed cleanup holds the remote budget; later local requests can proceed.
The hub persists a finished remote run's outcome and collected log before cleanup.
Its final result waits up to 120 seconds on the hub Clock for confirmed lease
lifetime and cost. If release stays unconfirmed, the result marks accounting
"pending confirmation"; the executor retains its remote reservation and retries
lease recovery every minute, independently of the ten-minute orphan sweep. This
lets a late provider deletion confirm within the six-minute recovery bound. Once
the durable lease confirms release, the hub posts one
accounting correction in the same topic. Restart resumes from the saved outcome
without polling the deleted machine and retains the wait window/correction state.
Sharded parents also report despite a broken spend ledger once all shards have
reported. The executor retains durable group-release requests and retries them
during reconciliation, including after restart and for shards with no lease.
The T2 cases in `hub/test/suite-close-component.test.ts` corrupt only the scratch
ledger, observe the parent receipt and freed scheduler slots, then repair the
fixture and prove both lease settlement and pre-lease reservation recovery.
`--executor local` and human hand runs use the local slot behind compatibility leases. The queue and its order survive restart; a known dead requester's queued run becomes one hub cancellation note to its original recipients. A disconnected spoke alone is not evidence of death.

`cland verify queue [--json]` prints `local: <holder or none>`, then one
`remote <active>/<budget>: <session> · <item> · droplet <name> <size> <region> ·
since <t> · ETA <d>` line per remote run, then ordered waiters with their requested
executor, elapsed wait and admission ETA. Remote-only waiters are labelled
`waiting for remote` with their queue position; their ETA uses remote capacity only.
JSON identifies them with `waitingFor: "remote"`. Acquiring machines are labelled
`acquiring` until their lease is available. JSON keeps `holder` as the local
holder and adds `remote`, `remoteBudget`, `localFallback` and each waiter's `executor`.
The text queue also prints `local fallback: true|false`. The sessions panel follows hub queue events live.
`hub status --history --json` includes historical per-run wait/run timings; compact status retains queue metrics and median/p90 over the last
20 completions. Cache hits record zero timing; executed-run estimates use recent
successful durations for the effective mode and executor. Remote durations
include acquire time; remote holders do not delay local waiter estimates. Unknown history gives a null ETA.
A remote slot held only by a durable preparation or unconfirmed-cleanup lease gives
a waiter that must outlast it a null ETA too, never a false free slot.

A green run may be reused for the identical committed candidate tree and effective
mode. The candidate excludes only `.cland/tasks` and `.cland/RULES.md`, so tracker-only
and rulebook-only dev merges hit; other paths and dirty working changes do not.
`--fresh` forces execution, and `[verification].cache_max_age_minutes` defaults to
1440 (0 disables reuse). Hits
name the requested head, original run/head, original occasion/executor and tree
hash and post once as usual. Release requests reuse only matching full coverage
on the effective executor and OS (Linux droplets or the local host OS), even
when configured rather than explicit. Compatible Linux droplet stage/release
receipts qualify; macOS stage receipts cannot satisfy a droplet release request,
and missing platform evidence cannot supply a release cache hit.
An explicit `--executor droplet` reuses only a green that ran on a droplet. A
local-only green triggers a fresh remote run, with the reason in the result
header and log. Outside stage and release occasions, omitting the executor flag preserves cross-executor reuse even
with a droplet default; `--executor local` also keeps cross-executor reuse.
Cache hits retain their original executor and platform.
The Reviewer still verifies criteria at the requested exact head using that
result; a cached result never revives an old criterion mark automatically.

`[verification].budget` in `.cland/config.toml` defaults to 1. Values above 1 log `verification-budget-capped` and use 1. T-215 keeps this conservative budget after classifying only five files as hermetic; process-heavy overlap remains disabled. `cland suite` remains an alias, including cancellation.

The compatibility shim retains `/tmp/cland-suite.lock` and `/tmp/cland-suite-nvim.lock` for hand-run `npm test` and pre-V1 branches. A holder or earlier live legacy ticket blocks local admission; droplets use their own machine's locks. The local worker atomically takes both leases before typecheck to cover a racing hand run. A V1 package runner borrows that verified lease and publishes its per-run recovery record in `<lock>.runs/<token>.json` through every shard; a pre-V1 package runner takes its own legacy lease after protected typecheck. A queued head change cancels the request; successful results keep the submitted exact head. The merge gate's rules are unchanged.

The underlying package scripts remain available for humans and isolated CI:


- `npm test`: automatic phase selection; `npm test -- --all` forces full.
- `npm test --workspace hub` and `npm run test:nvim`: request the matching reduced mode, widening to full when the diff does not qualify.

`hub/test/tiers.json` declares every `hub/src/**/*.test.ts`, `hub/test/**/*.test.ts`, `nvim/test/**/*.test.ts` and `web/test/**/*.test.ts` file in one path-sorted `tests` map, with `version: 1`. Add a new path at its sorted position in that map in the same commit as the test. Choose T1 (unit), T2 (component), T3 (integration), T4 (soak) or Web (browser) using the levels above. An entry is a tier string, or a T3 descriptor with exactly one nonempty `contract` or `scenario` string, for example `{ "tier": "T3", "contract": "codex" }`. Fixture/tool writers use `serializeTierManifest` from `hub/src/suite-shards.ts` to keep path order.

Run `npm run test:tiers`; `test:shards` remains an alias for one release. The lint rejects unclassified files, entries for missing files, invalid tier strings/objects and unsorted maps (naming the first out-of-order path). T1 still rejects process/port/timer APIs, process-fixture helpers, real-time waits, lock paths or Neovim in the source. In projects carrying the manifest, `cland verify` checks both the working files and immutable submitted head before queueing (`verify-tiers`), and `cland merge` checks the merged candidate before changing refs or the root checkout (`merge-tiers`). The old wire codes `verify-shards` and `merge-shards` remain accepted aliases. An in-flight candidate with only `hub/test/shards.json` still verifies: `free` reads as T1 and `machine` as T3, with its original hub-only classification coverage and no sorted-map requirement. When both manifests exist, `tiers.json` wins.

`cland verify --dry-run` (MCP `verify` with `dryRun: true`) runs the same
selection and manifest admission without submitting a job, taking a lease,
creating a droplet or reserving spend. `--report` is optional for a preview.
It prints the mode, reason, deciding files, planned tiers and tier projections;
`--json` returns the structured selection, tier plan and report lines. Executor,
worker and size overrides apply to the preview too.

Run logs and results show each planned tier's file count, observed top-level
test count and test-seconds, and projected wall from the duration baseline at
the run's workers. T1's serial phase stays at one worker. Projection uses the
close planner's longest-processing-time placement, summed across sequential
package phases. Missing duration baselines are named and use the known-file
median for projection; their missing seconds do not enter the manifest share.
Dry runs show baseline test counts as planned and observations as unavailable.
Wall budgets are T1 120 s, T2 480 s and T3 900 s; T4 has no wall budget.
An overage says `over wall (report only)` and does not change the run's exit.
The final `tier share: T1+T2 …` line counts manifest seconds for the unique
planned files, including the applicable smoke files. Load-gate repetitions
supply no extra census seconds or tier observations.

The hermetic T1 phase runs on one worker; hub T2–T4 and Neovim use `[verification] workers` (default 4), with `[verification.droplet] workers` overriding it on droplets (this repository: 2 per D53, measured on c-8; T-655, A-4106 and A-4156). Ordinary `all` and integrated `dev` runs plan T1–T3. Stage, epic and release occasions include T4 on both platforms and set `CLAND_TEST_SOAK=1` in test workers and their load-gate repetitions. Close-run balancing treats each hub file, including T4, as one job; merged results retain tier lines labelled by shard. `cland verify --workers N` overrides either policy for one durable run; `--size <slug>` overrides a droplet size with provider availability and spend checks. Use `--fresh` for timed comparisons, because cache reuse otherwise requires matching worker counts and size overrides. Only machine phases take `<lock>.machine`. Suite reports include shard durations, machine wait, total wall time, compatibility wait and hub queue wait. Local process-heavy overlap stays disabled.

Every package run takes both legacy locks jointly and retains them through its phases, including smoke, so hub and Neovim suites on the same machine serialize across sessions, projects and worktrees. Runs admit only when both locks are free, under both recovery guards; they hold neither while waiting. A legacy Neovim-first waiter can therefore take the free machine lock and finish without a cycle. No other run can pass between phases and the remaining waiters keep their order. Targeted single-file `node --test <file>` runs do not take a suite lease; they still obey cover-quiet admission.

Both locks use the same PID/start-time ownership, stale-holder recovery and interruption cleanup. Before polling any recovery guard, each waiter atomically publishes its PID, process start identity, monotonic queue time and worktree in `<lock>.queue/`. This persistent queue sits beside the temporary ownership directory so release and stale-holder recovery preserve waiting tickets. The oldest live ticket alone can take all required free locks, regardless of poll timing. Dead or reused-PID tickets are swept; interruption removes the waiter’s own ticket. A waiter prints its queue position, the holder, start time and holder worktree (unavailable for older holders). A dead holder is recovered after a one-second grace period, with its owned processes and temporary root cleaned before a new phase starts. Interrupting a waiter leaves the live holder's lock intact.

New lease records retain the legacy local `started` field and add `startedUtc`, probed with `TZ=UTC` and `LC_ALL=C`. Recovery and display compare the UTC identity, including recovery guards and phase cleanup anchors. An older record has no timezone basis: a live PID whose start differs by at most 26 hours remains held, since UTC-12 through UTC+14 can explain that difference. Scratch daemons started by the test harness use fixture-local compatibility paths, including projects with no verification override.

Local cancellation captures the full worker tree before signalling and defers
borrowed root cleanup until those identities are gone. For a recreated inode,
recovery preserves the contents by renaming the canonical token/phase path owned
by the same OS user, once the holder and known recorded runner group are dead
and independently owned writers have been reaped. Unknown runner metadata or
ambiguous writer ownership preserves the root and locks. The
`suite-recovery-quarantined` journal receipt names both device/inode pairs and the
quarantine path. Uncertain ownership stays held; `verify queue` exposes its latest
admission or local release-recovery error through additive `localBlocked.reason`
and an unknown local ETA until the corresponding recovery succeeds.
Use fixture-local locks and sealed descendants for these scenarios; see the
[cancellation](tests/hub-test-suite-cancel.test.ts.md),
[recovery](tests/hub-test-suite-recovery.test.ts.md) and
[queue](tests/hub-test-suite-admission-responsive.test.ts.md) seams. Never repair
the live machine's suite locks from a test or probe.

An ownerless manual lock stays held. The wait message names the lock's `rmdir` command; use it only after verifying that no suite using that lock is running. `CLAND_TEST_SKIP_LOCK=1` is for isolated CI jobs.

`hub/test/quarantine.json` quarantines an exact top-level `file::test` identity
(including its subtests), without skipping it. Task, integrated, close and release
runs execute it normally. The result's **Quarantine** section lists passes,
failures and skips with the owner and expiry. Raw Node counts and diagnostics
stay in the log; an accounted quarantined test failure does not make the run red
or become a shared-defect candidate. Other failures, process crashes, cancellation,
duration budgets and incomplete reporter receipts still fail normally. New-test
load repetitions also run, with quarantined failures reported separately.

Only the Coordinator adds an entry, after two known-flake failure receipts from
different runs and five isolated green repetitions. Record those run/artifact
references and the isolated proof in the owner ticket. The manifest starts empty:

```json
{
  "version": 1,
  "tests": {
    "hub/test/example.test.ts::known flake": {
      "owner": "E-123",
      "reason": "Two independent flaky runs; isolated 5/5 green (evidence in T-123).",
      "added": "2026-10-16",
      "expires": "2026-10-23"
    }
  }
}
```

Dates are UTC dates; expiry is exclusive at midnight and must be after `added`
and at most seven days later. Admission and the runner refuse expired entries by
name, missing owner tickets, invalid dates and empty or TODO reasons. The owner
fixes the test before expiry. The hub records one outcome per test and executed
run, across task and integrated runs; duplicate smoke observations use the worst
outcome. Twenty consecutive passes report **cleared**, so the Coordinator can
remove the committed entry. Skips and failures reset the streak; absent tests,
cache hits and report retries add no green observations. Renewed entries start
a new streak. The hub persists streaks and publishes their update atomically
with the result, including after restart; it never edits the manifest itself.

`hub/test/durations.json` declares the budgets listed under Test levels in
`budget.T1` through `budget.T4`.

Tier budgets check every observed identity, including known baselines and files
missing from the duration manifest. Missing files are named with their observed
seconds. In report mode, logs keep the complete `budget (report only): would fail …` list;
results show the ten largest overages ranked by seconds over budget. An allowance
covers its exact key up to its declared `seconds`; file allowances do not cover
individual tests. Tier-wall projection uses the declared wall budget.

The T3 ratchet pins the merge base with `origin/dev` at admission. It starts with
that base manifest's T3 file seconds, subtracts removed files and tests or files
moved out of T3, then adds observed seconds for new T3 identities (including
promotions from other tiers). Unchanged tests retain their baseline seconds;
smoke repeats count once. Changed literal/template titles are checked in the
submitted source; unresolved dynamic titles conservatively retain their baseline.
Whether a test is new comes from the pinned base source, independently of
missing timing keys: unchanged T3 files and pre-existing literal/template titles
never become growth just because they lack a timing baseline. Reports flag
incomplete base timings separately; unresolved source identities are retained
conservatively and flagged as uncertain.
Growth needs an allowance keyed `T3`, whose `seconds` is the permitted projected
total. The log and result show `T3 ratchet (report only): … s vs base … s` and
`would refuse growth` when unallowed. Missing base data is reported as unavailable.
T1 and T2 may grow within their wall budgets.

`budget.mode` selects `report` or `enforce`; omission keeps report mode for
older manifests. D73 restores report mode until after v0.1.4, superseding D71's
enforcement rollout through T-915; enforcement returns under E-880.
D72 moves the remaining speed exceptions to the open E-880 epic before
E-677 closes, retaining measured baselines and adding bounded allowances for
the stage-cover and periodic-run overages.

In enforce mode, every observed test and file must fit its tier's budget or an
exact allowance covering the measured seconds. A known baseline does not exempt
it. The runner fails with `duration budget`, independently of assertion
quarantine; T4 stays unbounded. Existing allowance validation and live owner
checks still apply, including the legacy exception below.

Before changing refs or the checkout, merge admission checks the immutable
merged candidate against the current integration base. Unallowed T3 growth or
a projected T2 wall above 480 seconds refuses with `merge-budget`. Projection
uses the complete manifests at configured `[verification].workers`, placing
whole files on workers and summing the sequential hub and Neovim phases.
Required immutable inspection failures refuse with `merge-budget`, rather than
disabling the ratchet or accepting partial source estimates. A successful tree
listing may confirm genuinely absent historical manifests; those retain the
unavailable-base diagnostic. Missing file timings use the known-file median.
A new T3 source identity with
no timing receipt is projected at its per-test tier budget (normally 10 seconds)
and labeled `estimated (no receipt)` in the merge-budget line. The estimate
must fit the ratchet or a `T3` allowance; the batch run then measures the test
and enforces its real duration. Existing unmeasured source identities stay old.

The T3 wall refuses above 900 seconds only when the base manifest's own T3 wall
projection at the same workers is strictly below 900 seconds. While the base is
900 seconds or more, merge diagnostics say
`T3 wall 900 s not yet enforced: base <s> s`; the T3 ratchet still applies.

In report mode, tier and ratchet diagnostics cannot change an exit status, and
the existing new-identity gate below remains active unchanged.

### Task T3/T4 duration check (T-1198)

A mode-free task verify with the merge queue enabled in the candidate and hosting
hub adds one execution of every top-level identity in each added or changed T3/T4
test file. “Changed” means the test file appears in the no-renames diff from the
merge-base of fetched `origin/dev` to `HEAD`, or in dirty/untracked paths. A renamed
file is an addition; a renamed identity changes its file. Deleted files are omitted.
Production paths select unchanged T4 files only through the `loadGuards` mapping
above; other production/helper changes do not select unchanged T3/T4 files.
Coverage selection and fallback affect T2, never expand this check to
the whole T3/T4 tier. Each selected file runs once, independently of coverage/smoke
subsets; these identities receive no load-gate repetitions. T4 enables the soak
prerequisite for its base execution and has no tier budget, so prints no stanza.

On the configured Linux droplet, each selected T3 identity at **>=80%** of its tier
per-test budget prints `duration allowance stanza` followed by a JSON object to
copy into `hub/test/durations.json`'s `allow` map. `durationAllowanceStanzas` is the
shared printer for duration tooling. It uses only explicitly passing samples,
chooses the worst observed passing sample per identity and rounds **1.5x** upward
to milliseconds. Failed, skipped, TODO and old outcome-less receipts contribute
no recommendation. This follows **T-931's headroom rule**: set an allowance at
about 1.5x the worst observed passing sample, rather than at the last sample.
Review the generated reason for the lifecycle need before committing. The owner
is the task's nearest open container, with UTC `added` today and `expires` seven
days later. A missing open container is reported instead of printing an invalid
stanza. Existing allowances and baselines remain untouched.

The ready report retains the complete JSON stanza and a `duration check:` line
naming platform/executor, selection rule, passing identity count and **added wall**:
the measured selected-phase wall excluding machine-lease wait. This is the added
work in a typical task verify: zero extra phases when no T3/T4 file changed and
no read-path guard matched; otherwise one base execution of just those files plus
runner setup. It is not a projection of the whole tier and does not estimate contention with other work.
Local macOS execution is explicitly labelled as lacking Linux evidence. A cache
hit retains its original platform/executor; it is not a fresh Linux sample.

The hub pins tier commands at admission. Updating only a candidate runner cannot
enable this capability on an older hosting hub: land the capability and restart
the hub before claiming live mode-free Linux evidence. Selection's optional
`durationCheck` field and timing's optional `outcome` are additive. Existing
selection consumers keep their fields; timing refresh, tier reports, coverage
and observers retain all timing rows. Only the stanza printer filters pass rows.

`hub/test/durations.json` sets a 5-second test budget and a 60-second file budget
for hub and Neovim. Files sum top-level test-time; nested durations are included
in their parent. Only a new over-budget test or file fails its run with a named
`duration budget` diagnostic. A test is known when its exact `file::test` key is
in `tests` or `allow`; a file is known when its path is in `files` or `allow`.
A known file never exempts a new test inside it, and a renamed test is new.
Before requesting review, add an exception in your
task branch with the observed `seconds` and a reason explaining why the test
needs that time:

```json
"hub/test/example.test.ts::real lifecycle": {
  "seconds": 6.1,
  "owner": "E-123",
  "added": "2026-10-17",
  "expires": "2026-10-24",
  "reason": "Starts multiple real workers and proves their confirmed teardown."
},
"hub/test/example.test.ts": {
  "file": true,
  "seconds": 65.2,
  "owner": "E-123",
  "added": "2026-10-17",
  "expires": "2026-10-24",
  "reason": "Aggregates independent end-to-end lifecycle and recovery cases."
}
```

These entries go in `allow`; a file exception does not exempt individual tests.
The working-tree and immutable-candidate manifest lint names missing or TODO
reasons, missing or closed owner items, invalid dates, excessive date spans,
and expired allowances (expiry is midnight UTC). D72 allows at most 31 days
between `added` and `expires` for dated allowances owned by `budget.legacyOwner`;
all other owners keep the seven-day maximum. Ownership
is checked in the live authoritative tracker, including linked worktrees.
Both paths also refuse duration test/allow keys with no matching source test
identity, and file baselines/allowances naming a missing test file. Literal and
template titles are checked in their own file; computed titles remain uncertain.
Renaming or moving a test therefore requires removing its stale manifest keys
in the same change. A later stage cover supplies the new identity's baseline.
An unmatched key refuses during shard planning, before any test receipt exists.
A merge batch therefore holds as inconclusive with nothing to bisect; the
Coordinator diagnoses the named key, arranges cleanup and recovers the batch.

By the Coordinator's D53 exception, pre-existing allowances carry `legacy: true`
and have no calendar dates. D72 makes their owner `budget.legacyOwner` (E-677
when omitted); this repository sets E-880. They expire when that owner closes.
T-915 converts undersized legacy allowances to dated E-880 allowances, keeping
their original reason and appending the observed peak and headroom. Every other
legacy entry retains its reason and seconds through the owner migration.
New allowances must use dated fields under the span limits above; `legacy` is
reserved for the original migration, and changing its owner never admits a new
legacy key. Reports show the legacy count, sum of seconds and configured owner,
so its progress is visible. Refresh
preserves ownership, dates, legacy metadata and the T3 allowance without extending
expiry. Missing manifests disable the budget and its reporter.
In report mode, known entries never fail the duration budget. Those over budget always produce a
`duration regression` notice annotated `over budget`, even when flat or faster.
Those under budget report when at least 1 second and 50% slower than their
baseline. Both kinds share a five-line cap, ranked by seconds over baseline.
The suite result includes these notices, budget failures, and `suite budget overhead <ms> ms` for
the runner's self-measured loading, bookkeeping, checking and reporting work.

At each stage close the Coordinator runs
`npm run test:durations -- --add-only <latest-green-integrated-log-artifact-path>` on `dev`
and commits the added baselines. Until T-931 decides allowance-refresh policy,
use `node hub/test/durations.ts refresh --add-only <log>…`: it adds only missing
test and file baselines, prints each addition, preserves existing entry bytes
and number formatting, and leaves every allowance unchanged (including omitted
identities and over-budget new tests). Review any new over-budget identity's
allowance separately. Source artifact ids are retained and the source head is
updated. Repeating the same refresh adds nothing.

The full `node hub/test/durations.ts refresh <log>…` mode
accepts several logs (newest last), takes per-test medians, sums file test-time,
preserves reasons and retains baseline entries for files absent from every supplied
log. For each observed file, it drops tests absent from the newest supplied log
that ran that file. Ordinary passing file-completion receipts also mark empty files
as observed: removing a file’s last test drops its old identities and records zero
test-time. Load-gate file envelopes do not mark ordinary execution. Partial task (T0–T2) and batch (T1+T3) logs can therefore refresh
their tiers without erasing the others. Unobserved allowances remain intact even
when their files have no timing baseline. Retained entries keep source artifact
references; timings for observed identities still use per-test
medians across supplied logs. It reads the durable
`suite timing` records or older top-level spec timings with start/source title
mapping. Refresh writes a `TODO` allowance only for an over-budget identity absent
from both its previous baseline and `allow`; replace it before admission.
Reasoned entries stay, and a known entry that becomes slow only updates its
baseline seconds.
Keep artifact ids and the source head in `source` so timings remain traceable.

Task-branch verifies have a **load gate** for each admitted T1/T2 top-level `file::test` identity
missing from both the duration manifest's `tests` baseline and the hub's durable
landed-task proof set. The hub retains exact identities with completed `5/5 passed`
load-gate receipts on reported green task runs. A proof becomes known only when
that run's item has a dev landing receipt matching its exact branch and head.
Unlanded branches and other revisions supply no exemption; skips, partial passes
and quarantined failures supply no proof. Suite history retains the proofs across
hub restarts without a dev commit per landing; retained pre-upgrade logs are read
once to recover older proofs. As the phase discovers
new names, `[verification] load_gate_workers` parallel lanes (default 2) repeat
each identity five times in fresh Node processes with an escaped, exact `--test-name-pattern` on the file, alongside the ordinary
phase. Ordinary integrated `dev` runs receive no repetitions. At stage, epic and release occasions, the hub instead pins the identities observed in the latest completed, reported green integrated stage run. Every T1–T3 identity absent from that receipt receives five repetitions, even if it appears in the current duration manifest; T4 runs only in the base soak phase. A later ordinary batch, failed stage or cache hit does not advance that baseline. Without a retained stage receipt, all observed identities are treated as new. Each shard carries the same pinned baseline. Each lane finishes all five repetitions of one identity
sequentially before taking another; the gate never drops repetitions to meet a
wall deadline. Its worker count is included in the log and run report. Increasing
it trades wall time for load, independently of ordinary phase workers.
An `allow` entry permits duration; task identities become known through a duration
baseline refresh or a matching landed-task 5/5 proof. Stage, batch and soak occasions
continue to use their own pinned receipt baselines, independently of landed-task proofs.
The live hub sets the task flag in the selection JSON. Updating a candidate
runner alone does not enable it when the running hub predates this feature;
bootstrap uses package-runner fixtures, followed by a live task proof after the
hub update.

Each repetition must exit green and produce exactly one receipt for the named
test. Five passes supply load proof. If all five repetitions skip with a
nonblank reason each time, verification accepts the prerequisite skip and the
log and run report name it as `skipped, not load-gated`, with the reasons. This
supplies no load proof: obtain five passing repetitions under load on a machine
with the platform or binary prerequisite, recording that machine and its
receipts in the item topic before claiming load proof. A skip without a reason,
a mixture of skips and passes or failures, TODOs and pattern-missed tests still
fail the gate.
The log reports `load gate: <file>::<test> <passes>/5 passed` for other outcomes;
fewer than five passes fails verification and appears in the failure summary.
The run's `suite duration` line includes `load gate extra wall <seconds>s`: the
sum of the tails spent finishing repetitions after their ordinary phase exits.
It does not estimate
contention during overlap. Repetition receipts do not refresh duration baselines
or enter coverage maps. Missing manifests disable this gate too.

The eight-new-test wall probe uses the same package-runner regression with 20s
per fixture test (normally 0.1s). It reports extra wall and peak one-minute load:

```sh
CLAND_LOAD_GATE_SLOW_PROBE=1 node --test --test-name-pattern='task load gate bounds eight' hub/test/durations-runner.test.ts
```

At the default two lanes this takes about seven minutes overall: the acceptance
bound is under five minutes of extra wall after the ordinary phase, with all
forty fresh repetitions retained.

See [the runner and process-fixture notes](../../hub/README.md#tests) when adding tests that spawn processes.

Hook bridges retry missing or unreachable hubs for 60 seconds, including a silent
handshake. Their expiry stops the mod's restart loop too. The real-hub lifecycle
test uses `CLAND_TEST_BRIDGE_GRACE_MS=2000`; a T1 test pins the production default
to 60 000 ms and the mod's expiry decision has an in-process no-retry proof.
`CLAND_TEST_SMOKE_BUDGET_MS` shortens readiness only for planted startup hangs.
The ordinary T2 thread differential oracle always uses 2 seeds × 12 renders,
including when `CLAND_TEST_SOAK=1`. The separate T4 case in
`nvim/test/thread-oracle-soak.test.ts` runs 4 × 25 through the same oracle helper. The shipped QA walk, orphan performance cases,
and hub harness self-tests are T4. A `hub/test` helper diff keeps the package
fallback, filtered to T1/T2 on a queue-enabled task; T4 self-tests run at
occasions and in the nightly soak. Each phase's existing discovery sweep reports bridge counts before and
after cleanup and fails if a phase candidate survives, preserving ambiguous processes.
For old orphans use `cland doctor` to inspect and `cland doctor --fix` to sweep only
the calling user's verified bridges whose explicit hub file is missing. An existing
hub file, ambiguous argv or unverifiable identity prevents cleanup. Doctor fixtures
scope deleted hubs, bridges and fixtures with `CLAND_TEST_ORPHAN_ROOT`; both CLI
and embedded daemon launches through the test harness default startup fixture sweeping to their own
project root too. Explicit scratch scopes may widen that test boundary. A doctor
cleanup case uses the default skipped startup sweep, or observes its completion
before removing roots, so a pending startup sweep cannot consume doctor's target.
Deleted-project hub OS proof wins over fixture classification in doctor's output.
The native fixture-ownership T3 case checks the open receipt separately from its
PID/birth match, then observes both client/stub receipts and confirmed process
death before removing the root. Linux `ps lstart` truncation needs the one-second
lower birth margin already used by self receipts; fd inheritance alone is not
the complete ownership proof.

Read-only QA stub runs keep serving inline scenarios when receipt creation fails
with EACCES, EPERM or EROFS. Without a receipt they have no ownership authority:
doctor may report a missing-root hint as unowned, but never signals it. Other
receipt errors still fail startup. The RPC client fixture still requires a
writable temporary directory before creating its receipt; read-only QA launches
Neovim directly rather than through that fixture.

## Authenticated session fixtures

Permission and dispatch fixtures opt in to `session-credential-fixture.ts` clients.
These provision synthetic session credentials in the disposable store and attach
them to known-session actors in both request and send frames; they preserve provisional identities rather than
adopting them. `sessionShell` supplies the matching fixture environment for direct
CLI children. They test authorization after authentication, not credential
admission. Credential admission tests use raw `harness.ts` clients and the real
CLI, with credentials obtained from the fixture adapter's launch request.
See [shell credentials](tests/hub-test-cli-session-credential.test.ts.md).
Onboarding's tokenless CLI fixtures instead establish an owned spoke, await its
credential-ready receipt, and pass both session ID and name to the raw CLI. They
exercise file migration and must not acquire credentials from the synthetic helper.

## Cover-quiet

Before fixture setup, the hub and Neovim test harnesses ask the project hub for
a read-only `suite.slot` check. When an integrated cover holds the local
compatibility slot, an unrelated test exits with `cover-quiet` and the run id.
Wait for that cover to release the slot. Its own workers pass with the matching
inherited lease; remote covers do not occupy this machine's local slot. Without
a project hub there is no refusal. A connected hub must answer. Admission waits
at least 15 seconds, scaling with one-minute load per available CPU to a maximum
of 60 seconds. A timeout is a typed `AdmissionTimeout`, with the nonzero outcome
`admission timed out after N s: project hub busy; not a test result`. Package
reports count admission timeouts separately and omit affected assertion ids from
test failures and shared-defect candidates, including load-gate repetitions.
The package entry returns 75 when its own admission times out; Node's worker
still exits nonzero when its admission hook fails. The harness registers that
hook before account fixtures, so test registration completes before admission
waits, and neither test bodies nor fixture hooks run after a refusal or timeout.
A disconnect also fails admission before fixtures. Discovery follows `CLAND_HUB_FILE`
and linked worktrees, as the CLI does. Only the human may set
`CLAND_TEST_IGNORE_COVER=1` to bypass this check. The check never joins the queue
or acquires a lease; normal full-suite queueing stays in effect.
An older hub that refuses or does not recognize the check fails startup with
`test admission unavailable`, naming the missing read-only `suite.slot/check`
capability and the required hub restart. Wait for that authorized restart.

### Droplet storage health and fixture filesystem (T-755)

Each dedicated run machine mounts `/tmp` as tmpfs before starting its worker.
The cap is the smaller of 4 GiB and half the machine's RAM; the repo,
`node_modules`, logs and coverage maps remain on disk. The existing suite and
reaper continue to own their normal `/tmp/cland-suite-*` roots. A failed or
unavailable mount keeps disk-backed `/tmp` and reports an explicit fallback.
The mount lives until that run's machine is released.

A startup probe measures four 1 KiB writes with fsync and eight SQLite WAL/FULL
autocommit inserts (including database initialization/close), separately on disk
and on the fixture filesystem. The entire probe has a ten-second bound plus a
one-second kill grace; failure leaves unavailable measurements and preserves the
suite outcome. A final three-second sample plus one-second kill grace reports
aggregate `/proc/stat` iowait and steal tick deltas and percentages across the
package run, excluding startup probes. Guest counters are not added twice.
Missing or reset counters report unavailable rather than zero. These are machine
CPU percentages, not per-process CPU use or a proof of device-level latency.

The structured `suite machine health` lines stay in the log. The final complete
receipt is copied into `result.json`, the result header and the `suite-result`
and `verification-timing` journal records, retaining run attribution through
recovery and cache reuse. Sharded results retain a `shardHealth` collection with
original child run, shard label and machine identity in durable receipts, journal
records and cached/recovered headers; they never treat concatenated child logs
as one machine's sample.
Only timing/counter/filesystem facts are captured; no environment dump or
command line is collected. Compare completed phases when investigating timings:
a failed hub phase can omit both Neovim and coverage reduction.


### Legacy spend retirement fixtures

`cland executor retire-legacy --confirm-registered-hubs` belongs to the human or
Coordinator. The flag asserts that both ledgers' registered projects cover all
of the user's hubs. Each project must return `spend.legacyRetirement: 1` and the same primary spend
path through live `executor.status`; absent, unreachable, non-capable and old-path
hubs refuse with the
registered project list. Neither a discovery version nor the new path alone proves marker support.
Never-registered hubs and later downgrades are outside that check: upgrade and
register every hub before confirming, and do not downgrade afterwards.

### Rendered artifact checks

See [nvim/test/artifact-render.test.ts](tests/nvim-test-artifact-render.test.ts.md) and the [per-test index](tests/index.md).

## Browser sign-in fixtures

Network-edge tests use loopback aliases (`::1` for the web edge while spokes
stay on `127.0.0.1`) or scratch config; never bind the live hub to a network
interface. `web-edge.test.ts` reads both actual listener addresses from `hub.status` and confirms both connected
addresses, plus doctor's
stopped-hub config warning. `web-auth.test.ts` covers tunnel Host/Origin admission,
Secure only on the configured Host + Origin pair, forwarded-header spoofing,
and executable `web --qr` output/refusal with scratch browser openers.
`web-network-unit.test.ts` covers LAN/wildcard/IPv6 link selection and half-block
QR vectors at T1, including link-local-first/only-link-local wildcard selection
and tunnel precedence; its independent byte-mode decoder reads format/mask/data from
the terminal rendering (L, versions 1–6; it does not correct damaged symbols).
`web.link` optionally takes `qr: true`; it remains a human-only Unix-socket frame.


`cland web` is human-only. A session shell carries its own actor and is refused;
never remove the live session's identity to mint a link. In a disposable project,
`projectHub` plus `askHubFrame(discovery, {type: 'web.link'}, 3000, {})` mints a
link for a test client. Trade it at `/auth` and supply the returned per-project
cookie and exact page Origin on `/ws`; the hello is a client hello without a
secret. Cookie sessions persist in `hub.db` as SHA-256 hashes, with public ids
and creation/last-use timestamps; expiry is fixed at 30 days after creation, not renewed by admission.
`web.sessions` and `web.revoke` also require a human test client on the Unix
socket. Session shells, browser sockets and stdio cannot manage browser sessions.

Web authority is a separate request boundary: `hub/src/hub/web-authority.ts`
classifies every human request and denies missing rows before replay or actor
resolution. `wire-conformance.ts` checks the inventory at typecheck; a new frame
needs a policy row in the same change. See `hub/README.md` for the 0.2.0 refusal
list and the `cli-neovim-only` result code. `web-authority-unit.test.ts` covers
pure policy decisions at T1; `web-authority.test.ts` exercises authenticated
`/ws` and Unix sockets at T2. The local comparisons preserve normal handler
preconditions: they do not publish, invoke Git or acquire provider resources.
Use the scratch hub and filtered HOME/XDG/Git fixture for both edges.
The same T2 file covers human `session.history` on Unix and web (both traffic
directions across topics, exclusive numeric pages, count/byte bounds and
unchanged spoke `history`), web-only `web.session` with two independent cookies
and a reconnect (own creation/last-use/fixed expiry, no identity selector), and
web launch-directory refusal with a root launch and a local-directory comparison.
Use fake adapters for launches and fake time for sign-in expiry; do not probe
these requests against the live hub. The T1 authority file classifies the two
reads and refuses every own `session.launch.cwd` field before dispatch.

### README startup and reference contracts

See [hub/test/web-readme.test.ts](tests/hub-test-web-readme.test.ts.md) and the [per-test index](tests/index.md).

### HTTPS tunnel guide contract

See [hub/test/web-tunnel-guide.test.ts](tests/hub-test-web-tunnel-guide.test.ts.md) and the [per-test index](tests/index.md).

## Thread history pages

See [hub/src/hub/store.test.ts](tests/hub-src-hub-store.test.ts.md) and the [per-test index](tests/index.md).

## Implementer test selection

See the [per-test index](tests/index.md) for file-specific coverage and fixtures.

For remote watchdog regressions, use the executor fake with a shared fake clock:
emit an in-flight receipt, observe its mirrored bytes, stop output, then assert
the terminal timeout receipt and released resource. Exercise status replies
without bytes, failed log reads, new-byte renewal, and restart at both sides of
the output-checkpoint/append boundary without resetting the admitted limit.

Clause procedure (defaults implementer, project implementer):

- `hub-selected` names changed functions, covering tests and the map artifact. Queue-enabled tasks run all T1 and selected T2, with all T2 in both packages on fallback. Changed T3/T4 files and mapped T4 guards run once; remaining T3 smoke runs in batches and integrated runs. Coverage maps come from green integrated runs; ancestry, mapping and fallback rules are in docs/agents/tests.md.

Clause procedure (defaults implementer, project implementer):

- Use `projectHub(t, root, env?)` from `hub/test/harness.ts` for project tests by default. Keep `startDaemon` only when an assertion concerns the hub process (startup, shutdown, signals, crash/restart, lock/discovery/PID identity, orphan sweeping, watchdog behavior, or CLI behavior with the hub down or unreachable); such tests name the process lifecycle behavior they prove. See docs/agents/tests.md.

## Web phase

See the [per-test index](tests/index.md) for file-specific coverage and fixtures.

### phone-notifications.test.ts

See [web/test/phone-notifications.test.ts](tests/web-test-phone-notifications.test.ts.md) and the [per-test index](tests/index.md).

### web-notifications.test.ts

See [hub/test/web-notifications.test.ts](tests/hub-test-web-notifications.test.ts.md) and the [per-test index](tests/index.md).



Edge fixtures bind only loopback aliases. Revocation checks observe socket-close receipts after admission closes; no-follow filesystem regressions also prove an authorized read beneath a symlinked trusted ancestor on every supported OS (A-8634 R9; T-966, T-981, T-982, T-987, T-988, T-1042).

Standalone generated-asset and bundle consumers declare their build prerequisites and check them themselves, independent of prior files or shard order; use fixture-owned present/missing output directories and derive asset lists from shipped scripts and workspace metadata (A-8634 R11; T-955, T-978, T-1019, T-1023, T-1031; A-9063 R8 source T-1096).

For human-only sign-in, session management and web authority policy tests, follow
[Browser sign-in fixtures](#browser-sign-in-fixtures).

Browser tests carry `Web` in `hub/test/tiers.json`, outside T0–T3, with a separate
4 s/test and 40 s/phase budget in `hub/test/durations.json` (report mode follows
the repository budget setting). The package runner reports actual phase wall time
separately from tier projections. Its hang guard resets a 60 s no-progress window
on each Web runner test start/finish receipt; ordinary output does not reset it.
The total ceiling is three times projected Web wall, with a 300 s minimum.
Projection schedules the selected files' duration baselines at the phase's actual
worker count; a file without a baseline uses the configured Web file budget
(40 s by default). A timeout names the last file and window or total ceiling,
fails the phase and reaps owned processes before removing the run root. These
guards apply independently of duration report/enforce mode. Web runs after
the hub phases with resource `machine`, two workers locally and four on droplets.
It keeps the suite's joint lease and never runs in load-gate repetition lanes.

New Web files have a separate, **report-only** admission check (T-1200), after
the ordinary Web phase and outside its wall-time measurement. When load gating
is selected, host admission compares changed Web test paths with the merge-base
tree of HEAD and freshly fetched dev. It carries the new-file list in optional
`selection.webRepetitionFiles`; renamed targets absent from that ancestor count
as new, even if a newer dev tip already has them. An explicit empty list means
checked, none new. Missing fetch/baseline proof leaves the field absent.
The runner uses only that list, intersected with its admitted Web phase files;
it does no Git lookup. Only new files run ten fresh whole-file processes, in two
lanes of five, while an owned CPU worker stays busy. The same machine lease
covers this check. Existing files start no repeat browser or CPU worker. Host
selection adds at most a merge-base and one baseline-tree read for Web changes.
An absent field reports missing proof rather than zero new files or repeating
every existing file. This additive field preserves old selections; cache
identity distinguishes absent, empty and populated lists.

Each repetition needs a successful exit, one complete terminal summary, at least
one passing test, no failure/cancellation/skip/todo and observed CPU progress over
the run. Verify retains `load gate workers 2; Web repetition (report only):
<file> N/10 passed; workers 2; CPU load; attempted M/10`, failure diagnostics and
separate extra wall time. The existing load-worker summary prefix makes counts
visible to running hubs without a new protocol or summary capability.
Partial or unavailable evidence says `missing load proof`; it is never 10/10.
During report rollout this check does not block ready. Ordinary Web failures
still fail verification. This does not replace the existing five-repeat T1–T3
identity load gate or its proof format. The T1 planner/summary controls live in
`web-phase.test.ts`; `suite-runner.test.ts` owns the real child lifecycle receipt
and runs through queued verification, not as an unleased local CPU probe.
Before hub restart #54, mode-free verification is expected to report the absent
field as `dev baseline unavailable`. A post-restart droplet count is C2 landing
evidence recorded by the Coordinator, not a pre-merge gate (decision 90231c27).

A diff wholly under `web/**` selects `web-only`: all Web tests plus `HUB_SMOKE`
and `NVIM_SMOKE`. Other reduced modes include `web/test/smoke.test.ts`; protocol,
shared wire, web edge and mixed web/non-web paths force full. Queue-enabled task
runs keep Web beside all T1 and selected T2. Hub-owned merge batches add Web
after T1 when their candidate diff touches web/;
periodic dev (`dev-t3`), integrated, stage, epic, release and soak runs include it.
The candidate's `supportsWebPhase` runner capability adds a recorded Web command
to tier-based verification; other projects and older candidates retain their
commands. Close shards place Web with the shard that owns Neovim so it runs once.

`npm install` builds the bundle and installs the lockfile-pinned Headless Shell
in `node_modules/playwright-core/.local-browsers`. Use `npm run test:web:install`
to repair it (`-- --with-deps` for Linux system libraries). Never launch the
human's installed browser or normal profile. `npm run test:web` runs the selected
Web files through suite admission; `node --test web/test/smoke.test.ts` is a free
targeted file after `npm run build`. Crew full suites still go through mode-free
`cland verify` after source review. The root check builds once before verification;
the package runner checks the source receipt and builds once before workers only
when a hand run lacks a current bundle.

Prepared Ubuntu 24.04 executor snapshots include Headless Shell's Chromium runtime
libraries. Root cloud-init (`hub/src/executor/droplet/provision.sh`) installs them
before the non-root runner executes the project's prepare command. For this repo,
`verify-prepare.ts` runs `npm ci` on a cold image; its `prepare` lifecycle downloads
the lockfile-pinned shell into the checkout. The snapshot key includes the committed
`package-lock.json` SHA-256, so a changed browser pin invalidates the image.
After provisioning changes land, the Coordinator or human restarts the hub onto
that code and runs `cland executor prepare`: cloud-init comes from the running hub,
not the delivered task branch. A branch receipt on the old image cannot prove new
system libraries; collect a droplet Web receipt after that rebuild. Implementers
report missing image libraries to their item lead for this preparation.

Use `web/test/harness.ts`: one scratch `projectHub` and Headless Shell per file,
one fresh context per sequential case. The fixture mints a test-client `web.link`
frame, trades it through `/auth`, stubs `Notification` in an init script and keeps
CSP enabled. Poll with `pageUntil`/`page.evaluate`; retain the final DOM assertion.
Fixture setup and behavioural waits have separate bounds. All homes, profiles,
TMPDIR and Git state are scratch-owned, with filtered child environments.
Failures save trace ZIPs in ignored `web/test-results/`; publish them through
`artifact.create`. Teardown observes browser exit and an empty process-group
census, closes the scratch hub and its edges, then removes directories. The smoke
also proves context isolation, one-time links, same-origin fonts/requests, strict
inline-script CSP and trace/cleanup on a planted failure. See
[web/README.md](../../web/README.md#browser-tests).

The candidate's `web/test/prerequisite.ts` exports `webPrerequisite()` and returns
`{available: true, executablePath}` or `{available: false, reason}` without
launching a browser. For a missing executable or system library, the runner emits
"Web unavailable on this machine" and a structured `suite web phase` receipt
with `status: "not-run"` and the reason. It skips browser workers and continues
the other phases. Results retain `webPhase` in the durable job and result JSON;
an unavailable phase supplies no passing Web evidence and cannot be reused as a
green cache receipt. A broken or missing probe with Web selected is an error.
The probe checks the pinned executable and, on Linux, the shell and bundled shared
libraries with bounded `ldd` calls in a sealed scratch environment. It launches
no browser; the fixture launches exactly its returned executable.

### phone-composer.test.ts

See [web/test/phone-composer.test.ts](tests/web-test-phone-composer.test.ts.md) and the [per-test index](tests/index.md).

### phone-sessions.test.ts

See [web/test/phone-sessions.test.ts](tests/web-test-phone-sessions.test.ts.md) and the [per-test index](tests/index.md).

### phone-disconnected.test.ts

See [web/test/phone-disconnected.test.ts](tests/web-test-phone-disconnected.test.ts.md) and the [per-test index](tests/index.md).

### Paused page clocks

Use `pausePageClock(page, time)` from `web/test/harness.ts` when a browser test
needs a clock paused at an exact `Date`. It installs one minute before the target
and pauses at the requested time, leaving headroom for browser command scheduling
under load. Installing at the target and then pausing there races the running
fake clock and can throw `Cannot fast-forward to the past`.
The T0 `lint-web-workspace.ts` guard rejects raw same-time install/pause pairs,
including pairs separated by comments or other statements; already-ahead pauses
remain valid. Keep existing DOM and socket receipts before advancing paused time.

### Web load-race guards

Use `resizePage(page, size)` from `web/test/harness.ts` for every viewport resize.
After navigation it waits for the shell's rendered `[data-phone="true|false"]`
at the 640 px breakpoint and keeps the final attribute assertion. In
`beforeNavigate`, it sets the initial viewport; `pageCase` observes the first
rendered navigation after `goto`. Keep any narrower geometry receipt as well.

T0 parses all `web/test/**/*.ts` and refuses raw `setViewportSize` calls outside
that helper, including variable widths (their previous layout is not statically
known). It also refuses root-negated inline predicates in `pageUntil`, `until`
and `waitForFunction`, including block returns; double negation for positive
presence is valid. Wait for the exact completion/row before a negative assertion.
For an actual DOM departure use a bounded locator `waitFor({ state: 'detached' })`
and keep the final count assertion. Do not replace a receipt with a rewritten
negative boolean. Both guards share one AST walk and report its measured cost;
they start no browser. Planted violations run in the same T0 command.

## Criterion write fixtures

See [hub/test/tracker-criterion-write.test.ts](tests/hub-test-tracker-criterion-write.test.ts.md) and the [per-test index](tests/index.md).

## Human marks fixtures

See [hub/test/human-marks.test.ts](tests/hub-test-human-marks.test.ts.md) and the [per-test index](tests/index.md).

## Connection snapshots

See the [per-test index](tests/index.md) for file-specific coverage and fixtures.

While client derivations or cross-client ports remain, retain an independent differential oracle (for example Lua against TypeScript), with a stated removal condition. Pair each delta-rebuilt row assertion with a fresh snapshot comparison, including hub totals while rows remain unloaded (A-8634 R4; T-979, T-1044, T-1061, T-1053, T-1052, T-1072, T-1058, T-1071; A-9063 R7 sources T-1075, T-1076, T-1056).

Pagination regressions include tied and backdated timestamps, traverse at least two pages, race a state change against a held page and retain the final one-row-per-identity assertion after replay (A-8634 R8; T-984, T-985, T-986, T-989, T-992, T-1046, T-1055; A-9063 R4; T-1073, T-1081).


### Startup reply byte budgets (T-1038)

See the [per-test index](tests/index.md) for file-specific coverage and fixtures.

Count UTF-8 bytes at the consuming boundary, including framing, with a separate budget for every startup reply; keep the budget guard unchanged (A-8634 R5; T-963, T-1007, T-1010, T-1003, T-983, T-1037, T-1038, T-1045).

Before compacting a reply, inventory readers, count/wait assertions, QA brief waits and startup probes; use rule 19 for migration and capability landing order. Check budgets against a copied live tracker and synthetic fixtures varying closed-container density independently of task count. Add small probe-assertion fixtures for each retained state/kind and cover changed row kinds through both real stdio hub and recorded stub (A-8634 R3; T-1025, T-991, T-999, T-1027, T-1038, T-993; A-9063 R1; T-1088, T-1089, T-1091).

When expanding verification phases, prove the command plans are unchanged when no file is classified into the new phase; use rule 19 before dependent work is enqueued (A-8634 R3; T-1025, T-991).

Status readers that assert completed-suite receipts, covers or harness launch
rows explicitly request `history: true` (`cland hub status --history` for CLI
checks). Cleanup waits do the same: finished jobs leave compact status, so an
active-only snapshot cannot prove that an owned run finished. Tests of compact
status and its startup budgets keep the default request. The merge gate, periodic
dev T3 and verification cache read the scheduler/store history directly.

For copied durable-state evidence, run `node hub/scripts/measure-startup.ts
/absolute/project/.cland`. Add `--cli` for the actual `cland hub start`, native
daemon and first `hub.status` socket receipt, with an enforcing five-second bound.
The default embedded run reports per-phase monotonic startup times and dispatcher
composition separately; its fake clock does not supply performance timings.
Both modes take a read-only consistent SQLite backup plus
copies of tracker, rules, roles, crew and journal into one disposable project.
Recoverable jobs and leases are removed; completed reported history and artifact
paths are rebased; process PIDs/account environments are cleared. Accounts,
configuration and adapters are scratch-owned. A fake hub clock prevents schedule
execution in the default run; CLI mode uses the isolated native daemon's real clock.
No source hub, artifact content or inherited credential is used.
The eight public dispatcher replies measure compose-to-receipt time separately
from JSON encoding/decoding; byte counts include the wire envelope and newline.
A serving receipt precedes requests, each has a 60-second bound, and a failed
request is recorded before continuing. Shutdown completes before root removal.
Publish the output as an artifact with head/tree and platform. This is diagnostic
measurement, not suite evidence; local runs require cover-quiet admission.
