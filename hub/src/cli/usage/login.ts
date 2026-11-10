// Pure command help text.
export const LOGIN_USAGE = `  login list [--json]  list project logins and host bindings, including disk metadata and last sign-in
                       local human CLI or Neovim only; no harness files or key material
  login add <harness> [--name <name>] [--pool <pool>] [--account <account>] [--kind disk]
                       sign in on a 1 GiB disk through the harness in your terminal
                       harness: claude-code, codex or opencode; pool: agents or the only pool
                       name: lowest free harness-N; account: name; requires a ready pool image
`;
