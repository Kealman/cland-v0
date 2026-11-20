# hub/test/state-paths-lint.test.ts

T1 source inventory and planted violations; no native process or user startup
file is read. The production scan reads repository source text only.

Every TypeScript and shell source remains discoverable, including files outside
the exception inventory's import graph. A conservative text candidate check
avoids AST construction for unrelated TypeScript files; escaped text always
falls back to parsing. Each candidate is parsed once and that AST serves both
declaration indexing and all finding checks. ASTs are not retained across scans,
so a subsequent source edit cannot reuse a stale result.

The work-bound regression passes an observed TypeScript parser and checks that
100 unrelated sources use no parses, while a planted unnamed HOME path and an
escaped temporary path are still rejected with one parse per candidate.
Disposable directory coverage plants TypeScript and shell violations with no
imports from the registered source; the scan must return both exact diagnostics.
Literal controls cover temporary and Library paths, native commands, templates
and fully escaped path/command spellings, each retaining one parse and a finding.

The doctor registration permits only `env.HOME` in the immediate context
`home = env.HOME` in `doctor/shell-credentials.ts`. Its approved diagnostic reads
named startup files to report credential names only and writes nothing.
The regression keeps other expressions, contexts and files rejected; existing
HOME, temporary-path, platform-guard and socket-expression controls remain.
