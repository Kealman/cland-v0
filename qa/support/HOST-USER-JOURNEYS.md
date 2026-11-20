# Host and user QA journeys

These four native cases use disposable projects, the directory-backed host
provider, fake harnesses, CLI-started hubs and isolated workbenches. They never
open the human's workbench or accounts. HOSTS-004 starts the fake DigitalOcean
API and asserts that doctor makes no provider request with its token absent.

Run from the item worktree with supported Node 24 and installed dependencies.
Obtain the native slot from the Coordinator first; run one case at a time below
a 1-minute load of 12. The wrapper refuses higher starting load, captures only
scanned output outside the worktree, waits for native close and calls the shipped
`qa-record.sh note` for every outcome. Give retries new run ids; retain failures.

```sh
node qa/support/run-host-user-journey.ts T-1868 native-1 HOSTS-001
node qa/support/run-host-user-journey.ts T-1868 native-2 HOSTS-002
node qa/support/run-host-user-journey.ts T-1868 native-3 HOSTS-003
node qa/support/run-host-user-journey.ts T-1868 native-4 HOSTS-004
node qa/support/run-host-user-journey.ts T-1868 native-5 HOSTS-005
```

HOSTS-001 connects Headless Shell and pinned headless Neovim to the same hub,
launches sessions on two fake hosts and observes the Hosts list and outage.
HOSTS-002 starts with a real login wait in the Neovim inbox, adds a login in the
web Hosts view, reads it through the CLI and observes the resulting native
session and its host in Neovim. Sign-in can reuse a ready host, so a transient
boot reason is not required. It then stops the session and its host (disk logins
remain host-bound after a session stops) and removes the login
through the web view, checking the CLI inventory again.
HOSTS-003 runs one scripted terminal through users mode and the agent-host login
step on a prepared fake pool with no initial login. Enter skips the passkey wait;
the expected setup exit is 1 with an explicit open sign-in row. It asserts the
first user and ready login. It does not exercise paid pool creation or real
passkey registration. The new DigitalOcean pool and first-login transport is
tracked as T-2019 (Coordinator decision for this item's scope). HOSTS-004 checks
the combined doctor faults and fixes.

Every journey entry uses `ownedJourney` before acquisition. It enrolls the
complete original callback with `caseDeadlines`, bounds initial setup separately
from behaviour, adopts its roots, and uses the shared fenced normal/signal
cleanup. Late acquisitions and continuations join before resource hooks; roots
and scripted seams remain retained when closure is incomplete. The daemon's
stopped receipt resolves only after its PID is observed reaped.

HOSTS-005 is failure-path coverage, separate from the four DoD journeys. It
aborts a held setup that acquires a late native listener, checks the next step
is fenced, and exercises actual guarded root removal after native close. A
setup rejection plus rejected resource close keeps both root and seam fenced
until repaired close. A third control opens a real relay, forwards bytes,
injects a tick rejection and joins its socket/server close receipts while
preserving the tick cause. Relay shutdown independently attempts every close,
including resources acquired before the last tick settles; failures retain the
primary producer outcome and secondary cleanup diagnostics.

Invite-bearing terminal output stays in memory until complete lines are redacted.
A planted credential must fail the unchanged publication policy; actual captured
invite values are checked against sanitized output and CLI/config captures.
No screenshots, traces, HOME, account files or raw invite output are exported.
Publish recorded evidence through the QA kit's `publishSessionEvidence` helper;
it adds the final snapshot scan and positive control before artifact creation.
