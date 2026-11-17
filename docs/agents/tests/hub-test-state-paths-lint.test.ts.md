# hub/test/state-paths-lint.test.ts

T1 source inventory and planted violations; no native process or user startup
file is read. The production scan reads repository source text only.

The doctor registration permits only `env.HOME` in the immediate context
`home = env.HOME` in `doctor/shell-credentials.ts`. Its approved diagnostic reads
named startup files to report credential names only and writes nothing.
The regression keeps other expressions, contexts and files rejected; existing
HOME, temporary-path, platform-guard and socket-expression controls remain.
