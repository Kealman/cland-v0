# hub/test/web-artifacts.test.ts

`web-artifacts.test.ts` exercises `artifact.url` on a cookie-authenticated web
client and cookie-free HTTP reads at T2. It covers extension types, file/folder
confinement, traversal and symlink refusal, HTML sandbox headers, relative
stylesheets, revocation and the fixed session expiry with an injected clock.
It also restarts the in-process hub to prove capability persistence and covers
moved-file owning-folder substitution. The injected filesystem open port swaps
a folder parent at the final open boundary: Linux must serve the already-anchored
file, macOS must refuse the symlink, and neither can return the outside bytes.
The T2 fixture keeps an explicit symlinked project ancestor on every platform:
authorized reads must succeed while artifact and nested-folder symlink swaps
remain refused. Only the trusted project prefix is resolved once by the web
edge; artifact paths outside it retain full-path no-follow checks.
`web-artifacts-unit.test.ts` checks outside-prefix no-follow reads, digest-only database rows and cascading
removal on revocation and expiry at T1. The frame is web-only; local test clients create source artifacts and manage
sessions through the Unix socket. Capability digests persist beside their cookie sessions across hub restarts.
