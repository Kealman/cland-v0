# hub/test/host-local-contract.test.ts

`node --test hub/test/host-local-contract.test.ts` registers the reusable
`hostContract(factory, register, expected?)` suite in `hub/test/host-contract.ts`. This T3 scenario
uses native disposable Node processes and `fixtureEnvironment`, with no hub,
provider, remote login or transport. Check disk space before each local run.

Cases cover short-command cwd/environment/output/exit, detached spawn with
native session and group isolation, native identity, liveness, legacy timestamp
compatibility, rejected mismatched-birth stops, and complete tree termination.
On Darwin the session-id assertion uses Perl's SYS_getsid (310); ps masks session
pointers. Linux uses ps's session-id column. Readiness files bound setup separately
from the behavior assertions; stop observes native termination before root removal.

The resource case keeps a parent and child alive, touches 16 MiB, and performs
10 ms of child CPU work per 100 ms until a bounded native sample arrives. RSS is
reported in bytes and CPU as the sum of ps percentages over each tree, including
its root. The percentages are OS samples, not a cland measurement interval.
The test does not measure machine capacity, launch admission or remote behavior.

Keep `process-identity.test.ts`, `system-processes.test.ts` and
`session-async-processes.test.ts` unedited as behavior-preservation controls.

The executable wrapper supplies `(name, run) => test(name, run)` as the registrar.
This keeps Node test locations and load-gate exact-name replay on the `.test.ts`
entry point. Passing `test` directly attributes tests to the helper and makes
replay execute an inert module. Check attribution with the production
`load-gate-reporter.ts`: all six passing receipts must name the wrapper.

File/worktree cases additionally check directory identity and exact cwd refusals,
symlink realpath and missing fallback, binary bytes and missing/directory refusal,
sorted recursive files and symlink rejection, a scratch Git branch/worktree,
root dependency sharing, stale warnings, dirty removal and alias containment.
All Git operations use the fixture environment. No provider or login is used.

The T1 guard in host-contract-coverage.test.ts parses the Host interface and
contract member accesses, including a synthetic uncovered-member positive control.
It detects missing member exercises; reviewers still check assertion quality.

The local wrapper supplies expected name and polling policy. Other Hosts may
supply their own expectations; byte comparisons accept any Uint8Array.
Containment and path fallback are shared with TaskWorktrees; its inode and
live-session revalidation remain in the pruning owner.
