# Git object maintenance

The hub schedules one background pass 30 seconds after serving. See
[the policy](../../hub/README.md#git-object-maintenance) for grace and ownership.
Requests stay available; startup never waits for collection.

`cland doctor` has one read-only `git maintenance` row for the current collector
owner, `.cland/run/git-maintenance.json` results and native `gc.log` files. It
never collects objects, including with `--fix`.

The private exec gate durably records PID/start/group before Git launches. A
normal native close clears that receipt only after the group is gone. An
incomplete close retains `.cland/run/git-maintenance-owner.json` as the collector's
territory ownership; hub stop stays bounded and never labels that collector
completed. Keep this receipt and the root intact during recovery.
The parent releases child and pipe observation handles at incomplete handoff so
they cannot keep the stopped CLI alive. Their release is not a death receipt;
recovery still checks the captured collector independently.

After serving on restart or before a territory mutation, recovery clears a gone
group, or signals a matching live group and waits with a bound. A reused PID is
never signalled. Unverified or surviving ownership refuses mutations and reports
the PID to the Coordinator; status and reads continue. Recovery removes only a
matching dead same-host `gc.pid`; possible replacement locks and all foreign pack
files are preserved. Native Git handles older stale locks without cland receipts.

After an ordinary Git failure, the Coordinator or human restarts to schedule
another pass. Retained batch/job/lease or unreadable activity state keeps all
unreachable objects for that pass. Task sessions keep the ordinary commit/fetch/
local-push workflow and do not prune the live repo or delete recovery metadata.
