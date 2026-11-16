# hub/test/host-prepared.test.ts

T3: deadline cleanup observes removal of the exact newly created log and then
asserts it; abort preserves an existing log. Restart-reader coverage uses durable
interrupted log and worktree plans in a scratch root, proving cleanup before
admission. A separate native CLI-agent case prepares both operations, kills its observed
launch, restarts it and checks cleanup after the new durable readiness receipt.
The shared fixture census rejects surviving `cland host serve` children.
Git commands use the shared sealed fixture environment. Teardown closes prepared
work and drains the process owner before fixture removal.

The deterministic ps/birth race uses the process owner's native completion
receipt before releasing the second observation. Its pre-fix receipt returned
false with `{identity:null,ended:true}`; the final assertion still requires true.
An independent captured native owner joins the child on cancellation before
storage removal. T1 host-stop-observation keeps the missing-birth negative case.
Replacement/dirty checkout tests preserve the tree, report incomplete cleanup,
and retry only after the fixture explicitly resolves its own replacement/data.

A failed preparation keeps a fresh native fixture writer alive while close is
asserted incomplete; the fixture independently joins that observed PID before
removal. Disconnect-abort failure also refuses second-connection writes and
commands, then permits cleanup recovery after the fixture resolves its dirty
checkout. No missing receipt is counted as successful cleanup.

Commit inspection, abort removal and restart removal inject an incomplete native
Git result while a separately observed writer remains live. Each case asserts
one launch, a durable `git-running` plan, pending settlement, mutation refusal and
incomplete close, then loads that plan through a fresh owner and asserts no
retry. The fixture joins every captured writer independently before root removal.
The runner hook is at the native command boundary and otherwise executes real
scratch Git commands.

Failed-add coverage accepts Git's native "already checked out" and "already
used by worktree" diagnostics for a branch owned by another checkout. It still
requires the add to reject and its reserved directory to be removed; replacement
and restart assertions are unchanged.

Interrupted publish/append commit checkpoints remain fenced after restart when
no durable result exists. Settlement checks the captured recovery owner, keeps
the plan and effect bytes, reports pending, and never replays append.

`completed append retains ownership when its durable result cannot be written`
removes the empty result directory after the native append completes and before
the sole result writer starts. The commit must reject with `ENOENT` while the
effect stays written once, mutation remains fenced, settlement stays pending
and the durable plan stays `committing`. This filesystem fault is independent
of the checkpoint's unique temporary filename; no active writer is removed.

T-1704 restart readiness observation: `agent.pid` records native identity before
watch startup and authenticated admission. The native restart case first matches
that receipt to its observed child, then waits with a setup bound for an
authenticated hello from that exact PID. Only the read-only handshake is retried;
prepared requests are issued once. Log/worktree existence before the kill and
ENOENT after restart remain required.

The deterministic `prepared restart observation waits through identity publication
before agent admission` case holds watch startup after the identity checkpoint.
It observes a real refused hello, releases startup, then requires an authenticated
hello and a successful identity request. The original one-shot observation fails
with `agent closed` at that boundary. This fixes test observation; production
continues to publish identity before admission. The real native restart scenario
still covers unfinished spawn and worktree cleanup across SIGKILL.

For stage QA, run this file under the preservation lock in a disposable archive
with `fixtureEnvironment(root, base, overlays)`. Record the exact source head,
platform/Node version and per-child test pass/fail counts. Loaded macOS evidence
requires ten complete file receipts with one-minute host load sampled throughout
each child's lifetime at 12–20; Linux evidence requires five complete file
receipts in a named `docker run --init` container. Keep macOS burners and Docker
batches sequential, stop stress after 30 seconds above 20, and label incomplete
or out-of-range children explicitly. Native preservation companions are
`host-agent-restart.test.ts`, `host-agent.test.ts`, `host-reboot-native.test.ts`
and `host-relaunch-native.test.ts`. None of these targeted receipts substitutes
for the reviewed-head verification run.

The held-startup and native-restart outer timeouts are setup watchdogs. They are
derived from the same `testWaitMs` values as the observations: the held-startup
case includes both watch observations, one hello observation and two fixed 10 s
request allowances; the native case includes two identity and two hello
observations plus seven fixed 10 s request allowances (five preparation/Git
requests and the final hello attempt on each launch). Both add 30 s for fixture
and cleanup work. Defaults are 90 s and 140 s respectively; setting
`CLAND_TEST_WAIT_MS` scales every configurable term in those envelopes. These
watchdogs are distinct from behavior assertions and measured test durations.
