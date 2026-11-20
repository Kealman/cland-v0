# hub/test/verify-prepare.test.ts

T-1709 provisioning evidence: run `node --test hub/test/verify-prepare.test.ts` with supported Node and inherited `CLAND_*` removed. Native T3 runs require the stage preservation lock and disposable fixture roots; never run a provisioning script on the host. Scripted component tests prove root hook ordering and failure output. Key tests prove hook and generic recipe staleness; native prepare tests hash committed hook bytes and retain no-hook snapshot coverage. Recipe inspection checks every Chromium library and both Neovim pins against project sources. QA runs these checks on stage dev; the Coordinator restarts the hub and rebuilds the snapshot before collecting full Linux suite evidence.

The hook writes `.cache/nvim/.cland-installed.json` with the installed tag and Linux digest. The prepare marker records project install facts separately from the executor key. Exercise a matching hook pin and a differing hook pin; keep the warm executor-run delivery assertion unchanged.

The same-tag/different-digest regression uses the real resolver with a planted old executable in its tag cache. It requires refusal before seeding, unchanged bytes and no newly published matching marker. A legacy tag-only project marker still uses the image receipt containing the digest. An older-tag project marker cannot hide a hook conflict at the requested tag; that case keeps the prior marker unchanged.

The shared-clone regression copies the repository's `.gitignore` into a disposable
source repository, clones with `--shared --no-checkout`, checks out its commit,
and calls `worktreeInstall` (the dependency preparation used by batches and dev
T3 probes). It asserts a real `node_modules` symlink and empty native Git status,
with an unignored file as a positive control. Its scratch environment also pins
an empty excludes file; the clone cannot borrow the source's `info/exclude`.
`residueControl` owns the complete original callback before root acquisition,
with separate bounded setup and assertion steps. Every Git command uses
`residueChild` to enroll its native owner and observe both close and the command
result; cleanup joins that work before the guarded fixture root can disappear.

Preparation output inventory:

| Producer | Checkout paths | Committed ignore rule |
| --- | --- | --- |
| `prepareBatchDependencies` / `worktreeInstall` | `node_modules` symlink; no other writes | `node_modules` (directory or symlink) |
| `verify-prepare` | `node_modules/.cland-prepare-key` | `node_modules` |
| `npm ci` | Installed packages, workspace links and `.package-lock.json` beneath `node_modules` | `node_modules` |
| npm prepare's web build | `web/dist/`, including assets and `build-stamp.json` | `web/dist/` |
| npm prepare's browser install | `node_modules/playwright-core/.local-browsers/` | `node_modules` |
| Neovim seed | `.cache/nvim/<tag>/`: `.download.lock`, `.download.lock.break`, their PID-suffixed `.tmp` files, `.<asset>.<pid>.part`, `.unpack-<pid>/` and extracted release tree | `.cache/` |
| Prepared-image hook receipt read by verify-prepare | `.cache/nvim/.cland-installed.json` | `.cache/` |

The regression plants representative files for these generated directories and
checks both `git check-ignore` and empty status. The directory-only cache and web
rules cover their actual directory outputs. The legacy image receipt
`$HOME/.cland-image.json` is read outside the checkout, not created by this script.
The native regression performs no install, network call, or browser launch.
