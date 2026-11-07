# hub/test/claude-code-remote.test.ts

The aggregate file allowance is 90 seconds, owned by C-216 from 2026-11-04
through 2026-11-11. Coordinator decision 8f8a0401 uses Linux x64 samples
58.659 seconds (A-16511) and 60.959 seconds (A-16517). Two case identities
exceed the decision's four-second split threshold, so the cases stay together.
That dated file allowance itself changes no individual allowance or fixture
assertion. T-1678's approved stop/fixture migrations are described below; its
new native identities have dated C-216 per-test allowances in durations.json.

T3 uses the fake SSH carrier and scripted Claude, with an in-process projectHub. It exercises generation-pinned worker adoption, delivery through the forwarded host sockets, pushed hook/mod states, four injected poll intervals with completed Host liveness receipts and no additional Claude commands, private credential file modes/scans, and confirmed stop. The shared SSH fixture and fake Claude owner independently join native writers before root removal and require an empty process census. Socket paths retain the shared 104-byte bound. An older agent capability control refuses before native command admission. No real SSH, network service or Claude login is used.

Native adverse controls use the same scripted Claude: a final TERM-resistant SessionEnd hook is captured before KILL; an asynchronous hook across root exit stays unowned and live until independent fixture cleanup; agent restart proves the serialized adopted marker grants no dynamic acquisition. A shutdown injected after startup and adoption joins rollback, scans both host/fake homes and generation folders, and retains a sibling job. A bounded setup observer arms before each signal. Timers for adapter poll intervals are injectable; wall-clock dates stay real throughout.

The hub restart control closes the process tree while retaining the account job,
restarts the embedded hub, then observes the durable retired row after re-adopt
and native cleanup. It checks removed job/agent records and scans host, fake
account and generation roots. The happy control repeats release to prove a no-op.

A real frame reply-loss control drops remove-claude after its persisted effect.
The failed stop retains private settings; retry releases idempotently without
repeating native stop, then scans all declared roots clean. This optional shared
SSH fixture fault defaults off for all existing callers.

Combined lost-release/restart and lost-forget/restart controls verify durable
recovery and no repeated native stop or Host stop. Terminal receipts and hub
private-deletion checkpoints carry no token; final forget removes the receipt
only after private-directory absence. Revoke/remove integration is T-1666.

The held-recovery-checkpoint control creates an asynchronous native SessionEnd
hook after the old tree snapshot, observes root absence and keeps the unknown
writer live: prepare-stop must not return settled, release refuses, and private
settings remain. It independently joins the unowned hook before disposal.
Frame-level terminal controls observe cleanup before exit, and native stop/query
failure with a held running row, role and credential copies. Four subsequent
injected intervals run no further Claude commands. Dates remain real.

A native startup-hook producer arms a filesystem observer before capture. The
Host's beforeSignal seam then releases one new child and observes its PID/birth
after prepare-stop but before commit. This was red with the same identity
refusal as the release-loss anomaly. The current stop signals the pinned root
and converges on the child births; the admitted operation is not replayed. A
SessionEnd receipt lets the owned short-lived child finish naturally.

Setup snapshots that worker group's transient cland-hook writers after the
turn-complete marker and joins positive native exit/replacement receipts for
their captured births, excluding the persistent bridge. The setup has its own
deadline and final assertion. A separate native pinned-hook control exits its
approved member between prepare and commit and requires one successful stop,
with no manual re-stop. The asynchronous SessionEnd control gates its first
post-TERM census on a positive root-exit receipt; async alone is not that
precondition. A held-root diagnostic control reproduced the old array-vs-null
assertion while the root remained alive (A-16506).

The companion reparented-child control keeps an orphan alive across two explicit
stops without acquiring it or losing the worker's row/role. Independent pinned
cleanup of the child then permits explicit worker stop. Temporarily disabling
the adopted-ledger guard makes the second stop incorrectly succeed, retaining a
red-capable check. The agent-restart control observes a durable pre-restart tree
capture before asserting no inherited authority for a later SessionEnd hook.

Failed-launch restart controls plant a lost accepted launch result or adoption
reply, retain the original identity/credential in pending-stop ownership, and
hold Host.stop after restart while asserting the role and private files remain.
Release permits native settlement, then role release and scans of both homes.
Missing hub state or agent receipt holds the generation as cleanup-incomplete.
An intentional missing-receipt close checks the exact fenced operation error;
the independent fixture census still joins all native writers.

A post-clear forget interruption leaves a terminal marker and acknowledgement
intent with no pending row. The next embedded-hub start prunes both with zero
adopt/stop/Claude calls. The fixture explicitly sets its role's writable roots
to the fake checkout (.) using the shipped role editor, satisfying T-1606's host
policy resolution without relying on absent default Git directories.

T-1678 adds `remote Claude root-first stop mid-turn` and `remote Claude root-first
stop completed turn`. Observers are armed before fresh topic delivery. The
mid-turn case holds the exact fresh native prompt in a synchronous hook. At the
native root-signal seam it checks that prompt's live producer birth, unchanged
completion count and unreleased gate, then makes that producer spawn a fresh
child and observes its native birth and parent before allowing TERM. SessionEnd
releases the producer and joins its child. The turn cannot finish between its
busy frame and stop admission. The completed-turn variant counts the native
completion log beyond its baseline and joins turn-end hook writers.
Both require one explicit stop, native root absence and a durable closed ledger.
The two cases are repeated under load on isolated Linux after source review;
platform-specific samples and any C-216 allowance belong to the evidence.

The unowned-orphan control keeps its writer alive independently of SessionEnd.
The beforeSignals observer proves pinned root TERM and no orphan signal.
Explicit stops refuse while it lives and after independent cleanup; row and role
stay held. A copied process ledger grants no signal or closure authority.

The fake graceful shutdown latches TERM once, starts no new turn hooks/mod posts
or queued turns, and joins managed posts in awaitSignals mode before root exit.
This models the unverified real-Claude shutdown assumption in host-agent.md.
Async SessionEnd without awaitSignals proves the adverse outcome instead.

`remote Claude exit-time orphan stays held after independent cleanup` gates the
first post-TERM census on root exit and the independent writer's native birth.
It retains row/role, proves zero signal requests to that writer, then requires
continued refusal after independent cleanup. `remote Claude orphan detached-child
escape retains unknown authority` makes that rejected orphan fork a detached
new-group writer and exit. Even with every known birth gone, stop still refuses,
never signals the escaped writer and keeps the unknown ledger and role held.
The process owner's optional beforeRemainingObservation hook supplies the fault
seam; normal callers have none. Only fixture-owned native cleanup removes these
writers. No observation-only absence fence can settle unknown authority.

`remote Claude retained hook retries after the pinned root exited` interrupts the
first stop after positive native root exit, with an already captured independent
hook still live. The second explicit stop signals that same child birth and no
root, then confirms durable closure. It proves the owner/admission path, while
the T1 scripted control separately proves a deadline-expired first stop and retry.

C3 timing adaptation (Coordinator e7e0b799/7e849c61): the synchronous
TERM-resistant SessionEnd control uses exported production CLAUDE_STOP_GRACE_MS
(3000 ms), replacing its test-only 300 ms grace/900 ms total. Its purpose stays
native-birth capture and KILL; every assertion remains unchanged. Coordinator
2a68c8dd also permits a 15 s outer Node envelope for native setup plus the 9 s
helper deadline. The asynchronous companion keeps its 300 ms grace. The outer
Node envelopes use `8 * testWaitMs() + 120000` (240 s with the default
15 s setup budget; `CLAND_TEST_WAIT_MS` overrides that budget). The 20 full-file load repetitions retained the stricter 10 s outer
envelope, as authorized evidence for the final 15 s envelope.

A-16684's x64 deadline failure was not reproduced by two five-run ARM load
batches. Buffered traces closed in 629.646–647.242 ms; the worst snapshot took
19.673 ms and identity observation 24.211 ms. No single pathological call was
observed on ARM; this does not claim a measured x64 cause. The separate owner
component expires its shared virtual stop clock and requires actual adapter
cleanup-incomplete plus the durable native row held. Production stop timing and
acquisition policy remain unchanged.

Batch setup adaptation (Coordinator a977afe9): both positive root-first cases
use the shared eventually/testWaitMs native setup bound for the initial turn's
completion receipt (default 15 s, CLAND_TEST_WAIT_MS may override), replacing an
explicit 2 s setup limit. Batch09d9af98/A-16714 repetition3 timed out before any
stop in both cases; repetitions1,2,4,5 and the base stop assertions passed. Stop
observations, held-turn gates and the production stop deadline are unchanged.
C-216 case allowances use the worst passing base or load-gate batch sample,
including the detached-child control; counts and durations remain distinct from
failed setup attempts. Five full-file Linux load runs validate this test-only
change before delta review and authorized exception enqueue.
The previous aggregate file allowance was 225 s, authorized by Coordinator 35a0544e from
the failed batch's 148.1 s file sample (1.5 times is 222.15 s). That duration
is evidence of file cost, not a passing stop result.

The lost-native-release cases also use the shared native setup budget for the
`session.measure done` receipt before arming reply loss. Their previous two-second
setup wait was shorter than a single mod hook post's 15-second subprocess
deadline. The fault injection, stop deadlines and cleanup assertions are unchanged.

T-1690 applies that shared setup budget to the remaining carrier readiness,
worker startup, initial turn, initial live-tree capture and startup-producer
receipts, plus both startup-hook native birth/exit joins. Outer Node envelopes use `8 * testWaitMs() + 120000` (240 s by default). Stop, settlement, post-signal and
fresh-turn behaviour deadlines and all assertions remain unchanged.

T-1692 measured 316 s as the current aggregate file allowance: ceil(1.5 times
its worst passing full-file sum of top-level case durations), owned by C-216
through 2026-11-11. The selected cap retains any higher existing allowance.
Five macOS full-file runs passed; Linux had four full passes and a fifth25/26,
exit1, with only the lost-native-release case excluded by Coordinator decision
under T-1697 (A-16915). All other25 cases passed all five Linux repetitions.
Per-case allowances use the completed eligible samples on both platforms; they
remain report-only and do not alter setup or behaviour deadlines.

T-1722 adds a CLI-started hub control: its production registry builds the fake
host layout without injected configuration. A disposable Git territory backs
the item launch; scripted Claude must report running and its exact job log
must contain the mod bridge acknowledgment through the host tunnel. The
CLI-started hub process and fixture-owned agent/workers are joined before root
removal. This proves installed plugin selection, not delivery to real hosts.

## Pre-spawn account-root refusal

The generated cases `remote Claude pre-spawn root refusal permits immediate same-name launch`
and `remote Claude pre-spawn root refusal permits immediate different-name launch` use the
existing fake SSH agent and scripted Claude, with a disposable account root changed to
0755. Each observes the actual 0700 fence, zero native --bg calls, fixes the root,
and immediately launches through the UI frame seam. The positive receipt is the
new worker's pinned birth in processes.json; stop and fixture cleanup join writers.
Run with `node --test --test-name-pattern='pre-spawn root refusal' hub/test/claude-code-remote.test.ts`.
Use the stage preservation lock and load ceiling for this native file. No real Claude,
DigitalOcean resources or browser are involved. The failed-launch restart result and
missing-receipt cases, plus remote-files untyped-lookalike controls, retain unknown
outcome supervision and old-wire compatibility.

## Native no-process outcomes

The `remote Claude native aborted`, `spawn-error` and `lost-reply` cases each
have `same-name retry` and `different-name retry` variants. Aborted uses a
cancel-run frame armed before native execution; spawn-error names a missing
executable. Both prove zero native background calls and subsequent persisted
worker birth, and no pending-stop owner. The lost-reply fixture drops the
accepted transport result with a typed incomplete transport fault after native
worker persistence; both retries remain fenced with their existing messages.
The four `native command admission receipt` cases separately exercise already
aborted, synchronous throw, no-PID error and an actual failed native PID. Run
with `--test-name-pattern='remote Claude native|native command admission receipt'`
in the same native file, under the preservation lock. No real provider is used.

The `pre-wire` variants abort the hub-side signal before wire() and prove both
names recover. `sent-abort` corks the server reply after worker persistence,
then aborts and disconnects while the result is unavailable; both names remain
fenced. Cork readiness uses a bounded observable setup receipt. Native abort cases send cancel-run while an awaitable runStarted fixture
hook holds native admission. The hook releases only after positively observing
its captured signal.aborted, with a testWaitMs-bounded wait, so native run entry
cannot race the later cancel frame. The one-shot hold is absent from retries.

The missing-executable path deliberately contains `cleanup incomplete`: typed
no-process proof must outrank those incidental diagnostic words when prepared
results are persisted. Untyped and truly incomplete controls stay fenced.
