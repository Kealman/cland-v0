# hub/test/permissions.test.ts

The T2 session-list regression runs the actual CLI with an Implementer shell's
stable session id/name against a scratch `projectHub`, using in-process adapters
and the shared sealed HOME/XDG/Git/account fixture. A human test client creates
one fake launched session. Plain and JSON lists must return it; launch, stop,
resume, archive and prune from the same shell must retain their typed refusals.
The adapter spawn count stays one, and audit receipts retain CLI attribution.
No real harness or hub daemon is required.

`hub/test/roles-launch-permissions.test.ts` proves the independent named read
through the public permission parser/decision seam at T1 for built-in, shipped
and project grants, including all roles, a roleless caller and restricted lists.
`hub/test/cli-identity.test.ts` retains its T3 real-process lifecycle scenario;
its Implementer list now succeeds while mutation and hub-stop refusals stay.

Run the touched files individually with `node --test <path>` after cover-quiet
admission permits them. Source review precedes mode-free task verification.
