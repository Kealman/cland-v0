# Claude Code hooks

`cland init` and `cland update` add a managed synchronous Bash `PreToolUse`
hook. Hub launches and relaunches inject the same `cland hook literal-rm`
handler through private settings. Existing sessions receive it on relaunch.

The guard refuses rm/rmdir targets using command substitutions, backticks,
named variables or xargs. Its exit 2 gives the model a reason and a retry:
print the path first if needed, then write every path literally. This avoids
Claude Code's statically-unresolvable-target approval stall under bypass
permissions. Literal paths, `git rm` and here-document bodies pass.

The handler evaluates no shell command and needs no hub, auth or network. It
uses the project's prototype pattern checks, not a complete shell parser or a
security boundary. Missing or malformed payloads pass. Other status hooks stay
asynchronous.

Hand-started sessions require `cland` on PATH. Project hooks stand aside when
`CLAND_SESSION_NAME` is set because the hub injected its own hooks. Init/update
replace only managed hook entries, preserving user hooks and local settings;
invalid project JSON is kept with a diagnostic and must be repaired before the
hook can be provisioned. Do not keep a second project-own literal-rm hook.
