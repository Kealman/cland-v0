# hub/test/merge-recovery.test.ts

T-1855 uses mock native timers and a held prune promise to prove that
`TaskMerges.stop()` cancels future retries and joins one already running. Both
normal completion and the 35-second shutdown deadline are checked; the latter
returns typed `incomplete` with the same pending settlement and logs
`merge-cleanup-stop-incomplete` with the responsible item. Mixed failed/held
writers and throwing sinks cannot abandon the join. The actual embedded
Dispatcher/daemon shutdown path keeps open databases, discovery and lock until
positive settlement, including an early assertion failure. Independent resource
owners release/join the writer before fixture storage closes. These component
cases require no native process or wall-clock delay. Native cancellation after
process exit remains the accepted T-1856 limitation.

T-542: At the T2 merge policy seam, inject Git landing facts and use a scratch node_modules sentinel. Prove package-lock changes appear in the landing result and durable item comment without modifying the shared install. Recovery retains the same landed commit facts.

T-1251: Inject before/after manifest blobs at the landed commit and its parent. Scripts-only changes omit the install requirement from the result, durable comment and Agents lifecycle notice, including a resumed landing. Dependency changes retain it. The fixture copies candidate manifest blobs into its squash commit; no real Git or installer runs.
