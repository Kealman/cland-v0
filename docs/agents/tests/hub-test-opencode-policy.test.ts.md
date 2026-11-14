# hub/test/opencode-policy.test.ts

Model syntax and session policy use pure OpenCode client facts. T-1855 also
injects an in-memory filesystem into the fake's shared `writeSessionRecord`
publisher. During a forced partial write, the final session path still parses
as the previous complete record and session listings exclude the temporary
entry. After rename it parses as the new record, with no temporary entry left.
The positive partial-window observation is required. This seam uses no native
process, actual filesystem or retry-until-parsed reader.

The pure publisher is `hub/test/fakes/session-record.ts`, outside the native
fake executable subtree. `fake-opencode.ts` supplies filesystem operations and
unique temporary names; the T1 test supplies in-memory operations. Keep native
bindings out of the pure module so tier admission stays T1 without exemptions.
