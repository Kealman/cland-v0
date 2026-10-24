# hub/test/adapter-composition.test.ts

T2 uses in-process adapters and public frames for launch/relaunch across harness
choices. T-1222's default Implementer policy is workspace-write with absolute
narrow Git/territory/artifact roots. Preserve explicit custom roots and policy
overrides, OpenCode's ignored policy, and the actual-harness relaunch assertions.
