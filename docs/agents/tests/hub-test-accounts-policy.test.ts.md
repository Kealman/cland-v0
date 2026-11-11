# hub/test/accounts-policy.test.ts

T1 source-policy coverage. `node --test hub/test/accounts-policy.test.ts` scans hub TypeScript for provider endpoints and credential-store access, with exact file/literal exceptions for authorized metadata, installer plans and saved path construction. It starts no process, installer or network request. The account migration case also guards against literal timer waits and elapsed-time assertions.

The mounted login path uses only the exact pure `mountedOpenCodeDatabase` helper
in `host/agent/state-paths.ts`, re-exported by `accounts/registry.ts`. Planted wrong-file, duplicate occurrence and database
read variants must still fail the exhaustive scanner. Calling the helper only
joins the mount and filename; it does not inspect login contents.

T-1714 C3 permits exactly one `https://opencode.ai/v2/install` literal in `hub/src/image/recipe.ts`: render-only image-builder text that the hub never fetches. `image installer exception permits only the exact v2 literal in its recipe file` proves the same literal in another hub file, a second occurrence in the recipe, and an unrelated OpenCode endpoint remain rejected. The full-source scan and positive/negative controls share the same checker.
