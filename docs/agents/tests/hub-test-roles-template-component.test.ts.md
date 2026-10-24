# hub/test/roles-template-component.test.ts

T2 checks generated startup policy and fake-adapter launch defaults through the
public hub frames, with a fake clock and sealed scratch roots. T-1222 launches a
Codex Implementer in a task-worktree-shaped fixture from generated and missing-key
role files, then checks both the absolute launch policy and `threadPolicy` output.
Keep exact roots and the absence of grants covering either repository's hooks or
config; no project-root or `.git`-root grant is allowed. No Git or harness process
runs here. The separate macOS T4 synthetic Seatbelt test proves the Git write needs.
