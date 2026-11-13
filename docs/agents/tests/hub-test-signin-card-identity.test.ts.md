# hub/test/signin-card-identity.test.ts

T1, pure card projection; no sockets, processes, fixture roots or credentials.
`sign-in card projection exposes only the persisted hub login identity` checks
the exact previous ordinary-card shape, the trusted hub code-card login name,
and absence of native admission/URL payload fields. Forged wire identity,
non-hub authors, other card kinds and malformed/empty payload names contribute
no identity. The shared projector also feeds flattened InboxAsk; public inbox,
history and closure coverage is in hub-cards.test.ts, and old-client-shape and
pre-receipt fold/reload controls are in web/test/hosts-view.test.ts.

Run on supported Node with inherited CLAND variables removed:
`node --test hub/test/signin-card-identity.test.ts`.
