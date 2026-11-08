# hub/test/literal-rm.test.ts

The T1 seam is Claude's PreToolUse payload. Keep computed rm/rmdir, separator,
keyword, sudo/command and xargs cases alongside literal, git rm, heredoc and
unrelated-payload controls. Never execute the payload's Bash command.

Glob regressions cover `*`, `?` and bracket classes, mixed literal/glob targets,
`bash -c`/`sh -c`, and separators/keywords. Allowed controls retain quoted and
escaped glob literals, unmatched brackets, non-rm arguments and heredoc bodies.
These are pure T1 payload checks: no filesystem deletion or shell evaluation.

Quoted separators keep word identity (including before a later glob target).
Bracket classes retain quoted members and leading `]`; quoting the class
delimiters keeps the filename literal.
