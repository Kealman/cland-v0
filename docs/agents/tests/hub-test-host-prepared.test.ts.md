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
