# hub/test/doctor.test.ts

`doctor.test.ts` exercises the public report in process with injected tool replies
and a scratch `projectHub`. `toolchain` builds its environment through
`fixtureEnvironment`; pass that environment to `runDoctor`. The project hub
status request and native lock probe use the same explicit environment, including
deliberate session credentials. Normal CLI calls default to `process.env`.

`doctor uses its fixture environment rather than the parent crew session` sets
six synthetic outer-session variables, observes the scratch hub's successful
report, and checks that the parent stays unchanged. Passing that synthetic
identity explicitly must still produce the credential refusal. The original
three failing cases remain in the file. Reverting environment forwarding makes
the regression and those cases fail in a crew session.

The T0 child-environment guard includes the historical doctor `execFile` launch
with a parent-environment spread as a rejected compiler control. It runs in
memory without starting a child. Keep this control even though the report
matrix now runs in process; real doctor CLI lifecycle coverage remains in
`doctor-cli.test.ts`.

Run `node --test hub/test/doctor.test.ts` for the component receipt and
`node hub/test/lint-child-environment.ts` for the inheritance guard. No browser
or installed web bundle is needed for this component matrix.
