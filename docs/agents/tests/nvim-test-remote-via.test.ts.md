# nvim/test/remote-via.test.ts

T2 recorded-client seam: headless Neovim, the sealed stdio stub and committed
protocol frames, with no hub runtime or harness. It checks actual thread rows
for Telegram and Discord, completed ask/approval archive rows, an old ask
outcome without `via`, and a closed approval delta during an Inbox visit.
Wait for the anchored rendered content before reading its buffer assertion.

After changing the scenario, refresh only this consumer with
`node hub/test/record-nvim-frames.ts --slice nvim/test/remote-via.test.ts`, then
run `node --test nvim/test/remote-via.test.ts` against the committed recordings.
The recorder publishes only after a complete, passing, non-skipped receipt.
Fixture cleanup stops and reaps Neovim and the stub before deleting scratch
roots. No real messenger, token or key is used.

T-1357 adds the denied OpenCode archive outcome beside the approved-once Codex
row; both actual headless-rendered rows retain `via Telegram`. Refresh only this
slice and commit its successful recording/manifest together.
