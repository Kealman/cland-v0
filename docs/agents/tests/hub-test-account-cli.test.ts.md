# hub/test/account-cli.test.ts

This T2 Unix peer holds the refresh poll while fake timers advance past the
ordinary three-second read deadline. Keep the final refreshed JSON and plain-text
list assertions. The peer records hello, initial account list, poll and final
list frames; assertions require the received frames to exclude the synthetic
outer session actor, id and credential. The CLI's ambient environment is scoped
through `fixtureEnvironment`, with only the scratch discovery file explicit,
and restored afterwards. A permissive fake peer's successful result alone does
not prove environment isolation.
