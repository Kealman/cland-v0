# hub/test/suite-soak-component.test.ts

T-1996 keeps the ancestry case in T2: the production `suiteCandidate.isAncestor`
uses a scripted `execFile` custom promisifier for positive, reverse and missing
Git receipts. No repository is initialized and no native Git runs. The shared
`fixtureNativeGuard` positively controls every native launch boundary and remains
installed through fixture cleanup. `suiteCase` owns the whole callback before
guard/root acquisition and fences each ancestry step. Fenced cleanup restores
the fake and then the guard only after successful resource/directory cleanup;
failed cleanup retains the patches. The callback boundary still reaches that
guard. The case previously used native Git while labelled T2; those receipts
do not establish fake-only coverage. The old native identity's timing is removed
from the duration manifest rather than assigned to the renamed fake case.
No T3 migration or T3 proof reuse occurs.

Coverage publication records the producer's timestamp before writing the map.
Advance the fake clock after publication and compare the durable pointer with
that recorded time, so asynchronous assertion scheduling cannot change it.

The fake periodic deadline publishes a durable Agents result with
`result: "inconclusive"`, a timeout headline and missing/incomplete T2, T3 and
Web tiers. The controlled fake clock expires the hub's admitted owner deadline;
no planted native exit is treated as authority and no culprit search is created.
The callback uses the fenced whole-case owner, including its fixture proxy.
Single-worker reporting fixtures explicitly configure `shards=1`.

Region-capacity probes name every configured region and the local-switch
suggestion in the retained cause. The structured `provider-capacity` outcome
still controls refusal: retain unavailable/not-run, no local fallback, no red
headline or culprit search, no worker/provider create and no cover assertions.
Explicit-size validation retains its separate configured-regions diagnostic.

Periodic and soak native bundle proofs live in the T3
[bundle contract](hub-test-suite-bundle-native.test.ts.md). Their earlier T2
receipts supply no T3 coverage after migration.

Public reporting uses `suiteCase` with its pre-acquisition whole-caller owner,
adopted root, fenced steps and positive native launch guard through cleanup,
with `remote-fixture`'s scripted provider and in-process hub:
inject a delivery failure, drain verification I/O and observe the exact durable
`verification-dev-t3-result` or `verification-soak-result` message. Assert the
infrastructure unavailable headline and retained cause, no executed start, no
incident cover and no culprit-search result. Periodic detail retains its existing
`notRun`/`cause` fields; soak uses the existing suite outcome in status.

Consumer inventory for the no-cover infrastructure outcome (T-1015): `Suites`
cover history and `suite.classify`; `hub.status --history` dispatch; the CLI's
cover count/display; `suite-cover.test.ts` and `suite-protocol.test.ts` executed
cover-count fixtures; and the historical E-468 QA brief's cover guidance. Web,
Neovim, QA waits and startup probes have no cover-row count observers. Executed
cover rows and their ten-row bound remain unchanged; a new not-run receipt stays
in suite history with `outcome.notRun` and supplies no incident cover. The new
component assertion checks both the retained suite row and absence of a cover.

For provider capacity, mark the scripted provider's offered regions unavailable
before acquisition, leaving size/price facts valid for admission. Also exercise
unavailable and absent configured size rows: their typed admission refusal must
reach the same durable report rather than the generic periodic skipped notice.
An explicit size override absent from the catalog instead refuses submission,
with no suite job or provider resource. Observe the
durable periodic result message and task result message/JSON/status, for both
default and explicit droplet selection, each with and without `--size`.
Negative admission controls keep invalid price, provider auth, spend-cap and
malformed-slug refusals separate; they create no suite or provider resource. Assert the original refusal, no red or
exit-failure headline, latest task verify `result: "unavailable"`, no delivery or
start and no provider mutation. No real provider resources are needed.

Unavailable-result consumer inventory (T-1144): `Suites.latest` feeds tracker full
and compact verify projections, CLI task view, Web `ItemCard` (prints result), and
Neovim `explorer_card` (explicit unavailable label). `eventRow` projects journal
suite-result and verification-timing rows. Historical suite status and result
JSON retain `code`/`cause` with additive `notRun`; periodic result detail retains
baseline/range/artifact fields. No row membership or count contract changes.

Periodic and nightly green publication share the scripted coverage-map seam:
observe the completed result, then read persisted log/map artifacts and chips
through public frames. Require creator `hub`, creatorKind `agent` (the existing
artifact schema) and chip sender/fromKind `hub`. Human shell suite.start frames
omit `as`: assert human queue rows and artifact ownership in General and Agents.
General chips stay human; read-only Agents keeps automatic hub report chips.
Setup and execution/completion publication have separate `caseDeadlines` bounds.

Deadline fixtures use scripted machines only. The repetition fixture reserves an
eight-minute run in an eighteen-minute lifetime with the calibration floor.
The rotation fixture admits one of two T4 files per night, observes the persisted
cursor and omitted log line, reopens the scratch store, and admits the other file
on the same tree the next day. FakeClock.block advances the date before reopen;
it avoids replaying a day's periodic timers. A zero exit without file envelopes
cannot update calibration; a terminal file receipt plus the remote start marker
can. The rotation case enrolls caseDeadlines with the shared pre-acquisition
cleanup owner, adopts the acquired root, and admits every asynchronous step
through that owner so caller FS/reopen continuations settle before disposal.
