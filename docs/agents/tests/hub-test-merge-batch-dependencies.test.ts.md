# hub/test/merge-batch-dependencies.test.ts

T3 native Git seam for batch linked worktrees and periodic diagnostic shared
clones. Every root is allocated with mkdtemp, registered immediately with
ownDirectory, and uses fixtureEnvironment for Git (scratch HOME and Git config,
no inherited credentials). No hub process, installer or browser starts.

Seed two tiny dependency packages and matching lock receipts in the disposable
root: @modelcontextprotocol/sdk and playwright-core. Check candidate realpaths
and Playwright resolution from web/test, repeat checkout at the persisted head,
then remove through each production owner. Assert the checkout is gone and both
root package sentinels remain readable. The batch removal invokes
removeWorktreeWithFixtures; clone removal uses the same writer barrier before
recursive removal. No real root install is read or changed.

Run with supported Node via node --test hub/test/merge-batch-dependencies.test.ts,
with inherited CLAND_* removed. This is filesystem/process evidence on the local
platform, not Web browser execution or full batch-suite coverage.
