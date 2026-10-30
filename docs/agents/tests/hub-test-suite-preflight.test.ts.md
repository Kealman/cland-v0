# hub/test/suite-preflight.test.ts

Run `node --test hub/test/suite-preflight.test.ts` alone. T3 owns native Git
commits and reads; each test uses a disposable `tempProject` root and the shared
`fixtureEnvironment` after overlays, with scratch HOME/XDG/Git configuration and
provider variables filtered. No daemon, worker, browser or suite is launched.

The CLI seam plants tier/duration errors, new and displaced lifecycle headers,
and forbidden process use, then asserts the cause and file/line before hub
discovery. Without a discovery file no queue entry can be created. A committed
bad header remains refused after disk repair. A skip-reason diagnostic proceeds
to discovery, proving it remains nonblocking. Existing prior-hub wire coverage
stays in `hub/test/suite-admission.test.ts`; no frame changes are introduced.

Git uses the existing `commandIn` owner with final sealed environment and explicit
exit assertions; its cancellation receipts are covered by
`hub/test/init-machine-lifecycle.test.ts`. Committed unsorted tier and stale
duration fixtures repair disk before submission and assert exact original
manifest line plus HEAD identity. Shared admission diagnostics read that rejected
source, not the subsequently repaired worktree.
