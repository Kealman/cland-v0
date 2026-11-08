# T-1755 host status and stop

Host status and explicit stop are local-human-only commands. For implementation,
use the sealed T2 frame/CLI fixtures; preserve `host list` and `host destroy`
compatibility. See [status and stop](../../../../docs/hub/host-status-stop.md) for
period accounting, failure fences and the lease owner. No role permissions change.
