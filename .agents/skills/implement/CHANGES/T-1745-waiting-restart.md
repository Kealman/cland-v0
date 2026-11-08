# T-1745 — durable waiting launches

Waiting requests retain their admitted actor identity and pinned pool in hub.db.
Restart rechecks current grants and drops removed roles/pools with one Coordinator
Agents notice. Process publication and wait deletion share one transaction.
Use the projectHub restart cases in
`docs/agents/tests/hub-test-waiting-launch-restart.test.ts.md`; preserve the
existing session.list/inbox waiting shape and CLI lines.

Restoration shares live admission validation, retains typed memory evidence, and
does not repeat a start notice. Only an exact wait id carried by launch admission
can atomically consume a wait during fresh or different-name reused publication.
