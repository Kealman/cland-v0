# T-1747: host lease ownership

Use HostRecords.leases for admission, renewal, settlement and watchdog mirrors.
Registry shutdown joins its asynchronous close before storage closes; never
cancel a reservation on an unknown provider outcome. See
[host leases](../../../../docs/hub/host-leases.md) and
[component tests](../../../../docs/agents/tests/hub-test-host-lease.test.ts.md).

Pin non-acquisition before spend; replace it durably before calling acquire.
Only that receipt grants zero-cost cancellation through the shared ledger API.
Published-mirror parse/read failures expire conservatively within the owned
timer/error path; registry shutdown still drains the native owners.
