# hub/test/task-worktrees.test.ts

T-542: The T2 TaskWorktrees claim seam uses scratch root/package trees and injected Git. Prove root node_modules linking with scratch playwright-core package resolution, preserve an older own install on reclaim, and name stale links or missing root installs. No npm, downloads or live root dependencies.

Review M1/M2: matching hidden-lock metadata with missing/older actual playwright-core manifests must warn for own installs and links. Healthy installs with other-OS/CPU optional entries or omitted optional packages must not warn. All packages are scratch artifacts, and preservation assertions remain.
