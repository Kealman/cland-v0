# hub/test/executable-path-fixture.test.ts

T2 filesystem-only held-work control for the exact pathFixture owner used by
executable-path.test.ts. Run `node --test hub/test/executable-path-fixture.test.ts`.
No native process, harness, Git or network call is made.

Arm the held-step receipt before starting the sequence, request close while its
filesystem write is held, observe the retained root, then release the write.
Final assertions require the admitted write to settle, the next write admission
to stay fenced and root removal to follow the complete join. Cleanup fences the
owner and releases the hold even on an early assertion failure. Removing both
sequence barriers reproduces the old gap and fails the control; restoring the
shared fixtureWork close and removal guard makes it green.
