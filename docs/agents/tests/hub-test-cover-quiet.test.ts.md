# hub/test/cover-quiet.test.ts

T3 native process/CLI lifecycle checks use disposable projects and Unix sockets.
Run `node --test hub/test/cover-quiet.test.ts` alone, subject to cover admission.
No browser or external provider is involved. The first comment block retains the
file's lifecycle justification.

The sentinel test first runs the original runner environment with synthetic
NAME/ID/ROLE/LAUNCH_TOKEN values against a scratch socket. Its observed suite.slot
actor is the positive control. The target launcher then uses fixtureEnvironment
with explicit scratch discovery and lease inputs, and checks all four inherited
identity fields are absent. A completed admission frame with no actor is the
final socket receipt. Child resource drainage precedes the sentinel beforeDirectories phase. Acquisition
and native listener/accepted-socket closure have separate five-second bounds;
a root-removal guard retains storage when closure is incomplete. Omitted,
aborted and listening setup controls assert the owner drained after fixture
cleanup.
No real crew credentials are copied into the sentinel environment.

Other cases retain integrated cover refusal, inherited lease/human exemption,
legacy/closed-hub refusal, nested lifecycle workers and durable worker completion
proof. The borrowed-lease child also runs from a disposable directory. Real
suite workers retain runnerFixtureEnvironment for original pre-fixture admission;
T-1525's tracker comment inventories all consumers and their isolation reasons.
