# hub/test/claude-code-remote-files.test.ts

T2 uses a recording nonlocal Host and scratch files. Private MCP/settings files retain the credential with mode 0600 and no argv exposure. A refused stop preserves them; a confirmed stop removes them. No native harness runs.

Generation-marked terminal recovery permits exactly one native retry on restart.
A second failed confirmation retains its attempt count and cause; another adapter
restart performs no further native commands. A successful retry releases the
job/private files and clears the marker.

A refused explicit stop reports cleanup-incomplete through stateReason while
retaining private files; confirmed explicit re-stop clears that cause.

An unconfirmed explicit-stop restart control rejects any new native command or
signal and keeps the running row/cause until an explicit re-stop. Already
released receipts and confirmed private-deletion checkpoints remain recoverable.

An accepted launch result held across close must re-adopt before rollback and
join native settlement. Captured and reconstructed callbacks share one producer;
generic rollback contains no private files. Typed non-admission permits rollback
without adoption, while an untyped lookalike error retains supervision and files.
