# hub/test/hosts-docs-pool.test.ts

`hub/test/hosts-docs-pool.test.ts` is T2. Run
`node --test hub/test/hosts-docs-pool.test.ts`. It allocates a disposable project
through `tempProject` (which registers disposal immediately), starts `projectHub`
with a real clock-relative FakeClock and sealed fake-provider root, and executes
every visible `sh host-pool` command in order through the sealed CLI helper.
The documented `<provider>` parameter is `fake`; a reader uses `digitalocean`.
The initial pool and managed config are fixture setup, outside the visible steps.
Use an isolated verification lock path before rendering so projectHub's lock
isolation does not rewrite away the managed marker.

The final status command must positively list both `first` and `second`, with
zero hosts. A separate persisted-config assertion checks the second pool's exact
settings. There are no real hosts, watchdogs, keys, credentials, paid calls or
external requests. The hub is joined before disposal. No waiting timer is used.
QA can find the published steps under “Configure a second pool” on the Hosts,
pools and logins page. This proves configuration/status, not native provisioning.
The shared `hub/test/remote-docs.test.ts` wrapper also imports the site's hosts
guard, so mode-free documentation selection includes its vocabulary checks.
