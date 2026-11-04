# T-1607 host Claude state-path registration

Verification 5b2e6bb5 at c7452c701 failed the unchanged state-path inventory
assertion on direct command.env.HOME and env.HOME reads in agent/claude.ts.
Coordinator 6a316bf5 classified this as T-1607's defect, not a shared defect.
The same targeted assertion reproduced both findings before the fix.

hostClaudeConfigDirectory now owns that unchanged precedence in state-paths.ts:
command CLAUDE_CONFIG_DIR, otherwise command HOME then agent HOME/.claude.
The resolver accepts both host environments explicitly and never reads the hub's
environment. Exact HOME expressions are registered with their host-agent owner
and account/login/job-record reason. The agent's real-directory, UID and 0700
precondition remains in place. A pure precedence control supplements the
unchanged inventory guard. No wire contract, discovery, stop or credential
mechanism changes; the agent launch is the only new resolver consumer.

The failed run completed T0 and a failing T1; T2/T3/T4/Web and load repetitions
were not executed. Its Linux c-8 lifetime was 254 seconds, cost $0.0177 (A-16474).
Fresh source review is required before verification of this correction.
