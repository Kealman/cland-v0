# web/test/smoke.test.ts

This Web smoke uses the production web edge and isolated pinned Headless Shell,
with disposable in-process `projectHub` roots and the shared sealed HOME/XDG/Git
and child environment. Build the web bundle before a standalone run. Real browser
contexts are needed to prove the one-time sign-in cookie, strict CSP, origin-only
requests, context isolation and Playwright trace ZIP output.

The T-1083 regression plants one failure in each of two `webFixture` instances in
the same worker. Both failures must reject with their planted error, report their
own exact trace path in diagnostics and leave distinct ZIP files. Read the first
ZIP before triggering the second failure, then compare its bytes afterwards to
prove it was retained; check both ZIP signatures and both browsers' empty context
lists. The test removes the two trace files only after these assertions.

The second fixture's browser and scratch hub live through its planted failure,
then close explicitly; the shared cleanup remains registered for assertion
failures. Both fixture teardowns observe the browser exit, reaped PID and empty
process-group census, stop the scratch hub and observe refused socket access
before fixture roots are removed. The parent retains its explicit disconnected
browser and zero process-exit assertions. Two real browser lifecycles are needed
here because the regression concerns trace output shared by separate fixtures,
rather than two contexts from a single fixture.
