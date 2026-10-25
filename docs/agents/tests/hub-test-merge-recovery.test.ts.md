# hub/test/merge-recovery.test.ts

T-542: At the T2 merge policy seam, inject Git landing facts and use a scratch node_modules sentinel. Prove package-lock changes appear in the landing result and durable item comment without modifying the shared install. Recovery retains the same landed commit facts.

T-1251: Inject before/after manifest blobs at the landed commit and its parent. Scripts-only changes omit the install requirement from the result, durable comment and Agents lifecycle notice, including a resumed landing. Dependency changes retain it. The fixture copies candidate manifest blobs into its squash commit; no real Git or installer runs.
