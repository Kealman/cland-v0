T-1595: SSH transport implementation guidance is in docs/hub/ssh-transport.md.
The stable Transport interface owns tunnel carrying, independently of providers.
Bootstrap uses only stdin for secrets and shares supervisor --check liveness.
Status hosts is additive and optional for older-hub compatibility. Tests use
fake SSH/hosts only, injected policy clocks, detached native owners and observed
forward/probe receipts; no new role permissions or command syntax were added.

A-16146 correction: exclusive private trust disables global/DNS/command trust,
quotes the private path using OpenSSH config syntax, and fences control metadata
until native endpoint absence (ENOENT/ECONNREFUSED). Single-host registry admission
covers the full check/unlink/start sequence. Fenced attempts back off and render a
short path-free reason. See Coordinator decision5ba557cb and subsystem reference.
