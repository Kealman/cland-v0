# hub/test/roles-template.test.ts

T1 covers generated role policy through provisioning and the public roles parser;
no harness runs. T-1222 compares the generated Codex sandbox for all six roles
with `fixedRoles()` (the no-file fallback), omitted roles and launch tables missing
the sandbox key. Keep the literal role policy expectations: Implementer and Aide
use workspace-write, Reviewer read-only, Coordinator, Lead and QA full access.
This proves configured policy, not OS enforcement; the Codex adapter contract
and the historical sandbox measurements in `docs/review-and-qa.md` cover that
separate boundary.
