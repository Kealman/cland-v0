# nvim/test/hosts.test.ts

T2 uses recorded `hosts.state` frames and isolated headless Neovim. Run with
`node --test nvim/test/hosts.test.ts`. Regenerate via
`npm run test:nvim-fixtures -- nvim/test/hosts.test.ts --slice`.

The rendered receipts cover Remotes-before-Hosts, two pool rows, harness login
counts, signed-out counts, native `za` fold/unfold on the header, host facts,
outage and provider red marks, recovered dim marks and empty replacement.
The first assertion covers a previous hub with no hosts frame. No login action,
provider call, real account or GUI is involved. The one-second bound starts at
the pushed frame, excluding setup; native tunnel-to-render proof is separate.
