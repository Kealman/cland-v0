# hub/test/claude-stop.test.ts

T1 scripts the public Claude stop owner's census, births, UID and clock. Natural
SessionEnd closure, TERM-resistant escalation, root exit, reparenting and foreign
UID controls retain checkpoint-before-signal and no-foreign-signal assertions.
Unknown births get exactly one re-read. No native process or timer runs.

T-1678 replaces the old fixed recapture-budget controls with root-first TERM,
successive new births, settled exits and unstable-deadline convergence. Two empty
captures confirm closure. A new child can be acquired through a pinned live
parent after root exit; an unproved orphan, foreign UID, old census PID or changed
root cannot grant new authority. The real harness lifecycle remains covered in
claude-code-remote.test.ts.

Retained-hook retry covers positive root exit and birth replacement with exact
pinned child authority. It signals only that child; an unknown root birth still
refuses without signals. The test uses an injected clock and no native process.
The two-attempt control first expires its injected stop deadline with a pinned
hook retained after root exit, then joins that same birth on a fresh explicit
stop. The native companion covers the AgentProcesses admission path.
The replaced-root helper control includes the live replacement in its original
group through closure; it never omits that row to make retry pass. The T2 owner
companion covers reconciliation and admission with the same boundary.
