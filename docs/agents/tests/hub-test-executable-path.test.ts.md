# hub/test/executable-path.test.ts

T3 native PATH conformance: requires the preservation slot and runs one file at
a time. `node --test hub/test/executable-path.test.ts` compares scratch executable
selection against execFile for absolute, empty, relative and unset PATH. HOME,
XDG and Git configuration use fixtureEnvironment. No real gh, Git, harness,
network, credential or droplet call is made. The unset-PATH case uses system sh
and plants a cwd shadow to distinguish default search from empty PATH.

The second case preserves absolute-PATH behavior for doctor installation, setup
machine/handover, the OpenCode prerequisite and the owned maintenance command
runner with a fake git. Both full setup/native sequences use shared fixtureWork;
the pathFixture adapter is shared with the deterministic T2 held-work control in
executable-path-fixture.test.ts.
its beforeDirectories close fences every subsequent FS/native step and joins
the admitted continuation before removal. Root acquisition is inside that owner;
late roots are registered before another step, and a removal guard retains them
if the bounded sequence join fails. execFile callbacks and maintenance completion
join native writers. Diagnostics retain argv,
cwd, native completion and bounded fixture output. Release doctor coverage is
in doctor.test.ts, including an older status shape.
