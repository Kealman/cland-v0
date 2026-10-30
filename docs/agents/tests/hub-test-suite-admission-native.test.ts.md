# hub/test/suite-admission-native.test.ts

Run `node --test hub/test/suite-admission-native.test.ts` alone. T3 covers native
Git history for lint-baseline provenance and the installed CLI admission contract.

The pruned-install cases copy hub source, CLI and shared client modules to a
fresh disposable install tree, link runtime packages only, and positively assert
that TypeScript cannot resolve there. Each target has a committed test and tier
manifest; one also has a source duration identity. A sealed Unix socket passes
suite.start to the copied production suiteCandidate inspector and returns its
result to the real installed `cland verify --dry-run` CLI. It runs no scheduler,
full suite, daemon or browser. Native Git and CLI children use fixtureEnvironment
with isolated HOME, XDG and Git settings, filtered after overlays. The pre-owned admissionExchange registers onCleanup and a root-removal guard
before listener or child setup. Listener readiness has a 5 s bound; CLI completion
has a 30 s native SIGKILL limit and a separate 35 s callback-plus-native-close
observation deadline that invokes owned disposal; disposal cancels admission and the child, destroys
active sockets and joins native close plus the actual inspection within a separate
45 s bound. Inspection has no cancellation port, so its work is joined rather than
detached. An incomplete drain retains the root. Omitted setup, aborted listener
setup and an explicitly held inspection exercise those cleanup obligations.

Both cases require exit 1, empty stdout, and one stderr line naming the unavailable
TypeScript compiler and unknown check, with no stack/module-resolution dump.
The runtime package manifest must keep TypeScript dev-only. These prove refusal
at admission, not test execution or scheduler coverage. Existing compiler-present
lint and duration tests cover parser semantics.

Failure controls use a fake child callback and FakeClock to withhold native close:
the operation deadline must begin cancellation, incomplete drainage must retain
storage and include native code/signal plus a bounded diagnostic tail, and only a
later close receipt permits drainage. This is synthetic failure-path evidence,
not a real process timing measurement. A failed drain can be retried after the
missing receipt arrives; storage guards still require positive drainage. The held
inspection control pre-registers gate release and client destruction/close before
setup, and releases/joins in finally when an entered/close observation fails. An
early injected observation failure proves that inspection has settled before the
control returns. Both controls retain final positive closure assertions.
