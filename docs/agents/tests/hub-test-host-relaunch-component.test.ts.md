# hub/test/host-relaunch-component.test.ts

T2 public resume-frame admission with an in-process projectHub and harnesses.
C1 checks a different host is refused before adapter effects and same-host
relaunch keeps host and cwd. Remote-to-local relaunch is refused explicitly. Missing, wrong-generation and
negative release receipts refuse before destination effects. Existing resume
tests remain previous-wire coverage.
Run `node --test hub/test/host-relaunch-component.test.ts`.

The relaunch checkpoint inherits the fixture's territory lock. A positively
controlled native launch guard covers each case through cleanup; generation
refusal assertions still check that the destination receives no operations.
This file remains T2; native worktree lifecycle proof belongs to T3.
