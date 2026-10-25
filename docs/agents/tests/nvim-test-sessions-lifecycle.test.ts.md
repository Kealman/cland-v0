# nvim/test/sessions-lifecycle.test.ts

T3 seam: headless Neovim launches the three sealed fake native harnesses through
the real hub, observes exact session rows/models and lifecycle records, attaches
each terminal, and checks process death in the hub log. A real process is needed
for these launch/attach/kill boundaries; no GUI or human account is used.

Keep the session screen error assertion scoped to rendered action refusals
(`launch/stop/resume/archive <name> refused:`) and `hub: refused`. A word in a
Coordinator clause rendered in General is ordinary content. The launcher
component’s real rejected-launch screen remains the positive control for this
matcher. Preserve the three positive row/model and launched journal receipts,
attachment text, process/death observations and existing bounds.
