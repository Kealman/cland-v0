# hub/test/roles-launch-permissions.test.ts

T1 seam: `parseRoles`, `roleLaunchPolicy` and `decide`; no sockets, processes or real time.
T-781 adds namespaced custom definitions, full field-path errors, default-deny
permissions, reserved-name and unknown-field checks, exact grants, own-claim
completion/review and verify admission. Malicious supplied grants test the
decision-time ceiling independently from parser rejection. Keep all six built-in
roles and their historical launch-policy assertions. A valid dictionary-member
name (`constructor`) must not inherit grants, labels or a Codex sandbox compatibility default during launch edits.

T1 public-parser checks retain OpenCode's native policy while proving inherited
Codex/Claude role policy. T-1222 expects workspace-write and narrow roots for
Implementer, workspace-write for Aide, explicit full-access Coordinator/Lead,
read-only Reviewer and full-access QA. Keep explicit empty-policy overrides and
the OpenCode-to-other-harness fallback checks.
