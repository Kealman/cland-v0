# hub/test/web-tunnel-guide.test.ts

`hub/test/web-tunnel-guide.test.ts` reads the literal TOML block from
`web/README.md`'s HTTPS phone guide and starts a sealed scratch `projectHub`
with that exact configuration. At T2 it runs the executable `cland web --qr`,
decodes the printed QR, redeems the link on loopback with the documented Host
and Origin, then observes an authenticated WebSocket welcome and status reply.
Both platform browser openers are scratch stubs; HOME/XDG/Git and account
variables use the shared sealed fixtures. No Tailscale process, external network,
live hub or real browser is used. This checks configuration and admission, not
Tailscale provisioning or real phone installation. Build first, then run
web-auth.test.ts, web-edge.test.ts and web-tunnel-guide.test.ts targeted before
mode-free verification. A new passing identity reaching 80% of its tier budget
needs a dated, reasoned E-880 allowance citing the run, about 1.5× its worst sample.
