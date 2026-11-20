# hub/test/typecheck.test.ts

T3 runs the actual root/workspace typecheck scripts in a disposable minimal hub
source tree, an inherited worktree install and a worktree-local install. It
copies every shipped tsconfig plus the committed owned-exec.mjs input required
by the JS gate compiler check. The real compiler/alias version and API checks
are unchanged; missing input never becomes a tolerated compiler failure.

The callback owns its original asynchronous copy/setup and root before acquiring
fixtures, with distinct setup/check bounds. Synchronous native Git/npm calls
retain their native deadlines and return only after child exit. The fixture
uses the shared sealed environment and read-only pinned dependency links.
