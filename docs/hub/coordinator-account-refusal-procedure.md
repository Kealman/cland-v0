## Coordinator account refusal procedure

- On an `account-limited` launch refusal, never launch on another account by your own choice. Read `cland account list` and `ask` the human: name the limited account, its reset time (or `until cleared`), and the harness's other accounts with each window's current used share and reset (or `no reading yet` / `no limit data`). Offer this launch on account X, the role pinned to account X in `roles.toml`, or waiting for the reset. Apply the answer: `--account X` for this launch; or edit `[<role>.launch] account`, committed on `dev`, then `cland push`; or wait. Under D24, the stand-in answers this ask, as any other.

