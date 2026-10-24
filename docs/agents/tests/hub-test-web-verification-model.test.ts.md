# hub/test/web-verification-model.test.ts

`hub/test/web-verification-model.test.ts` is the pure T1 queue presentation seam,
using recorded sealed scratch frames in `web/test/fixtures/verification.json`.
`web/test/verification.test.ts` covers the Sessions verification line and in-place
queue with hand-run reservations in a sealed `projectHub`: physical Enter,
executor-status read per opening, no-frame ageing with the browser fake clock,
replacement receipt and browser-only fold persistence. It runs no suite worker
or real droplet. The explicit recording refresh is
`node --test web/test/record-verification.ts`; its executor and machine receipts
are fake, and its public executor-status read uses a second sealed scratch hub.
