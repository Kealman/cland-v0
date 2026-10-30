# hub/test/stage-qa.test.ts

Residual T3 stage QA checks use sealed native Git projects and real verifier
spokes; the core in-process rule seam is `planned-stage.test.ts`. Premature QA
fixtures claim their tasks before closing them, so an empty branch still requires
a dev landing receipt. Brand-new branchless done tasks instead qualify as
evidence-only when they have no dev `Item:` trailer or landing receipt.

Keep the legacy stage-hash test: evidence-only support must preserve hashes for
stages whose tasks have actual dev landing receipts, including across restart.

The supplemental Lead spoke explicitly uses the recorded native launch generation via claudeLaunchIdentity. stage-qa-support exposes its existing optional fake for that read; the stage-close scenario and all other fixture consumers keep their original behaviour. Preserve exact outside-subtree refusal and inside-subtree admission assertions.
