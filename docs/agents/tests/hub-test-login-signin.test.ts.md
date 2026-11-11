# hub/test/login-signin.test.ts

T1: in-memory SQLite, injected Host/provider boundaries and FakeClock. Cases
prove exact public sign-in commands, the production source logout prohibition,
failed terminal outcomes retaining detached signed-out disks, and creating
isolation through unmount, snapshot and detach receipts. No native process,
socket, real clock wait or external login runs.

Run `node --test hub/test/login-signin.test.ts` with supported Node 24. CLI and
native fake SSH evidence live in login-add.test.ts; hub connection authority
is covered by login-add-component.test.ts.

`sign-in records volume and snapshot lifetime receipts in the admitted pool` asserts exact receipts using useClock(FakeClock), confirmed snapshot deletion time, next-month pruning and refusal of a changed clock.
