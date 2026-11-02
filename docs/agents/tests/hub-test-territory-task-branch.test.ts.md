# hub/test/territory-task-branch.test.ts

T3 native Git refs and linked worktree receipts, using preparedProject and
fixtureEnvironment (scratchGitEnvironment isolation). No real provider or harness.
The local baseline was captured and passed before production changes: root branch,
tip, literal item path and exact journal record. An item launch regression captures the Host admitted by Sessions rather than
the worktree service default, using an in-process fake harness.
The recording Host observes the
territory ref and territory-lock exclusion before delegating native add.
Divergent root/territory dev controls prove local root-tip preservation and
nonlocal territory-tip selection (Coordinator amendment to A-15078 on T-1555).
Existing territory commits, root-only branches, add failure and prune controls
assert durable Git refs and worktree HEADs. Prune retains advanced territory refs.
Run this file individually; stop fixture owners before disposable-root removal.
Keep task-worktrees, task-worktrees-lifecycle, territory-cli and worktree-cli
unedited as preservation controls. worktree-host's held branch observer targets
the root command explicitly because creation now also issues a territory command.

Held native publication controls create competing ancestor/equal refs before the
push and assert their tip and provenance remain unchanged. An empty lease alone
is insufficient for Git's equal-tip up-to-date response: require a new-ref receipt.
A held Host fetch-close notification allows an unrelated fetch to overwrite
FETCH_HEAD, then asserts both the task ref and worktree HEAD use the admitted
source tip. Release holds and join operations before restoring native mocks or
removing fixture roots. Both controls failed before the review fixes.
