# hub/test/host-secret-admission.test.ts

T2 uses projectHub, fake harness rows and scratch per-host secrets; no SSH or cloud.
C1/C2 dial the real Unix WebSocket edge. C3/C4 use the human socket with a host
principal, prove credential-bound CLI, hook and mod-bridge requests, and deny
identity-free, cross-host, human-only and snapshot requests. C5 observes native
WebSocket and Unix socket closes after durable revocation and checks a later
hello's sanitized revocation refusal. Client claims never grant human user authority.

Preservation owners run unedited: daemon.test.ts (hub socket/project-secret),
resilience-component.test.ts (spoke bearer admission), web-authority.test.ts
(web/project authority). Existing wire shapes remain accepted by those fixtures;
only the additive host.revoke request extends the workbench request union.

Review-boundary regressions hold a fake spawn before publication and admit only
its captured host/role, including anonymous reconnect identity reuse. Settled
first-hello tokens cannot join a live foreign session by id with its name or
without a name; the foreign role, credential and native ping receipt stay intact,
and the token's own session still admits afterwards. No launch proof is consumed
before the exact identity reaches core.hello.
