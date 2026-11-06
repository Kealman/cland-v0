# hub/test/host-allow-list.test.ts

`hub/test/host-allow-list.test.ts` is T3 because native Git commits refs after its update hook and the Unix git socket must fence that boundary. Fixtures use scratch HOME/Git configuration and fake host ids only. Native receive-pack advertisement proves lock admission; native close and listener drainage precede the successful revoke. The reverse ordering holds the territory lock, checks a retryable push refusal and completes a real fetch while that lock stays held. Native batch preparation checks the pinned commit's bytes and empty lease list; immediate merge checks every host lease was removed. Hub startup replaces a previous update hook in a prepared scratch project.

Run this file and host-git-daemon.test.ts one at a time. Keep territory-cli.test.ts, territory-lock.test.ts, merge.test.ts and task-worktrees.test.ts unedited as preservation controls. No browser, SSH, network provider or live territory participates.

The stalled-receive case injects a 500 ms receive ownership cap and asserts that the production default constant is 30 seconds. It waits for native advertisement, then native close and listener drainage before proving a fresh grant can acquire the released fence. The cap starts only after lock acquisition; it excludes lock contention and acquisition probes. Setup and native-exit observation have separate bounds; native timers continue running.

The held-release regression pauses only the receive owner's asynchronous removal of its exact `territory.lock`, observes client completion, then observes the contender reading that held record before releasing the owner. It proves public revoke joins native ownership rather than treating client exit as release. Independent-holder tests inject a short revoke deadline and retain refusal/list assertions; the re-entrant case calls public revoke inside the existing lock and proves another grant stays excluded. The fixture uses its own mkdtemp root for every repetition.

Contention asserts `TerritoryBusy` and the single documented refusal for immediate
grant/revoke, a bounded revoke wait and a positive sub-millisecond wait that
rounds to the current timestamp (no holder probe). Immediate refusals name the
observed PID; deadline exhaustion names it when known.

T-1702 receive contention: a push observes an independent held operation, releases it, and proves the exact published tip. A raw receive request with a 500 ms injected acquisition bound holds the operation through the named refusal and asserts no early refusal. The reverse revoke case injects a 100 ms acquisition bound; its fence, refusal and concurrent fetch assertions remain. Production acquisition defaults to 30 seconds separately from the native stalled-push cap.
