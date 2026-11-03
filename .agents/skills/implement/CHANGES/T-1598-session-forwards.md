# T-1598: per-session SSH forwards

Use SshTransport.forward/unforward for one session endpoint per master. The
Transport interface is unchanged. See docs/hub/ssh-transport.md, Session forwards,
for acknowledgement, serialization, short-path allocation and retry semantics.

A-16209 correction retains pending socket removal through filesystem failures.
Unforward, reconnect and stop retry cleanup without repeating acknowledged
cancellation or reinstalling abandoned endpoints.

Coordinator decision a1375ab0: forwarding lifecycle fixtures inject short reconnect
and forward retry schedules. Production delays remain unchanged; no duration
allowance is introduced. Recovery and exhaustion retain observable final receipts.
