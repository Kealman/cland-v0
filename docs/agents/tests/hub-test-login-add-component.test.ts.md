# hub/test/login-add-component.test.ts

T2 `projectHub`, with FakeClock and both fake lock process facts. The injected
sign-in runner keeps native provider and terminal processes outside this seam.

- `login add disconnect settles only its admitted connection`
- `login add failure settles only its admitted connection`
- `login add success settles only its admitted connection`
- `login add preparation failure reaches CLI without a terminal plan`
- `dispatcher shutdown joins every login closer and still closes the suite owner after failure`

The tests retain a creating row while admitted, refuse completion from a second
connection, and wait for the persisted terminal state. A failed or disconnected
attempt retains disk identity and no bindings. Run with supported Node 24 and
inherited `CLAND_*` stripped. Native disk receipts are covered by login-add and
login-disk T3, not inferred from these injected cases.

The shutdown control injects two distinct cleanup failures, holds the second
owner, and requires both errors plus the suite owner's close receipt after
drainage. The direct in-process dispatcher keeps this test below native tiers.
