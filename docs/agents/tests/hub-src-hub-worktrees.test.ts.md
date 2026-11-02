# hub/src/hub/worktrees.test.ts

T3 colocated worktree/claim race controls use a real tracker and disposable Git
territories. Their seven local Sessions doubles explicitly admit placement with
validateLaunchHost before the launch callbacks exercise the original race.
Keep all original claim, stop, reservation and prune assertions unchanged.
Host admission itself is exercised through real Sessions/frame fixtures in
hub/test/session-host-placement.test.ts; these doubles do not copy that policy.

For a standalone run, launch the test process with fixtureEnvironment from the
shared test-support module so HOME, XDG, Git config and account/provider variables
are isolated. Wait for the native test process close receipt before removing its
disposable runner root. The suite runner already owns that outer environment.
