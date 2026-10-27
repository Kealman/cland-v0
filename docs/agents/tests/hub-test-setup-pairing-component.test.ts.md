# hub/test/setup-pairing-component.test.ts

T2 drives the remote setup step with the scripted prompter, production local CLI
frame client, `projectHub` and the loopback fake Bot API. `tempProject` and
`fixtureEnvironment` own the paths, HOME, XDG and Git environment. Only the fake
token constant is stored in the scratch secrets file; no real platform or child
process runs. This complements the full CLI/Aide ordering regression in
`setup-remote-component.test.ts` and T1's no-code/multiple-code scripts.

During the pause, arm the next-poll observer before injecting Start. Its offset
must acknowledge that exact update before the pause ends. Approve only after
the pairing row's identity is confirmed; read the numeric pairing back through
remote.status. A decline retains the waiting inbox row and its exact command,
and leaves pairing null even when `--yes` is set and Enter accepts the supplied
default No. Nonterminal mode asks nothing and reports `open` with
the bot link and approve command; a paired terminal rerun reports `ok`.

All fake waits are bounded. Stop the owned hub before reading drained logs and
before root removal. Secret checks use value-free assertion diagnostics.
