// Pure command help text.
export const LOGIN_USAGE = `  login snapshot <name>  back up a ready or in-use disk login; local human CLI or Neovim only\n  login list [--json]  list project logins and host bindings, including disk metadata and last sign-in
                       local human CLI or Neovim only; no harness files or key material
  login add <harness> [--name <name>] [--pool <pool>] [--account <account>] [--kind disk|key]
                       sign in on a 1 GiB disk through the harness in your terminal
                       harness: claude-code, codex or opencode; pool: agents or the only pool
                       disk default: lowest free harness-N; account: name; requires a ready pool image
                       key: OpenCode only in 0.4.x; stdin or hidden prompt, never value arguments
                       encrypted locally; metadata only to hub; no pool, image or network required
`;
