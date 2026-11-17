# hub/test/login-list.test.ts

The recovered one-sign-in hint case checks all three surfaces using the same
clock: General card, Agents notice and CLI list. loginMetadataOwners registers
its dependency-ordered hub/borrowed-Store join before acquisition and guards root
removal. The before-hub and hub-drain fault cases retain the root until a positive
fixture close, keeping the borrowed Store open whenever hub closure is unconfirmed.
Each fault callback and the held-stop callback enrolls the shared `fixtureWork`
owner before acquisition. It adopts late roots and resource owners, fences new
steps on cancellation, releases registered holds and joins the callback before
removing its outer root. Fault cases attempt actual guarded removal of an inner
fixture root while hub closure remains unconfirmed, check the root and Store are
retained, then recover and observe successful disposal. The held-stop case checks
hub-before-Store ordering and observes root removal after the callback owner joins.

T2, projectHub with FakeClock and fake lock process facts for both hub and droplet startup. `login list text and JSON expose rows and hosts, retained across hub restart` proves C3/C6 plus help and argument validation. Rows are seeded through the public metadata store. It awaits hub.stop before reopening and compares the full list including bindings. `login frames retain session and remote refusals with selective web authority` proves session/gateway refusals and selective web admission through dispatcher edges and an authenticated session actor on the CLI socket. No browser, native host, harness login or external network is needed. Stage QA can run both files; no local native lifecycle files changed.

Run: `node --test hub/test/login-list.test.ts`. Full task evidence uses mode-free `cland verify` after source review.
