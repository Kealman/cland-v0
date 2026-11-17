# hub/test/secrets.test.ts

The provider callback and held-work control use secretSequence, backed by the
shared fixtureWork owner. Register before acquisition; capture roots and late
resources before the next step. Removal joins the whole callback and resource
settlement. The held writer's release/join is registered before admission;
its late resource must close and its next step must be fenced before removal.

The provider-store case sends a synthetic token to the secret command via stdin,
starts a sealed projectHub without a provider variable, and checks the existing
local-human host.providers presence/fingerprint shape. No provider is called.
It also observes the actual host-registry environment: membership restored there
must reach `hostEnvironment`, and runtime membership written through that fixture
view must reach the registry. This catches a stale launch-input copy at T2.

`hub/test/secrets.test.ts` is T2. `projectHub` supplies the startup completion
receipt before mode assertions and proves symlink refusal releases the hub lock.
The CLI is the subject of real child launches through the shared
`secrets-fixture.ts` owner, `clandCliLaunch` and `fixtureEnvironment` after all
overlays. Made-up values enter only through stdin.
Child completion is the receipt for output, argv and persisted-file assertions.
Stop the hub and flush its writers before reading logs or removing the fixture.
The owner registers every child before returning or sending input, passes the
test's cancellation signal, and joins native close plus output completion after
termination. A bounded incomplete outcome names native exit/signal and a redacted
tail; the root's before-remove barrier retains it if drainage cannot finish.

`secret set accepts stdin only, list prints names and fingerprints, and unset
removes one value without leaking it` covers the whole command walk, file mode,
captured native spawn argv, CLI output and completed hub log/journal contents.
The other cases cover all four names, rotation preserving other keys, malformed
TOML, empty input, extra arguments and symlink refusal for every operation.
Assert credential comparisons as booleans with value-free messages so assertion
diagnostics cannot print a made-up credential on failure.

Related seams: [T1 input and keypresses](hub-test-secret-input.test.ts.md),
[T3 native Git ignore contract](hub-test-secrets-git.test.ts.md).
