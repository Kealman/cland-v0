# hub/test/prerequisite-guards.test.ts

T2, no hub. Run `node --test hub/test/prerequisite-guards.test.ts` alone.
The site graph's planted transitive hub-only package and computed import must
produce findings; builtins and site-declared packages pass. The CLI control seeds a minimal known-good source tree; the report command copies
production source without test cases, retaining shipped runtime support into a disposable root, imports every CLI module and its literal runtime import closure (including lazy imports)
with native Node, and rejects source imports of undeclared runtime packages.
Planted lazy test-only and development-package imports must be observed in native exit diagnostics.
Its HOME, XDG and Git settings come from fixtureEnvironment after all overlays.
The child closes before removing its root; no command action or browser runs.

`node hub/test/lint-prerequisites.ts` runs both guards on the candidate checkout
in report mode. `--help` documents that findings feed no exit status. These checks
cover runtime module loading, not every command's side effects or optional external
tools. Web readiness reports before runner repair and standalone probes, without
introducing a refusal or skip. Enforcing these findings requires a separate item.

The candidate baseline retains known finding T-1484: literal lazy closure inspection
reaches dev-only TypeScript in sourceTestIdentities. Installed `cland verify` only
hits that parser for cland-shaped duration metadata; generic projects without
hub/test/durations.json avoid it. This finding is reported, never suppressed or
counted as a clean install result; the compiler remains dev-only.

Source1 M1 uses the shared `importEdges` parser for site declarations and stripped
runtime CLI closure sources. Named/renamed/namespace createRequire, its loader
aliases, immediate factory calls and literal const/concatenated paths are followed.
Lazy missing require and dev-only package controls retain native exit diagnostics;
unresolved computed imports yield explicit incomplete findings rather than clear.
The candidate retains TypeScript findings from both sourceTestIdentities and
lazy createRequire in test-lint; both belong to T-1484's tiered-project baseline.

Source2 M3 binds each in-memory source with TypeScript's lexical symbol table
(no library or import resolution). Only a const declaration belonging to that
exact symbol can resolve an identifier. Shadowing parameters and reassigned let
paths remain incomplete in both site and CLI controls; immutable const literal
concatenation remains supported. Factory and loader aliases also key on symbols.
