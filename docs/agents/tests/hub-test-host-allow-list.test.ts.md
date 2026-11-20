# hub/test/host-allow-list.test.ts

`hub/test/host-allow-list.test.ts` is T3 because native Git commits refs after its update hook and the Unix git socket must fence that boundary. Fixtures use scratch HOME/Git configuration and fake host ids only. Native receive-pack advertisement proves lock admission; native close and listener drainage precede the successful revoke. The reverse ordering holds the territory lock, checks a retryable push refusal and completes a real fetch while that lock stays held. Native batch preparation checks the pinned commit's bytes and empty lease list; immediate merge checks every host lease was removed. Hub startup replaces a previous update hook in a prepared scratch project.

Run this file and host-git-daemon.test.ts one at a time. Keep territory-cli.test.ts, territory-lock.test.ts, merge.test.ts and task-worktrees.test.ts unedited as preservation controls. No browser, SSH, network provider or live territory participates.

T-1655 retains the immediate-merge case in T3: actual Git landing and the
post-revocation Unix-socket push refusal require native processes. Setup creates
and claims the task through the existing UI socket, and merge uses that same
socket, eliminating three CLI startups while retaining both task commits and
the merge, empty lease-list and rejected-push assertions. There are no fixed
sleeps in this case. Five sequential local macOS arm64 / Node 24.21.0 samples
were 7.094415250, 10.224062250, 7.622794334, 11.128183542 and 12.983251958 seconds
(setup, assertions and cleanup included; worker startup excluded). Starting
1-minute loads were 6.15, 7.54, 8.43, 9.12 and 9.48, with no synthetic load.
The full-file invocation also passed all 12 cases, with this case taking
14.373569250 seconds at starting load 11.08. The original case took 5.901331417
seconds at load 6.38; these different-load samples do not demonstrate a speedup.
A dated 10.017-second allowance uses 1.5 times the worst quiet/historical sample,
6.678 seconds (A-16171); the item's other historical macOS sample is 5.117
seconds. The Coordinator excluded concurrent-crew samples above from sizing:
they describe the busy shared machine, and three exceed this allowance.
Quiet stage-cover passing receipts for this exact generated identity are macOS
A-22176 at 9fcfec3 (4.535180167 seconds), A-22175 at 47da58e (4.493004375),
A-22174 at fb3d9f0 (3.905565375), and Linux A-22170 at b4fec06 (3.674780904),
A-22142 at f62df55 (4.468913434). These covers precede this change and are sizing
evidence, not new-head verification. Native coverage remains in place.
The ticket-era 5-second report budget remains report-only; the T3 enforce-mode
default is 10 seconds. Historical timing baselines are preserved, so report-mode
regression notices can still appear despite the allowance.

The stalled-receive case injects a 500 ms receive ownership cap and asserts that the production default constant is 30 seconds. It waits for native advertisement, then native close and listener drainage before proving a fresh grant can acquire the released fence. The cap starts only after lock acquisition; it excludes lock contention and acquisition probes. Setup and native-exit observation have separate bounds; native timers continue running.

The held-release regression pauses only the receive owner's asynchronous removal of its exact `territory.lock`, observes client completion, then observes the contender reading that held record before releasing the owner. It proves public revoke joins native ownership rather than treating client exit as release. Independent-holder tests inject a short revoke deadline and retain refusal/list assertions; the re-entrant case calls public revoke inside the existing lock and proves another grant stays excluded. The fixture uses its own mkdtemp root for every repetition.

Contention asserts `TerritoryBusy` and the single documented refusal for immediate
grant/revoke, a bounded revoke wait and a positive sub-millisecond wait that
rounds to the current timestamp (no holder probe). Immediate refusals name the
observed PID; deadline exhaustion names it when known.

T-1702 receive contention: a push observes an independent held operation, releases it, and proves the exact published tip. A raw receive request with a 500 ms injected acquisition bound holds the operation through the named refusal and asserts no early refusal. The reverse revoke case injects a 100 ms acquisition bound; its fence, refusal and concurrent fetch assertions remain. Production acquisition defaults to 30 seconds separately from the native stalled-push cap.
