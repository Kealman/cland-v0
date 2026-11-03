# T-1659: supervised fixture ownership

The fixture registered its supervisor (a non-group-leader) and harnesses, but
never the supervised host agents. Targeted cleanup therefore stopped the
supervisor while its agent survived, later reparented to init.

The test now captures agent PID/native birth with ownProcess at each authenticated
hello, including the replacement. Closing supervisors first stops and joins every restart owner and starter
sharing the root, then snapshots remaining root writers and joins agent ownership
and the snapshot. This covers setup failure before an authenticated hello as well.
All roots survive until the post-file cwd census; its assertion precedes safety
cleanup and directory deletion. Filesystem absence is asserted after removal.
process-cleanup.ts and production contracts are unchanged.

## Before-fix positive control

macOS, local, Node v24.21.0; working tree with only retained-root census changes,
base dev `8c9f569cf77719706bd02fb43b829b55c66b77f1`. Command:
`node --test hub/test/host-supervisor.test.ts`.
Existing cases passed in 1716, 496, 829 ms. Post-file hook failed with
`post-file fixture process census: supervised writers survived teardown`:

| PID | Parent | Native identity |
| --- | --- | --- |
| 50706 | 1 | darwin:1793742762:763020 |
| 51689 | 1 | darwin:1793742763:684296 |
| 51945 | 1 | darwin:1793742763:972807 |

Each command was this worktree's `cland.ts host serve`. The assertion's finally
joined these captured writers before deleting roots, so the control leaked none.

## Fixture audit

Searches covered `createFakeHost`, `supervisor`, `host serve`, `agent.pid`,
`serveAgent`, and cleanup call sites across hub/test, including T3/T4.

- host-supervisor.test.ts: fixed initial/replacement agent capture, failed-setup
  capture and join, post-file census.
- fakes/fake-host.ts: creates directories/identity files only, starts no process.
  kill-agent authenticates endpoint and checks native identity before signalling.
- fake-ssh.test.ts: detached launches registered through ownProcess and joined
  through bounded native close; no supervised host agents are launched.
- transport-ssh.test.ts: real supervisor; existing ownDirectory.beforeRemove
  captures fixtureProcessCensus(root) and joins cleanupOwnedProcesses after
  carrier stop, while root remains. This covers supervisor and agents together.
- ssh-host-fixture.ts and remote-discovery-host.test.ts: in-process serveAgent,
  stub supervisor, stop/close resources, capture and join cwd census, assert empty
  before root deletion. remote-discovery.test.ts is pure T1; CLI discovery uses
  scratch hub fixtures rather than supervised host agents.
- transport-forwards.test.ts and transport-contract-fixture.ts: in-process agents,
  no-op/check-only supervisor; explicit server/carrier close precedes deletion.
- host-agent.test.ts: in-process agents close explicitly; CLI agents are direct
  ChildProcess handles with close observers armed at launch, kill/close joined
  in finally (including restart); harness ownership is separately joined.
- host-prepared.test.ts: direct CLI launches recorded by ownProcess immediately,
  native close joined through fixture cleanup; no supervising shell.
- host-ssh-registry.test.ts, host-records.test.ts, fixture-socket-path.test.ts:
  directory-only fake hosts or stub transport, no native host agent launch.

## Evidence

First fixed targeted run: 3/3 pass, empty post-file census; 1842, 872, 1092 ms
per case, 4589 ms file elapsed. macOS local, Node v24.21.0, no browser, no full
suite, no load-gate coverage. Hub TypeScript check passed. Budget policy remains
report mode. C2 five load repetitions and long UUID TMPDIR are pending the
Coordinator's quiet-machine notice; no claim of C2 coverage is made here.

Final pre-review targeted tree: 3/3 pass, empty post-file census; 1956, 881,
1083 ms; 4668 ms file elapsed. Closed-item wording lint: zero findings.

## Source-review correction (rev-35-1659-source-1)

Restored the setup-failure case title to its existing duration-manifest identity.
The new held-teardown regression ran red against the pre-stop snapshot: the
assertion `replacement started during teardown is joined` found PID 14036,
parent 1, native birth darwin:1793743165:2127 (2214 ms, macOS local Node 24.21.0).
Safety cleanup joined it. Registry teardown now joins all supervisors/starters
sharing the root before its final census, so another owner's live restart loop
cannot race agent cleanup. The new case withholds recordAgent on the replacement
and observes its hello/native birth before releasing owner shutdown.

First corrected file run: 4/4 pass; 1853, 686, 994, 2055 ms, empty post-file
census; file 6491 ms. This is targeted local macOS evidence, not configured
verification or C2 load coverage. Emergency post-file cleanup also stops/joins
restart owners before disposing captured survivors and roots.
