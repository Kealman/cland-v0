## Running

### Enqueue preflight

Ordinary merge admission requires ready status and the Tracker readiness
verification policy: a finished passed exact-head task receipt, including a
same-tree cache projection. No configured test/tier command or an empty task
diff exempts verification. `merge-verification` names the missing evidence,
run and head; `merge-not-ready` names status. Batch runs do not replace member
receipts. Deploy and restart the hub to activate this admission policy.
Existing human tracker/docs overrides and already-landed recovery retain their
paths.

With the merge queue enabled, code enqueue prepares the reviewed item head
merged with current dev, projects the item's closure through the shared wording
lint, and runs the candidate's configured `[verification].check` in an isolated
checkout. This repository configures `npm run check`, including whole-source
lints, typechecking and build. For cland candidates containing both
`hub/test/run-suite.ts` and `hub/test/cli-usage-compatibility.test.ts`, enqueue
appends `node --test hub/test/cli-usage-compatibility.test.ts` after a successful
configured check, on that same merged checkout. Compatibility failures name the
first differing usage export and refuse before queue mutation. The successful
enqueue reply's existing `preflight` string reports the combined command, exit
and duration in seconds, from command launch through closure checkpoint and
protected output publication; checkout preparation and removal are excluded.
Older hubs may omit this successful-check summary. Deploy and restart the hub
to activate the additional enqueue check. Other stacks and candidates without
the compatibility test retain their configured command.
If the resolved candidate/root check is empty,
enqueue retains immutable tier/test lint and projected wording checks but runs
no command. It continues with the optional `preflight` result field set to
`preflight skipped: no verification check configured`; the CLI prints that note
after its queued line. This applies even when the project has no verification
commands at all. Check-only admission does not require `verification.test`;
ordinary verification retains its existing test/tier-command requirements.
A skip is not a passing command receipt.
Findings from configured checks refuse before any
queue mutation and name the command, native exit and a protected output tail of
at most 16 KiB. The supervisor suppresses raw stdout/stderr forwarding for this
check. It retains at most 1 MiB of command output and cause, protects the complete
capture with the shared redactor, then cuts the tail. If that bound is exceeded,
it drains further output and displays an explicit withholding marker instead of
an unrecognizable raw suffix. Output observer failures stay inside the native
owner and join its cleanup before settlement. Its exact private exception stays
with that owner, separate from public diagnostics. A prior selected native stop
receipt remains primary; later observer or cleanup failures are secondary.
Thrown check failures, incomplete retention and cleanup failures use the same
bounded shared-redactor projection before merge replies. The protected header
is at most 4 KiB; primary and secondary diagnostics each retain at most 16 KiB.
Each capture withholds above 1 MiB instead of releasing a raw suffix. Private
causes are nonenumerable or held in a private owner map, never wire fields.
This enforcement was authorized in human triage A-19813 (ask 8e3dd5ab,
2026-11-16). Tracker/docs immediate merges retain their existing path.

The long check runs outside territory serialization. Its owned checkout is
given scratch HOME, XDG and npm's default HOME-relative cache under
`enqueue-environment` in its owned Git metadata directory, outside the checkout.
Guarded worktree removal deletes that metadata and the scratch contents on
success, failure and cancellation. Incomplete native closure retains both until
the command owner confirms closure. Git still refuses removal if the command
writes an untracked or modified file in the checkout.
The checkout is
removed before locked admission. Under that lock, a changed task head refuses;
a changed dev tip is accepted only if its verification tree is unchanged
(tracker/rulebook metadata outside that tree). Other dev movement releases the
lock and reruns once; a second movement refuses with `dev moved during preflight`.
Cleanup failure prevents admission, retaining the first check failure and a
secondary cleanup diagnostic when both fail. A native command result alone does
not authorize removal: the command owner must observe native close, closed
pipes and an authoritative process census confirming its captured tree and
isolated group are gone. An incomplete receipt refuses enqueue, names the
retained checkout and keeps its live cleanup obligation until positive closure.
A durable command fence precedes launch and records closure before removal;
copied or recovered fence fields do not inherit the live owner's authority.
Shutdown joins that obligation. Missing or failed observations retain the root.
A captured descendant that remains listed with an unreadable current birth
also retains the fence, even outside the original process group. Only an
authoritative absence or a positively observed different birth releases it.
Projects whose pinned task head contains `hub/test/durations.json` also require
a passing, reported, cleaned exact-head and candidate-tree Linux timing receipt
before code enqueue, independently of manifest budget mode or a configured
check. Missing receipts refuse explicitly. Projects without that manifest keep
their existing path. Same-tree cache reuse from another head is insufficient.
The timing producer's OS must agree with the run's structured platform receipt;
missing or mismatched native platform metadata cannot supply Linux proof.

The runner atomically preserves reporter samples outside its temporary root.
Local worker results and droplet status carry optional `timingReceipts`: run,
head, tree, command, step, platform and samples (file, generated name, seconds,
outcome). Readers cap retained bytes at 16 MiB while reading; absent, damaged
and oversized sidecars stay unknown. Persisted Suites detail retains the data
across restart. `Suites.timingReceipt(head, tree, platform)` reads one indexed
producer; status/list replies carry only optional `timingSummary` counts and
producer identities. Older result and list shapes remain supported.
Sharded parent summaries carry `timingShards` with state `sharded` and child
run ids. `Suites.timingReceiptForRun(id)` reads the named child's own receipt;
parent lookups never synthesize combined samples or replace child producer ids.

Admission compares passing samples with the pinned base's source identities.
Matching a literal base identity is sufficient even when that file also has
computed test titles. An unmatched dynamic name is also known when its exact
identity has a test baseline or allowance in the pinned base duration manifest;
records added only in the item head do not establish an existing identity.
New identities measured at least 4 seconds need an allowance covering the peak.
Refusals provide an `allow` stanza with 1.5x headroom, seven-day dates and the
standing owner when available (`OWNER_REQUIRED` otherwise). Unresolved dynamic
base identities refuse as unknown. Logs and manifest timings supply no proof.
Derivation runs outside serialization; final mutation rechecks the indexed
producer and existing freshness fences.

Deploy this capability and restart the hub before obtaining fresh Linux
receipts: local worker and droplet status scripts come from the hosting hub,
and the delivered candidate must contain the timing-capable runner. Older
runners remain compatible but cannot supply timing proof. Prepared executors
still need the candidate's runtime dependencies; no new provider access is added.

CLI and spoke merge requests wait up to 30 minutes for this preflight; cancel
requests retain their one-minute reply deadline. These are client reply waits,
not command runtime bounds or evidence that a timed-out request did not enqueue.
The configured check uses the shared suite command supervisor and its stall and
joined-cleanup behaviour. Its HOME, XDG paths and Git configuration are sealed
to the disposable checkout with the shared fixture environment builder.

Cancelling an item advances its in-memory cancellation revision even before it
has a queue entry. The original preflight joins its check and cleanup, then
refuses with `cancelled during preflight`; a fresh request captures the new
revision and can enqueue. Admission checks the revision again under the lock
immediately before mutation. Hub shutdown joins admitted preflight work from
its first asynchronous read, retaining the existing incomplete-stop boundary.

From the repository root:

```sh
npm install
npm run typecheck
npm test
node hub/bin/cland.ts --version
```

`npm run check` inside `hub/` runs the typecheck and the tests together. `CLAND_TEST_VERBOSE=1` streams every spoke's stderr while the tests run.

At the repository root, `npm run check` runs typechecking and static/test lint.
Test lint refuses an existing T3/T4 file that loses its lifecycle declaration
from the base, or whose missing declaration would expose process-helper growth.
It names the first comment block with `[t3-lifecycle]` before process allowances;
never-headed files within their frozen allowance retain their current result.
Contract/scenario declarations and wall-clock enforcement are unchanged.
The test-lint census reports `skip-reason` for direct `node:test` skip options
with literal `true`, comparisons, negations or blank strings. This finding is
report-only; helper-returned skips are not resolved. Give platform conditions a
nonblank reason on the skipping branch and `false` on the running branch.
The load gate accepts five reasoned skips as `5/5 skipped`, without passing load
proof; a reasonless skip fails. See [verification guidance](../agents/tests.md).
Load-gate reporter receipts also retain test diagnostic lines, associated with
the result's producer location and nesting, separately from assertion errors.
Each reporter retains at most 65,536 UTF-8 JSONL bytes of diagnostic records,
including identity and escaping, redacted before truncation. Diagnostic-line
records use the shared credential redactor as well as environment-value and
invocation-tail masking. Excess lines are
drained without retention. Failed repetition output and its suite log include
these facts under `diagnosticLines`; older receipts without that field remain
readable. Diagnostic text does not determine admission or failure outcomes.
The pure fixture builder lives in `test-support/fixture-environment.ts`, with a
compatibility export in `hub/test/fixture-environment.ts`. Native account fixtures
keep their account builder at attach/replacement launches; prepare fixtures place
legacy snapshot inputs under the sealed HOME.
Its T0 child-environment guard checks native launches in `hub/test` and `nvim/test`, including
helpers, fakes and JavaScript tools. Supply the complete sealed fixture builder
result after explicit owned extras. Fresh runner children use
`runnerFixtureEnvironment` to retain only execution/admission controls while
replacing inherited profiles. Intentional native credential/provider contracts, sealed
helpers and other reviewed seams carry `// cland-allow-child-env: <reason>` beside
the launch. The guard's `--inventory` lists each recognized call and its reason,
with file/line diagnostics and no environment values. See
[fixture isolation and guard scope](../agents/tests.md#fixtures).

### Scratch admission children (T-1525)

A child testing cover admission against a disposable hub uses
`fixtureEnvironment` with explicit owned hub/lease inputs. Inherited crew
session identity is stripped along with inherited discovery paths. The runner
builder still preserves original admission controls for real suite workers.
The cover-quiet regression first observes synthetic identity at a scratch
sentinel with the old builder, then proves the isolated child admits without it.
No CLI, configuration or role permission changes apply.

Its T0 copied-tracker guard syntax-scans hub/web/Neovim tests for literal E-/T-
ids in callbacks copying `.cland/tasks`. Derive live ids from the copy; seeded
rows carry a nearby `cland-allow-tracker-id` comment naming their seeding owner.
See [guard scope and exceptions](../agents/tests.md#this-repositorys-verification-commands).

Its T0 dictionary membership guard checks `hub/src`: string-indexed records,
`any`, `unknown`, bare objects and dynamic or undeclared keys use `Object.hasOwn` or `Map.has`.
Narrowing by a declared finite key stays allowed. Intentional prototype-chain checks
need `// cland-allow-in: <reason>` on the same or preceding line; diagnostics
include file and line. See [the testing guide](../agents/tests.md).

`npm run typecheck` uses the native TypeScript 7.0.2 compiler, pinned under the
`typescript7` npm alias. The root command checks both `hub/tsconfig.json` (bin,
src and test) and `nvim/tsconfig.json` (bin and test); the hub command checks the
hub project. Both scripts use `hub/bin/typecheck.ts` to resolve the alias from
local or ancestor installs, including dependency-free task worktrees, because
both compiler packages provide a `tsc` executable. TypeScript 5.9.3 remains installed
as `typescript` for the compiler API used by `hub/test/executor.test.ts` and
`hub/test/lint-tracker-container-source.ts`; TypeScript 7 does not provide that
API. Adoption was gated on matching diagnostic codes, files and lines on both
clean projects and planted strict-option/import errors (T-427).

The T0 closed-item wording guard checks repository Markdown READMEs and docs,
including site Markdown and MDX pages,
against the candidate checkout's tracker. It reports lines that combine closed
item references with future-work wording. Fix stale claims; retain historical
records or unrelated runtime descriptions with a reason-required line exemption.
See [scope, fixtures and exemptions](../agents/tests.md#this-repositorys-verification-commands),
or `node hub/test/lint-closed-item-wording.ts --help`.

### Verification commands

<!-- cland-allow-closed-wording: pending evidence is a runtime outcome, not pending T-1049 -->
Under rule 17, CLI and derived summaries distinguish unknown or pending evidence from failure; neither is a failed result (A-8634 R13; T-1049).

Record the stack's commands with `cland config set verification.prepare|check|test`
(one key per invocation). String settings take argv literally, including quote
characters; non-string settings accept TOML values. Types come from the shared
writable-key exemplar, including optional keys omitted from generated configs.
These are project commands, independent of the language:

| Key under `[verification]` | Purpose | Where it runs |
| --- | --- | --- |
| `prepare` | Install what check and test need; optional | On the droplet builder when preparing an image, and after checkout cleanup before every droplet run; never locally |
| `check` | Fast gate; optional | Before test locally, and on the host before a droplet is created; the droplet checks again unless it can reuse the matching host receipt |
| `test` | Suite whose exit code decides the run | Locally or on the droplet, after check |

Set `test` before verifying: without it (or the optional tier commands described
below), `cland verify` refuses and names the configuration command. Empty strings
are unset. Each command runs from the candidate project directory under
`/bin/sh -c`; shell quoting, pipes and compound commands retain their meaning.
A failed check stops the run. An unset check or prepare is logged and skipped.

For example, in a Python project after `cland init` and `cland hub start`:

```sh
cland config set verification.check 'python3 -m compileall -q .'
cland config set verification.test 'python3 -m unittest'
```

This project needs no prepare command if its tests use only Python's standard
library. A project with dependencies can also set, for example,
`cland config set verification.prepare 'python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'`,
then use `.venv/bin/python` in check and test. Ignore `.venv/` and `__pycache__/`
in Git. Install local dependencies yourself: a local run never calls prepare.

Commands are resolved once at admission from the candidate's working
`.cland/config.toml`, or its committed file for a committed candidate; unset
commands fall back to the project root's config. Queued runs keep the recorded
commands across reloads. Commit configuration changes before a droplet run:
only a clean candidate's committed Git objects are bundled (tracker and rulebook
edits have the exclusions described below).

Verification identity and tree exclusions have one definition in
`verification-tree.ts`; admission owns selection policy and pins the command
plan, tiers and base for execution, cache lookup and reports. Reuse a receipt only
when command, tree, tier and occasion coverage, and execution overrides all match.
Release requests also require the effective executor and OS (Linux for droplets,
the host OS for local runs), including when the executor comes from configuration.
Persist stage and schedule state in durable records rather than reconstructing
it from transient history or message text.

Prepare must be idempotent and write only ignored files, leaving HEAD and tracked
files unchanged. Delivery cleans the checkout before rerunning it, preserving
`node_modules` and `.cache`; other ignored checkout outputs can disappear.
Caches under `$HOME` survive. Both fresh builders and run deliveries receive
`CLAND_PREPARE_KEY` as JSON describing the snapshot inputs; a matching key alone
is no proof that a fresh builder has installed dependencies. A failed prepare or
unignored output stops delivery before tests, with its output in the run log.

A project using only `test` runs that command in full. Coverage selection, the
`hub` and `nvim` package modes, the load gate and file sharding belong to cland's
own runner; another stack does not acquire them by configuring these commands.
Use mode-free `cland verify --report <topic>` for ordinary task verification.
Optional tier commands let any stack split execution explicitly; they do not
supply cland's file selection. This repository's values, modes, covers and shards
are documented in [agent test guidance](../agents/tests.md#this-repositorys-verification-commands).

### Remote executors: droplets

Executor acquisition, reap, snapshot publication and shard-release receipts
create only child directories beneath the existing `.cland/run` anchor.
If the project is removed during a write, they reject with the filesystem's
structured `ENOENT` error (snapshot preparation retains it as its error cause)
without recreating the project or run anchor. Output paths and record formats
are unchanged.

Droplet and SSH key deletion succeeds only after a GET by id answers 404,
including when DELETE itself answers 404. Release and the detached watchdog
retain ownership and the spend reservation while reads still show a resource;
release records `deletion-unconfirmed` attention and retries on the next bounded
attempt. Every discovered id remains in the lease cleanup record until its own GET 404;
list omission never discharges it. Accepted DELETE is checkpointed before GET,
so a failed confirmation keeps the original 300 s droplet bound. The watchdog
keeps its own atomic cleanup sidecar, merged by lease release on recovery.
Recovery completion wakes pending suite and shard-parent collection after its
native writes finish, including when an earlier short release attempt expired;
collection need not wait for a later scheduler tick.
`cland executor reap` and the automatic provider sweep use the same GET-by-id
confirmation for droplets and keys. An unconfirmed ID is reported and excluded
from reaped counts; the sweep stays deferred. Its lease and spend remain open.
The next reap attempts DELETE again, including after DELETE 404 with GET 200;
there is no tag-list confirmation loop. Pending identities are checkpointed in
`.cland/run/executor/reap-pending.json` before DELETE and retried across restart
or omitted provider listings, including after a project rename. A project lock serializes reaps; retries recheck
provider identity and live leases and retain identity mismatches. JSON retains `deleted`, `deletedKeys`
and `summary`, adding `unconfirmed: { droplets, keys }` only when needed.
Snapshot deletion confirmation is documented with the snapshot recovery flow.

Project test commands are configured under `[verification]`: `test_unit` (T1),
`test_component` (T2), `test_integration` (T3), and `test_soak` (T4).
Each is a POSIX shell command; empty means unset. Use
`cland config set verification.test_unit '<command>'` to store it verbatim.
Tasks with hosting batch protection run `check`, unit and component; merge batches run `check` (T0) before commands matching `merge.batch_tiers` (default unit/integration), omitting unit with complete exact-head member receipts, adding Web after T1 for web/ candidate diffs; periodic `dev-t3` runs integration;
integrated dev, explicit `all` and tasks without batch protection run T1–T3; occasions and nightly soak run all
four. Tier lines report exit, duration and output tail. Admission records the
commands so config reloads cannot change queued evidence. With only `test` set,
the whole command runs per task and `[merge] queue` defaults to `false`.
Enable it for batch landing; `merge.batch` (default 3) and `merge.batch_wait`
(default `"10m"`) set the maximum heads and oldest-request wait, and both are
settable through `cland config set`. See [test guidance](../agents/tests.md).

Choose the project default with `[verification] executor = "local"` (the default)
or `"droplet"` in `.cland/config.toml`; `cland hub reload` applies executor,
local workers and droplet settings live. The human or Coordinator can use
`cland verify executor local|droplet [--workers N] [--json]` to atomically save
the default executor and its worker count, reload, and return the effective
executor, workers and batch location. Without `--workers`, it keeps that
executor's configured count (droplets inherit local workers without an override).
An unmarked config is left unchanged. A reload refusal fails the command;
the saved edit is not reported as applied. Running jobs retain their admission
snapshot; queued jobs following the default take the new policy. Merge batches
use the default; periodic dev and soak still explicitly use droplets.
`cland verify --executor local|droplet --report <topic>` overrides it for one run.
Use `--executor local` on a macOS host for a macOS-only question or when the human
asks. Both executors share admission order, the tree/mode cache and the
artifact-backed result. Review source first, then verify the exact reviewed head
(D25), whichever executor runs it.

Before an uncached remote submission, a five-second API probe checks sizes and
configured regions. Unavailable regions are skipped with a named reason; an
unreachable API refuses with its cause and suggests `cland verify executor local`.
The probe does not reserve or inspect spend for a fallback-eligible request:
with the executor flag omitted and `local_fallback = true`, acquisition retains
the existing spend-cap fallback. Remote-required requests (an explicit droplet
executor or `local_fallback = false`) also check spend before submission.
Every acquisition still reserves against the shared cap atomically.
After acquisition, SSH readiness has its own bounded wait. A readiness failure or
an exhausted two-attempt upload transport failure can replace the droplet once,
after confirmed release, in a different configured snapshot region. The run
retains the failed lease, region, phase and replacement identity. Accounting
retains both resources; the report labels cumulative lifetime and cost as a total
across two machines. Upload failures
from the local SSH client, already delivered runs, and unconfirmed cleanup never
authorize replacement.
Replacement allocation supplies an explicit resource-lifetime cap from the
original lease. That cap is distinct from the acquisition wait deadline and is
persisted before spend reservation and watchdog launch; replacement cannot renew
the run's resource lifetime. A second delivery failure retains the integrated or
periodic run's pre-execution infrastructure classification.

Result messages retain executor accounting and machine health before optional
diagnostics when the text cap requires a shorter summary. Long fallback and
deciding-file lists remain in the log artifact. Confirmed lifetime and cost also
appear in a readable accounting line immediately before the final provenance
JSON footer; pending accounting stays explicitly unconfirmed.

Updated droplet launchers append advisory `suite machine metrics` JSON lines to
each run's `suite.log` about once per second during package execution, after the
startup storage probe. Fields are `version: 1`, `at` (machine epoch milliseconds),
`elapsedMs` (actual interval), `load` (Linux 1/5/15-minute load averages), and
`cpuPct`, `iowaitPct`, `stealPct` (machine-wide tick deltas). CPU excludes idle,
iowait and steal; guest counters are already included in user/nice. Missing or
reset counters remain null. Scheduling under load can lengthen an interval;
the recorded interval remains authoritative. These lines survive log evidence
reduction; the existing aggregate `suite machine health` receipt is unchanged.
The sampler timer runs inside the foreground package supervisor, under the
admitted package deadline and ten-second outer kill grace; no separate sampler child
or unbounded shutdown wait is added. Metrics stream to a separate file during
execution. After the foreground owner completes, a framed append copies them
into the run log, preserving arbitrary package output without trailing newlines.
This append has a three-second bound plus one-second kill grace; failure records
incomplete telemetry and preserves the package outcome. Thus live package log
collection does not include the series until this final append.
The retained `suite machine metrics-incomplete` record names the append stage
and its native exit code; it is distinct from a complete JSON sample.
The supervisor arms TERM/INT observation before launching the package. It
allows two seconds for local drainage after interruption; TERM is never a
closure receipt. The pre-launch `package-pending` fence permits `done` only
after an uninterrupted native close writes `package-closed`. Interruption or
supervisor KILL retains that fence, records the foreground native exit when
available, and delegates closure to the owning machine's deletion.
Whenever finish executes, `exit` preserves the native status independently of
completion, including before an incomplete handoff returns. The `done` marker
remains gated by closure; final reporting stays fenced until release.
The supervisor's admitted timer atomically writes `deadline-expired` before
interrupting its package owner. Its two-second handoff remains fenced by machine
deletion; the outer native timeout leaves at least five seconds of shutdown
headroom, followed by its existing ten-second kill grace. The bounded marker
reader emits optional `deadlineExpired: true` in status and result checkpoints;
restart preserves that authority as `timedOut`. An ordinary command exit 124 or
an old receipt without the marker establishes no deadline cause. Periodic such
results remain red with unknown cause; genuine owner timeouts without observed
failures report inconclusive and name incomplete tiers. This requires deploying
and restarting the hub; its hosted upload supplies the new supervisor files.
If marker publication fails, a bounded secondary diagnostic names the publication
stage and a validated native error code when available. The selected
interruption still reaches bounded handoff, even if diagnostic output also
fails; missing marker bytes grant no deadline authority. All result writers,
including missing-evidence and isolated-unavailable reconstruction, share the
same positive-metadata projection. Later result-only recovery preserves that
metadata without replacing a selected infrastructure or cancellation outcome.

Status also adds optional `packageClosure: { state: "incomplete", nativeExit: number | null }`;
unknown exits stay null and an incomplete zero exit cannot pass. The hub keeps
this receipt in the job and result through restart and withholds its final
report and terminal task card until the lease's confirmed release, including after the normal
accounting wait expires. Release attempts retain their existing per-attempt
bound; this closure handoff keeps retrying instead of publishing pending
accounting. Older runners without the fence/field keep their prior reply shape
and accounting behaviour. This capability requires the hosting-hub restart
described below before measurement runs use it.
Per-second series are retained for normal completed runs. Interrupted runs,
including supervisor KILL without shell finish, can lose the separate series.
Their final log explicitly states `machine metrics unavailable: run interrupted
before collection`, with the closure cause and foreground native exit (or
unknown). This disclosure is generated from the durable handoff receipt after
confirmed deletion; it does not imply zero load or available samples. Collecting
those samples before deletion is a separate follow-up.
Merged parent logs retain each interrupted child's disclosure under its shard
header. Parent finalization replaces its own generated footer while preserving
these child facts across aggregation and publication retries.
Sampling is report-only and cannot change the suite outcome. The launcher is
supplied by the running hub: deploy and restart it before requesting measurement
runs; candidate-only changes cannot update an older hub's uploaded launcher.

#### Close runs

`cland verify all --occasion stage|epic|release --report <topic>` shards remote
integrated `dev` closes. The Coordinator may name any occasion; QA may name `epic`
for an epic demo. The project-root checkout must be clean, on `dev`, at freshly
fetched `origin/dev`. Other roles and task heads are refused. The MCP `verify`
tool takes the same `occasion` field. Task runs stay on one slot; cland tier-command batches may shard;
`--executor local` keeps a close run local.

Every `after-stage` gate, including `qa.scope: none`, requires a green integrated
Linux droplet `--occasion stage` full cover (normally sharded; the documented
one-slot fallback still counts). A stage may additionally name `macos: [<test
paths>]` in its plan. These paths must exist at plan set and use repository test
paths; duplicates and unknown paths refuse. That stage also requires a green
targeted macOS receipt for exactly those paths at the Linux cover's tree. A
non-none QA scope additionally needs its clear stage QA verdict at that tree.
Per-item gates are unchanged. `task plan show` names missing platforms, tree and
the targeted macOS receipt. Completed stages retain their evidence across later
descendant builds while their plan and landing evidence remain valid.

The Coordinator submits `cland verify all --occasion stage --executor local
--stage E-<n> --report <topic>` on macOS. Repeat `--stage` for several epics: the
run pins the union of their current open stages' `macos` paths and records a
receipt for each named stage. Linux, a non-stage occasion, or a named epic whose
open stage has no `macos` paths refuses the selector. MCP `verify` takes the
equivalent `stages: ["E-<n>"]`. Without the selector a local stage occasion stays
a full run; Linux stage occasions remain full. Cache reuse preserves executor,
platform and pinned targets. A full cover does not replace an explicit targeted
receipt. The epic Definition of done requires a green macOS **full** cover at
its DoD tree; a targeted stage receipt cannot satisfy it.

Restored covers can await background tree or ancestry checks. `task plan show`
reports those platforms as `pending`, not `missing`; JSON covers include an optional
`pending` platform array. A stage QA verdict's `current` stays absent until its
facts settle. Pending evidence holds stage closure and advancement. Stage ancestry
and task merge-gate comparisons run in a foreground lane independent of epic-demo
history scans. Demo surfaces and intervening changes each use one batched Git
history read, retaining every changed commit (including reverted edits and side
branches), rename/deletion paths and conflict commit identities. Closed epics
read cached demo currency without scheduling scans; an uncomputed answer stays
unknown, and reopening an epic restores background checks. Both lanes share the
tracker's shutdown cancellation and drain ownership.
The copied-tracker restoration probe and its stronger checkpoint-recompute mode
are described in [Implementer test selection](../agents/tests.md#implementer-test-selection).

At admission, free remote slots up to `[verification] shards` (default 2) set the
shard count. Hub files are placed largest-first on the lightest shard using
`hub/test/durations.json` `files[*].seconds`; unknown files use the manifest
median. Neovim goes to the shard with the least hub time, on that same droplet.
Hub-owned batches carrying cland tier commands and a nonempty file plan use this
policy too. Their pinned tier plan limits both balancing weights and execution:
configured T4 is retained, omitted T1 stays omitted, and partial importer masks
stay partial. Neovim and Web share one assigned machine. Setup repeats per shard;
T0 reuses the host gate only with matching tree and command, otherwise it repeats.
Every planned shard must report green structured command receipts with
the admitted tree/head and the exact complete parent file inventory before
landing; missing, failed or incomplete shards cannot land or establish full
coverage. Full sharded batches may supply the periodic full-batch backstop;
partial batches never do. Legacy unsharded receipts remain supported.
Mixed failed and interrupted/unexecuted shards remain inconclusive for culprit
diagnosis, using the children's structured native and tier receipts. Full batch
coverage is checkpointed from the already-loaded terminal producer. Periodic
checks consume that versioned run/head/tree-bound compact fact without hydrating
archived groups; old sharded history without it remains unknown. Unsharded
history retains its existing receipt policy.
`CLAND_SUITE_SELECTION` carries each explicit file list into the package runner, which retains free/machine classification inside that shard. Selections above 64 KiB, including large stage identity baselines, use a delivered JSON file named by `CLAND_SUITE_SELECTION_FILE` on both executors; test workers and repetition workers inherit neither selection variable.

The hub atomically reserves the whole group's estimated lifetime cost against
the shared daily ledger ($3 here) before creating machines. When the cap cannot
cover every shard, or fewer than two remote slots are free, it runs whole on one
slot with one warn notice: `sharding skipped: daily spend cap $3 would be exceeded`
or `sharding skipped: fewer than 2 remote slots free`. Shards are not silently
retried or run locally after admission. If every shard is refused before execution,
the group finishes unavailable, retaining each shard's cause: provider capacity
when all refusals are capacity, infrastructure when bundle admission, acquisition
or delivery fails before worker submission. Restored delivered leases and failed
start acknowledgements retain their uncertain execution outcome. An unexecuted group creates
no red/green cover or culprit search. A partially executed group retains the
executed counts and failures, names each unexecuted shard, and cannot pass.

One merged result sums counts, labels failed/lost shards, lists each machine,
size, duration and cost, total cost, and wall from admission to final collection.
The merged log and one log per shard are durable artifacts. Leases and child
receipts survive hub restart, and confirmed deletion precedes slot release.
An identical green tree/mode cache entry with matching soak coverage serves a later occasion request. Ordinary batch greens cannot satisfy occasions. Stage
and release requests also match the effective executor/platform; a stage's Linux cache must
itself cover a stage close.
Two c-8 machines with ten-minute lifetimes estimate $0.0833 total at $0.25/hour;
provisioning and cleanup add to billed lifetime. Read measured costs in each run.

#### Configuration and costs

| Key | Default | This project's D27 build value |
| --- | --- | --- |
| `[verification] executor` | `local` | `local` during the build; `droplet` after E-271 closes |
| `budget` | `1` (local cap) | `1` |
| `remote_budget` | `4` | `2` |
| `local_fallback` | `true` | `false` |
| `shards` | `2` (positive integer) | default |
| `lock_path` | `/tmp/cland-suite.lock` | default |
| `cache_max_age_minutes` | `1440` | default |
| `lifetime` | `110m` | `60m` |
| `run_timeout` | `75m` | `50m` |
| `daily_spend_usd` | `5` | `3` |
| `[verification.droplet] size` | `c-8` | default |
| `prepare_size` | `c-8` | default |
| `snapshot_size` | inherits `prepare_size` | `c-4` |
| `regions` | `["lon1", "nyc1", "sfo2"]` | default |
| `image` | `ubuntu-24-04-x64` | default |

`lifetime` and `run_timeout` are positive duration strings (`s`, `m`, `h`, `d`);
the lifetime must cover the timeout plus ten minutes. Droplet settings are read
again at each acquire; invalid values name their config key. The first available
configured region offering the size and holding the prepared image wins.

`[verification] coordinator_suites` is a positive integer, default 1 in generated
and inherited configuration, applied on reload. It limits distinct active droplet
submission keys for the hub-held Coordinator session identity. A matching retry
joins its existing run; executor/worker/size overrides retain their existing
separate-run behavior, including Linux and macOS stage covers. Other roles keep
the existing one-key limit. Extra Coordinator requests queue when remote slots are full; shard limits and
daily spend checks remain unchanged. Insufficient spend returns a provider-capacity
not-run receipt rather than waiting for budget; this setting creates no extra
machine capacity.
Local execution stays at one run per machine. Deploy and restart the hub before
raising this setting for work that relies on the new admission policy.

Verify replies with the run id, nullable worker pid and queue position after the
job is persisted, without waiting for scheduler inspection or worker launch.
This early reply belongs to the socket/RPC request handler. In-process
`Suites.start()` callers still await the scheduler pass; existing fixtures and
fake-clock drivers retain that completion contract.
Candidate validation, tree hashing and required spend checks still precede
admission; bundling, host gates and execution follow it. Scheduler work is owned
by the hub and joined on shutdown; launch failures remain recorded run outcomes
and produce the usual artifact-backed result. The CLI reply bound is 90 s for local and remote discovery
(diagnostics: 120 s), allowing candidate validation before the durable checkpoint.
This includes the roughly 40-second admission envelope observed on a local socket;
it does not wait for execution. A sent request with no reply exits
75 and says to check `cland verify queue` before resubmitting; it never retries
automatically. The reply fields retain their previous shape.

One local run uses the host's compatibility leases. Up to `remote_budget` droplet
runs proceed beside it, using their own machines' locks. A full remote budget with `local_fallback = true` (the default)
may send a default droplet request to a free local slot with a warning; with both budgets full,
it waits. `cland verify queue` shows `local:`, a `remote <used>/<budget>:` line per
remote run with session, item, machine, size, region and ETA, and waiters naming
their executor and the `local fallback: true|false` policy (`localFallback` in JSON).
With `local_fallback = false`, default droplet requests follow the same remote-only
policy as explicit `--executor droplet` requests: they stay queued for remote
capacity (including durable leases pending cleanup), labelled `waiting for remote`
with their position; later local requests can pass them. Their admission ETA
uses remote capacity only. JSON waiters include `waitingFor: "remote"`. A machine
still being acquired is shown as `acquiring`.

At [DigitalOcean's listed rates](https://www.digitalocean.com/pricing/droplets),
c-8 costs $0.25/hour and c-16 $0.50/hour. A full suite on c-8 costs about $0.10
(roughly 24 minutes); c-16 costs twice as much per hour, with its run cost depending
on duration. Billing is per second with a 60-second or $0.01 minimum, whichever
is higher. cland's result estimates cost from the size's hourly price and lifetime
with a 60-second minimum; it is not an invoice. [Droplet snapshot storage](https://docs.digitalocean.com/products/snapshots/details/pricing/)
costs $0.06 per GB-month, separately from run and builder time.

#### Controls and the prepared snapshot

The hub owns the lifecycle: sessions never create, list or delete droplets by
hand. `cland executor status|prepare|reap|retire-legacy` belongs to the human and Coordinator.
Under D27, T-282's hand driver retired when T-346 merged; Linux proof runs now
use `cland verify --executor droplet` under the hub's enforced limits. The stand-in
keeps the hourly tag check; the hub's sweep and watchdog do the automatic cleanup.
Legacy hand-driver droplets carry only `cland` and are swept only after the
configured lifetime plus ten minutes.

The droplet lifecycle uses DigitalOcean's REST API. Run `cland secret set digitalocean.token`,
then restart the hub. See [provider credential migration](provider-credential-migration.md)
for removing startup exports; an explicit hub environment token still overrides the store.
Each API call sends the resolved token only in the Authorization header;
cland never prints or logs its value, or sends it to a droplet. Calls
have a 15-second bound. A create refused with exactly `422 unprocessable_entity:
Size is not available in this region` advances to the next catalog-supported
configured region (also present in the prepared snapshot for verification).
Each refusal is appended to the verification run log. Exhaustion reports one
provider-capacity reason listing the refused regions and releases the lease's
spend reservation after cleanup. Other refusals and ambiguous creates keep their
existing handling; API pacing and the acquisition deadline apply across attempts.
The lifecycle needs permission
to read the account, sizes and regions, and to create, read and delete droplets
and account SSH keys. See the [DigitalOcean API reference](https://docs.digitalocean.com/reference/api/reference/).

`cland executor prepare [--report <topic>] [--json]` submits a hub-owned snapshot
job and exits. Status shows its step and elapsed time; one hub notice in the
chosen topic (Agents by default), addressed to the Coordinator, reports the key,
image, regions, duration, builder lifetime and cost. A second prepare while one runs is refused.
Preparation and the other executor controls belong to the human and Coordinator.

The snapshot contains the base packages, the host's exact Node version, the
ordinary `runner` user, a bare repository mirror and a checkout of the base, plus
what the project's prepare command installs. `[verification] provision` names an optional
repository-relative script in the committed base, run with Bash as root after the
generic recipe and before `prepare` runs as runner. Its output is logged as
`executor-prepare-install`; a failed hook stops preparation and reports its output.
Without a hook, no additional root step runs. This project configures
`hub/bin/verify-provision.sh` for Ubuntu Chromium libraries and pinned Neovim;
`verify-prepare.ts` installs Node dependencies and Chrome Headless Shell. The hook
records the installed Neovim tag and digest under `.cache/nvim/.cland-installed.json`,
independently of the executor key and the npm installation receipt. A known
same-tag digest conflict refuses before seeding or publishing a matching marker;
rebuild the snapshot with consistent pins. Legacy tag-only project markers can
use the old image's tag-and-digest receipt.
The shared `renderRecipe({ arch, node, harnesses? })` in `hub/src/image/recipe.ts`
uses the retained `provision.sh` base template. It accepts `x86_64` and `arm64`,
selects the matching checksum-verified Node archive, and refuses unknown architectures.
The executor builder remains x86_64 and omits harnesses, preserving its template
bytes and digest. Agent-image callers pass a harness pin object; omitted pins use
`doctor/ranges.ts` tested minimums. Agent plans install pinned Codex via npm with an explicit `/usr/local` prefix,
OpenCode 2 via its v2 installer and Claude Code via its native installer, with
user-level installers running as runner before the ready marker. Executable checks
and stable `/usr/local/bin` links to the baked runner binaries keep native harnesses
available when an account uses a login-disk HOME. Rendering executes
no installer; base packages remain project-neutral.

The key combines Node, the running hub recipe SHA-256, optional hook content
SHA-256 with its captured path, the committed base's optional lockfile SHA-256, and `origin/dev` after
a fetch from the local territory. Local uncommitted hook edits do not affect it. Hook capture uses the applied
configuration; a changed applied path refuses an already captured key before
reuse or builder admission. Committed hooks must be regular files, not symlinks.
A matching prepare reports `current`; a new key builds a replacement and deletes
the previous image only after the new image completes. Failures clean up the
builder and partial image while keeping the previous snapshot. Status includes
the image's size in GB.

The record lives in `.cland/run/executor/snapshot.json`, mirrored in `hub.db` under
`executor-snapshot`. Status lists its key and `current` or `stale: base|lock|node|recipe|provision`
for the inputs that moved. A moved base increases future delivery bundles;
changed install inputs need reseeding during a run. Re-prepare after a release or
a lockfile change; this is a human or Coordinator action, never automatic.
After provisioning changes land, restart the hub onto that code before preparing:
the root cloud-init template comes from the running hub, while a delivered branch's
prepare command runs as the non-root runner. Collect Web evidence on the rebuilt image.

Acquire reports changed lock, Node, recipe or provision inputs once per distinct snapshot/install-input key to the Coordinator in Agents, naming `cland executor prepare`. Base-only drift stays visible in status at any age without prompting; further base moves do not repeat an existing install-input notice. This advisory does not block the run or rebuild an image. Metadata/publication failures retain a bounded, credential-redacted secondary hub-log diagnostic; a failing diagnostic sink also cannot block acquisition. Its receipt survives hub restart; matching install inputs or successful preparation clear it. Inspection uses local committed inputs with a five-second bound and no fetch.

Acquire creates from the image, without user data, only in regions holding it.
It polls until active with a public IPv4 address under a five-minute bound,
then waits up to 180 seconds for SSH as `runner` to answer and for the image marker
to match the recorded key; a mismatch or timeout releases the droplet. Without
an image it refuses with `no prepared snapshot; run cland executor prepare`.
The image's per-boot script copies the newly injected root key to `runner`.
Private SSH/SCP calls use the lease key, ignore host SSH config and known-hosts
files, have explicit time bounds and strip `DIGITALOCEAN_TOKEN` from children.
The executor, host carrier and provider bootstrap share `sshBinaries(env)` from
`hub/src/host/ssh-binaries.ts`. `CLAND_SSH_BIN` and `CLAND_SCP_BIN` select
alternative transports with either both nonempty `CLAND_FAKE_HOSTS` and
`CLAND_FAKE_HOST_ROOT`, or `CLAND_TEST_EXECUTOR_TRANSPORT=1` together with an
absolute `CLAND_TEST_FAKE_MACHINE_ROOT` containing `.cland-executor-transport-fixture`
whose contents equal that root. The fake provider creates this marker in its
disposable root. Without either gate the selector returns `ssh` and `scp` from
PATH. Final role Host command environments strip the two executor controls
after all overlays, including restored account rows and OpenCode secrets; fixture hubs retain
explicit controls. A hub deliberately started with both controls and a valid
marker can use fake binaries, as with the fake-host gate. The executor
code and droplet `run.sh` come from the running hub, so deployed changes require
a hub restart before real runs use them.

`snapshot_size` selects the verification snapshot builder; when unset it inherits `prepare_size` (default c-8), preserving existing projects. This project pins `snapshot_size = "c-4"`, the smallest requested verification size. `prepare_size` continues to select the paid host-pool builder, including explicit overrides. DigitalOcean restores a snapshot only onto a disk at least its minimum disk size; a c-4 snapshot therefore supports c-4 and c-8 runs. Prepare refuses a builder disk larger than the configured run disk before creating anything and, with `snapshot_size` set, rebuilds a matching-key snapshot whose minimum disk exceeds the selected builder disk. Without that override, a matching snapshot retains legacy reuse without a provider call, including drainage of an already admitted key computation during shutdown. When a prepared snapshot exists, verification admission refuses an incompatible disk before T0 and names fitting catalog sizes; regional capacity is checked separately. Without a snapshot, admission and dry-run planning retain their existing behavior; acquisition still requires preparation. The builder uses the same lease, tags, watchdog and
release as a run, installs the exact versions with digest checks, delivers from
the territory and runs the root's configured prepare command as `runner` (or
reports `prepare: not set`). It powers off before snapshotting,
polls power-off and snapshot actions under a twenty-minute bound, then transfers
to configured regions within the builder's remaining admitted lifetime and
tags the image `cland` and `cland-p-<hash>`, then releases the builder.

Stopping the hub interrupts provider waits, reservation-lock and spend-ledger
retries, acquisition polling and preparation machine work. Cancellation joins
native lock acquisition and releases a late-acquired lock before rejecting; it
never detaches an owner. Sharded planning uses the same cancellation. If its
ledger release cannot finish at shutdown, the persisted shard-release intent
stays until the next hub settles it before reconciliation completes; reservations
remain conservatively counted until then. Suite launches keep their durable
acquisition attempt rather than
falling back locally during shutdown. Unanswered creates keep their original
name, tags and unfinished create marker in `lease.json`; cleanup remains
`releasing` with unknown lifetime and cost until deletion is confirmed. The hub
drains these local ownership writes and preparation's outcome notice, logs
`stopped` and exits without waiting for provider completion. The detached watchdog
and the next hub's reconciliation retain responsibility for late resources;
only resources matching the lease's own name and tags are deleted. Preparation
also retains snapshot-recovery records for restart.
Before submitting a snapshot action it saves image-recovery ownership under
`.cland/run/executor/snapshot-recovery/`. Restart and the lease retry timer retain
that ownership through late actions, delayed catalogues and refused image
deletions. Status lists outstanding recovery. An ambiguous old-image deletion
keeps the completed replacement until provider state decides whether to retain
it or restore the previous image; a failed catalogue read never counts as
absence. Recovery matches images to their builder, so a later prepare of the
same key cannot lose its image to an older failed attempt.
Once retirement is submitted, old-image presence may be stale or deletion may
still be running: cland keeps the replacement and retries retirement until the
old image has a GET-by-id 404 receipt. Snapshot DELETE uses the same confirmed
deletion helper as droplets and keys, including DELETE404/GET200 split answers.
Unconfirmed retirement and partial-image cleanup retain their recovery record;
the next recovery retries DELETE for saved IDs even when a catalogue omits them.
Preparation checkpoints the created image's ID before transfer. A failed prepare
reports image cleanup as confirmed only after recovery confirms deletion; otherwise
it names image cleanup as unconfirmed. Builder lifetime and cost likewise stay
unconfirmed until the existing lease release confirms deletion.
Only an unstarted or definitely rejected delete permits
rollback to the old image.

`cland executor status [--json]` also reports token presence, live leases, their names,
ids, sizes, regions, ages and deadlines, whether each watchdog is alive, today's
spent and reserved USD against the daily cap, the shared ledger path, and the
number of droplets tagged `cland`.
Snapshot freshness compares against the local `refs/remotes/origin/dev` commit;
the snapshot status line names it as `local=origin/dev@<short SHA>` (or `unknown`
when inspection fails or exceeds its bound). Status never fetches or runs `ls-remote`. A key
read that exceeds 5 seconds continues in the background for one later observation;
the snapshot’s additive `inspectionReason` and summary name the failure or timeout, while `freshness` keeps the compatible `unknown (inspection deferred)` incomplete value. Consumption checks the local base again and discards a key from an older base.
`current` therefore means current against that named local commit. Remote changes
become visible when the local ref refreshes; `executor prepare` still fetches
`origin dev` by default before preparing its key and snapshot.
`cland executor reap [--json]` deletes this project's tagged droplets with no live
lease, and unowned `cland` droplets past their lifetime plus ten minutes. Known
leases use their own recorded deadline: a short-lived scratch hub preserves a
foreign live run. Provider lists are followed by fresh durable ownership reads,
so concurrent acquisition cannot make a new resource look orphaned.
It also removes this project's orphaned account SSH keys. New key names start
with the droplet project tag, `cland-p-<hash>-`, so equally named projects cannot
reap each other's in-flight keys. Legacy `cland-<name>-` keys are removed only
when no live lease registered on this host names them and their known lease
creation/import time is older than lifetime plus ten minutes. Unknown-age legacy
keys are preserved: DigitalOcean's [SSH key schema](https://docs.digitalocean.com/reference/api/reference/ssh-keys/) has no creation timestamp. Hubs register their project roots
in the shared ledger so cleanup can inspect other projects' durable leases.
Registration requires an existing directory with a `.cland` directory; filesystem
roots, HOME itself and their aliases are refused before any ledger write. Roots
are canonicalised so aliases register once. Sweeps also remove invalid legacy
registrations immediately, with `executor-project-pruned` and reason
`invalid project directory`; this includes `/` even though it exists. Each
automatic sweep records when a
registered directory first disappears. After 24 continuous hours missing, it
removes that root from `projects` and journals `executor-project-pruned` with
`project` and `since`. A return during the grace resets it; unreadable paths defer
the sweep. Missing-project records persist across restarts and legacy write-through.
Pruning retains all spend entries and outstanding reservations, and prevents those
entries from reviving lease-directory scans while the root is gone. A returning
valid project is restored before provider cleanup and can register again.
Both commands belong
to the human and the Coordinator; reap requires the token.

#### Run and result

A host check interrupted by hub shutdown can rerun under the same admitted run.
Batch preparation checks closed-item wording on immutable candidate blobs,
projecting each prepared member as closed before admission. Findings refuse
the member with file/line diagnostics; other open items remain open for this
check. The standalone T0 lint continues to use the checkout tracker state.

Each new T0 receipt records its run, candidate tree and command. Batch settlement
ignores an interrupted attempt only after a later passing receipt with all three
bindings equal. The raw log retains both attempts and a supersession note; the
batch notice labels the aborted exit and duration as superseded. An unbound
legacy interruption, an unmatched retry or an interruption without a later pass
still holds the batch as inconclusive. Ordinary failing receipts remain failures.

For ordinary task runs and merge batches, before acquiring a droplet the hub
runs the recorded check command at the submitted head on the host
(`Host gate: <command>`). Integrated dev and periodic dev T3 instead check the
captured commit remotely, independently of later root movement. A host failure posts
`host check failed (exit <n>); no droplet created`; an unset check logs
`Host gate: check not set` and continues. A `MODULE_NOT_FOUND` or
`ERR_MODULE_NOT_FOUND` naming a locked package also reports
`dependencies out of date: run npm install`, with the candidate checkout. Unknown
imports and ordinary type errors retain their original failure. This diagnosis
never runs an installer. Delivery
bundles the head against its merge base with the prepared snapshot's base; without
a merge base, or when the bundle would be empty, it sends a full bundle. As `runner`,
the machine fetches that bundle, checks out the exact detached head and cleans the
checkout while preserving `node_modules` and `.cache`, then runs the recorded
prepare command on every delivery with `CLAND_PREPARE_KEY` as JSON. It rejects
changed HEAD, tracked edits and unignored output before starting the worker.

Delivery file uploads retry the failed file once after the transport has
settled. Each attempt allows the larger of 120 seconds or 30 seconds plus the
file size at 32 KiB/s; this is a conservative transfer allowance, not a measured
network rate. All delivery steps share a ten-minute deadline starting before
bundling, capped by the droplet lifetime. The attempt receives only the remaining
budget. For 9 MiB the allowance is 318 seconds; after a full first timeout,
the ten-minute window leaves at most 282 seconds for the retry (less time already
spent on setup). A faster first failure leaves the full allowance for retry.
Idempotent directory readiness retains its thirty-second retry window;
fetch and checkout/prepare are not blindly replayed after SSH errors. Every
directory and upload attempt records its timeout, elapsed milliseconds and
outcome in the local run log. Exhausted uploads name the file, attempted copies
and their elapsed times in one terminal delivery reason. They remain
infrastructure failures without a test receipt, so merge batches hold as
inconclusive. `delivery.log` keeps the remote fetch/prepare output consumed by
the runner; attempt diagnostics live in the run log. Local verification has no
droplet transfer policy.

Copy failures retain stderr through native process close. The transport drains
stderr incrementally, keeping its last 64 KiB and reporting bytes seen and
dropped; a truncated tail discards and marks its partial initial line before
redaction, so it cannot publish the suffix of a token cut at that boundary.
Smaller output remains complete. Every failed upload attempt persists
that diagnostic, including attempts followed by success. Exit code, signal and
the transport-owned timeout receipt remain distinct; a known-hosts warning or
SIGTERM alone is not classified as a timeout. Command arguments are excluded
and the provider token is redacted. This diagnostic does not establish the
cause of a network failure or change the existing upload retry policy.
If persisting a failed upload diagnostic itself fails, the copy error remains
the primary cause and a bounded secondary diagnostic names the persistence
failure. The upload stops without claiming a durable diagnostic or retrying.
Coverage downloads retain transport facts in their thrown diagnostic; durable
per-attempt history here applies to delivery uploads only.

Readiness deadline errors retain a typed producer phase, deadline milliseconds
and observed clock milliseconds. `boot-readiness` identifies the image/boot
probe; `delivery-lease-expiry` identifies a lease already expired before
directory delivery. `delivery-budget-expiry` identifies the ten-minute delivery
cap instead; `delivery-directory-readiness` identifies the directory setup cap
if a clock jump crosses it before the initial probe. Delivery wrappers retain
that error as `Error.cause`.
The phase suffix in the diagnostic is for human readers only and must never be
parsed. Persisted suite outcomes keep their existing shape and human-readable
cause; they do not expose the typed phase as a separate field. These diagnostics
change no readiness, retry or lease deadline.
Preparation wrappers also preserve the typed error as `Error.cause`. Subsequent
release, recovery-checkpoint or recovery failures stay secondary in its
`cleanupFailures` receipts and human-readable cleanup notice. A failed builder
release or recovery checkpoint retains recovery ownership and skips subsequent
image cleanup. Acquisition and preparation preserve non-readiness primary
errors too: cleanup failures become an `AggregateError` cause alongside any
existing cause. Frozen or non-Error thrown values remain the cause of an
aggregate wrapper. Acquisition retains its lease when its failure checkpoint
or release rejects; restart reconciliation retries from the durable record.
Reservation failure also survives a rejected budget-lock release. The executor
keeps that exact lock owner's release handle for retry before another reservation,
during reconciliation and on close; a failed retry retains the handle. Regional
capacity-refusal checkpoints preserve the provider refusal if persistence fails.
The delivered lease checkpoints the local log prefix as `execution.deliveryLogEnd`
before the hub starts collection. Restart uses that durable byte boundary even
when the suite-job checkpoint still carries the pre-delivery offset. Already
collected remote bytes remain relative to that same boundary. Older delivered
leases without the optional field retain their existing job offset.
Launch recovery loads this boundary before writing admission diagnostics;
cleanup messages after the boundary go to the hub journal rather than the
mirrored stream.

Cland's own prepare script (`node hub/bin/verify-prepare.ts`) runs `npm ci` and
seeds the Neovim pin when needed. It skips only when the snapshot inputs and a
successful-install marker (`node_modules/.cland-prepare-key`) match. Existing
images can use `$HOME/.cland-image.json` as a legacy receipt while dependencies
still exist; fresh builders install even with a matching key. The log retains
`dependencies match snapshot` and `Neovim pin matches snapshot` for warm runs.

Delivery ignores uncommitted changes under `.cland/tasks` and to `.cland/RULES.md`, including tracker writes
between submission and bundling. Every bundle contains the committed head's tracker
state; this applies to each shard of an occasion run too. Task runs require their
exact submitted head and refuse other dirty files, with their paths in the error.
Integrated dev runs (including soak, stage, epic and release) and periodic
`dev-t3` runs bundle the admitted commit directly from Git objects, independent
of later source or administrative commits and dirty files in root dev. They
skip the live-root host gate and run the recorded check remotely at the detached
submitted head. A pre-execution delivery failure is retained as infrastructure
not run, with its cause, and supplies no failed incident cover or culprit search.

The host computes the suite selection while `origin/dev` is available. The uploaded
`env` carries the selection (inline JSON or a delivered selection file), worker
and limit settings, and `FORCE_COLOR=0` / `NO_COLOR=1`.
Cland's package runner reads that selection without fetching. A detached `setsid nohup`
run as `runner` executes the recorded check and test plan. A successful host check
is reused only when its command and candidate tree match; otherwise check runs
on the droplet before test. It uses the machine's own compatibility locks
and `timeout` with the configured `run_timeout`. The hub also cancels a run beyond
that timeout plus two minutes, collects its log and releases its machine. Both
paths report `run timeout <value>` once. Config load refuses a `lifetime` shorter
than `run_timeout` plus ten minutes, naming both values.

Every ten seconds the hub polls status and up to 256 KiB of log bytes by offset.
SSH failures leave the run unknown and are retried; an API 404, or five minutes
unreachable while the API reports active, fails it with `remote machine lost`.
An explicit local SSH client failure (user lookup, unreadable/invalid private
key or missing/unexecutable client) with an active provider receipt instead
returns unknown with `local SSH client unavailable` and clears the unreachable
timer. Polling resumes when the client works; ordinary connection or
authentication failures still age the five-minute bound. An unavailable provider
leaves status unknown without confirming this local-client hold. The hub logs
`executor-local-ssh-hold-enter` once on entry and
`executor-local-ssh-hold-leave` on observed recovery, terminal status or confirmed
release, each with run id, cause and the original bounded/redacted transport
error text. These transitions are observed per executor lifetime; a restarted
hub logs a fresh entry if it observes the same hold. Queue, job and UI shapes
remain unchanged. Lease lifetime,
run timeout and output-silence limits still apply.
Cancellation signals the remote process group, collects and destroys the machine.
A restarted hub reattaches to an active run, resumes at the local log's byte offset
and posts its result once. An expired lease reports `remote machine lifetime expired`.

After collection and confirmed release, the result adds a line such as
`Executor droplet · c-8 lon1 · cland-project-1a2b3c4d · linux x64 6.8.0 · Node v24.21.0 · Neovim v0.12.5 · lifetime 1398 s · cost $0.0971`.
The job and `suite-result` record retain the machine name, size, region, lifetime
and cost. A green same-head Linux result is merge-gate suite evidence for its tree
and mode;
a later local request may reuse it and still names `droplet`. It establishes the
selected suites on Linux, with macOS-only cases visible as `suite skip` records.
Those cases run in the release's final local suite ("Release v0.1.2 from the item").

A missing `DIGITALOCEAN_TOKEN`, refused create (including 4xx/5xx), missing
prepared snapshot, spent daily cap,
full remote budget with a free local slot, or
dirty candidate sends a requested droplet run to the local queue with
`executor: local`. Budget refusals before creation may retry remotely while
queued; other acquisition failures retain one create attempt per run. Its topic and recipients
receive `verify <id>: droplet unavailable (<cause>); running locally`, projected
with warn severity on messages and inbox warning surfaces. The journal records
`verification-executor-fallback` with id, item, requested, effective and cause.
The fallback applies when the executor flag is omitted and `local_fallback = true`
(the default). With `local_fallback = false`, default droplet requests use the
same remote-only policy as explicit `--executor droplet`: requests wait for remote
capacity and refuse submission when the daily spend cap cannot cover their lifetime
reservation, naming the cap. Other remote failures refuse submission or fail the run without
running locally. Acquisition
still reserves spend atomically; a cap reached after submission fails that run
instead of moving it to the local queue.
Provider catalog capacity refusals at size/spend admission or acquisition (no
offered configured size/region) finish **unavailable: provider capacity**, retaining the original
cause and `outcome.notRun: "provider-capacity"`. They never enter the local queue
or try another size/region; a periodic run says **not run: provider capacity**.
An explicit `--size` override missing from the provider's size list is invalid
input: submission exits 1 with an "unavailable" error, without a suite job or
droplet. A listed override marked unavailable or absent from the configured
regions retains the provider-capacity outcome above.

#### Leases, cleanup and spend

Every droplet carries `cland` and `cland-p-<hash>`, where the hash is twelve hex
digits derived from the project root path and name. Reap leaves droplets without
`cland` alone. Another project's young `cland` droplet is also left alone.

Before create, cland writes and fsyncs a lease in
`.cland/run/executor/leases/<lease>/lease.json` (mode 0600), mirrors it in `hub.db`
under `executor-leases` while unreleased, generates its own ed25519 SSH key there, and arms a
detached watchdog on the hub host. The token stays in the inherited environment;
the watchdog command line holds only its entry file and the lease directory.
On macOS it runs `caffeinate -i -w <pid>` while live to inhibit idle sleep.
At the lifetime deadline it checks the droplet's name and tags, deletes the
droplet and key, retries until both are absent, and writes `watchdog.json`.
It survives a stopped or crashed hub. Restart consumes that receipt into the
`executor-watchdog-fired` journal event, recovers interrupted creates by name,
releases active leases with no run, and re-arms dead watchdogs for live leases.

Routine lease reads use `.cland/run/executor/lease-index.json`. Hub recovery
repairs this index from the retained directories once at startup, then removes
released entries only after observing their settled, published spend entries.
Unchanged compaction skips durable publication. A fresh project with no leases
keeps the index absent; readers scan retained lease directories when it is absent.
The first lease append includes those legacy directories in its durable index
before writing the new lease record.
Migration with only settled legacy directories publishes an empty index to end
the retained-directory fallback.
Released leases without a ledger entry publish an unknown-spend receipt in the
ledger (`cost: null`, `spendReceipt.reason: ledger-entry-missing`) before leaving
the hot index. Each new receipt logs `executor-lease-spend-missing` once; rebuilds
reuse it. The shared receipt policy validates the missing-entry reason and exact
project, lease and finite release-date bindings on ingestion and creation.
Malformed or foreign metadata refuses accounting and cleanup. Primary/legacy
reconciliation preserves terminal unknown in either duplicate order, including
beside an older pending or numeric-zero entry. Read-only migration retains legacy
file bytes while publishing the merged primary ledger; ordinary mutations retain
locked write-through. Terminal unknowns are excluded from pending reservations.
Pending reservations remain in the hot index. Initial index publication
logs `executor-lease-index-migrated` with read, indexed and settled counts;
rebuilding an existing index logs no migration. Both compaction and the first
lease writer share the publication policy. Counts describe identifiers considered,
indexed and settled; a first writer includes its newly admitted identifier and
settles none. A synchronous migration-log failure cannot interrupt lease-record
publication or replace an observed run status. The publisher offers one secondary
`executor-lease-index-log-failed` notice; if that sink also throws, no diagnostic
delivery is claimed. Actual index/lease durable-write failures still propagate.
Status exposes optional
`spend.unknownLeases`, a count over retained unknown receipts, and names these
leases in its CLI summary and Web spend label. Known numeric totals exclude them;
`todayCostUsd` is null when unknown receipts exist. Older status replies without
the additive count retain their previous rendering.
A missing lease file retains its uncertain id and
reports `executor-lease-record-missing`; repair cannot establish idleness from it.
Periodic recovery retries settlement and index compaction. Compaction creates
only individual executor directories below an existing `.cland/run`; it never
recreates that directory or its parents. Lease checkpoints and executor/pool
snapshot recovery writers use the same bounded child-directory helper; their
run anchor is created once by `serveProject` during its locked startup, before
background recovery. A filesystem ENOENT plus an independent
missing-run receipt returns `stopped` with reason `run-directory-missing` and
reports `executor-lease-maintenance-stopped`. Other I/O failures remain failures.
Executor close joins direct startup and periodic reconciliation and in-flight
release maintenance before storage disposal. Pool
recovery loads its image module only after discovering a valid recovery
directory. A settled released lease leaves hot membership only after both local
key removals complete. Lease
index maintenance cannot replace confirmed provider lifetime/cost: a compaction
failure preserves the `Released` result and reports
`executor-lease-maintenance-deferred` for later recovery. That report does not
claim unfinished index maintenance or key cleanup succeeded. Lease files and
directories remain available at their original paths. Latest demo
pointers live in separate per-epic files under `demo-leases/`, outside the hot
index; status/stop read only the requested epic's pointer. Recovery drains at
most 32 pending files from `demo-reports/` per pass, checkpointing each durable
tracker report in the retained lease directory before removing its queue entry.
An interrupted report retries idempotently. Doctor, executor status, budget
checks, heartbeat and Git maintenance
use the hot index or its unreleased `executor-leases` mirror.
Git maintenance retains its conservative no-prune policy when an indexed lease
file is missing. Writers publish
index membership before a lease file, so an interrupted write cannot hide a
new resource. Atomic index replacement leaves the previous checkpoint usable
on interruption; startup repair also recovers files written by older hubs.
Suites checkpoints the admitted lease identity before provider resource creation,
retaining that same lease through failed acquisition and confirmed cleanup.

New watchdog records retain `pid` and UTC `startedUtc` and add `pidIdentity`,
using Linux boot-id/start ticks or macOS native microsecond birth. Arming retries
unreadable native birth or UTC-start probes for at most 10 seconds, with a 25 ms
retry gap. Each native request is capped at 3 seconds or the remaining window;
a late reply cannot resume an expired arm. Readable births must agree within
and across attempts: a conflict refuses immediately. Exhaustion keeps the
existing identity-verification refusal and cleans up only through the owned
child handle, with a separate 5-second close bound. Restart
liveness and each destructive signal compare that native identity; a PID reused
within the same `ps` second is left alone. A legacy record upgrades once after a
matching UTC start is bracketed by the same readable native birth. The executor
fsyncs that identity into the latest lease before signalling, preserving concurrent
lease changes and refusing a changed watchdog. Every in-process full lease write
and the ownership-only checkpoint share a per-lease queue; a stale release or run
snapshot retains the already persisted native identity for that same watchdog.
The checkpoint patches the latest state inside the queue, so it cannot restore
an earlier release state. Missing/mismatched proof or failed
persistence grants no signal authority. Same-second reuse before that first
legacy observation retains the old risk. Native child handles remain the stop
authority until their close receipt; restart waits accept native identity change
or OS PID absence, while an unreadable live probe alone proves no exit. A release
that makes a replacement exit during its birth probe suppresses that rearm only
after the durable lease is `releasing` or `released`.

Release confirms deletion by listing droplets and keys before marking a lease
released or removing its key files. An unconfirmed deletion stays `releasing`;
lease recovery retries it every minute and its watchdog remains armed. A lost
create or SSH key import response retains the lease while the resource may still
appear. Released
leases stay on disk for their accounting history. Cost uses the size's hourly
price, from create to the first accepted delete call, with a sixty-second minimum.

At hub start and every ten minutes, the hub runs lease reconciliation and the
orphan sweep. Each sweep journals `executor-sweep` with lease, reaped droplet,
reaped key and failure counts. Between sweeps, an unref'd timer retries lease
recovery every minute so a late provider-side deletion can be confirmed within
the six-minute recovery bound. Recovery and sweeps run serially; provider errors
are logged and retried on the next applicable pass. Reconciliation consumes new
watchdog receipts, re-arms a dead watchdog for a live lease's remaining lifetime
(`executor-watchdog-rearmed`), and retries every `releasing` lease. It skips
already-settled accounting history without ledger locks and settles interrupted
releases in one batch, preserving the recovery deadline for unfinished leases.

Sharded close results still publish when the spend ledger is unavailable after
the shards have reported. Group reservation release is retained under
`.cland/run/executor/shard-releases/` until the ledger confirms settlement;
reconciliation retries these requests across hub restarts, including reservations
for shards that failed before acquiring a lease. The log records
`executor-shard-reservations-deferred` and `executor-shard-reservations-released`.
Accounting retries do not rerun shards or publish a second parent receipt.

Before every create, including a prepare builder, cland reserves the configured
lifetime times the size's hourly price (at least sixty seconds) in
the [per-user executor spend ledger](per-user-state.md#per-user-state), `$XDG_STATE_HOME/cland/spend.json`
(default `~/.local/state/cland/spend.json`).
An exclusive crash-recoverable lock serializes
reservation and settlement. The test override is `$CLAND_EXECUTOR_STATE/spend.json`.
Entries name the project, lease, run, size, reservation, actual cost and times;
they never contain the token. Confirmed release replaces the reservation with
the estimated actual cost; unconfirmed cleanup retains it across restarts and
UTC midnight. The cap checks today's spent plus all outstanding reservations
before creation. This is an estimate from hourly price and lifetime, not an
invoice; provider billing may differ (see costs above).
`cland executor status` prints the path and today's spent + reserved / cap.

The version-1 ledger also supports host reservations through `reserveHostSpend`,
`renewHostSpend`, `settleHostSpend` and `inspectHostSpend` in
`executor/droplet/spend.ts`. New entries carry `category = verify` or `hosts`;
missing categories mean `verify`. Host entries also retain pool, hourly rate and
billing minimum. The caller supplies the shared verification daily cap and hosts
sub-cap: both include today's settled costs plus outstanding reservations, and
executor admission counts both categories. Renewals reserve the extended lifetime
before the caller publishes its deadline. Settlement requires confirmed absence
and the real lifetime end, and bills at least the persisted provider minimum.
Settlement timestamps are stored in canonical UTC; identical-instant retries are
safe and conflicting final settlements are refused. Executor admission refuses
lease keys already owned by hosts before idempotency or shard reservation.
Inspection reports UTC today's/month's settled totals per category and host pool,
excluding reservations. This additive accounting API does not enable automatic
host creation; host lifecycle callers must perform admission before provider work.
Older hubs retain the additional fields and count hosts against the shared cap;
legacy reconciliation and write-through keep their existing version and locks.


#### Retiring legacy spend write-through

The human or Coordinator can run
`cland executor retire-legacy --confirm-registered-hubs [--json]`.
The flag confirms that the union of `projects` and every entry's `project` in
both ledgers covers all hubs this user runs. Before confirming, upgrade all
those hubs to code supporting the retirement marker and start them. Every registered project
must answer an authenticated live `executor.status` request within three seconds
and report both `spend.legacyRetirement: 1` and exactly the same primary spend path
as the requesting hub. Capability 1 means that all ledger transactions preserve
`legacyRetired` and stop legacy reads/writes once it is set. A state-directory
hub without this capability can otherwise undo retirement on its next write. Missing,
unreachable, malformed, non-capable or old-path hubs refuse retirement. Refusals list the
registered projects; stale discovery files and version strings are insufficient.
An empty registry, aliased ledger files and `CLAND_EXECUTOR_STATE` overrides also refuse.

Both ledger locks serialize the final reconciliation, checks, snapshot and
activation. `spend-retirement.json` beside the primary ledger records the checked
projects, time, paths and original legacy bytes. Only after durable snapshot
publication does the primary ledger activate `legacyRetired: true`. A failed
activation can leave an unactivated snapshot; retry the command. Activated
retirement is idempotent, survives hub restart, and stops legacy reads and writes
in upgraded code. The legacy file is never moved, deleted or changed by retirement.
Reservations, settlements and the shared daily cap continue in the primary ledger.

This check cannot discover a hub that never registered in either ledger. The
confirmation flag is the operator's assertion that no such hub remains. A later
downgrade can restore legacy behaviour or split accounting; do not restart older
binaries after retirement. This command does not run automatically during upgrade.


#### Epic demo leases

`cland demo start <epic> [--commit <sha>] [--json]` asks the hub for a demo droplet at a named commit on `dev` (the tip by default). It returns the lease id, full commit, deadline, lifetime and cost. Delivery uses the verification snapshot, installs changed dependencies and prepares the candidate's Neovim pin. The root checkout may keep moving or have tracker edits: only committed Git objects are delivered.

`cland demo exec <epic> -- <command…>` runs as the ordinary `runner` user in the delivered tree, with `hub/bin` on PATH. It returns stdout, stderr and the command's exit code; `cland --headless --qa qa/cases/<case>.lua` works there too. Each argument is preserved; use `sh -c '<script>'` for a shell pipeline. `cland demo status <epic> [--commit <tested-sha>] --json` reports lease state/accounting and, with a commit, its current freshness even after a local fallback. `cland demo stop <epic>` releases the lease and reports confirmed accounting.

During machine creation and delivery, demo status reports `state: "provisioning"` with the lease id, commit, deadline and accounting. Exec refuses with that provisioning lease and commit, advising the caller to wait for start to complete. Once delivery persists readiness, start and status report `active` and exec accepts commands until the deadline. These demo states describe usability; the executor's durable provider lease can already be `active` during delivery. Cleanup retains `releasing` and `released`.

Demo leases share `remote_budget` and the daily spend cap with verification and snapshot preparation. No slot or budget means a nonzero refusal naming the reason, without creating a droplet; QA runs locally at the same commit while the lane merge hold stays active. Callers are QA holding that epic, the Coordinator or the human. The hub owns provider calls, loads the project DigitalOcean token privately, and uses the existing tagged lease, spend ledger, watchdog and reaper. Stop, the epic's QA verdict, or the earlier of `run_timeout` and `lifetime` ends the lease. Restart retains the lease; create, confirmed destroy and cost are comments on the epic.

Release confirms absence by droplet id, including when an accepted deletion leaves an archived response without tags. A genuine name or tag mismatch preserves the resource and spend reservation. Demo status and executor status then show operator attention with expected and observed identity fields and provider status; the epic records the refusal and the hub alerts the Coordinator once for that lease. The hub retries cleanup on reconciliation, clearing attention only after the identity is valid again or absence is confirmed.

An epic QA verdict names the tested dev commit. A later dev tip is acceptable when the commit is still on dev and every intervening commit avoids the epic's surfaces: files changed by its task merges, found through their `Item:` trailers. An intervening edit (even reverted), deletion or rename touching a surface makes the verdict stale; the refusal names the commit and files. The same rule governs verdict admission, cached freshness and epic close. Stage QA retains its existing exact dev build rule. The QA recorder copies remote captures locally before stopping and records the executor, commit, lifetime and cost; macOS-only cases run locally at the same commit.

Remote `qa-record.sh run` accepts `QA_EXPECTED_FACTS`, a local JSON-array file of required own keys in the case result's `facts` object. Native Lua cases supply it through `<case>.facts.json` in `CLAND_QA_OUT`; the recorder includes that sidecar as evidence and merges only fact/error fields, refusing duplicate fields. Missing/null facts or malformed declarations block recording PASS; false and zero remain valid facts. Nonempty recorded `error`/`errors`/`stepErrors` fields and nonzero native exits also block PASS. Legacy results need no fact declaration. The recorder scans metadata, stderr and all decoded captures before its first local copy, withholding recognized secrets with a value-free BLOCKED receipt and retaining remote sources. Manual notes, local runs and rescue recovery require their own pre-publication redaction/scan. See [demo recording policy](../agents/qa-demo-recording.md) for formats and text-scanner limits; the helper's `--help` describes its interface.


### Tests

The T1 `host-boundary.test.ts` lint recursively scans adapter source for native
process and filesystem metadata bypasses of Host. It reports file/line/use and
keeps named native implementation, hub-file metadata and crash-test exceptions.
Fixture sources prove forbidden uses fail without editing the adapters. See
[Host boundary test guidance](../agents/tests/hub-test-host-boundary.test.ts.md).

Verification runs the project's configured check and test commands; see
[Verification commands](#verification-commands). The following runner details
and package commands describe cland's own suite.

`npm run test:nvim-fixtures` refreshes the Neovim protocol recordings. Full
discovery selects runtime stub consumers through imports and launch URLs, rather
than test tiers, and excludes native clients that only share the command-validating
launcher (such as `artifact-browser.test.ts`) and type-only stub references. It
also names `explorer-summary.test.ts` and `hub-read-component.test.ts` as local
Lua checks that never await stub frames; incidental startup traffic does not make
them recording consumers. Every selected file must still record at least one frame. It
captures and validates all requested files before replacing fixtures, refusing
skipped or incomplete runs and empty captures. Completeness uses successful test
counts, allowing scheduling-dependent reductions in distinct frame counts. See the
[fixture maintenance guidance](../agents/tests.md) for full, retained and
per-file slice refreshes.

Use `projectHub(t, root, env?)` from `hub/test/harness.ts` for project tests by
default. Each test serves its own project through `serveProject` in the test
process, with normal discovery, Unix socket and WebSocket edges. Real CLI
subprocesses, discovering spokes and fake harnesses keep their production
protocols. Pass environment overrides to the fixture; never temporarily mutate
`process.env` for one hub. Teardown stops the served hub, disposes the fixture's
owned processes, then fails on surviving owned handles, timers or process
listeners, with `process.getActiveResourcesInfo()` diagnostics.

Keep `startDaemon` only when an assertion concerns the hub process: startup,
shutdown, signals, crash/restart, lock/discovery/PID identity, orphan sweeping,
watchdog behavior, or CLI behavior with the hub down or unreachable. Session
stop, resume and native harness crashes alone do not require a spawned hub.
New tests using `startDaemon` must name the process lifecycle behavior they
prove. Do not share one project hub across unrelated tests. Validation duplicates
may call the existing dispatcher or tracker directly while retaining one real
frame proof per tool/refusal family; adapter parsing edges use a fake native
transport while launch/inject/turn/stop/resume retain frame coverage.

Package suites pass `--test-timeout` to every Node test phase. The default is
120 seconds per test; `[verification].test_timeout` in `.cland/config.toml`
sets a positive duration (`s`, `m`, `h` or `d`). A timed-out test fails by name.
An explicit configured duration stays exact, including a value equal to the
default. Only an absent source setting scales the default with current load at
runner launch. Fresh hub admissions and queued config capture retain the shared
parser's default provenance. Generated and managed configs keep an absent
`test_timeout` unset. Existing explicit values survive updates and settings writes,
including values equal to the default. Admitted limits and config snapshots without default
provenance stay exact. This runtime policy takes effect
after restarting the hub with this code.
An explicit test-level timeout still overrides Node's default.

Delivered-tree load and Web repetition startup defaults sample current load per
child admission from the supplied runner environment. Explicit `startupMs`
controls stay exact. An omitted factor selects that shared default; an explicitly
passed NaN or below-one factor is refused instead of silently becoming 1.

Structured file-start receipts also arm one shared per-file startup/import
watchdog in the verification command worker and the delivered tree's package
runner, including on Linux droplets. Load-gate and Web repetition children each
use that same guard with their own captured cleanup owner and bounded startup
ownership markers. Load-gate stdout is forwarded unchanged while its progress
is observed; Web repetitions observe typed progress internally and retain their terminal summary.
If no test or suite starts in that file, it
fails with `<file> no test started within <n> s`. The base setup allowance is
30 seconds, scaled by the shared suite load policy (load, configured workers,
parallelism, executor floor and explicit `CLAND_TEST_LOAD_FACTOR`), and capped
at half the admitted no-output timeout. A completed empty file disarms it;
unrelated output and duplicate file starts do not extend it. Older reporters
without typed file progress retain the ordinary no-output guard. This watches
startup readiness, leaving test behaviour deadlines unchanged. It uses the
existing captured-process cleanup path. Both owners retain the pre-cleanup
native exit/pipe receipt; the outer command also retains the process census
described below. The runner joins timeout cleanup and forces a failed phase
even if its native test process exits zero or assertions were quarantined.

After installing its phase guard and before releasing the test child, the
package runner emits `suite startup owner {"id":"<phase>","event":"start"}`.
It emits the matching `finish` after the guarded child's native exit and any
timeout cleanup have joined. Pipe-close waiting stays after the existing writer
sweep; inherited pipe writers cannot hold startup delegation open.
The outer command delegates startup cleanup between those receipts. A missing
finish returns ownership on the launched command's native exit/close; a hung
inner runner still has the outer no-output guard as its backstop. Older trees
without the marker retain outer startup monitoring. No periodic renewal or
prepared-image change is required: the droplet executes the delivered tree's
`hub/test/run-suite.ts`. Markers do not change test counts or durable evidence.
The failure's `suite stall startup` record retains its file and bound through
semantic log reduction, so a droplet phase remains a timeout in cover history
even when the shell reports only its nonzero command exit.

The local verification worker also watches stdout and stderr during check
and tests. `[verification].stall_timeout` defaults to `"10m"`. After that much
silence it fails with `stalled: no output for <n> min` and up to eight tests
whose reporter start has no matching completion (cancelled tests remain in flight).
Before cleanup it records the command's native exit receipt (or pending) and
stdout/stderr EOF state in a bounded `suite stall command` semantic record,
before any native inspection can fail. Periodic ancestry inspection retries after
failure, preserving earlier ownership proofs. At command settlement, one bounded
`suite inspection` JSON receipt records the first failure timestamp, total and
consecutive failure counts, maximum consecutive count and last error class
(never the error message or argv). `unobservedPastBound` reports any failure
episode longer than `unobservedBoundMs` (5000 ms), even if inspection later
recovers. The command result carries optional `inspection` metadata; the local
worker preserves these as optional `inspections` entries keyed by command id in
its result JSON. The command's settlement callback also hands the finalized
receipt to the worker when native cleanup rejects, preserving the original
failure cause and lack of cleanup authority. Older result readers can ignore these additive fields. The log
receipt survives semantic reduction. These diagnostics are report-only and do
not change the command's exit status, cause or cleanup authority.
A `suite stall processes` log line retains up to 32
current birth-matched owned pids and executable names, with a total count;
it excludes argv and environment values. Inspection uses bounded native probes.
The command-state record and complete census survive semantic log reduction and cached evidence;
capped result summaries point to its log artifact with `stall process detail`.
That pointer also survives when native inspection fails before the census exists.
An exited command with open pipes distinguishes an inherited writer from a
command still awaiting exit; missing inspection evidence cannot identify the survivor.
It terminates the
verified command tree (including detached test runners and spokes), retaining
observed child identities if a parent exits before its output pipes close. It sweeps owned
suite roots, and releases compatibility leases before publishing the result.
The stall path also inspects native endpoints to recover detached writers after
ancestry disappears (see [ownership](coordinator-subscription-procedure.md#inherited-stdio-writer-ownership)).
If a writer cannot be identified and keeps inherited pipes open, the
failed result says `cleanup incomplete: unverified inherited-pipe writer`,
including known parent/pipe evidence. The hub posts one warning in Agents and
the human's inbox and journals it. It preserves unverified processes and releases
admission so the next run can proceed.
Droplet runs retain their separate enforced `run_timeout` and machine lifetime.
They also enforce the admitted `stall_timeout` against new bytes in the mirrored
stdout/stderr log. Status replies and failed log reads do not renew the timer.
Observed output is checkpointed before mirror append, and replay after restart
keeps that original silence boundary. With a responsive transport, detection
takes at most the same stall limit plus the 10-second progress polling interval;
the next poll moves earlier for a silence deadline between polls. The result
retains in-flight file/test receipts and classifies as `timeout`. The hub cancels
the worker and releases its droplet, including each timed-out shard; confirmed
cleanup/accounting can finish later than detection. See
[`docs/agents/tests.md`](../agents/tests.md) for fake-executor regression guidance.

`hub/test/prepared-project.ts` supplies `preparedProject(t)` (a repository after
file provisioning, with its territory and an intentionally empty tracker), `preparedProject(t, 'repository')` (main with
one Initial commit), and `preparedReleaseProject(t)` (also a private bare GitHub
stand-in). The `native-territory` shape provisions only the territory and ignores
`.cland/`, for the existing native-boundary tests. The merge tests use the `verification` shape, with a tiny package in
its initial commit. `copyPreparedProject(root)` fills an empty directory already
owned by `tempProject` when a helper accepts a root instead of a test context.
Each shape is built once per worker process under its temporary root; a cached
promise serializes concurrent callers. Seeds stay private and unchanged after
preparation. Copies have independent files, including objects, refs, index,
config, hooks, worktrees and `.cland` state, with remote paths relocated to the
copy. No objects are hardlinked or shared. Test teardown owns copies just as it
owns `tempProject`; worker teardown removes seeds and the runner's phase sweep
also covers them. Tests asserting repository/territory construction, init
reports or a custom initial history must still build their own fixtures.

The spawn census counts `child_process` calls inside the suite's Node processes,
with command totals and sources ranked by test file and helper. Run
`node hub/test/spawn-census.mjs run .tmp/census-before` from the repository root;
it preloads the recorder through `NODE_OPTIONS`, runs `npm test -- --all` under the
ordinary machine-wide suite locks, and writes `report.md`, `aggregate.json` and
`suite.log`. The report records the measured head and runner's `suite duration`
line; invocation wall time also includes queue wait. Compare two runs with
`node hub/test/spawn-census.mjs compare .tmp/census-before/aggregate.json .tmp/census-after/aggregate.json`.
The census cannot see non-Node descendants (including git hooks and
`git-receive-pack`) or subtrees that replace or strip `NODE_OPTIONS`; its report
names test files with those overrides and sandbox-exec launches that may deny log
writes. A denied log open leaves the child uninstrumented and preserves its behavior. Shell calls count as `sh -c`. Records
contain only the command basename, first argument, test file, helper and timestamp,
never environments or remaining arguments. Append-only records remain in the
printed temporary root for inspection; failed runs produce partial reports.

Automatic Node module compile-cache activation is disabled: warm loads fail on
the supported Node 24 engine range. The [qualification check and measurements](../node-compile-cache.md)
record the reproduction, per-process-cache cost and upstream follow-up (T-220).
Re-run it when a new Node 24.x is released or Node 25 support is added, before
enabling a shared cache and validating that configuration with a full suite.

Implementers use `cland verify` for full runs and wait for its artifact-backed result;
see [the agent test workflow](../agents/tests.md). The package commands below
are also available for humans and isolated CI.

`cland verify [all|hub|nvim] [--fresh] [--report <topic|session>] [--to <session>]…`
runs the project's check and test detached and posts one artifact-backed result.
Without `--report`, it uses Agents and addresses the Coordinator; explicit topics
and recipient shorthand remain available. Item workers keep their permitted item
topic and Reviewer/claimant recipients. CLI and new spokes materialize the default
report/recipients for prior validators; report-free previews remain unchanged.
The hosting hub must load this change to publish hub-owned reports in Agents.
Already-admitted jobs retain their pinned topic on restart and reporting retries;
completed messages and artifacts are not relocated.
It persists requests in the hub database before admission. Waiting requests have no
worker PID. The Coordinator's integrated dev runs go first, then human `npm test`
waiters in enqueue order, then item rank at submission, then other runs in enqueue
order. The queue survives hub restart. A known dead
requester's queued run is cancelled with one hub note to its original recipients;
a disconnected spoke alone does not prove death. `cland suite` is a transition alias.

Results include `Executor local · <os> <arch> · Node <version> · Neovim <pin>`
after the branch and head line. The worker records OS, architecture, OS release,
the Node on its PATH in the candidate worktree and the candidate's
`nvim/NVIM_VERSION` pin (`none` when absent). Cards name the executor, status and
journal records carry the executor/platform, and cache hits keep the original
run's executor and platform. Older jobs without an executor read as `local`.

Task runs may report `hub-selected`: changed hub tests, tests covering the changed
functions, and `HUB_SMOKE`/`NVIM_SMOKE`. A hub source imported by Neovim keeps the
full Neovim phase. The report names the deciding functions and coverage artifact.
Clean integrated `dev` full runs record per-test-file V8 coverage, including the
CLI, lifecycle daemons, spokes and fake harness descendants, and publish a
function-range map with their head and canonical candidate tree. Close-run shard
maps merge into one artifact. Task runs never refresh the map.

Admission reads the newest artifact whose head is an ancestor of the task's merge
base. `[verification].coverage_max_age` is a positive duration, default `"2d"`.
This is a reporting threshold: older ancestor maps still select when every hunk
maps through the intervening diff, with their age and limit in the report.
Missing, invalid, future-dated or unrelated maps keep the package rules and name
the reason. Protocol/contract, package, harness, fixture, runner and executor changes,
unsupported paths, unknown source files, missing covering tests and hunks changed
since the map also keep those rules. Top-level edits and edits in untested
functions of a mapped file widen to every test covering that file; a file with
no covering tests falls back.
Unchanged lines are translated from the merge base back to the map across the
intervening diff. Integrated full runs remain the regression backstop; a selected
run can miss a regression which the next batch detects.

Raw V8 coverage is temporary: the runner drains its owned writers and removes
its raw directory on success, failure or a handled standalone interruption. A
borrowed interruption leaves raw bytes to the hub, which removes them after local
executor release confirms detached-writer cleanup, before reporting completion.
At suite admission, the hub processes at most 32 pending terminal identities from
its existing suite index (finished, cleaned, reported runs and shards), preserving
active and uncertain runs. Per-identity checkpoints survive restart; admissions
do not rescan retained directories or completed history. The
admitting suite log records each removed run and its file byte count. Removal
is confined to `.cland/run/suites/<id>/coverage-map.json.raw`; droplet runners
use their executor account's `runs/<id>/coverage-map.json.raw`. Symlinked roots
are refused. SIGKILL recovery waits for the hub's cleanup receipt. Raw-removal errors are
logged for retry without stranding already-drained execution leases.

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
Cache reuse for
`hub-selected` also requires the same selected tests and Neovim phase.
`node hub/test/selection-replay.ts <first-parent-range> --coverage` prints the last
40 task landings from a disposable local mirror clone. The clone preserves refs;
historical checkouts and selector archives use private HOME, XDG and Git
configuration with inherited Git redirects and account credentials removed.
The caller's repository is read-only; its committed sources supply the checkout,
while coverage maps, durations, retained suite logs and `--failures` inputs are
read from the caller. No network or harness login is required. The replay reports
missing-map fallbacks, deciding functions and each selected share
of hub test-time. `--nearest` explicitly labels retrospective maps that may postdate
the merge; live admission always requires an ancestor and mappable hunks. Supply
`--failures <json>` to include historical failed test paths keyed by full/short
merge SHA. The replay also reads retained suite logs by item and names their count; old logs
without source identities remain unavailable rather than guessed.
`--count N` changes the replay window (default 40); an incomplete window exits 2.
Exit 1 reports own or historical misses for inspection; the agreed own-test bar
and historical miss causes are reported separately.
Shares use the current duration manifest, rather than claiming historical wall
times. The replay bar is zero misses on those merges' own changed/added tests;
every wider miss must be listed with its cause.

**Close-run sharding.** Only integrated `dev` requests with `--occasion
stage|epic|release` shard remotely; cland tier-command batches may shard under the same remote slot/spend policy. The
Coordinator sets the occasion; QA may use `epic` for its demo. File balancing,
Neovim placement, the daily-cap whole-run fallback and per-run costs are described
under [Remote executors: Close runs](#close-runs). The result and queue show the
occasion and the remote shard machines.

**Executors.** `hub/src/executor/executor.ts` defines acquire, deliver, prepare,
start, status, log, cancel, release and reap. The backend owns its durable lease's
resource payload; detached starts outlive the hub and status reattaches after
restart. `local` is the default; `droplet` runs on a prepared DigitalOcean snapshot. The local backend
owns the existing suite worker, compatibility slot and process cleanup; the hub
shares the queue, cache, timings, verify card and report across executors.

The shared DigitalOcean client admits the endpoint's declared requests per minute
in every rolling 60-second window, per token and canonical API base within the
hub process and clock. Executor and host-provider clients share that budget.
`endpoint.ts` owns parsing and formatting. The real DigitalOcean base is fixed at
250/minute regardless of any URL fragment; that fragment is ignored. Existing `CLAND_DIGITALOCEAN_API` overrides without a declaration also
retain 250. Custom HTTP(S) bases can declare `#requests-per-minute=100000`; this
fragment is metadata and is removed before transport. Bases cannot contain a
query or embedded credentials. Limits are positive safe integers. Equivalent
scheme/host/default-port/trailing-slash forms share one budget; differing limit
declarations for the same service/token conservatively use the smaller limit.
Independent configured API services have separate budgets. Queued calls use the
injected clock and respect caller deadlines and cancellation; calls under budget
invoke transport immediately. Detached processes have their own budgets.

The fake DigitalOcean API declares 100000/minute by default through its existing
endpoint URL and scripted-provider environment. Its `requestsPerMinute` option
uses the same parser; pacing regressions explicitly select 250. This keeps fast
fixture polling from consuming the production service's request allowance. The
sentinel token, loopback-only transport and disposable-root requirements remain.

An HTTP 429 raises `RateLimited` (a `DigitalOceanError`, status 429), with
`retryAt` in UTC epoch milliseconds when valid retry headers are present. It uses the later valid `Retry-After`
(seconds or HTTP date) and `ratelimit-reset` (epoch seconds); absent, invalid or
past headers impose no provider cooldown. The shared token waits until that time
before admitting further calls. The fence starts at header receipt, before
optional body diagnostics are read; a null or invalid body keeps the typed 429.
The refused call is never automatically resent.

`[verification].budget` defaults to 1. Higher values are retained in config but
capped at 1 with a `verification-budget-capped` log note. T-215 retains this
conservative budget: only five hermetic hub files qualify for overlap, too little
to justify overlapping process-heavy local runs. `[verification].remote_budget`
is a positive integer, defaulting to 4, beside the local slot of one. The scheduler
walks the same ordered queue, admitting droplet runs into free remote slots without
checking the host's compatibility leases. A blocked local waiter does not hold up
remote waiters behind it. When all remote slots are reserved and the local slot is
free, a default droplet request with `local_fallback = true` runs locally with one warn notice
`verify <id>: remote budget <n>/<n> full; running locally` and a
`verification-executor-fallback` journal record with cause `remote budget full`.
A default request that already fell back because the remote budget was full,
but is still waiting for local admission, reclaims a free remote slot in the same
queue order, including after a hub restart. The hub reports
`verify <id>: remote capacity available; moving queued local fallback to droplet`
to its topic and recipients and journals `verification-executor-reclaimed`.
Only budget fallbacks are reconsidered; other acquisition failures stay local,
except provider capacity refusals, which finish unavailable without a fallback.
`--executor local` always uses the local slot. Launching/acquiring jobs reserve
remote slots through confirmed release; acquires proceed in parallel and each
checks the shared daily spend cap. The provider also counts durable preparation
and unconfirmed cleanup leases before permitting a create. `verification-admitted` records `remoteActive`
and `remoteBudget` for each remote admission.

A terminal remote run with no acquired lease holds no execution slot, even if
posting its result needs a retry. Startup applies the same accounting. Durable
preparation and unconfirmed cleanup leases still reserve capacity independently.
Missing-evidence recovery applies only to unreported, finished remote executions
with a recorded finish time and no lease. Cache hits have no new native receipt;
legacy report-only inputs without that finish receipt retain their original exit.
If a terminal no-lease run has lost its result or collection log receipt, the hub
posts a failure naming the missing evidence, retaining a known nonzero exit and
surviving log identities; it never reconstructs a pass or infers non-execution.
An existing pre-execution refusal keeps its exact original outcome and cause;
its first result receipt is materialized normally, without a collection-loss diagnosis.
If that refusal is already terminal and its report files are lost, the hub
reconstructs those inputs from the checkpoint, naming missing inputs in the log
while preserving the refusal's exact outcome, cause and finish time.
The heartbeat clears its unposted-result row after publication.

Running leased jobs also resume status inspection after startup. When status
observes a lost machine, collection failure cannot strand completion merely
because the local log mirror is missing: the hub creates that log, naming the
machine and loss cause, and continues through the existing release and single
publication checkpoints. Surviving collection bytes remain in the log.
Provider-confirmed absence uses the captured machine id; failed provider reads
remain unknown and a present machine retains its slot during normal execution.
This recovery does not turn missing execution evidence into a passing result.
If a completed green native result survives but required coverage collection
fails, a provider-confirmed missing machine ends finalization as incomplete.
The original result file stays byte-for-byte intact. The scheduler uses its
existing nonzero outcome with the cause `incomplete: machine <name> gone;
coverage map missing; tests exited 0 (original result.json retained)`.
That outcome supplies no gate, cache or cover evidence. Present or unknown
provider inventory retains the lease for a later collection retry. Temporary
coverage files are never parsed during this recovery; its durable incomplete
checkpoint prevents further collection attempts, and restored health avoids
rescanning the log for machine health on each retry.

The compatibility broker keeps both legacy locks as a fence, and a hand
`npm test` or pre-V1 holder occupies admission. The worker takes a verified lease
before typecheck; V1 package runners borrow it through all phases and publish
recovery metadata in a unique `<lock>.runs/<token>.json` record as well as the
legacy ownership sidecars. Records track the planned root, inode/device and
runner PID/start identity and are removed only after cleanup. Pre-V1 package runners take their own lease after protected
typecheck. A racing hand run remains excluded by atomic lease acquisition.
Admission identity probes are asynchronous and bounded. Stale process/root recovery
runs in a bounded subprocess; failure retains ownership and logs
`verification-admission-blocked` for retry.
`verification.lock_path` defaults to `/tmp/cland-suite.lock`; isolated fixtures
may select another absolute path (the Neovim lock then uses its `-nvim` suffix).
Keep the default on a shared machine. Exact submitted heads remain in results.
Integrated dev runs survive tracker-only and rulebook-only commits before admission
or during execution when the canonical candidate tree stays unchanged; their result
covers the new head. Task runs still require the submitted head. Merge gate
semantics stay unchanged. Logs and ordinary results use T-203's artifact checkpoint
and message id to prevent replay.

Green results are cached by the Git tree of the submitted head **excluding
`.cland/tasks` and `.cland/RULES.md`**, plus the selected effective mode (`full`, `hub-only`, `hub-selected`, or
`nvim-only`). A private Git index constructs this canonical tree without changing
the worktree's staged contents. Tracker-only or rulebook-only dev commits and rebases that reproduce this tree
reuse the original run; every other committed path, including `.cland/config.toml`,
still participates. Dirty tracked/staged files or nonignored untracked files outside
the tracker and rulebook bypass caching and cannot seed it. Clean cache candidates are checked
again before and after execution; changes to suite inputs still fail verification.

`--fresh` bypasses reuse. `[verification].cache_max_age_minutes` defaults to 1440
(one day); 0 disables caching. Age starts at the original successful completion,
not at subsequent hits. A release occasion reuses only a full receipt with matching
commands and tier/occasion coverage on the effective executor and OS: Linux on a
droplet, or the current host OS locally. This applies to configured defaults too;
a macOS stage or release receipt cannot satisfy a droplet release request. Missing
platform evidence is a cache miss. A compatible full stage receipt on Linux
droplets can satisfy a droplet release request. An explicit `--executor droplet` reuses only a green that
ran on a droplet. If only a local green qualifies, it starts a fresh remote run
and names that cache bypass in the result header and log. With no executor flag,
ordinary reuse stays cross-executor, including when the configured default is droplet;
`--executor local` also keeps cross-executor reuse. Hits retain the original
executor and platform. Only successful completed, reported runs with an available
log artifact qualify; old pre-cache jobs, failures and cancelled runs do not. A
new failed or pending fresh attempt supersedes older green evidence for its key
(restricted to droplet attempts for an explicit droplet request).
Cancelled attempts (by the requester, requester death, or a head change before
admission) do not supersede older green evidence. Test failures, worker crashes
and timeouts still do.
The cache survives restart and may reuse evidence from another worktree in this
project. Requests from a repository subdirectory bypass caching, since their npm
scripts can differ from those at the worktree root. A hit creates its own durable request and posts once to the usual topic
and recipients, with the requested head, `cached`, original run/head and identical
canonical tree hash. Its log artifact carries the original log and provenance.
Cache notices and logs name the original occasion and executor separately from
the requested occasion; older cached records without an occasion say `unknown`.

The merge gate and T-209 criterion freshness remain exact-head: a cache hit alone
never refreshes a stale mark. The Reviewer must verify the new head using the posted
cached result as evidence; no tree equivalence is applied to review or QA marks.

A human's `npm test` outside a cland session asks this same scheduler for a
connection-owned slot before taking the compatibility lease. The runner prints
its queue position, holder elapsed time and ETA as they change, and at least once
a minute. A waiting runner polls `suite.slot` every two seconds; a free slot is
observed on the next poll. Integrated Coordinator dev runs come first, then human waiters in
enqueue order, then ranked item runs, then other runs in enqueue order. Human
waiters have `kind: "hand run"`
and `session: "human"`. Admission reserves ten seconds to acquire the lease;
closing the connection removes the waiter, and an unused reservation expires.
The journal records `verification-human-queued`, `verification-human-admitted`
and `verification-human-left`, including waiting time. A linked worktree finds
the main project's hub through the usual discovery path. With no answering hub
within a few seconds, the runner prints that no hub queue is in use and takes
the compatibility lease as before.

`npm test -- --force` removes the flag from the test arguments and runs unlocked
beside the holder. Before starting, it sends `suite.forced`; the hub journals
`verification-forced` with worktree, head, selected mode and the holder it ran
beside. With no answering hub, it prints that it runs unlocked. Unique phase
roots and process cleanup still apply. Use this only for an intentional bypass.
Session-shell `npm test` retains the compatibility-lease path; it is not the
human queue path. Inherited hub worker leases are borrowed directly. Crew full
runs go through `cland verify`.

The human runner frames sit beside `suite.start`:

| Frame | Result and lifetime |
| --- | --- |
| `{"type":"suite.slot","id":…, "mode":"full"|"hub-only"|"nvim-only", "cwd":…, "head":…, "pid":…, "token":…}` | `{id, admitted, locks, queue}`. First call registers a human waiter; repeated calls on the same socket poll it. Keep the connection open through the run. An expired reservation returns an error. `token` matches the runner's compatibility owner. |
| `{"type":"suite.forced","id":…, "mode":…, "cwd":…, "head":…, "pid":…, "token":…}` | `{}` after journalling the bypass; no slot or lease is taken. |

`cland verify queue [--json]` prints `local: <holder or none>` (including
compatibility **hand run** holders, labelled `human` for an admitted human slot),
one `remote <active>/<budget>: <session> · <item> · droplet <name> <size> <region> ·
since <t> · ETA <d>` line per remote run, then the ordered waiters with their
requested executor, elapsed wait and admission ETA. A machine is labelled
`acquiring` until its lease is available. JSON keeps `holder` as the local holder
and adds `remote`, `remoteBudget` and `waiters[].executor`. Integrated dev comes
first, then human `npm test` waiters in enqueue order, then ranked items, then
other runs in enqueue order. Its human-facing form is the sessions panel's
one-line `verify:` summary (holder, run time, waiting count and next ETA). Enter on the summary
or the palette's **Open verification queue** opens the centre queue view with
ordered waiters, elapsed waits, admission ETAs and timing metrics; `q` returns.
Both follow the same queue live from `verification.queue` events;
`hub status --json` includes it as `verification`, with the scheduler's
latest compatibility-holder observation (refreshed each second). An explicit CLI
queue read refreshes ownership immediately. Status metadata and recorded timing
metrics never wait for OS probes. JSON `version: 1` uses
milliseconds, explicit nulls for unknown estimates, and ordered `waiters` with
one-based positions. `holder.etaMs` estimates remaining execution;
`waiters[].etaMs` estimates time until each admission. Estimates use recent
successful executions of the same mode and executor; remote duration includes
acquire time. Remote holders do not add delay to local waiter estimates. A cache hit completes
without entering this queue even when a hand run occupies the compatibility slot.
A remote slot held only by a durable lease (preparation or an unconfirmed cleanup)
has no observed duration, so a waiter that must outlast it shows an unknown ETA
(`null` in JSON), never a free slot.

Each run's status includes `admittedAt`, `completedAt`, `waitMs` and `runMs`.
Admission starts executor acquisition; `runMs` spans admission through the durable
worker `finished` receipt, including typecheck and all package phases. Recovery
uses that receipt even without live worker status, excluding hub downtime.
For close runs, each `shard duration` names admission through remote finish, and
`shard collection` separately names remote finish through final collection and
machine release (or the bounded accounting wait). Missing timestamps report
`unavailable`; the merged overall wall still spans admission through collection.
A cancellation before admission records its elapsed wait and zero run time.
Cache hits record zero wait and run time; their separate `completedAt` never changes
the original `finished` used for cache expiry. The journal records `verification-timing`
once per measured request. Existing T-232 receipt/start records seed estimates at
second resolution and are labelled `timingEstimated` in status (`estimated` in the
journal); unavailable timestamps remain null.

`cland verify queue` also shows queue wait p50 and p90 for the last 24 hours
and the last 50 completed requests **per effective executor** (`local` and
`droplet`). Both its JSON and `hub status --json` expose the same values at
`verification.metrics.queueWait` (the queue command omits the `verification`
wrapper). `targetP90Ms` is the configured target in milliseconds;
`last24Hours` and `last50Runs` each contain `local` and `droplet` values with
`count`, `cacheHits`, `p50Ms` and `p90Ms`. Empty samples have null percentiles.
P50 is the median (the average of the middle pair for an even sample); p90 is
nearest-rank. The last-50 window includes cache requests in its limit, but
cache hits are counted separately and excluded from both percentiles because
they never enter the queue. Requests cancelled before admission, unknown or
invalid timings, and internal shard jobs do not contribute wait samples.

Wait is durable `queued` to `admittedAt`, including failed executed runs. A
fallback is counted under the executor that actually ran it. Windows use the
durable `finished` time when available, otherwise `completedAt`, so restoring
a receipt after a restart does not move the run into a newer window or add
recovery delay to its wait. This metric does not use `runMs` or the recovery
clock to infer admission.

`[verification] wait_p90_target = "20m"` sets the target (a positive integer
followed by `s`, `m`, `h` or `d`); it is informational and does not change
admission. Metrics use the loaded config snapshot: `cland hub reload` publishes
a changed target; an invalid reload retains the last good value. The hub records
the same target and window values in a
`verification-wait` journal entry on the first scheduler tick of each UTC
hour while running. Shutdown clears its timer before logging `stopping` or
awaiting cleanup, so drainage cannot emit a sample. The last recorded hour
survives restart, preventing duplicate records;
after downtime only the current window is recorded, without inventing past
hourly samples.

Integrated dev runs completed from the cover-record rollout onwards persist
`cover: {status, cause, tests}` in their hub run record, expose it as
`hub status --history --json`'s `suites[].cover`, and include it in the journal's
`suite-result` event. Task runs and child shards have no `cover`; a sharded
integrated run records one cover from its merged outcome and log. Historical
already-reported runs are not backfilled or scanned at startup.

`status` is `green`, `red` or `cancelled`. `cause` is always present: `null`
for green, `test-failure` for failed tests (also the fallback for an otherwise
unclassified failed outcome), `budget` for duration-budget diagnostics without
test failures, `timeout` for test/run timeouts or the silent-output watchdog,
`cancel-head` for a changed submitted head/candidate, or `cancel-requester` for
explicit cancellation or a queued requester's death. A run with both test and
budget failures is `test-failure`. `tests` holds deduplicated repository-relative
`file::test` identities from failure receipts and duration-budget diagnostics;
a file-wide budget uses the file path. It is `[]` for green or when no test
identity is available. Cancellation and timeout retain any observed failures.

`cland verify classify <run> load-flake --note <text> [--json]` lets only the
Coordinator or the human shell reclassify a finished red integrated cover.
The nonblank note is required. The command changes `cover.cause` to
`load-flake`, preserves the original derived cause as `cover.derivedCause`, and
adds `cover.classification: {note, by, at}` (`by` is the session name or
`human`; `at` is an ISO timestamp). Repeating classification retains the first
derived cause and replaces the annotation. Tests and the original process
outcome remain intact. The update persists across restart and is journalled as
`verification-cover-classified` with `id`, `head` and the updated `cover`.

`hub status --history --json` also returns `covers`, at most ten recorded covers, newest
completion first: `[{id, head, branch, completedAt, cover}]`. `completedAt` is
an ISO timestamp (or `null` when unavailable). `cland hub status --history` lists their
run ids, status, cause and head; green's null cause displays as `none`, and a
classification also shows its derived cause and note.

`metrics` reports median and nearest-rank p90 wait/run durations over the last 20
completed requests, including hits and failures, with counts of available values.
ETAs use successful executed runs in that window matching the effective mode,
subtract the holder's elapsed run time, then accumulate preceding waiters' durations.
Hand runs use the window's successful execution median across modes. Missing history,
an ownerless manual lock, or a remote slot held only by a durable preparation or
unconfirmed-cleanup lease yields an unknown ETA. These are estimates, not reservations.

`cland verify cancel [<suite id>]` requests cancellation through the hub and exits.
Without an id it selects the caller's latest active run. A session can cancel only
runs submitted by its own stable session identity; the human can cancel any run
by id. Reporting topic and recipients stay those of the original submission.
Cancellation reconciles only the selected run; unrelated submissions and cleanup
do not hold up its cancellation. A queued request has no worker or FIFO ticket;
cancellation removes it from admission immediately.
The hub persists cancellation before sending SIGTERM to the identity-verified
worker, when one exists. The worker forwards it to npm and the lock runner: a legacy queued runner removes
its FIFO ticket without disturbing the holder, and a running runner cleans its
children, temporary root and leases. Cleanup finishes before one `cancelled`
result (exit 143) is posted with its log. The live local executor retains each
verified descendant's native identity across incomplete cleanup attempts. A
detached child that reparents or changes group remains owned by that same run;
cleanup retries drain retained identities before removing roots or reporting.
Dropping a capture requires confirmed native exit, PID absence or a different
native birth. Missing process-table rows alone do not release ownership.
These live captures are not serialized or inherited by copied/restored leases;
restart recovery retains its existing independent identity and cwd checks.
Restart and reporting retries retain
cancellation even when the worker receipt says interrupted; repeating an explicit
cancel is harmless. A finished run cannot be newly cancelled. If cleanup or
reporting cannot proceed, `cland hub status --json` shows the retained error and
the hub retries without duplicating the result.

`npm test` and `cland verify --report <topic>` default to diff selection. They fetch
`origin/dev`, compare the branch from its merge base with fetched dev, and include
staged, unstaged and untracked files on task and other non-dev branches.
On `dev`, deciding files come only from the committed merge-base diff against
the fetched dev commit; root working edits never enter integrated run evidence.
When HEAD equals fetched dev, that list is empty. Renames include both old and new paths.
The pure `chooseSuiteMode` in `src/suite-selection.ts` uses ordered package rules.
A diff wholly under `web/` selects `web-only` (Web plus hub/Neovim smoke).
A diff wholly under `nvim/` selects `nvim-only`; a mix of Neovim and any other
paths runs full. Everything else selects `hub-only`, including hub code, docs,
skills, `.agents/` and `.cland/tasks/`.
Before those package rules, shared paths force full: the crew/role(s) CLI, adapter
contract, protocol, web edge/auth/CLI, Neovim hub transport/event state, package/lockfile/tsconfig
files, suite runner, selection and shards modules. A shard-manifest change alone
uses the package rules; the shard lint guards hub file assignments. Any hub
file imported by `nvim/test/**/*.test.ts` or their helpers also forces full.
Admission follows relative imports within `nvim/test/` from those test entries,
collecting hub imports without following hub-internal dependencies. It reads
static, type, side-effect, re-export and literal dynamic imports (quoted or
backtick) from source; interpolated dynamic imports fail closed to full. New shared
imports widen selection automatically; pure callers may
supply the list and otherwise use the current baseline. Dot or parent segments
are ambiguous and force full. Reasons name the deciding rule and shared file.
An empty diff or a failed fetch/diff runs full with its reason. Integrated `dev`
always runs full. `cland verify all` / `cland verify --all` and `npm test -- --all`
force full. The runner CLI's `--all` overrides explicit test targets as well as the
selected mode. Explicit `hub` / `nvim` requests reduce only a qualifying matching
diff; otherwise they widen to full. The duration line and durable suite report name the
mode, reason and deciding files. Hub jobs persist one selection for the worker
and report, including across restart.
Reports show a byte-bounded file summary with an omitted count when necessary;
the durable log retains every deciding path. Compact reports preserve the mode,
result and log-artifact pointer before other details when the configured cap is small.

With `tiers.json` and `[merge] queue = true` in both the candidate and hosting
hub, task verification plans T0 (check), all T1, coverage-selected hub T2 and
diff-selected Neovim T2. Coverage fallbacks run all T2 across both packages,
clearing inherited Neovim subsets. Tasks additionally run each added/changed
T3/T4 test file and mapped T4 read-path guard once, without load repetitions; unchanged process smoke stays deferred; results name whether T3 is in the merge batch or deferred to periodic dev
and integrated occasions, with the queue state. Explicit `all`
retains T3. A flaky-gate second task receipt uses the same mode-free selection.
Projects with the queue disabled or absent, and legacy candidates without
`tiers.json`, retain their previous plan.

The task duration check uses changed test-file paths from the fetched dev
merge-base diff plus dirty/untracked paths, independently of T2 coverage.
The optional `tiers.json` `loadGuards` map adds T4 files when their source globs
match diff paths; reports name the guarding file and changed source. Fallback
keeps that exact changed/guarded T3/T4 file set. See
[shared read-path selection](../agents/tests.md#shared-read-path-load-selection-t-1203). On the Linux droplet, passing T3
identities at >=80% of their tier budget print JSON allowances with 1.5x worst
passing sample headroom, the nearest admitted standing ancestor (or validated
manifest `budget.legacyOwner` fallback) and seven-day UTC
dates; T4 has no budget and prints no stanza. No manifest values are written.
The ready report retains stanzas and measured added phase wall (excluding
machine wait), with platform/executor. The duration summary counts the printed
`duration allowance stanza` JSON lines (each can contain multiple entries), or
says `no allowance stanzas` when none are printed. Local macOS is not Linux evidence.
The hosting hub must land/restart onto this admission capability before live
proof. See [shared duration procedure](../agents/tests.md#task-t3t4-duration-check-t-1198).

Code changes enqueue through `cland merge T-<n>` after same-head task verification
and final review/QA verdicts. `queued <n>` is a FIFO position, not a landing.
`cland merge queue [--json]` lists pinned heads and the active batch;
`cland merge T-<n> --cancel` withdraws an entry under the merge role/subtree gate.
Changes wholly in the documentation/tracker allowlist still land immediately;
skills and role configuration go through the queue.

#### Queued member conflict preflight

With `[merge] queue = true`, enqueue with existing members checks the candidate against dev, then
against the pinned queued heads applied onto dev in FIFO order, using Git
merge-tree and temporary commit objects. A conflict refuses enqueue as
`merge-conflict`, naming the queued item, branch, pinned head and actual files.
The existing FIFO, refs and checkout remain intact. A batch conflict from a
retained queue or a later dev change uses the same pinned-member diagnosis in
its drop notice. Conflicts with dev itself
retain the instruction to rebase on dev. Re-enqueue excludes the item's own
previous entry. This conflict refusal leaves the advisory demo warning and batch verification
requirements in effect.

Enqueue posts an advisory `merge-demo-warning` to the candidate's item topic
(Agents when it has none), addressed to the Coordinator and candidate's item
lead. It names each overlapping open epic and the exact files from its landed
task commits on dev. An epic is under demo when it has an active, unexpired
demo lease, or when all task children are closed, the last ticket landed on dev,
and no hub QA demo verdict has been recorded. Stage QA does not count as a demo
verdict. Closed epics are excluded; a recorded demo without an active lease is
excluded. The warning applies across epics regardless of `follows` and enqueue
still succeeds. The existing `follows` overlap hold remains a refusal.
Unreadable lease evidence or unavailable/malformed landed-file history instead
posts `merge-demo-warning-unavailable`, identifying the missing diagnostic while
enqueue succeeds. Authorization, lane holds and freshness checks still refuse
under their existing rules.

The hub takes `[merge] batch` entries (default 3) when full or after `batch_wait`
(default `"10m"`). It runs the resolved `check` (T0) on the immutable merged
candidate before its runtime tiers, using available remote shards for cland tier commands (one local slot) and
`[merge] batch_tiers`, a nonempty set of T1–T4 tiers. Its default is
`["T1", "T3"]`; generated or inherited configuration can override it. Configured
T1 is omitted only when every member's latest mode-free verify is green at its
exact pinned head and has complete producer-owned structured T0–T2 receipts.
Another configured runtime tier must remain: sole-T1 configurations always run
T1, and configurations without T1 stay unchanged. Cache hits
require matching same-tree source receipts, even from another head or item. Missing, stale, partial and
unavailable receipts retain T1 for the whole batch. The durable summary in each
member topic says `T1 skipped`, naming each member run and head, or explains
`T1 retained`. T0 remains; configured T3 uses candidate-delta importers for
fewer than three waiting members, including unknown graphs conservatively.
Production changes under hub/src/, hub/bin/ or shared/ (deletions included),
verifier helpers/configuration and unavailable selection inputs retain full T3.
The named policy is `LIGHT_BATCH_POLICY` in hub/src/batch-selection.ts; configured
batch size/wait and non-cland commands are unchanged. Web runs after the configured tiers
when T1 is absent. Older persisted jobs without a decision render legacy/unknown.
Tier metadata is additive: verifies made before the updated producing runner
are missing evidence and keep T1. No log text establishes eligibility. See
[structured tier receipts](verification-tier-receipts.md).
When T3 is selected,
identities absent from the latest per-file same-tier passing batch or stage receipt
get five repetitions. A partial T3 batch preserves older proofs for other files;
a newer red run contributes passing identities from files with positive passing
file completion and no failed, skipped, todo or unfinished identity. Failed or
incomplete files fence older green proof; missing completion stays unknown.
Passing red-run identities are checkpointed across restart. A T1-only batch supplies no
T3 proof. Cancelled, cached, unreported and diagnostic runs are excluded.
Missing evidence treats identities as new. `batchBaselineFileRuns` retains
per-file receipt ids; the per-tier summary names its newest contributing receipt.
Light batches retain the same exact-head T1 omission as full batches. Their
report names T1 coverage from member verifies, batch runtime or no configured T1.
Each tier's baseline scan has independent caps of 256 summary visits and 32
same-tier receipts; other-tier hints skip hydration, and beyond-budget proof is
unknown. Partial masks survive compact history as presence flags. They cannot
suppress periodic dev T3, supply a full-stage baseline or count as stage/release
coverage; per-file baselines use only the mask's selected files.
The batch summary names baseline runs per tier and distinct identities with
positive five-repetition success/quarantine receipts. Skips are excluded;
started or legacy failed identities without positive completion make the total
unknown, alongside confirmed-complete and completion-unknown counts.
Green candidates land in FIFO order. Recoverable landing errors (`merge-dirty`,
`merge-checkout`, `merge-git`, `merge-unpublished`, `merge-recovery`) retain the
batch, completed members and green receipt across restart. The blocked notice
names the cause; the queue retries on later ticks once it is resolved, rechecking
the candidate against the retained evidence. Other held failures wait for human
or Coordinator action, as their notice states.
Test-lint Git or filesystem read failures retry the same inputs three times, draining every admitted read before retry or hold. Baseline-introduction and parent-history read failures use the same path; successful empty-history or parent-list results establish no-introduction and root commits. If reads remain unavailable, the batch retains its members and green run as blocked (`merge-git`), names the cause, and retries on a later tick, including after restart. Genuine lint findings still drop their member and rebuild the remainder.

When the item is closed with a durable merge receipt, a failed follow-up is reported for that item and the batch continues. Repair the named step with `cland merge T-n`; the landing is not repeated. A retained blocked batch whose members are all landed or completed clears on the next tick, including startup, after admitted workers finish. Follow-up notices have a durable delivery obligation separate from the batch. A failed notice retains the original follow-up reason and separate report error; later ticks retry it even after candidate cleanup or hub restart, without holding remaining landings or the next batch.
If publishing that blocked notice fails, the batch retains its original `failed`
reason and a separate `reportError`; the hub logs `merge-batch-report-failed`
and keeps serving. Periodic T3 search and nightly/periodic skip notices also
contain report failures at their timer boundary and log the failed report.
Integration-base movement during preparation
keeps each task in the batch and rechecks the candidate against the retained green
receipt. Documentation/tracker-only movement may reuse that receipt; code changes
require a new run. A task-head change drops that member, with the prepared and
current heads in its notice (a deleted ref is `missing`). Red batches rerun
failing files or the failed T0/Web step on leave-one-out trees: `merge-bisected` rejects a unique culprit
(or a red singleton). Without a unique green removal, one original-tree repeat
can select a candidate; otherwise `merge-bisect-unresolved` rejects every member
and notifies the Coordinator. Inconclusive runs hold the batch for its decision.
If explicit failing-file admission refuses and the file is confirmed absent
from a leave-one-out checkout, that omission attributes the failure to its
member. The queue drops that member with the file in the reason and runs the
survivors' full plan before landing. An existing but unclassified file remains
held. Held notices name pinned members and `cland merge T-n --cancel` followed
by `cland merge T-n` for recovery after resolving the cause. Re-enqueue at the
same branch, head and base rejoins an active batch's pinned request; a held
batch instead restarts with fresh evidence after its workers have drained.
Batch checkouts and periodic diagnostic clones link the root dependency install
through task worktrees' shared install policy before admission. Missing or stale
dependencies hold preparation as inconclusive, naming the install or locked
package, without dropping members. Local runs never invoke prepare or npm;
droplet delivery retains its configured prepare step. Candidate removal drains
fixture writers and removes the link without deleting the root's node_modules.
Results name T0 and Web with their measured durations, including a red host check before
droplet creation. Every successful diagnosis selects a candidate for the original
pinned full-plan confirmation before landing, including file-only non-Web recovery.
Failing-file reruns alone never cover a skipped selection. Diagnosis notices name
files without execution receipts and the covering run, tree and result. Unknown
file inventory still requires the full plan. Missing or conflicting successful T0/Web proof
holds the batch. See [queued merge batches](../agents/tests.md#queued-merge-batches)
for step receipts and combined-tree T0/Web bisection.
`merge-conflict` and `merge-budget` go to the item lead for a fix and renewed
review/verification. See the [merge skill](../../.agents/skills/merge/SKILL.md) for
refusal ownership and recovery.

`[verification] dev_t3_every = "8h"` enables this repository's hub-owned
`dev-t3` occasion; `""` (the default) disables it. It selects T2, T3 and Web on
configured `[verification] shards` without load repetitions, under the shared
remote budget and daily spend cap. Unavailable shard reservations or slots fall
back to one droplet with a warning. The first attempt is due one interval after activation; later runs
are due after the interval since the last attempt/start, only when dev's
verification candidate tree differs from the last started run's tree. The shared
exclusions in `hub/src/verification-tree.ts` make tracker-only commits ineligible.
Queue rows, heartbeat lines and timing records attribute periodic runs to `hub`;
their log and coverage-map artifacts have creator `hub`, and their chips are hub
notices. Nightly soaks use the same attribution. Ordinary human shell submissions
keep `human` queue/heartbeat attribution and artifact ownership. In the read-only
Agents topic their automatic report chips remain hub notices. Existing stored
occasion facts determine the author, including after restart.
The cursor survives restart, and a queued, running or unreported
periodic run prevents another. The hub requires clean root dev at freshly
fetched origin/dev. Periodic runs never hold or rebuild a merge batch.

### Fresh integrated cover before periodic dev T3

A periodic tick skips admission when a reported, executed green integrated dev
cover completed within the last hour at the same head or a descendant of the
captured dev tip. Integrated runs and stage/epic/release occasions qualify with
a full T3 selection; red, partial, cached, diagnostic and subset receipts do not.
The notice names the covering run id and head. Missing ancestry stays unknown.

A green merge batch also suppresses periodic admission when its captured
verification tree equals dev's tree, regardless of commit ancestry or age.
Structured producer receipts must prove every planned step, including T0 and T3,
and T1 must either have run or have a recorded skip naming a current verify for
every pinned member. Legacy receipts without these facts supply no batch cover.
The notice names the batch, run and tree. The hub reads its checkpointed index,
without scanning logs or hydrating archived full records.

Batch-only suppression on changed dev stops after 24h since the last green
full periodic completion, or the first batch skip when no such baseline exists.
That cursor survives restart and is not extended by later batch skips. The next
deadline attempt bypasses the normal attempt interval even when a prior batch
skip fell just before it. A persisted deadline attempt restores ordinary retry
throttling on admission failure. Only full periodic selection with
complete structured T0/T2/T3/Web producer proof resets the baseline; unknown
or legacy success metadata does not. The attempt runs full periodic T0, T2,
T3 and Web; unchanged dev retains the
existing same-tree early return. The configured 8h attempt interval, remote
budget, credentials, network and spend cap still govern actual execution; the
backstop does not guarantee a completed daily run when admission is unavailable.
Nightly soak rotation does not reset it. All skips throttle another attempt for
the configured interval. These rules change periodic admission only, without
changing merge or release cover gates.

Red results first probe each failing file at current local dev. A passing file
reports `already fixed on dev at <commit>` without filing a Bug only when the
red head is an ancestor and an intervening commit changes a path outside
`.cland/tasks/`, `docs/`, `qa/briefs/` and `hub/test/durations.json`. A green tip
with only those metadata changes reports `not reproduced (intermittent)`, retaining
both red and green run ids and log receipts in the Coordinator notice. The original red head passing again is also an unconfirmed
flake. Missing history or partial-green tip evidence remains inconclusive.
History checks commits, so a source edit followed by a revert still counts. The search rechecks the dev ref
before reporting and probes a moved tip. Bugs retain the tip's red receipt.
No stage/integrated receipt cache is reused. Historical probes use standalone
detached repositories sharing objects, so their candidate checks read pinned
allowance owners even after the live tracker closes them. Legacy linked
checkpoints with captured ownership convert at idle admission. An unmarked
legacy root stays untouched: the probe records its path and missing-ownership
cause in durable `dev-t3-preserved-candidate:<path>` metadata and prepares a
different standalone clone. It checkpoints the actual candidate path before
worker admission, so restarted completion cleans up that clone while retaining
the legacy root. If an admitted legacy worker completes after an upgrade, its
collected probe receipt remains valid: missing cleanup authority preserves the
root and records the same secondary diagnostic, without failing that result.
If that completed-path diagnostic write fails, a bounded structured hub log
entry records it and the existing receipt's `reason` carries the secondary
context into the search checkpoint and evidence report. The selected test
result remains unchanged. Required diagnostic/checkpoint writes before new
worker admission still stop preparation on failure.
Changed checkout identities still refuse cleanup. Incomplete standalone clones are recreated
there after checking HEAD and tracked-file status. Complete checkouts are reused;
active workers finish before cleanup.

Merge-batch upgrades apply the same preservation rule at the idle worker
boundary: an unmarked candidate records its path and structured missing-ownership
cause in `merge-batch-preserved-candidate:<path>` metadata. The batch retires;
retained queued requests get a fresh batch id, candidate path, head/tree and run.
Cancelling all members clears the blocked record after workers finish, including
when same-head requests are immediately re-enqueued. Marked replacement roots
still refuse removal. Candidate ownership uses the shared verification tree
identity excluding tracker items and RULES, plus the exact HEAD, private marker
and native directory identities. It never adopts an old root for deletion.
Red files search candidate merges with detached diagnostic probes; Web test
files select the Web tier and require their own execution receipts. Test-root
and parent-traversal validation also applies to these probes. Historical admission
skips and logs hosting manifest/test lint and tier projections while retaining
candidate commands. Pinned-tree absence narrows the search without executing
the missing file. Culprits require a fresh repeated boundary pair; a flip is
inconclusive (flaky). Known Linux sandbox exclusions retain identities, reasons
and executor platform as partial evidence; only identical sets on the same
OS/architecture permit comparison of the executed subset. Changed, missing or
unexplained skips stay inconclusive. Only that pair repeats: at most two extra droplet runs per
failing file, or one when the predecessor is absent. See
[periodic culprit search](../agents/tests.md#periodic-dev-t2t3-and-release-gate).

After admission, periodic delivery uses the captured commit's objects, so later
root dev commits cannot invalidate bundling. A bundling or delivery failure before
worker execution publishes **not run · infrastructure**, with its cause. The
durable outcome keeps `code`/`cause` and adds `notRun: "infrastructure"`;
`verification-dev-t3-result` uses `result: "not-run"` with the same `notRun` and
`cause`. It supplies no cover, release proof or culprit search, and changes
neither the last executed green nor red evidence. The attempt cursor still
throttles retries for one interval; the next eligible tip is retried, including
the same candidate tree if it has never started. These outcomes survive restart. A provider capacity refusal at
acquisition uses the same not-run lifecycle with `notRun: "provider-capacity"`
and the original refusal in `cause`. Its periodic headline is **not run: provider
capacity**; it never advances executed green/red markers or starts a culprit
search. Task verification publishes **unavailable: provider capacity** and the
item's latest verify `result` is `"unavailable"`. Suite result JSON and historical
status retain the additive `notRun` field alongside `code`/`cause`; Events and
Neovim cards show unavailable rather than failed. Capacity refuses the run even
with local fallback enabled: it does not select another executor, region or
size. Changing that policy changes spend and belongs to the human.

Release occasions run T1–T4, including T3. `cland release`, including
`--dry-run`, refuses with `release-t3` unless a completed, reported green
dev-t3, soak, stage or release occasion covers the pinned release head's
verification tree (excluding `.cland/tasks` and `.cland/RULES.md`). A different
commit with the same build tree qualifies; T1-only batches, partial selections,
cancelled or incomplete runs do not. The refusal names the needed
`cland verify all --occasion release --report agents` run.

`[verification] soak = "03:00"` schedules this repository's nightly UTC T1–T4
run on one droplet; the new-project default `""` disables it. The hub attempts
once per day, including late startup, on clean dev at fetched origin/dev and
skips an unchanged tree only after an untrimmed selection. It repeats identities absent from the last green soak,
reserves daily spend before creation and reports a cap skip. Results and
quarantine proposals go to the Coordinator in Agents; a red soak leaves the
merge queue running. Proposals require the normal evidence before the
Coordinator edits quarantine. See [Tiers and the merge queue](../agents/tests.md#tiers-and-the-merge-queue)
for isolation, budgets, run plans and bisection evidence.

Reduced integrated/package runs retain a cross-package smoke baseline. Task plans filter out these T3 files. Both lists are named constants
in `src/suite-selection.ts`:

- `NVIM_SMOKE`: `nvim/test/scenarios/workbench.test.ts` and
  `nvim/test/startup-budget.test.ts`. A hub-only run executes the whole hub phase
  followed by real-hub Neovim attach/main views and the generated thousand-item
  startup budget (3 seconds from welcome to rendered explorer/header/sessions;
  first task response at most 128 KiB). Both are T3 and stay deferred in queued
  task plans. Full runs and web-only diffs retain them too. See the
  [measurement contract and scratch-only macOS probe](../agents/tests.md#neovim-workbench-startup-budget-t-1010).
- `HUB_SMOKE`: `hub/test/scenarios/message-tracer.test.ts`,
  `hub/test/scenarios/hub-lifecycle.test.ts`, `hub/test/scenarios/startup-smoke.test.ts`.
  A Neovim-only run executes these spoke/daemon
  tests followed by the whole Neovim phase. The startup smoke starts the candidate
  tree's real detached daemon with `cland hub start` in a fresh project and requires
  `hub status --json` to answer over the Unix socket within one ten-second startup
  budget. It then serves a tracker request and stops the hub, observing PID and
  discovery/socket teardown. It runs in full, hub-only and coverage-selected hub
  phases too. The separate `hub/test/startup-smoke.test.ts` regressions plant
  pre-discovery and listening-but-silent daemon hangs to prove
  bounded failure naming the last structured startup log event. A test-only spawn
  observer owns the detached daemon independently of discovery, and cleanup proves
  its PID is gone while the fixture still exists. The hang cases' duration allowances
  pay for their real ten-second deadlines.

These smoke baselines apply to integrated and legacy package plans; queue-enabled
task plans filter them out after selection.

`hub/test/tiers.json` declares every hub and Neovim test file in a `version: 1`,
path-sorted `tests` map. Add each new file at its sorted path in the same commit.
The tiers are T1 unit (hermetic), T2 component (in-process hub with socket edges),
T3 integration (real process scenarios/contracts) and T4 soak (load/long/platform
checks); see [Test levels](../agents/tests.md#test-levels-d53). Values are
`"T1"`, `"T2"`, `"T3"`, `"T4"`, or a T3 object with exactly one nonempty label:
`{ "tier": "T3", "contract": "codex" }` or
`{ "tier": "T3", "scenario": "release" }`. Fixture/tool writers use
`serializeTierManifest` from `src/suite-shards.ts` to keep the map sorted.

`npm run test:tiers` checks the manifest (`test:shards` is an alias for one release).
Package runs perform the same lint. Unclassified files, absent files, invalid
entries and an unsorted map fail, with the first out-of-order path named. T1
retains the hermetic check: process/port/timer APIs, process-fixture helpers,
wall-clock waits, legacy lock paths or Neovim in its source fail. Verify admission
refuses with `verify-tiers` before queueing; merge admission checks the immutable
merged candidate and refuses with `merge-tiers` before changing refs. The old
`verify-shards`/`merge-shards` wire codes remain accepted aliases.

T0 runs static checks. T1 maps to `hub free`, T2–T4 to `hub machine`, and Neovim keeps its package phase. Hub-owned batches default to configured T1/T3 across available remote shards for cland tier commands (one local slot), omitting redundant T1 only with complete producer receipts and another configured runtime tier. Ordinary `all` and integrated `dev` runs plan T1–T3. Stage, epic and release occasions plan T1–T4 on both executors and set `CLAND_TEST_SOAK=1` for tests and load-gate repetitions. Close-run balancing places T4 files like the others, and the merged result retains each shard’s tier lines. A pre-migration tree carrying only `hub/test/shards.json`
remains admissible: `free` maps to T1 and `machine` to T3, without requiring
Neovim entries or sorted keys. If both manifests exist, `tiers.json` takes priority.

The hub free shard runs on one worker. `[verification] workers` sets the hub
machine shard and Neovim concurrency (default 4). `[verification.droplet] workers`
overrides it on droplets and otherwise inherits it; this repository sets it to 2
(D53, measured on c-8; T-655, A-4106 and A-4156). Both accept positive integers;
`cland update` preserves them. Hand runs use the local setting even when the
project's default verification executor is a droplet.

`cland verify --workers N` overrides the count for one run. `--size c-16` overrides
the droplet size for one run and requires the droplet executor. The hub validates
that the provider offers the size in a configured region, then reserves its actual
hourly price against the daily spend cap before creating it. Overrides survive
queueing/restart and appear in the result header. Cache reuse requires matching
worker counts and size overrides; use `--fresh` for every timed measurement.
A droplet fallback uses the local configured workers unless `--workers` was given.

D53 sets droplet workers to 2 from the c-8 measurements. Earlier Mac runs at
four workers approached load 14–15, where readiness failures began; higher counts
need measured evidence after the inspection diet and in-process hub changes.
Compare c-16 at 4/6/8, then the quiet Mac at 4/5/6. Keep four locally unless a
failure-free leader improves wall time by at least 10%; repeat close contenders.
The [measurement procedure](../research/T-396-worker-measurements.md) records
the table, decision rule and required accounting receipts. The Coordinator posts
the actual trade-off at stage-2 close before changing defaults.

Smoke targets use the same classification. Only machine phases
acquire `<lock>.machine`; the legacy lock pair stays held as the compatibility
fence for the complete invocation, including typecheck. Production invocations
remain serialized by budget one and this fence. This preserves hand-run and
pre-V1 exclusion; it does not enable production free-shard overlap yet.
Logs and suite reports include each shard's wall time, resource, workers and
machine wait, plus the hub queue wait and total suite/compatibility wait.

Integrated covers and batches with only filed hub/nvim `flaky` identities can acquire
green-with-receipt evidence after five passing same-head/tree hub reruns. The
hub uses ordinary batch failing-file admission on the original executor, under
normal capacity and spend caps. Reruns pin the original recorded prepare/check
and failed runtime step commands, including T4; acceptance requires complete
producer receipts at those exact steps, commands, run ids and tree. Missing
legacy command/step bindings grant no authority. Any unfiled identity, rerun non-pass, T0 failure
or incomplete execution keeps the run red. Tracker references are exact inline
code spans or whole trimmed lines in an open flaky-labelled item's body.
The native result stays unchanged. Stage acceptance binds the receipt to its
original tree and retains the two-platform, full-selection and QA requirements.
The hub writes a version-1 manifest into the run's durable evidence and receipt;
the Coordinator lands tracked entries separately. Evidence and tracked manifests
share `lintQuarantineManifest`. Retained stage and batch admission also invoke
it; expired entries invalidate stage projections, including cached projections
and reopen.

A filed Web failure stays red even after five passing reruns, with the reason
`Web identity outside quarantine scope`. The hub attempts no manifest entry;
the Web runner does not implement quarantine.

`hub/test/quarantine.json` lists exact top-level `file::test` identities (including
their subtests) with `owner` (`T-n`), a non-TODO `reason`, and UTC `added` and
`expires` dates. Expiry is exclusive at midnight, after addition and no more than
seven days later. Verify/merge admission and package runners refuse expired or
invalid entries by name. The Coordinator adds tracked entries from the hub's
filed-identity 5/5 receipt, recorded in the owner ticket. See
[the manifest example and evidence rule](../agents/tests.md).

Quarantined tests still execute in task, integrated, close and release runs,
including new-test load repetitions. A complete, accounted test failure is
reported in the result's **Quarantine** section with passes and skips, without
failing the run or generating a shared-defect candidate. Raw Node counts and
diagnostics remain in the log. Crashes, cancellation, other failures, incomplete
receipts and duration budgets still fail. The hub records one outcome per real
run, uses the worst duplicate smoke outcome, and reports **cleared** after twenty
consecutive passes. Skips/failures reset the streak; cache hits, report retries
and absent tests add no pass. Streaks persist across restart and update atomically
with publication. Renewing an entry resets its streak. The Coordinator removes
cleared entries from the committed manifest; the hub never rewrites it.

Phase and quarantined repetition receipts publish through a staging file and
rename. A missing, empty or truncated phase receipt produces
`incomplete: receipt missing` with the execution-order in-flight test identities
(or an explicit unavailable identity), the native process exit/signal and up to
64 KiB of its stderr tail. The runner preserves a non-zero native status and
turns a zero status into failure; unusable receipts never excuse quarantine or
supply duration-budget evidence.

`hub/test/durations.json` records each hub and Neovim test's median time and each
file's summed top-level test-time, and declares tier budgets in `budget.T1`
through `budget.T4`. `budget.mode` selects `report` or `enforce`; omission keeps
report mode for older manifests. This repository uses report mode until after
v0.1.4 (D73); enforcement returns under E-880.

In report mode, tier and T3 ratchet diagnostics cannot change an exit status.
Logs retain the complete `budget (report only): would fail …` list, and results
show the ten largest overages ranked by seconds over budget. The existing
new-identity gate remains active: a new test exceeding 5 seconds or a new file
exceeding 60 seconds fails the run. In enforce mode, every observed test and
file must fit its tier's budget or an exact allowance covering the measured
seconds. A known baseline does not exempt it; the runner fails with
`duration budget` independently of assertion quarantine. T4 stays unbounded.
See [duration budgets](../agents/tests.md) for allowances and the T3 ratchet.

Tests are known by their exact
`file::test` key in `tests` or `allow`; files are known by their path in `files`
or `allow`. A known file never exempts a new test inside it; a renamed test is new.
Nested test times are already included in their parent. Add a justified exception in your task branch's `allow`
map: a test key is `path/to/file.test.ts::test name` with `seconds` and `reason`;
a file key is its path with `file: true`, `seconds` and `reason`. A file exception
does not exempt its tests. Admission (including verify and merge) refuses empty
or `TODO` reasons through the shard-manifest lint. Missing duration manifests
disable this check and the timing reporter, preserving fixture/older runner behavior.
Working-tree and immutable-candidate lint also refuse exact test/allow keys
with no matching source identity, and file keys naming missing test files.
Renames and moves must remove stale keys in the same change; a stage cover adds
the new baseline. Computed titles remain uncertain; literal and template titles
are matched within their own file.
This refusal happens during shard planning before a test receipt exists, so a
merge batch holds as inconclusive rather than bisecting a failing test. The
Coordinator diagnoses the named manifest key and recovers the batch after cleanup.

The hub reads the current project's `hub/test/durations.json` for the periodic
dev T3 result report and each Coordinator heartbeat. Both name every dated
allowance expiring within five days, its exact test/file key, owner and UTC expiry
date; already expired entries remain visible as expired. The five-day boundary
is inclusive and samples the hub clock after the manifest read completes.
Admission uses the same midnight-UTC date
interpretation and still refuses expired allowances, listing all expired keys
in one refusal. Legacy allowances without dates expire on owner closure and do
not receive calendar warnings. A missing manifest produces no warnings; an
unreadable or malformed one produces an explicit warning instead of preventing
the report or heartbeat.

Renewals remain reviewed edits to `added` and `expires`: their span is at most
31 days for `budget.legacyOwner` (default `E-677`), seven days for other owners.
Keep the existing `seconds` and `reason` unchanged. There is no renewal command.

Closing a planning container (an epic by default) rereads the project’s
`hub/test/durations.json` when present and refuses if any `allow` entry names
that item as `owner`. The refusal lists every test/file key. Re-own those
`allow[key].owner` entries to a standing category or epic directly under a category before retrying; retain
`added`, `expires`, `seconds` and reasons. There is no re-own command: edit the
manifest. `task edit --state closed` and imports closing an existing epic share
the guard, and the human’s QA `--override` does not bypass it. Projects without
the manifest close normally; an unreadable or malformed manifest refuses close.
This does not change stale-owner lint or the expiry rules.

At each stage close the Coordinator refreshes on `dev` from the latest green
integrated full-run log artifact:

```sh
npm run test:durations -- --add-only /absolute/path/to/A-123-green-integrated.log
# Multiple logs take the median per test; pass the newest log last.
node hub/test/durations.ts refresh --add-only <older-green-log> <latest-green-log>
```

Until T-931 decides allowance-refresh policy, use `--add-only`: it prints and
adds missing test/file baselines, preserving all existing entry bytes, number
formatting and allowances. It creates no TODO allowances; review new
over-budget identities separately. It retains source artifact ids and updates
the source head. `refresh --help` describes the option.

When a tier manifest exists, both refresh modes accept log identities only for
files owned by that manifest and print `duration skipped (not tier-owned): <identity>`
for each skipped file or test identity. Imported `site/test` cases therefore need
no manual removal after stage close. Without a tier manifest, refresh keeps its
legacy unfiltered behaviour. Existing entries are retained under the usual refresh
rules; invalid existing duration keys still refuse shard planning.

Full refresh (without `--add-only`) preserves reasons, updates timing fields and removes tests absent from
the newest log. Only over-budget identities absent from both their previous
baseline and `allow` get a new `TODO` exception; known slow entries only update
their baseline seconds. Resolve every `TODO` before
committing. The `source` records the artifact ids and latest head. The runner's
file reporter emits one record per top-level test; `suite timing` lines retain
those records in the durable log after phase cleanup. Older spec logs use their
top-level result lines and start identities, falling back to source titles when
start identities are absent; ambiguous source matches refuse refresh.

In report mode's new-identity gate, known tests and files never fail the duration
budget. Over-budget entries always
report a `duration regression` annotated `over budget`, even when flat or faster.
Under-budget entries report at least 1 second and 50% slower than the recorded
baseline (threshold equality counts). Both kinds share the report's five-line
cap, ranked by seconds over baseline.
`suite budget overhead <ms> ms` measures manifest loading, the timing
reporter's bookkeeping/serialization, record reading, checks and reporting using
`performance.now()`. It excludes executing tests and waiting for their events;
serial absent/present whole-file comparisons also check the added reporter cost.

Task-branch verification also applies a **load gate** to each top-level test
whose exact `file::test` identity is absent from the manifest's `tests` baseline.
The phase reporter discovers names while the ordinary phase is running.
`[verification] load_gate_workers` parallel lanes (default 2) repeat each new name
five times in fresh Node processes, using an escaped, anchored `--test-name-pattern` on its file alongside the phase's normal
work. Each identity stays on one lane with sequential repetitions; no repetitions
are dropped to meet a deadline. The log and run report include the lane count.
Increasing it trades wall time for load independently of ordinary phase workers.
A reasoned duration allowance does not make a test known to the load gate;
the Coordinator's stage-close manifest refresh does for task runs. Occasion runs instead use the runtime identities from the latest completed, reported green integrated stage receipt, pinned at admission and carried to every shard. Names absent from that receipt repeat five times even if the current duration manifest knows them. Ordinary batches, failed stages and cache hits do not move this baseline; without a stage receipt every identity is new.

Every repetition needs a green process exit and exactly one passing receipt for
the named test. Skips, TODOs and missed names do not count. The log names each
test with `load gate: <file>::<test> <passes>/5 passed`; anything below 5/5 fails
the run and appears in its failure summary. The `suite duration` line reports
`load gate extra wall <seconds>s`, the time spent finishing repetitions after
the ordinary phase exits, summed across phases. This measures the tail added by
the gate, rather than the unmeasurable contention cost during overlap. Known
tests and integrated `dev` runs (including sharded close runs) get no repetitions.
The running hub computes the task flag carried in the suite selection; both the
hub and candidate runner must support it. A pre-upgrade hub supplies no flag and
does not request the gate. Exercise the gate through package-runner fixtures
during bootstrap, then prove the live task path after the hub is updated.
Without a duration manifest the gate is disabled, like the duration budget.
Repetitions share the phase's owned temporary root and cleanup, and their
receipts do not enter duration baselines or coverage maps.

All package runs queue once for joint admission to `/tmp/cland-suite.lock` and
`/tmp/cland-suite-nvim.lock`, and retain both locks through the chosen phases,
including smoke. Each phase cleans up its processes and temporary root before
the next starts. Explicit test targets passed to `runPackageSuite` retain the
single-phase targeted/fixture interface; a hub target run needs only the machine
lock. Compatibility admission serializes runs across projects and worktrees;
the separate machine lease is held only during machine shards. Joint waiters hold neither lock until both are free under their recovery
guards, so live legacy Neovim-first waiters can drain without an opposite-order cycle.
See [agent test notes](../agents/tests.md). A second run prints the holder's
pid, start time, worktree and its own queue position. Atomic PID/start-time
tickets published before guard polling in `<lock>.queue/` order admission by monotonic enqueue time; dead
waiters are swept and interrupted waiters remove their own tickets. The queue
survives release and recovery of the ownership directory. Automatic runs publish a PID/start-time sidecar
before creating the directory. After a one-second grace period, a dead holder
(including a reused PID) is reclaimed: its verified processes exit and its run
directory is removed before the replacement suite starts. The short, unique
run-root path is recorded before directory creation, so interrupted setup is
recoverable too. A live older-version holder with an unreadable start time is
preserved until its PID exits; the waiter identifies it as an older version.

Local cancellation captures the worker's descendant identities before signalling,
including detached harness children. Interrupted workers and borrowed package
runners preserve their root and compatibility ownership for the hub's termination
owner. The hub confirms the captured tree is gone before recovering its leases
and reporting cancellation; this exact-worker recovery needs no stale-age grace.
If a child recreated the root, recovery requires the exact canonical token/phase
path, the same OS owner, a dead holder and a dead recorded runner group. Quarantine
follows independent cwd/ancestry discovery that reaps detached writers; an
ambiguous candidate preserves ownership. Missing runner metadata stays blocked.
It renames that directory to `<root>.quarantine-<device>-<inode>`, preserving its contents,
and journals `suite-recovery-quarantined` with `before` and `after` device/inode
pairs, token, holder PID, root and quarantine path before releasing both locks.
Symlinks, a different path/owner, live or unknown runner groups, and raced roots
retain ownership and a blocked reason. Quarantined roots remain diagnostic files;
there is no automatic deletion policy.

An empty lock from the manual `mkdir` convention has no recorded owner and is
never reclaimed by age. Once a minute the waiter prints its age and recovery
guidance, with a warning after 15 minutes. If no suite is running, remove an
abandoned manual lock with the `rmdir` command printed by the waiter, naming
either `/tmp/cland-suite.lock` or `/tmp/cland-suite-nvim.lock`.
`CLAND_TEST_SKIP_LOCK=1` skips the lock in isolated CI jobs.

### Trying setup on a scratch machine

Shared hub test launches use `test/fixture-environment.ts`, through
`accountFixtureEnvironment(extra)` in the worker harness. They own scratch HOME,
XDG/account paths and Git configuration, discard inherited Git overrides and
identities, and filter provider/account credentials after the final overlay.
The default Git author and committer are `Fixture Test <fixture@example.test>`;
explicit synthetic identities in extras override those defaults.
They also remove ambient SSH-agent/askpass and package-manager credential config
handles. Account product tests use a separate `scratchAccountPaths` dependency
for deliberate HOME/database inputs, validated inside the disposable project.
Pass explicit scratch profiles and fixture identities as extras; do not add an
overlay after the builder returns. The manual `test/inbox-load.ts` probe uses
the same builder. Its root, including HOME, is removed after the served hub stops.
Fake-provider contracts opt in separately through the typed `syntheticProvider`
fixture dependency or `clandWithProvider`: only `cland-test-…` sentinel tokens
with an explicit HTTP loopback endpoint and port or the injected fake API qualify.
Credential overlays in the normal builder remain filtered.
Daemon restarts must pass the typed `syntheticProvider` dependency again.
Native Git contracts use `projectHub`'s typed `scratchGitConfig.excludesFile`
for a project-owned excludes file; the remote fixture's `gitExcludes` option
creates it. Only `core.excludesFile` is admitted through inline Git config,
and arbitrary `GIT_CONFIG_*` extras remain filtered.
See [Fixtures](../agents/tests.md#fixtures) for the T1 poisoned-parent proof
and the deliberate synthetic-auth native adapter contract.

`node --test hub/test/scenarios/setup.test.ts` runs the complete setup scenario
through a pseudo-terminal: missing Codex, signed-out Claude Code, a declined
account profile, a stand-in workbench launcher, and one real scratch hub/Aide.
It checks terminal and nonterminal reruns, trust files and remembered installer
declines, then observes stopped processes before removing the scratch HOME.

`test/setup-machine.ts` builds a temporary HOME, XDG directories, Git identity
and project through the real `cland init`. Its PATH contains only allowlisted
host utilities and fake harnesses. It inherits no account overrides, shell
startup configuration or provider tokens. Never add the host PATH or a real
DigitalOcean token to this environment. No installer makes a network request:
the fake `curl` answers only the three official URLs, and rejects anything else.

For QA, make a local `hub/test/setup-qa.try.ts` with the following, then run
`node hub/test/setup-qa.try.ts` from a terminal. Claude Code
is missing, Codex is signed in and OpenCode is signed out:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setupMachine, signIn, calls } from './setup-machine.ts';
import { initIn } from './init-machine.ts';
import { beforeDirectories, ownProcess } from './process-cleanup.ts';

test('try setup', async t => {
  const machine = await setupMachine(t, { installed: ['codex', 'opencode'] });
  await signIn(machine, 'codex');
  console.log({ project: machine.project, home: machine.home });
  const child = spawn(process.execPath,
    [fileURLToPath(new URL('../bin/cland.ts', import.meta.url)), 'setup', '--attach'],
    { cwd: machine.project, env: machine.env, stdio: 'inherit' });
  ownProcess(t, child.pid);
  // Stop the scratch hub before the fixture removes its HOME and project.
  beforeDirectories(t, async () => { await initIn(machine, machine.project, 'hub', 'stop'); });
  const [code] = await once(child, 'close', { signal: t.signal });
  assert.equal(code, 0);
  console.log(await calls(machine));
});
```

The fixture cleans up after the test; remove the local try file afterwards.
`installFake(machine, harness, 'installer')` puts a binary only in its vendor's
folder, off PATH; the default `'path'` puts it in the fake bin folder.
`signIn(machine, harness, false)` signs out, and
`profileEnvironment(machine, harness, scratchPath)` selects another profile
(`OPENCODE_DB` for OpenCode). Apply that environment to a copy of the machine
before calling helpers or starting commands. `loginFails(machine, harness, true)`
makes login exit zero without changing its marker. Set
`machine.env.FAKE_INSTALL_FAILS = 'claude-code'` (or `'codex'`, `'opencode'`,
`'1'` for all) to make the emitted installer fail. OpenCode's default connection
is a credential; `signIn(machine, 'opencode', true, { connection: 'env' })`
models an env-only connection. `calls(machine)` reads invocations and Codex RPCs.

`node --test hub/test/setup-machine.test.ts` exercises the installers, profile
logins and Codex trust/EOF behaviour inside a poisoned inherited scratch HOME,
then compares its `.claude.json`, `.codex/` and `.config/cland/` contents. The
human's real account files are never opened by this self-test.

The fake harness fixtures use **30 ms turns**, **50 ms adapter polls**, **100 ms
Claude push trust**, and a **150 ms Codex refuse window**. Direct invocations of
the fake executables retain their 300 ms turn and 1500 ms Codex refusal fallbacks.
Pass `turnMs`, `pollMs` or `pushTrustMs` to `fakeClaude` / `fakeCodex` (or set the
fake's `FAKE_*_TURN_MS` in a standalone fixture) when a test needs a slower turn or
suppressed polling. Comment each opt-in with the race or behaviour it stages.
OpenCode's existing “take your time” input also selects a slow turn. A fast-default
race is a Bug to report to the item's lead; any temporary slow opt-in names it.

Positive waits use frames, journal records or `eventually`. Negative waits span
named schedule intervals; wall-clock boundary and real deadline proofs retain
comments explaining the wait. Claude logs its resolved `claude-schedule` so a
default can be asserted without waiting out 30 seconds. Executor fixtures can
scale runtime deadlines with `CLAND_TEST_EXECUTOR_LIFETIME_MS` and
`CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS`, alongside the existing sweep, watchdog and
collection timing knobs. These do not change config parsing or validation.
`CLAND_TEST_USAGE_EVENT_MS` similarly scales the existing Sessions usage and
account-limit publication window. Usage fixtures use 100 ms; stop-before-publication
cases and the real-window account-limits test retain the 1000 ms production default.

`CLAND_TEST_WAIT_MS` is a test-harness-only failure deadline: a finite positive
number sets the default budget for `eventually` and the gated verifier's startup
wait. Without it (or with an invalid value), `eventually` retains 15 seconds and
the verifier startup wait gets 30 seconds to prepare its worktree and start its
harness under load. Setup `until` and `eventually` budgets also use the
current load: `max(executor floor, 1 + one-minute load / availableParallelism())`
on each wait (floor 1 locally, 2 on droplets). Run-suite no longer exports a
factor frozen at phase start. `CLAND_TEST_LOAD_FACTOR` remains an explicit
override of at least 1; invalid explicit factors fall back to 1. Injected wait
clocks and named
`behaviour` deadlines stay exact; an explicit `loadFactor` can exercise scaling
with a fake clock. Positional `eventually` budgets remain supported and scale
as setup waits. `remoteEventually` keeps its remote scaling without a second
suite multiplier. See the shared wait procedure in docs/agents/tests.md. The
verifier fixture releases its adapter only after the competing tracker operations
finish, without a timed gate opening. No production timeout changes. Linux proof
runs use the defaults, with this variable unset.

`CLAND_TEST_EVENT_WINDOW_MS` is a test-only daemon knob: a finite positive number
sets the equal-event coalescing window in milliseconds. Without it (or with an
invalid value), the production window remains 60 seconds. The window-boundary
test uses 250 ms and waits 300 ms, retaining its separate-event/count assertions;
other coalescing tests retain the default window. An injected-clock test checks
that the production default includes 59,999 ms and excludes 60,000 ms without
waiting a minute. In-process hubs can instead
use `eventWindowMs` or their existing injectable `now` clock. Timing fixtures
retain generous failure deadlines: shortening a window does not shorten how long
a loaded machine has to become ready.

Fixture hubs started with `startDaemon(t, root, env)` skip the startup orphan sweep
by default (`CLAND_TEST_SKIP_ORPHAN_SWEEP=1`) and log `orphan-sweep-skipped`.
Tests proving startup cleanup pass the fourth argument `{ sweep: true }`; an
explicit environment value takes precedence over that option. Production startup
without the variable still sweeps. Doctor and on-demand cleanup are unaffected.

Process inspection treats any `pgrep` stderr, malformed PID output, known failure
text, timeout or unexpected exit as unavailable, including macOS sysmond errors
with exit 0. Failed inspection preserves collector receipts, fixture writers and
suite recovery roots, reporting `process inspection unavailable`. A clean empty
listing remains an absence observation; it does not replace the separate native
birth and ownership checks. Remote stream/status reads and watchdog identity
checks use their existing SSH and native process probes independently of pgrep.

Test helpers record each process's PID, process group and start identity at spawn
or first observation through the CLI, hub frames or fake harness records. PIDs
from one protocol result are captured together. Teardown
selects only those PIDs and their recorded leader groups (`pgrep -g`, followed by
`ps -p`), verifies the original identities, and kills a group only when its leader
and every selected member are owned. Non-leaders and groups with an unrelated
member receive individual PID signals. Processes older than the test worker are preserved; its ancestors are protected
using targeted probes. Current ancestry proves child ownership;
reparented members require a targeted cwd check under a still-owned fixture.
An exited leader retains its recorded group until selected survivors are checked;
verified survivors receive individual signals, since the absent leader cannot
authorize a group signal. A reused leader cannot authorize its replacement group.
Exit waits probe only captured PIDs. An already-absent registered non-leader needs no additional spawn. Directory teardown kills registered processes
before removing the directory, without a machine-wide process or cwd listing.
`cleanupProcesses` uses the same targeted path when given captured seed identities.
A live seed that no longer verifies falls back to the full ownership proof, preserving
its replacement identity. Root cleanup without seeds and the runner’s phase sweep
retain machine-wide discovery so unregistered leaks are still found.

`fakeClaude` closes writer admission after resource and hub shutdown, reaps
registered session groups, then drains every registered CLI before removing its
home. The 5-second drain deadline reports the remaining PID/start identities and
retains the home; it never authorizes killing a slow poll or removing its files.
Release or stop the reported writer before retrying cleanup. Removal itself
retries ENOTEMPTY/EBUSY for 1 second and names remaining files on exhaustion.
The lifecycle regression injects a complete `writerClock` to cross the drain
deadline with a deliberately held real poll, without a wall-clock delay.

An OS process identity disappearing and an `execFile` callback arriving are
different receipts: the callback waits for stdio closure and may arrive later
under load. Assert the writer's OS identity is gone at the removal boundary;
await the callback separately to check successful CLI completion. Do not treat
an undelivered callback as proof that a process can still write.

The machine shards run at concurrency 4 locally and 2 on droplets (D53, measured on c-8); hermetic shards run at 1. Targeted single-file runs take no suite lease but obey cover-quiet admission:
`node --test hub/test/daemon.test.ts`. If calling the runner directly, use
`node hub/test/run-suite.ts hub` or `node hub/test/run-suite.ts nvim`; raw
`node --test` is reserved for targeted runs.

When an integrated cover holds the local slot, `suite.slot/check` refuses with
`cover-quiet`. An authenticated session's refusal persists a one-shot
`test-slot-available` hub report, delivered to that stable session identity when
local capacity is free. Repeated refusals coalesce; the registration survives the
short-lived test socket closing and hub restarts. No queue row or lease is taken.
Do other work or end the turn until that report arrives; never poll with sleep
or `cland verify queue`. Retry the command after the notice: admission is checked
again, so another cover can refuse it and register a fresh wake-up. Remote covers
do not hold the local slot, and a matching inherited lease admits the cover's own
workers. Human/standalone checks without session identity get Coordinator-notice
guidance; only the human may use `CLAND_TEST_IGNORE_COVER=1`. Older running hubs
keep their previous refusal; report the missing capability to the Coordinator
and end the turn until its release notice or authorized restart. See
[cover-quiet](../agents/tests.md#cover-quiet).

Each phase ends with `suite skip details N` and one `suite skip` JSON record per
skipped test, containing its repository-relative file, name and reason. Both
static platform skips and runtime prerequisite skips appear on macOS and Linux;
for a skip without an authored reason the record says so. The ordinary Node
reporter still owns the test counts: these detail lines do not match the hub's
`# skipped N` / `ℹ skipped N` count diagnostics and cannot double their totals.

Targeted test admission warns once per admission when the running Node is
outside the root package's `engines.node`, even without a project hub or with a
cover exemption. It names both versions; it does not block the targeted test.
The QA recorder's `run` and `note` instead refuse with exit 2 before executing
or writing receipts. They use `node-engines.json` shipped beside the recorder
through skill provisioning and release packaging, with a parity regression
against cland's root engines; an arbitrary host project's manifest is ignored. `recover` keeps historical receipts unchanged. Select a
supported Node on PATH for local commands and their children; with nvm, source
its `nvm.sh`, run `nvm use 24`, then confirm `node --version` meets the full
root engine range. Hub verification retains its pinned runtime.

#### Running the suite on Linux

Use Ubuntu 24.04 with `git`, `curl`, `ca-certificates`, `build-essential`,
`python3`, `jq`, `lsof`, `xz-utils`, `procps` and `locales` installed. Use Node
24.13 or later in the 24.x line (see `package.json`). For this repository, run
`node hub/bin/verify-prepare.ts` to install dependencies and fetch and verify the
release pinned by `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`. Local verification
does not run prepare; a droplet runs the configured prepare automatically. Run as
an ordinary login user with
a home under `/home`, with no added environment settings (normal login `HOME`,
`USER`, `LANG` and `PATH` suffice): `npm run check && npm test -- --all`.
`PS_PERSONALITY` and `CLAND_TEST_*` overrides are unnecessary. Agent runs still
follow the verification queue rules above.

For a local container, use `docker run --init` and an explicit CPU limit within
the host's available CPUs. A real init must reap orphaned descendants; using
`sleep infinity` as PID 1 alone leaves zombies that invalidate process-exit
tests. The macOS `sandbox-exec` cases are listed as skips on Linux, along with
an absent real OpenCode binary or any missing prerequisites. Installing OpenCode
is optional; its fake adapter coverage still runs. Root runs additionally list
the permission-denial recovery case that root cannot exercise.

The runner uses a short temporary directory for each phase (Unix socket paths must
fit). After the test process exits, one machine-wide discovery sweep is the safety
net for missed registrations and crashed tests. It verifies process start identities
and either cwd containment in the phase root or current ancestry to its recorded
runner before signalling; revalidation and exit waits target the captured PIDs and groups. Late group
members must prove current cwd containment or descent from an original identity;
they are captured during targeted revalidation.
The same discovery snapshot counts phase-owned `cland hook bridge` candidates.
Each phase prints `suite hook bridges: before cleanup N; after cleanup N` after
waiting for the captured identities to exit. A surviving candidate fails the phase;
ambiguous ownership still prevents a signal. Existing bridges outside the phase
are excluded by its root and run marker.
Each cleaned process is visible as `cleanup pid <pid>: <command>` in the runner's
log; ambiguous candidates are preserved and printed as `preserved pid <pid>:
ambiguous ownership`. Production inspection and test cleanup share
`ps -ww -e -o pid=,ppid=,pgid=,lstart=,stat=,command=` on macOS and Linux
(procps-ng); targeted listings replace `-e` with `-p <pids>`. The repeated `-w`
keeps the full command line, zombies are dropped, and start-time whitespace is
normalized to match the lock's `processStarted` identity. No `PS_PERSONALITY`
setting is needed. Cwd discovery uses `lsof` on macOS or `/proc` on Linux.
Environment markers select candidates and diagnostics; they never prove ownership.
The phase root retains its device/inode proof, including during crashed-holder
recovery, and is removed after the sweep. A test runner waits at startup until its
PID/start identity is durably recorded.

New process fixtures must use `tempProject` or `ownDirectory` and register each
process with `ownProcess` before awaiting startup. Helpers associate protocol/CLI
PIDs with their registered fixture directories; `ownProcess(t, pid)` also belongs
to that test context. Start fixtures detached when they need to own descendants as
a group. Signal handlers clean registered identities on SIGINT/SIGTERM; a crash
that bypasses them is covered and reported by the phase sweep.

Production grace waits select descendants of captured parents with bounded
`pgrep -P` walks and targeted `ps -p` snapshots. Each new child still needs a
current parent/start-identity proof before reservation and capture, so an observed
child stays owned after its parent exits gracefully. After freeze/KILL, waits
probe only captured PIDs. Termination
settles without another spawn when `kill(pid, 0)` confirms all are absent. Its full
initial tree discovery, repeated fork-to-freeze walks, immediate identity check
before each signal, ancestor protection and reservation/authority checks remain. Synchronous lock
acquisition caches only a successful identity for its own current-process lock
record, as asynchronous acquisition already does. A missing self identity is
retried. The general PID probe APIs and every foreign-PID pre-signal check stay
fresh; no identity of another process is cached.
Each suite invocation prints its elapsed duration and peak sampled one-minute
machine load, which includes other activity on the machine.

### `cland` on the PATH

The project hooks `cland init` writes into `.claude/settings.json` call `cland` from the PATH, and do nothing when it is not there (a Claude Code session the hub launches does not need it: its hooks name the CLI by path). To run them for a session started by hand, and to type `cland` instead of `node hub/bin/cland.ts`, put the CLI on the PATH once, from the repository root, with either:

```sh
npm link                                              # links the package's `cland` bin into npm's global bin folder
ln -s "$PWD/hub/bin/cland.ts" ~/.local/bin/cland      # or a symlink into any folder on the PATH
```

Both point at this checkout, so `git pull` updates the command; `npm unlink -g cland` or `rm ~/.local/bin/cland` removes it. Node resolves the CLI's imports from the link's target, so either works from any directory.


<!-- Implementation guidance moved from the implement skill. -->

For gateway routing, authority or remote failure isolation, use the sealed frame-protocol and
test-messenger seam in `docs/agents/tests/hub-test-gateway.test.ts.md`. Keep
authority before replay/actor resolution and resolve reply topics from stored
messages. Platform clients use the gateway's frame port, never a hub credential.
Messenger provenance is trusted per-request metadata, not a frame field; keep
remote messages, ask outcomes, approval outcomes and fallback denial notes in
step. Preserve optional-source compatibility for old ask outcomes; the headless
workbench regressions are `web/test/remote-via.test.ts` and
`nvim/test/remote-via.test.ts`.

For pairing codes or local approval lookup, read `docs/agents/pairing.md` and its
T1 service/T2 frame seams, including approval authority and replacement drainage. Keep `Inbox.pairings` optional for older hubs, and
strip pairing rows and counts at the remote boundary. Trusted pairing callbacks
invalidate read replay at persistence, before coalesced inbox publication.
Workbench pairing rows use `docs/agents/tests/web-test-pairing.test.ts.md`:
the sealed Web fixture and real headless Neovim share one hub with fake messengers.
Keep pairing entries in Asks and approvals; Neovim's card alone binds its approval
key, while the web offers selectable local command text. Remove departed codes
from retained visits and split detail pages on the authoritative snapshot, and
keep inboxes without the optional `pairings` field readable. Existing role clauses
already reserve pairing approval to Neovim and the terminal; add no clause lines.

For remote persistence and poller ownership, use `Store.remotes` on the existing
hub.db handle, with platform ids kept as strings/TEXT. The T1 storage/lease seams
and T2 frame/restart/stop receipts are documented in
`docs/agents/tests/hub-test-remote-state.test.ts.md`,
`docs/agents/tests/hub-test-remote-state-migration.test.ts.md` (T2 native DDL trace),
`docs/agents/tests/hub-test-poller-lease.test.ts.md` and
`docs/agents/tests/hub-test-gateway-state.test.ts.md`. Use fake native process
facts and fake time; retain live or unreadable holders, and release a lease
only after positive remote stop receipts. Never signal a token consumer.

For remote outbox changes, read `docs/hub/durable-remote-outbox.md#durable-remote-outbox` and use
`docs/agents/tests/hub-test-outbox.test.ts.md` for client proof/attempt receipts,
`docs/agents/tests/hub-test-outbox-gateway.test.ts.md` for outage and source
closure through frames. Keep immutable attempted payloads, stable job identities
and the unknown-delivery fence. Re-read queue arrivals within the active drain;
use injected Clock/random for capped retryAfterMs and reconnect equal jitter,
with no independent hub timer loop. Keep legacy clients optional-field compatible;
stop cancels delays and aborts/joins reconnect before releasing storage.

For hub shutdown changes, use the real-process receipt tests described in `docs/agents/tests.md#implementer-test-selection`, including held fake-provider mutations and late-resource reconciliation; interpret `hub stop`'s released-lock/live-PID diagnostic and signal cleanup deadline through `hub/README.md`.

Reservation-lock shutdown uses the cheaper T1 ownership and T2 `projectHub`
seams in `docs/agents/tests/hub-test-executor-lock-liveness.test.ts.md` and
`docs/agents/tests/hub-test-executor-admission-lock.test.ts.md`. Join a late lock
acquisition before rejecting cancellation. Keep shard-release intents durable
through shutdown and prove next-hub settlement; no new process is needed for
these local wait boundaries.

For PID ownership changes, keep legacy `pidStarted` fields alongside additive
`pidIdentity`. Stop, rollback and cleanup require native birth proof: Linux
boot-id/start ticks or macOS microsecond kinfo birth via the OS Perl syscall
bridge. Legacy rows upgrade once after a coherent matching lstart/native
observation, persisting proof before signalling; same-second reuse before that
first observation retains the previous risk. Mismatch/unreadable proof never
grants a signal or exit receipt; preserve live writer roots. A final native Linux
Z/X or Darwin SZOMB receipt establishes exit without signalling; keep uncertain
listed descendant branches until captured or refused. Parent PID reaping is a separate boundary. Test cleanup rechecks listed
descendants of a natively exited parent against their own captured births;
gone or changed births settle, while live or unreadable descendants retain the fixture. Use the
parser/persistence, native listing and
same-second signal seams in `docs/agents/tests/hub-test-process-identity.test.ts.md`
and its linked T3 files. Inject processStarted, processIdentity and coherent
processRows for synthetic-PID fixtures, including one-time migration checks.

For local verification cancellation or compatibility recovery, use the sealed cancellation, recreated-root quarantine and blocked-queue seams in `docs/agents/tests.md`. Observe exact descendant death before root cleanup; retain the quarantine journal's old/new inodes and next-run admission receipt. Live machine locks are outside the fixture.

For inherited-stdio cleanup, follow `docs/hub/coordinator-subscription-procedure.md#inherited-stdio-writer-ownership`
and the fast-exit/denied-census controls in `docs/agents/tests/hub-test-suite-timeouts.test.ts.md`.
Keep reciprocal endpoint and native birth proof, restore stream reads after duplication,
and preserve unknown-writer warnings. Existing role permissions cover this cleanup.

For hung verifier fixtures, use the real-runner PID receipts and early-failure
controls in `docs/agents/tests/hub-test-suite-timeouts.test.ts.md`. Register
cleanup before the fixture closes its clients, cancel through the owning
verifier and wait for its terminal receipt before removing roots. The deliberate
phase-sweep leak is in `docs/agents/tests/hub-test-suite-runner.test.ts.md`;
parent emergency ownership must not substitute for the sweep's cleanup receipt.
For suite identity or lifecycle fixtures, take the worker from `launchWorker()`
before `hub.stop` or a saved-job edit (`docs/agents/tests/hub-test-suite.test.ts.md`);
`launch()` can return a queued snapshot with no PID.

For Git object accumulation or stale `gc.log`, follow `docs/agents/git-maintenance.md`; prove grace, owned fixture drainage and held-close recovery through `docs/agents/tests/hub-test-git-maintenance.test.ts.md`, serving-first bounded stop/restart through `docs/agents/tests/hub-test-git-maintenance-startup.test.ts.md`, normal CLI exit beside a live handed-off collector through `docs/agents/tests/hub-test-git-maintenance-cli.test.ts.md`, and identity/refusal policy through `docs/agents/tests/hub-test-git-maintenance-recovery.test.ts.md`.

For startup lease recovery and phase timing, follow the sealed T2 fake-provider receipts in `docs/agents/tests.md#implementer-test-selection`. The T3 retained-history scale guard counts suite checkpoints, explorer batches and per-item native reads through the first completed status reply; retain CPU/wall/step diagnostics, the gross hang guard and red count-based historical controls as `docs/agents/tests.md#startup-reply-byte-budgets-t-1038` describes.

For remote watchdog changes, use the executor-fake guidance in `docs/agents/tests.md#implementer-test-selection`: observe mirrored byte progress, the terminal timeout receipt and released resource; preserve the admitted stall limit across restart.

For provider deletion confirmation, use the fake-only seams in
`docs/agents/tests/hub-test-executor-deletion-confirmation.test.ts.md` and
`docs/agents/tests/hub-test-executor-deletion-watchdog.test.ts.md`. Droplet/key
DELETE success requires GET-by-id 404, including DELETE 404. Keep unconfirmed
leases and spend reservations open. Retain every discovered id across list
omissions and checkpoint accepted DELETE before its confirmation GET; failed
reads keep the original 300 s droplet bound. Use
`docs/agents/tests/hub-test-executor-recovery-collection.test.ts.md` for the
recovery-completion wake-up after a short release attempt expires. Reuse the fake's split-answer and slow-GET faults for later providers.
For reap and automatic sweep, use
`docs/agents/tests/hub-test-executor-reap-confirmation.test.ts.md`: count only
GET404-confirmed IDs, report unconfirmed IDs and retry DELETE on the next reap.
Preserve leases/spend and the existing empty result shape for older clients.
Checkpoint pending identity before mutation, retry independently of list presence
and revalidate identity/live leases after recovery under the reap lock.

For snapshot retirement and cleanup, use
`docs/agents/tests/hub-test-executor-snapshot-confirmation.test.ts.md`. Reuse
the shared confirmed deletion helper and fake split-answer fault; retain recovery
IDs through GET200 and catalogue omissions. Keep both existing prepare test files
unedited as preservation controls.

For roles-file launch refusals, fix the named key before retrying; running sessions
keep their last-good grants. Prove launch/relaunch refusal before native stop and
correction through both reader implementations at the fake-adapter seam in
`docs/agents/tests/hub-test-roles-session-refresh.test.ts.md`.

For role-clause skill inventory changes, use the production configuration and
T-1220 synchronous-filesystem guard described in
`docs/agents/tests/hub-test-session-credential-io.test.ts.md`; snapshot refresh
receipts are in `docs/agents/tests/hub-test-config-reload-component.test.ts.md`.

For `web/` changes in this repository, follow the root AGENTS.md web rule and `web/README.md`. The root check builds the ignored bundle after typechecking, including on local verification; no separate development bridge is used.

For message or notes Markdown, read `web/README.md#message-markdown` for the pure
token contract, configured item prefixes, per-message fences and raw-HTML source
guard; use the T1 parser seam named in `docs/agents/tests.md#web-phase`.

Task duration summaries count printed allowance JSON lines, which can contain
multiple identity entries; `no allowance stanzas` means no such line was printed.
Keep this distinct from T4's lack of a tier budget. See the shared task T3/T4
duration procedure in `docs/agents/tests.md`.

For Web hang-guard changes, use the fake-clock and held-child seams in
`docs/agents/tests/hub-test-web-phase.test.ts.md` and
`docs/agents/tests/hub-test-suite-runner.test.ts.md`; the Web phase procedure
defines the progress window, projection ceiling and cleanup receipts.

For missing droplet browser libraries, report to the item's lead: the human or Coordinator rebuilds the prepared snapshot after restarting the hub onto the provisioning change. See `docs/agents/tests.md#web-phase` for the root provisioning and lockfile-key boundary.

For item clients, consume hub-computed summaries and roll-ups from snapshots and deltas. The first payload contains open rows and their ancestors. Neovim reads them as `paged:true` open summary pages: accumulate every page and replay buffered task events only after the complete traversal; a reply without `next` is a complete legacy list. Fully closed containers and tasks load in bounded per-parent `task.list` summary pages; follow newly loaded containers and deduplicate retained ancestors by identity. Card-only dates/branch/relations/compact verification travel in snapshots and by-id pages; ordinary summary lists and parent pages omit these extras to protect the native first-payload budget. Closed card facts and a complete compact tree row are fetched in bounded by-id `task.list` summary pages; item links use the canonical id and parent to load and unfold missing ancestors without reading the body; fetch the body through `task.view` only when agents’ text or the criterion editor is opened; preserve the 1 MiB snapshot cap and Lua differential guard. See `hub/README.md` (summary projection) and `docs/agents/tests.md#connection-snapshots`.

For web card criterion edits, use `task.criterion` with the authenticated human and no `as` field. Keep one-line text separate from the `Ck.` id label, preserve ids and drafts, disable offline writes and never replay mutations after reconnect. Legacy criteria with null ids stay read-only until Add or a CLI write returns persisted ids; explain this in a tooltip and never guess an id. `e` is scoped to the criteria block through the shared key map. Labels, body and other item fields stay read-only in Items. Use the three Web/CLI seams in `docs/agents/tests.md#web-phase`; no protocol or role permission expansion is needed.

For explorer container cards, keep descendant verdict facts in loaded summaries and
read their reason only from existing detail cache; selecting a descendant owns its
body fetch. Use the settled-card T2 and mapped twenty-case T4 seams in
`docs/agents/tests/nvim-test-explorer-component.test.ts.md`.

For Neovim recording refreshes, follow `docs/agents/tests.md#neovim-recorded-frames`: audit every reduced slice before changing its stored expectation. The named local-only summary/decoder checks are excluded from full discovery; every selected file retains the zero-frame guard.

For early Neovim plan navigation or launcher role defaults, use the delayed
snapshot seams in `docs/agents/tests/nvim-test-plan-component.test.ts.md` and
`docs/agents/tests/nvim-test-launcher-component.test.ts.md`. Hold the initial
reads and observe the resulting view or form after release without another key.

For human marks changes, preserve the forward-only timestamp/plan-history ordering and the durable one-time import acknowledgement before removing `events.last_look` or `plan_seen` from `ui.json`. Use the real-frame and recorded-headless seams in `docs/agents/tests.md#human-marks-fixtures`; no role-clause expansion is needed for these human-only UI frames.

For human topic kinds and queued withdrawal, use the public-frame/fake-spoke seams in `docs/agents/tests.md#human-kinds-and-queued-withdrawal`. Only a human Question starts a wait; withdrawal succeeds before adapter submission and returns the text. Preserve the durable submission fence and held notes.

For web Withdraw, use the same sealed Web/public-frame seam with a busy fake session and a test-controlled idle step. Hold the receipt before asserting draft restoration; preserve newer typing and shared pending state through navigation. Prove refusal through the real hub after injection, with its tooltip reason and unchanged draft, then release the held delivery delta.

For Web Events changes, use the sealed Events/public-frame seam in `docs/agents/tests.md#web-phase`: hub-side filters on subscription and pages, local-day folds, receipt-backed shared last look, live coalescing focus and gap-free older pages. Keep Inbox summaries unfiltered even beside Events in a split. Shared key routing changes also run the Sessions launch/archive and shell files with the actual focused rail target: rail digits navigate, other rail keys retain their active area and Events row digits filter.

For open-page browser notifications, use the pure rules/text seam and sealed Web Notification/visibility/focus stubs in `docs/agents/tests.md#web-phase`. Keep the Accounts Profile switches in the shared browser store unchanged, with no palette actions; test Finished off after reload and first-enable permission through stubbed Web controls. Request permission directly from an enabling gesture, seed snapshots without replay and use pre-transition task layers. Open the Inbox list explicitly in either pane and observe exact row-id focus, including from an open palette; hold browser animation time to prove row focus follows committed DOM rather than elapsed frames; retain receipt-based suppression; keep notifications stubbed. Phone worker changes use `docs/agents/tests.md#phone-notificationstestts`: opt-in worker contexts, real root registration, stubbed showNotification, worker click/no-fetch contract and T2 edge headers; real notifications stay in QA's demo.

For Inbox drawer, reply, visit and archive changes, use the sealed Web/fake-sender seam in `docs/agents/tests.md#web-phase`. Select action rows explicitly; observe the exact departure before asserting leave/re-entry, including focus into another area while Inbox remains mounted. Keep drawer history reads separate from exact-id recovery reads, and retain the fake sender's reply receipt while split remains open. Retained approval detail identities resolve current native authorization and recovery state. Archive reads consume hub departures without replacing live rows or counts. For read-outcome races, keep the controlled reply-first and departure-first orders in `docs/agents/tests/web-test-inbox.test.ts.md`.

For Web approval cards, extend `web/src/ApprovalCard.tsx` for Inbox and drawer reuse. Use the sealed Web/native-record seam in `web/test/inbox.test.ts`: complete subjects and session facts, offered choices, optional denial notes, Escape without an answer, held delivery/failure, and the exact archived race winner. Keep TUI-only cards button-free and route reusable card keys through the shared map and shell dispatcher. The approval drawer reads bounded `session.history`; retain an exact rendered message receipt.

For spoke stdio framing, use the owned-byte-stream seam in
`docs/agents/tests/hub-test-spoke-stdio.test.ts.md`: cap each input line at
1 MiB before JSON/schema decoding, emit a JSON-RPC cap error with unknown id,
discard the oversized remainder and retain a successful next-request receipt.
No hub connection or process is needed for this boundary.

For ask outcomes, a declined ask is a decision and never consent. Human `topic.answer {ask, declined: true, reason}` requires a non-empty reason, delivers `declined: <reason>` and leaves the topic open; return the unchanged decision down the lead chain with `ask.answer`. Use the public-frame and recorded-headless decline seams in `docs/agents/tests.md`; Neovim does not initiate declines in 0.2.0.

For copied-tracker tests, copy the pinned shape corpus by default
(`docs/agents/tests/hub-test-pinned-tracker.test.ts.md`); the full live-body Lua
comparison stays at T4 and the 1,000-item scale guards stay generated. Derive
live ids from the scratch copy; name the seeding
owner beside seeded literal ids with `cland-allow-tracker-id`. Read the T0 guard
scope in `docs/agents/tests.md` when adding copies or exceptions. Keep payload
caps above measured copied-state bytes with growth headroom, alongside synthetic
fixtures.

For Neovim frame refresh admission, use the T1 capture/TAP publication seam in
`docs/agents/tests/hub-test-nvim-frame-refresh.test.ts.md`; completeness follows
successful consumer tests and nonempty captures, not historical frame counts.

For native child launches in `hub/test` and `nvim/test`, use the complete `fixtureEnvironment`
or `accountFixtureEnvironment` result after explicit owned extras. Fresh runner
children use `runnerFixtureEnvironment` to filter inherited paths while keeping
execution/admission controls. Read the T0
child-environment guard scope in `docs/agents/tests.md`; intentional seams need a
nearby `cland-allow-child-env` comment naming the sealing owner or native contract.
Run the guard's `--inventory` when reviewing exemptions. It prints no environment
values.

For executor fixtures and partial environment overlays, follow the scratch-ledger
proof in `docs/agents/tests/hub-test-suite-accounting.test.ts.md`; publish the sealed
environment after the final options spread. Registration and missing-project
sweeps use `docs/agents/tests/hub-test-executor-spend.test.ts.md`.

Periodic dev T3 and nightly soak queue/heartbeat rows and artifacts name `hub`; ordinary human shell runs keep `human` ownership (automatic chips in read-only Agents remain hub notices). Attribution uses existing occasion facts after restart, with no new wire field or role permission. Periodic dev T3 uses the admitted commit's Git objects and checks remotely at that detached head; later root commits cannot invalidate it. Bundle/delivery failures before execution retain `outcome.notRun: "infrastructure"` and publish `result: "not-run"` with the cause. They supply no green/red cover, release evidence or culprit search, and retry the next eligible tip after the interval. Provider capacity refusals at size/spend admission or acquisition use `notRun: "provider-capacity"` and retain the original cause; periodic notices say "not run: provider capacity", task results say "unavailable: provider capacity" and latest verify result is `unavailable`. No executor/region/size fallback applies. Such a receipt is missing runtime evidence, not a criterion failure or passing proof; report the blocker to the item lead. For historical or Web culprit-search changes, use `docs/agents/tests/hub-test-dev-t3-search-component.test.ts.md`. Report boundary confirmation cost: at most two extra droplet probes per failing file, or one for an absent predecessor; only the boundary pair repeats. Historical probes log skipped hosting lint and retain candidate commands in standalone detached repositories whose tracker is pinned, including allowance owners. Current local dev gets a file probe before history and after any tip movement before filing; a complete pass reports already fixed only with intervening source-change evidence. Tracker (`.cland/tasks/`), docs (`docs/`), QA briefs (`qa/briefs/`) and `hub/test/durations.json` alone report `not reproduced (intermittent)` with both red/green receipts to the Coordinator; missing history is inconclusive. Bugs retain the current tip red receipt. Report this tip-probe cost separately from the boundary pair; no integrated/stage cache is reused. Known platform exclusions remain partial evidence; use the component guidance for exact exclusion/platform comparisons and negative controls. Use the sealed bundling and fake-executor seams in `docs/agents/tests/hub-test-suite-soak-component.test.ts.md` and `docs/agents/tests/hub-test-suite-soak.test.ts.md`.

For coverage selection, pointer retention or shard merging changes, follow
`docs/agents/tests.md#coverage-ancestry-and-fallback`: prove parsed/retained map
counts and retained pointers at the loader seam, with named expiration events.

Manual selection replay uses a disposable mirror clone with sealed HOME/XDG/Git
configuration and filtered inherited credentials and Git redirects. Historical
checkouts use committed sources; maps, timings and logs stay read-only inputs
from the caller. Preserve the CLI isolation and replay assertions described in
`docs/agents/tests/hub-test-suite-selection.test.ts.md`.

An explicit `--size` override absent from the provider catalog is invalid input:
submission exits 1 with an "unavailable" error and creates no job or droplet.
Listed unavailable sizes or sizes absent from configured regions retain the
provider-capacity outcome; configured catalog absence remains a capacity refusal.
For sharded cover outcomes, use the sealed scheduler and public-notice seams in
`docs/agents/tests.md`: preserve each unexecuted shard's cause, distinguish an
entirely unexecuted group from partial execution, and retain executed results.

Shell CLI calls claiming a session require its own credential: the adapter's `CLAND_LAUNCH_TOKEN`, otherwise the private session-id-bound fallback file provisioned by its own MCP spoke reconnect. An invalid environment token never falls back. A named credential refusal calls for reconnecting that session's own spoke or `session resume --relaunch`; legacy running shells migrate on reconnect without relaunch. Relaunch rotates the credential; archive removes its private directory. The hub uses its stored role. Keep credentials out of argv, logs and artifacts. See `hub/README.md` (Task CLI trust model).

Automatic run reports and verify/executor-prepare defaults go to Agents, addressed to the Coordinator; log chips follow the report topic. Item workers keep explicit `--report <item-topic>` and Reviewer/claimant recipients. General retains Coordinator exit/vacancy recovery notices for the human.

When changing dictionary membership or prototype checks in this repository's
`hub/src`, read the T0 dictionary guard scope and exemption rules in
`docs/agents/tests.md`.

## Soak deadline accounting

Nightly soak admission calibrates worker wall projections across every selected
tier, including Web, before choosing fivefold repetitions. Its 2.17 floor comes
from A-19799; a later successful soak with completed file receipts updates the
persisted observed/projected ratio, bounded below by that floor. Dynamic time
uses only the remote run.sh start log receipt and remote native `/done` finish;
host T0, acquisition, delivery and collection are excluded. Remote setup, check
if executed, tests, repetitions and final health are included. An absent,
duplicate or invalid start marker leaves timing unknown and retains the last
valid calibration or floor; local runs do not
update it. The advisory marker is written on its own runner-log line with write
errors ignored; older logs without it stay compatible. It keeps 20%
of `run_timeout` plus 60 seconds and one second per file. Oversized bases rotate
contiguous file prefixes within every tier using durable admission cursors, with
calibrated serial costs for selected files. The selection states a conservative
cycle bound in admitted nights, omitted counts and reason; suite.log lists all
omitted files. First-file sets that cannot fit refuse before machine creation.
Skip/trim receipts persist in the Coordinator heartbeat as unexecuted coverage.
Trimmed runs neither reuse green cache nor publish full coverage maps.
Generated and inherited configuration use the same calculation on either executor.
On a local or remote timeout, `result.json` adds per-tier `execution` entries with
`unexecuted` and `incomplete` file lists. A terminal file envelope proves file
execution completed; individual completed tests do not. The report and log name
both lists, preserving completed test counts and exit 124. Topic display limits
path details per tier and names omitted counts with a log reference; result.json
and the log keep every path. Local worker progress receipts remain intact. Legacy receipts
without the optional inventory retain their previous progress representation.
See [nightly soak](../agents/tests.md#nightly-soak) for the shared procedure.
Existing role routing and permissions apply; no clause change is needed.

## Retained history and hub memory

For startup history changes, use the suite summary/by-id and recovery controls
in `docs/agents/tests/hub-test-suite-persistence.test.ts.md` and the journal's
bounded input-work/prior-selection controls in
`docs/agents/tests/hub-test-journal-subagents.test.ts.md`. Preserve legacy full
receipt storage and history replies, one in-flight journal scan per path, and
escaped or unterminated records. Keep CLI/wire shapes unchanged.

## Local verify preflight

`cland verify` (also `suite` and `--dry-run`) runs the shared hub tier/duration
and frozen test-lint admission before sending when the caller has
`hub/test/run-suite.ts`. Repair the named cause and file/line on HEAD or disk;
report-only findings remain nonblocking. Other stacks retain configured hub
checks. Preflight success is not verification evidence. See
`docs/agents/tests/hub-test-suite-preflight.test.ts.md` for the disposable CLI seam.
Existing role clauses already require these checks; no new clause is needed.

## Periodic dev T3 fresh-cover skips

Periodic dev T3 skips a due admission when a full T3 integrated dev cover passed
within the last hour at the captured tip or a descendant. The notice names its
run id and head; the attempt cursor persists across restart. Red, partial,
cached, diagnostic and subset receipts never qualify. This does not replace
an item's exact-head verification or source review. Regression guidance:
`docs/agents/tests/hub-test-suite-soak.test.ts.md`. Existing role clauses cover
the flow; no permission line is added.

## Packaging and Web prerequisite reports

`npm run test:lint` includes report-only install-shaped CLI imports and site test
dependency checks (`node hub/test/lint-prerequisites.ts --help`). Read their findings
as advisory evidence. Web runners and standalone probes report source-stamped
web/dist and resolvable node_modules before existing build/availability handling;
missing prerequisites supply no new refusal or skip during this rollout.
Use the disposable controls in docs/agents/tests/hub-test-prerequisite-guards.test.ts.md;
no local full suite or browser is needed to diagnose these reports.

## Repository auto-maintenance configuration

## Rest memory measurements (T-1478)

Use the sealed memory probe with `--rest-seconds 600` for diagnostic idle runs
and `--rest-seconds 1800` for the final record, only within a Coordinator-granted
measurement slot. The default remains startup only. Require rest-start/end,
heap/RSS/footprint samples and both worker/native disposal receipts. Missing
footprint readings remain unavailable; sampled surviving allocations are estimates,
not exact retained sizes. A guard-interrupted run is partial evidence.

For the separate synthetic load phase, add `--stream-runs 6` to the timed probe.
It uses fake executor receipts through production suite checkpoint/log/result
collection. Require all durable synthetic results and cleaned records in
streaming.json; label these slopes separately from idle. Seed after sealed-copy
preparation, never from live unfinished recovery capabilities.

## Copied memory probe suite recovery (T-1483)

## Additive interaction selection (T-1454)

Batch reports also carry optional `t3` evidence: `mode: report`, proposed files
and a reason. Importing and individually unknown T3 files are listed only when
T3 is absent from the configured batch tiers. Scan failure is unknown (`files:
null`), rather than an empty set. This projection never changes the execution
plan, exit status or admission, including with `batch_interaction = run`. Older
reports without `t3` remain readable. The summary bounds examples to ten paths;
the persisted selection retains every proposed path and fallback reason.


For cland-runner candidates, `[merge] batch_interaction = "report"` defaults to
recording proposed additions without changing configured batch tiers or Web.
Explicit `"run"` executes those additions. Existing or generated configs omitting
the key inherit report; config set/reload uses the same parser. Task-verify
widening remains active. Changing the batch default to run is a separate item
based on recorded batch lines. No role permissions or clause lines are added.

Merge batches compare pinned member heads with the
prepared candidate and follow runtime imports through helpers and re-exports.
Importing or individually unknown T2/Web graphs add those files, retaining
configured batch tiers. Only unavailable scan machinery or phase-wide read/byte
budgets add the whole affected T2/Web phase. Per-file traversal exhaustion adds
that file. Unknown batch graphs never add unrelated T3/T4. Task verifies retain test
files hidden by first-parent dev merges plus roles/area guards. Unavailable or
over-limit task history retains full T1–T4/Web through final command planning.

The graph lazily uses TypeScript's parser, separately from the legacy tokenizer.
Literal import/export, import-equals, require and dynamic-import edges are
resolved, including calls in templates and escaped literals. Non-literal module
specifiers, escaping loaders, eval/Function/vm forms, parse errors, unavailable
TypeScript and unsupported source extensions remain unknown. Bounded direct
createRequire(import.meta.url)(literal) calls and const handles used only in
direct literal calls use the same resolution; other uses remain unknown.

Built-ins are external. A bare package is external only when an ancestor
candidate package.json declares a registry dependency (including dev, optional
and peer entries). The nearest declaring ancestor wins; workspace package names,
workspace/file/link/Git/path specs and undeclared names remain unknown. Candidate
manifests use the same immutable source reader; no live node_modules proof is
used. Missing browser/runtime support still determines whether Web actually runs.

Selection reasons name importer triggers and phase fallback causes;
interactionTests lists every added file; optional batchTests masks execute the
selected T2/Web files while preserving already configured whole phases. Legacy receipts
without that optional field remain readable; cache reuse requires the same set.
Shared graph reads are bounded at 20,000 reads, 32 MiB total, 2 MiB per file and
200,000 traversals per file; each parser walk is bounded at 200,000 nodes. Task history
accepts at most 1,000 merges, scanning 1,001 to detect overflow. This adds no
pass/fail gate or role permission. New precision claims require measurement of
both direct syntax and transitive graph unknowns on a disposable source copy.

### Project package-base scanning (T-1510)

The scanner also supports const createRequire handles based on
`pathToFileURL(join(root, '<literal directories>/package.json'))`, using exact
`node:path` join and `node:url` pathToFileURL imports. Only resolve calls with
literal names or a const literal for-of list are supported for these bases.
Candidate dependencies/devDependencies/optionalDependencies prove resolve-only
registry packages; peer-only declarations do not prove installation. Dynamic,
shadowed or escaping forms remain unknown.

## Verification log provenance

Read the final `suite provenance` record when citing a hub verification log on
local or droplet. Name its head/tree, executor/platform, occasion and browser
binary/version; null means unknown or unexecuted, and cache metadata names the
original run. The version-only browser probe is not Web execution proof. Missing
skip reasons remain report-only and never alter the exit status. See
`docs/agents/tests.md#verification-log-provenance`. Existing role clauses cover
this flow; no additional permission line is needed.

## Browser fixture wall time

## Executor lifecycle interface

For executor interface work, call `prepare` with optional progress options and
`reap` with optional authorization options. Backend image keys stay inside the
backend; local operations return typed `not-applicable` results. Local startup
recovery uses `reconcile`, including fixture interception of that boundary.
Keep droplet CLI/frame output and concrete legacy overloads compatible. Use the
scripted interface checks in
`docs/agents/tests/hub-test-executor-prepare-retry.test.ts.md`; native image and
CLI evidence remains in the existing executor tests. No role clause is added.

## Coordinator droplet suite admission

`verification.coordinator_suites` defaults to 1 and limits distinct active droplet
submission keys for the stored Coordinator identity. It does not raise local
machine capacity or other roles' limits. Retries and existing executor overrides
retain their behavior, including Linux/macOS stage pairs. Remote slots, shards
and spend caps still apply. Deploy/restart before configuring a higher cap;
Implementers continue submitting one task verification at a time.

## Installed verification without the development compiler

For compiler-backed duration identity or test-lint admission, preserve the shared
lazy capability boundary in `hub/src/typescript-capability.ts`. A pruned install
refuses with a single line naming TypeScript unavailable and the unknown check.
Preserve `TypeScriptUnavailableError` through duration validation; only source
findings receive provenance and location lines at admission;
use a source install with development dependencies for verification. Missing
compiler capability is no passing evidence. Keep TypeScript dev-only and ordinary
startup compiler-free. The native installed CLI fixture is documented in
`docs/agents/tests/hub-test-suite-admission-native.test.ts.md`.

## Verifier queue retirement diagnostics

For a queued review/QA request, read its assignment/refusal notice and the single
Agents diagnostic after 1000 ms of running hub clock. Idle verifiers can retain
live work; the diagnostic names their exclusions and any retired stale pending
receipt. An unpinned request retires on a later same-kind verdict or newer accepted request.
For a pinned request, retirement requires the same commit or proven descendant;
unknown ancestry retains pending work. Wait for assignment rather than resending. For
routing changes, retain delayed acceptance, supersession and legacy provenance
controls in docs/agents/tests/hub-test-verifier-routing.test.ts.md. Keep admission
authority (including trusted human input without a sender session and owned
launch/reuse briefs and legacy launch ownership), local cross-kind compatibility,
global supersession and lifecycle
replay checkpoint isolation and maintenance during held
heartbeat warnings covered when changing that boundary. Existing role
clauses cover this flow; no permission line is added.

For queued human input and acknowledged agent reports, use the memory Sessions,
fake-harness and transport-clock seam in
`docs/agents/tests/hub-test-human-hold.test.ts.md`. Retain minute rechecks,
repeated-idle drainage, stale poll-only busy expiry and push-busy controls;
limit repeated-idle/timer replay to durable never-attempted deliveries. Attempted
unconfirmed input keeps its busy-to-idle/reconnect trigger and backoff; explicit
uncertain input stays fenced.

## macOS cover rerun reports

A single recent-green load-gate repetition failure in an integrated or occasion
macOS cover can receive one automatic advisory rerun. Keep both receipts and the
flaky-rerun finding; that advisory pass alone leaves the original cover red. The
separate filed-identity five-round receipt can excuse its assertion failures. Recent
means the last five completed covers within seven days with explicit pass evidence.
Report the executed prefix and named unexecuted tail, as described in
`docs/agents/tests.md#macos-cover-load-gate-reruns-report-mode`. Task runs are
excluded. Existing role clauses cover the flow; no permission line is added.

For an explicit Coordinator-granted used-swap waiver, pass the granted ISO end
through `--quiet-slot-until ISO`. Parent/worker enforce its load, pressure,
no-new-swap-out and expiry predicates through the shared machine checker.
Record the Coordinator's baseline/waiver and all machine receipts, and allow
copy/rest/disposal time before slot expiry. Source changes still need fresh
review before measurement. Without a grant, keep the default swap thresholds.

The quiet-slot pressure predicate uses `kern.memorystatus_vm_pressure_level <= 1`.
The transient `vm.memory_pressure` counter and free-memory percentage are context
only; retain original aborted records rather than relabeling their raw counters.

The manual memory probe defaults to the human-agreed256MiB heap/768MiB RSS
report-only limits (ask53ad10db); flags provide explicit overrides. Preserve
prior unconfigured diagnostic receipts and record the agreement with final evidence.

## Operator retry of queued input (T-1473)

`cland session retry <name> [message id]` is human-only. It forces one human
message queued over 60 seconds through busy, requiring transport acknowledgement
before native injection. Omit the id to select the oldest eligible queued or
uncertain delivery; older hubs require the id. Refusals retain the legacy
`no uncertain delivery` phrase and report recipient stage and queue age.
Preserve attempted-unconfirmed recovery and the uncertain fence.
Use the memory/fake-harness controls in
`docs/agents/tests/hub-test-human-hold.test.ts.md`; no new role clause is needed.

## Parallel-edit lists

Edit command help in `hub/src/cli/usage/<command>.ts`; `usage.ts` retains compatibility exports. Keep palette help expectations in `web/test/palette-help/<area>.json`. Add test guidance in its per-test document, then run `node hub/test/generate-test-docs-index.ts --write`; after combining branches regenerate the derived index. Index drift is report-only in T0.

Queued human input and acknowledged uninjected deliveries older than five
minutes mark a live session `deaf`. Use the fake-harness/frame and persisted
restart seams in `docs/agents/tests/hub-test-inject-stalled.test.ts.md`.
Assert one Agents notice and inbox wait, plus General for the Coordinator;
name the oldest held id and its stage: queued uses `cland session retry <name>`;
delivered uses `cland session resume <name> --relaunch`. The next injection
clears only that recipient’s wait and persists a watermark excluding stale
replays. Persist episodes across restart, outside lifecycle-journal checkpoints;
execute the displayed recovery command through the fake harness for both stages. This remains
advisory, with no new setting or role permission; retain uncertain fencing and
retry backoff. Select candidates on the coalesced session timer, never by
reading whole presence on delivery or rebuilding health from the process
inventory on inbox reads. Keep the unchanged inbox-workload guard and the
positive SQL timer receipt. Keep new launch input pinned to the launch until
the native receipt binds its session id; never snapshot a previous pool holder
as the new brief recipient. Preserve the native fresh-thread assertion in
session-native-lifecycle.test.ts. Check optional health fields against older wire shapes.

## Bridge and flush diagnostics (T-1475)

Read bridge and flush records from the process log: `bridge-stale-closed` is an
older bridge's disconnect (including generation invalidation/unwatch), classified
by the native adapter's captured disconnect receipt. Generation/shutdown
invalidations retire that owner while live; disconnect never reads storage.
`harnessId`/`pid` are captured at connect.
For `flushed`, cite `sent`, `held` and `heldReasons`; legacy `count` is pending
candidates, and a transport send proves neither ack nor native injection.
Older rows missing the new fields remain unknown. Use the memory/log and
retained-row compatibility controls in
`docs/agents/tests/hub-test-human-hold.test.ts.md`. These report facts only and
change no delivery policy, command or role permission.

## Portable test socket paths (T-1500)

Explicit test-owned Unix listeners and matching client lookups use
`fixtureSocketPath` from `shared/fixture-sockets.ts` (the test-support path remains
a compatibility export), keyed by disposable root
and endpoint. Actual nodes live in private directories under disposable roots, reached through
short symlink aliases. Both directory owners recover reciprocal root-owned alias
records after positive native drainage, including killed allocating workers;
recovery verifies targets and unlinks aliases without a global sweep. Hub teardown
attempts every resource and directory, preserving all errors; only live-writer
guards retain their root and socket directory. Keep the Node-only helper outside
wire/browser barrels and verify static import boundaries plus the web build. Keep native close/drain barriers.
See `docs/agents/tests/hub-test-fixture-socket-path.test.ts.md` for the deep TMPDIR
native bind control. Production-selected paths remain production coverage.

## Pinned verifier builds

Pinned coverage keeps earlier covering receipts when later work is unrelated.
Background checks page indexed receipts and persist cursors/results, including
delayed delivery and restart; do not replace them with a latest-only summary.

Unavailable ancestry is queued separately from forward coverage scans: it must
not hide later exact proof or become a durable negative when Git objects are
missing. Keep bounded retry pages and recovery controls in the routing fixture.

## Merge queue landing reports

Finished suite results retry failed delivery with exponential backoff (five seconds
to five minutes), retaining a run-bound immutable finalized log and coverage
registration. Publication remains serialized for shared legacy log paths.
The hub logs `suite-report-failed` with the run id and error for each failed attempt;
heartbeat rows include the actual report-attempt error, with later inspection
failures as secondary diagnostics. Generic historical errors stay unclassified.
A required result addressed to a role held solely
by its sender reaches that sender. Ordinary role broadcasts exclude their sender.
The running hub needs a restart to apply this behaviour to existing pending jobs.

With the merge queue enabled, read the item-topic landing report for the landed
commit and batch. It goes to the enqueuing session and pre-closure claimant;
the earlier green batch suite report alone is not a landing receipt. Follow-up
failures remain separately reported. Existing role clauses cover this flow.

## Standing duration allowance owners (T-1504)

Use a category or an epic directly under a category (such as E-880) for duration
allowances. `test:tiers` refuses delivery epics and tasks with the key, source
location and a standing-owner suggestion. Generated stanzas use the same rule.
Keep seconds, dates and reasons when re-owning. Existing E-880 entries remain
valid; no role clause or permission change is needed.

## Scratch admission children (T-1525)

When testing admission against a disposable hub, use `fixtureEnvironment` with
explicit owned discovery and lease inputs. `runnerFixtureEnvironment` preserves
crew session identity for original pre-fixture admission and real suite workers;
it is unsuitable for redirecting that identity to an unrelated scratch hub.
Keep a synthetic sentinel positive control; see
`docs/agents/tests/hub-test-cover-quiet.test.ts.md`. No role clause changes apply.

## Memory budget interval reporting

For memory probe reports, use the existing comparison and sealed-worker seams in
`docs/agents/tests/hub-test-measure-memory.test.ts.md`. Preserve report-only endpoint
limits, print the policy line, and label observed interval maxima as sampled facts
from readiness through rest (including selected streaming). Startup/shutdown are
excluded; partial outcomes retain observed maxima without a completed endpoint.
Existing role clauses cover this diagnostic; no permission line is added.

## Build guard tier coverage (T-1505)

When adding build or prebuild guards, keep a verify-tier entry or eager runtime
import from an existing tier wrapper. Read the report-only build guard inventory
in `test:static`; resolve orphan findings or record the reason in the item.
Opaque/computed shell or script-hidden subprocess chains require manual review;
no finding changes exit status. See
`docs/agents/tests/hub-test-build-guard-tiers.test.ts.md`. Existing role clauses
cover this flow; no permission line is added.

## Declining an accepted verifier request (T-1494)

Reviewer and QA use `verification.decline` with `request` set to the delivered
`msg_id` and `reason` set to one nonempty line. The hub checks the caller's durable
session and exact accepted receipt, clears that pending reservation immediately,
and durably returns the reason and request id to the original requester's session
in the request topic. Missing agent identity or incomplete captured-ID delivery
admission refuses and retains pending; retry after identity recovery. Human
requests receive the notice in their topic. It records
no verdict and does not requeue the declined request; the requester decides the
next assignment. Other queued requests can use the released capacity immediately.
A stale id cannot release newer work, even on the same item or head. Existing
tracker holds remain separate: release an acquired hold with `task.hold` too.
Requests without a captured message receipt cannot be declined by guessing prose.

Verifier sessions must be relaunched after this tool lands: tools are fixed at
launch. Inherited roles with explicit tool lists must grant `verification.decline`
to Reviewer/QA; generated defaults include it. Older hubs refuse the new tool
without changing pending state; do not substitute a verdict to clear it.

For mode, first-user or reset work, use the seams in
`docs/agents/tests/hub-test-auth-mode.test.ts.md` and
`docs/agents/tests/hub-test-users.test.ts.md`. Register synchronous durable invite
and pairing revocation through `store.users.onReset`; native drainage precedes
that transaction. Keep the retained first user and single-mode compatibility.
Recovery from a stopped hub with a hand-edited single config restores users mode
in config, starts the hub, then uses `cland auth reset`; never edit SQLite offline.

### Waiting suite tickets

Compatibility and machine wait queues use FIFO tickets. New tickets record the
native process birth as well as the legacy PID/start-time fields. Ticket age is
not an expiry. One joined batch of native PID probes consumes the remaining guarded inspection
deadline; late evidence preserves tickets and reports inspection incomplete.
A matching native birth retains a live waiter across wall-clock
corrections; an unavailable native probe retains unknown ownership. Tickets from
older runners keep the legacy start-time check. Older observers still use that
legacy check, so this protection requires the updated runner/observer.

A sweeper records its PID and removal reason before removing a ticket whose PID
is live but whose native birth differs. Dead-PID removals are logged without
retaining a receipt for a process that cannot consume it. A waiter whose ticket
vanishes exits 75 with `suite infrastructure:` and the removal receipt. The
package owner also writes the optional `CLAND_SUITE_CAUSE_FILE` channel supplied
by its worker or droplet launcher; test children do not inherit that channel.
Workers and summaries take infrastructure causes from this receipt and the
recorded outcome, never from matching test-output lines in suite.log. Sharded
summaries and incomplete-execution reports inspect the recorded child outcomes
before adding shard labels; they do not parse the aggregate display cause. An older
delivered runner without the channel keeps its exit status with no recorded
cause; a newer runner without the environment variable retains its diagnostic
and exit. The droplet launcher comes from the hosting hub, so its receipt
handling changes take effect after that hub restarts on the updated source. External
deletion or an older sweeper has no receipt and is explicitly labelled unknown.
Updated local workers and droplet collectors classify this reserved exit plus
its recorded cause as infrastructure unavailable; completed test receipts remain in
the log. A passed shard beside infrastructure loss keeps the parent's incomplete
infrastructure disposition, including restored child receipts; a genuine test
failure keeps a failed aggregate. Reports retain completed counts without claiming
that no tests executed. Other exit-75 commands keep their ordinary outcome. Droplets retain one
bounded cause file at completion, before the done marker; status reads that file
without rescanning the log. Existing remote runs without it remain compatible.

Both local and uploaded status readers use the same bounded reader: at most
4096payload bytes plus one oversize sentinel, then close the descriptor. An
oversized or unreadable receipt reports unknown cause metadata with a secondary
diagnostic and retains the selected exit; receipt-close failure retains a cause
already read. Worker compatibility cleanup also retains a selected command's
exit and infrastructure classification. Failures before outcome selection still
produce their own failure. The uploaded status reader comes from the hosting
hub source and takes effect after restart, like the outer runner script.

Without a done marker, the uploaded process-group probe reports disappearance
only on ESRCH. EPERM and other probe errors report unknown without a terminal
outcome; observation continues within the existing run and machine deadlines.
This reader change requires restarting the hosting hub on the updated source.

Inspection summary and callback publication are independent ancillary effects:
both are attempted and the callback is joined. Publication failure retains the
selected command exit/cause and adds a secondary error-class diagnostic. A
rejected command with failed publication carries its original failure and typed
inspection receipt to the worker for durable recovery; signal handlers are
removed on every finalization path.

Suite/shard duration lines currently use wall-clock differences. They can include
clock corrections and must not be equated to native test duration or provider
lifetime. T-1576's evidence reconciles the historical clock correction separately.
