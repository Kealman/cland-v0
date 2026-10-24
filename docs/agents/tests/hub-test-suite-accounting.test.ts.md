# hub/test/suite-accounting.test.ts

The C1 executor isolation regression uses `suiteUnit` with real accounting and a
partial `options.env` and explicit hostile path overlays. Set ambient HOME, XDG state and the executor override to a
hostile scratch machine, seed both primary and legacy ledgers, and snapshot that
HOME before and after a completed executor run. Observe actual fixture ledger
entries before stopping its writers and removing it. The hostile HOME snapshot
and inherited override stay unchanged. Never run the proof against real HOME.

`suiteUnit` layers partial environment extras into `fixtureEnvironment` and passes
that sealed environment after the final options spread. XDG extras are filtered
before construction so every XDG path stays fixture-owned, including explicit
overlays; HOME/Git are reset by the builder and executor state is fixed here.
Its injected provider is
reintroduced through `syntheticProviderEnvironment`; native provider/account
variables remain filtered. Reopening uses the same seal.
