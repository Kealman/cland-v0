# hub/test/doctor.test.ts

Remote discovery uses an owned fake Unix transport: forbidden result,
unauthorized handshake and a previous error-only result. Refusals retain the JSON
check shape, name the refusal and give credential/host guidance without printing
credentials. Disposing the fake before probing proves the no-listener path still
names tunnel repair. No real host or provider is contacted.
Both new cases use caseDeadlines with shared normal/signal ownership before
acquisition, adopt the root and fence/join every setup/body step before cleanup.
The task CLI regression proves forbidden replies preserve refusal text rather
than entering the OS transport error.code branch; refusal metadata is separate.

Release-tool regressions use a fake command rejection (ENOENT), executable
placeholders that cannot run, and scratch in-process hubs with a different PATH
from the caller. They cover missing/present gh, disabled web_bundle, offline
lookup and a literal previous hub.status reply without releaseTools. No real
gh/auth/network call is made. Ordinary status requests retain the old shape.
The release lookup also covers empty and relative PATH entries from the release
root, even when the hub process cwd differs. Shared native PATH conformance and
absolute-PATH consumer regressions live in executable-path.test.ts (T3).

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
