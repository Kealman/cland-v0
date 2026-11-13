# hub/test/login-card-signin.test.ts

T3: projectHub, fake pool provider, native fake SSH/agent and the existing fake
Claude/Codex binaries. The host-create fixture's optional `cardSignIn` argument
installs exact-path launchers for the existing fake TypeScript modules. Each
launcher passes the rotating-login opt-in and mounted account paths as explicit
third-argument overlays to fixtureEnvironment, then execs with the same PID.
The shared scratchAccountEnvironment restores only a validated owned OpenCode
database path, matching fake SSH's existing account-path pattern. It
also connects the two test messengers; other fixture callers keep their existing
environment and adapter configuration. All date readers remain real. No real
provider, volume, credential, sign-in endpoint or browser is used.

Generated cases:

- `native Claude card creates and renews one disk across both remotes with deletion`
- `native Claude card creates and renews one disk across both remotes with one fallback`
- `native Codex card completes device sign-in without an answer`
- `native cancelled Claude card closes its admitted writer before failed disk completion`

Claude creation starts with no host. The real card/default Host operation creates
one pool host and disk, receives the fake link, writes a secret input and observes
ready plus exactly one snapshot. Renewal marks that disk dead, starts through the
other messenger and checks the same host/volume and a distinct native admission.
Both messengers observe the exact answered code-card event; deletion or a single
fallback is observed on the captured sender. Native receipts are read by their
captured admission and validated with the production parser. A planted positive
control precedes the final bounded, no-symlink scan of fixture files and mirrored
frames for the pasted sentinel. No secret is printed or passed in argv.

Codex delivers the exact fake link and device code, commits ready/one snapshot
and withdraws the code card without an answer. Cancellation reads the exact
admission's durable native close before accepting signed-out plus a detached,
kept volume. The fifteen-minute clock and held-close visibility/ownership split
are proven separately by the T2 owner case; no real fifteen-minute wait or fixed
date is introduced in this native fixture.

An observer calls real preparePoolLogin unchanged and wraps only the prepared
Host operation for diagnostics before start. It records bounded output in memory
and observes its actual close, including before any prompt. It redacts each full
bounded stream before taking a 3000-character tail; missing close stays explicitly
incomplete. The native test reporter secret-scans the entire selected publication
(trace, receipt metadata, hub-log tail and login states) before emitting it, and
withholds the entire diagnostic on a scan refusal. The observer itself has no QA
skill dependency, so the Web compiler-input closure can include it without pulling
skill files into linked compiler fixtures. The operation, output bytes, input and
native ownership are forwarded unchanged.

Setup observations use `eventually`/`testWaitMs`. Missing receipts fail explicitly;
test-producer termination is never substituted for the native operation receipt.
The host-create fixture joins hub, watchdogs, transports and native census before
storage/root disposal. Run under the release's native preservation slot, one file
at a time, with inherited `CLAND_*` stripped and a between-file stop file. Allowances
for measured cases at or above the platform threshold must accompany the final
head; do not transfer another case's timing baseline.

Local targeted runs provide partial evidence; final directed native evidence
names its committed head. Actual receipts and failed attempts stay in the item
evidence. Component parsing/refusal/recovery controls
are in the owner/remote/recovery guides. Full T3 is the merge-queue batch and T4
belongs to the stage/epic occasion.
