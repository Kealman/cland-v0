# hub/test/remote-docs.test.ts

T1 imports `site/test/remote-docs.test.ts` into the existing hub suite. The site
test also runs in site's prebuild with only its own dependencies installed:
import only dependency-free CLI usage, and read the config template and
`SECRET_NAMES` declaration as source. The wrapper compares those extracted names
with runtime `configKeys()` and `SECRET_NAMES` so extraction cannot drift silently.

The public source seam covers every backticked cland command and shell line in
Remote control and web-and-phone's Remotes section, dotted remote settings and
secret names. Keep the unknown-command/key/name positive control. Check the
Features sidebar group, both inbound links and the exact CLI-reference remote
and secret subcommand lists against usage, including extras. Run this file or
`node --test site/test/remote-docs.test.ts` alone; no browser or hub is needed.
