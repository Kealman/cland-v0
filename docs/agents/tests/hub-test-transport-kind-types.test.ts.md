# hub/test/transport-kind-types.test.ts

T3 compiler API fixture; no child process, native carrier, credential or network.
It overlays only `TransportKind` with a hypothetical `outbound` member, resolves
the full production import graph, and compiles an outbound carrier against the
unchanged `Transport` interface. Diagnostics cover the carrier, kind module,
transport module and pool parser. Whole-source checking remains the normal T0
typecheck. Full-graph resolution exceeded the T2 budget under load, so the tier
manifest places this compiler contract beside `typecheck.test.ts` in T3.
Earlier T1/T2 receipts are not reused as T3 proof after this classification move.
The shipped union and runtime parser remain SSH-only; `transport-kind.test.ts`
and `transport-records.test.ts` retain unknown-kind refusal and old-row evidence.
