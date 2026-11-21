# hub/test/merge-batch-dependencies.test.ts

T3 native Git seam for batch linked worktrees and periodic diagnostic shared
clones. Every root is allocated with mkdtemp, registered immediately with
ownDirectory, and uses fixtureEnvironment for Git (scratch HOME and Git config,
no inherited credentials). No hub process, installer or browser starts.

The npm enqueue cases run a real local npm script in a linked checkout through
the production command supervisor and guarded candidate removal. Success,
script exit 1 and request cancellation remove HOME and every XDG directory.
The incomplete case substitutes a deferred closure receipt after the real child
closes, proves guarded removal refuses while the HOME sentinel remains, then
releases the receipt and observes removal. A stray checkout write positively
proves Git still refuses unclean removal. npm uses its default HOME-relative
cache; the script creates account sentinels without network or install work.
The success case reproduced Git exit 128 before the environment-root fix.
The native cases enroll a stageCase positive-close resource fence before root
acquisition. Teardown releases the deferred closure even if its native receipt
arrives after teardown starts, joins the original command and retained metadata
continuation, then permits root removal. The rejected-assertion case deliberately
fails before releasing closure, invokes the real fixture cleanup owner, asserts
the retained join in the directory's beforeRemove callback, and observes the
root's removal afterward. Candidate head/tree setup has its own named deadline.

Seed two tiny dependency packages and matching lock receipts in the disposable
root: @modelcontextprotocol/sdk and playwright-core. Check candidate realpaths
and Playwright resolution from web/test, repeat checkout at the persisted head,
then remove through each production owner. Assert the checkout is gone and both
root package sentinels remain readable. The batch removal invokes
removeWorktreeWithFixtures; clone removal uses the same writer barrier before
recursive removal. No real root install is read or changed.

Commit `.cland/tasks/T-1.md` and `.cland/RULES.md` in the fixture and assert the
full Git tree differs from the shared committed verification tree. Admit the
verification tree, then repeat checkout and guarded removal. This catches an
ownership inspector incorrectly comparing the full tree to the admitted tree.
The shared caseDeadlines owner enrolls before acquisition, adopts the root before
setup continues, bounds setup separately, and joins the original sequence before
cleanup. Native checkout, repeated ownership inspection, removal and final
filesystem receipts have named bounds; rejected cleanup retains ownership.

Run with supported Node via node --test hub/test/merge-batch-dependencies.test.ts,
with inherited CLAND_* removed. This is filesystem/process evidence on the local
platform, not Web browser execution or full batch-suite coverage.
