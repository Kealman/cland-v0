# hub/test/homebrew.test.ts

T1 pure configuration/formula contract. Run `node --test hub/test/homebrew.test.ts`.
It checks opt-in config round trips, tag URL/version/SHA rendering, node@24,
the shared source-build call, runtime PATH wrapper and doctor test. It executes
no Ruby or Homebrew. Real formula audit/install remains E-778's launch demo
evidence; the formula is published in `Kealman/homebrew-tap`.
