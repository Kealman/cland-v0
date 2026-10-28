# nvim/test/artifact-upload.test.ts

`nvim/test/artifact-upload.test.ts` is a T3 client-boundary regression for
spec v0.3 §3.6 and §3.11. It owns one in-process `projectHub`, a human frame
client and one headless Neovim. Both image names lack extensions: the upload
MIME rules supply `.png` and `.jpg`. The test opens the actual artifact-list
rows with Enter and waits for the scratch viewer's filesystem receipts. The
final assertion checks exactly one argument and one invocation for each image;
a note opens in a Neovim buffer without adding a viewer receipt.

Run the touched file alone with Node 24:

```sh
node --test nvim/test/artifact-upload.test.ts
```

The shared fixtures seal HOME, XDG, account and Git configuration and filter
credentials after environment overlays. `CLAND_OPENER` is always a scratch shell
stub: this test starts no GUI and contacts no platform. Synthetic bytes are
sufficient because this boundary asserts viewer routing, not image decoding.
Initial snapshots and rendered rows bound setup separately from the bounded
viewer receipt waits. Fixture ownership stops processes before root removal.

To prove sensitivity while developing, temporarily disable PNG in
`browser_ext` in `nvim/lua/cland/artifacts.lua`: the PNG receipt must time out.
Restore the routing before committing. Keep real-hub coverage here rather than
adding native resources to the stub-only T2 `artifacts.test.ts`.
