# hub/test/user-invites.test.ts

T2 uses tempProject/projectHub and the sealed human CLI. Assert invited admin
rows, the edge URL, first-admin switch output, fresh replacement, token absence
from captured hub logs and events, and auth reset's durable revocation. SQLite
reads validate the retained tokens without spending them. No browser or native
process lifecycle is under test; no real credentials or live project state.

Authenticated session-shell calls to all five auth/user frames must fail with the
same human-only reason and unchanged users/invites/mode; the human succeeds on
each command. Held upload cancellation observes its cancellation receipt before
probing the reset fence. Failed mode reload retains that fence until recovery.
Both fence tests assert unchanged durable records on refusal; release and join
reset and upload writers before fixture disposal.
