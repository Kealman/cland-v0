# web/test/phone-sessions.test.ts

`web/test/phone-sessions.test.ts` uses the sealed 390×844 touch/mobile
`webFixture` and Headless Shell. Fake Codex sessions exercise public adapter
signals (including the optional command on `waitingForApproval`), source usage
and public launch/queue frames; all CLI reads target that fixture's scratch hub.
It checks the four header counts, registry-ordered account cells on one row,
worst-window/missing readings, two-line rows without visible actions, group
folds and a cell tap into read-only Accounts. The shared queue opens in a modal
full-height sheet, with Close and physical Escape restoring summary focus.
The session page retains the complete waiting command, model, account and
usage, while both Back paths restore the exact row focus, including after Stop
moves the selected row into a saved folded Stopped
group: the test observes the expanded group and focused row for both Back paths.
Stop and Archive confirm in place, cancellation leaves the page open, and scratch CLI receipts
prove their persisted outcomes; all four lifecycle/capability controls and
confirmation buttons meet 44 px. No live hub, real harness or GUI browser runs.
The file ensures a current web bundle before running; it needs no prebuilt
`web/dist`. Run phone*.test.ts, sessions.test.ts, session-actions.test.ts,
session-launch.test.ts, accounts.test.ts and key-contexts.test.ts targeted.
After any resize, observe `data-phone` before measuring. New passing Web
identities reaching four seconds need a dated E-880 allowance with the run and
about 1.5× its worst passing sample.

`phone session page names a remote host and omits the local host` launches fake
Codex sessions on a registered `testHost` and `local`, taps each actual row and
reads its page. The remote page shows the host id with its tooltip; the local
page omits that fact. Directory admission is synthetic, and native host operations
refuse. The test uses no provider or external network.
