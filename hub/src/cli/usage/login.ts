// Pure command help text.
export const LOGIN_USAGE = `  login remove <name>  delete an idle login and its storage; local human CLI or Neovim only
                       unconfirmed deletion retains remaining ids; rerun to finish
  login set <name> --exclusive true|false  change an idle disk login; local human CLI or Neovim only
  login snapshot <name>  back up a ready or in-use disk login; local human CLI or Neovim only\n  login list [--json]  list project logins, bindings and disk metadata; text ends with capacity per pool/harness
                       local human CLI or Neovim only; no harness files or key material
  login add <harness> [--name <name>] [--pool <pool>] [--account <account>] [--kind disk|key]
                       sign in on a 1 GiB disk through the harness in your terminal
                       harness: claude-code, codex or opencode; pool: agents or the only pool
                       disk default: lowest free harness-N; account: name; requires a ready pool image
                       key: OpenCode only in 0.4.x; stdin or hidden prompt, never value arguments
                       encrypted locally; metadata only to hub; no pool, image or network required
`;
