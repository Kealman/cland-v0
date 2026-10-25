# hub/test/suite-soak-component.test.ts

Periodic bundling uses `suiteUnit` with a disposable native Git repository and
`fixtureEnvironment` (scratch HOME/XDG/Git and credential filtering). Advance
root source HEAD at the delivery boundary, then call the real `runBundle` using
the scheduler's delivery policy. Fetch the resulting bundle into a scratch bare
repository and assert the captured commit and file contents, followed by the
fake executor's start and completion receipts. No real hub process or provider
is needed. `caseDeadlines` bounds setup and behaviour separately.

Public reporting uses `remote-fixture`'s scripted provider and in-process hub:
inject a delivery failure, drain verification I/O and observe the exact durable
`verification-dev-t3-result` message. Assert its infrastructure headline, additive
`notRun`/`cause` fields, no executed start and no culprit-search result.

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
