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
