/** Existing exceptions are exact expressions plus their immediate context, never whole files.
 * Each new runtime path must register its reason here (T-1621 / E-1532 shared seam). */
export const PATH_EXCEPTIONS = [
  {
    "file": "accounts/registry.ts",
    "expression": "env.HOME",
    "context": "env.HOME ?? homedir()",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "accounts/registry.ts",
    "expression": "homedir()",
    "context": "env.HOME ?? homedir()",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "adapters/claude-code.ts",
    "expression": "env.HOME",
    "context": "env.HOME || homedir()",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "adapters/claude-code.ts",
    "expression": "homedir()",
    "context": "env.HOME || homedir()",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "adapters/claude-code.ts",
    "expression": "this.#env.HOME",
    "context": "this.#env.HOME || homedir()",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "adapters/claude-code.ts",
    "expression": "homedir()",
    "context": "this.#env.HOME || homedir()",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "adapters/codex.ts",
    "expression": "tmpdir()",
    "context": "real(tmpdir(), resumed)",
    "reason": "Codex machine runtime sockets and matching sandbox permissions."
  },
  {
    "file": "adapters/codex.ts",
    "expression": "tmpdir()",
    "context": "real(tmpdir(), resumed, machine)",
    "reason": "Codex machine runtime sockets and matching sandbox permissions."
  },
  {
    "file": "adapters/codex.ts",
    "expression": "tmpdir()",
    "context": "join(tmpdir(), 'cland-run')",
    "reason": "Codex machine runtime sockets and matching sandbox permissions."
  },
  {
    "file": "adapters/opencode.ts",
    "expression": "this.#processEnv.HOME",
    "context": "HOME: this.#processEnv.HOME",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "cli/init.ts",
    "expression": "homedir()",
    "context": "realpathSync(homedir())",
    "reason": "Read-only refusal of HOME as a project root."
  },
  {
    "file": "cli/open.ts",
    "expression": "homedir()",
    "context": "realpathSync(homedir())",
    "reason": "Read-only refusal of HOME as a project root."
  },
  {
    "file": "cli/qa.ts",
    "expression": "tmpdir()",
    "context": "realpathSync(tmpdir())",
    "reason": "Explicit QA command allocates a disposable isolated root."
  },
  {
    "file": "cli/setup.ts",
    "expression": "homedir()",
    "context": "realpathSync(homedir())",
    "reason": "Read-only refusal of HOME as a project root."
  },
  {
    "file": "doctor/harnesses.ts",
    "expression": "env.HOME",
    "context": "env.HOME ? [join(env.HOME, '.local/bin', h.bin), join(env.HOME, '.opencode/bin', h.bin)] : []",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "doctor/harnesses.ts",
    "expression": "env.HOME",
    "context": "join(env.HOME, '.local/bin', h.bin)",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "doctor/harnesses.ts",
    "expression": "env.HOME",
    "context": "join(env.HOME, '.opencode/bin', h.bin)",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "doctor/keys.ts",
    "expression": "env.HOME",
    "context": "home = env.HOME",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "doctor/toolchain.ts",
    "expression": "env.HOME",
    "context": "HOME: env.HOME",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "executor/droplet/health.ts",
    "expression": "'/tmp'",
    "context": "process.env.TMPDIR ?? '/tmp'",
    "reason": "Remote machine temporary runtime and suite-lock cleanup; no retained user state."
  },
  {
    "file": "executor/droplet/run.ts",
    "expression": "'rmdir /tmp/cland-suite.lock; trap - EXIT\\n'",
    "context": "released ? '' : 'rmdir /tmp/cland-suite.lock; trap - EXIT\\n'",
    "reason": "Remote machine temporary runtime and suite-lock cleanup; no retained user state."
  },
  {
    "file": "fixture-processes.ts",
    "expression": "tmpdir()",
    "context": "realpath(tmpdir())",
    "reason": "Read-only containment check before fixture process cleanup."
  },
  {
    "file": "hub/daemon.ts",
    "expression": "'/tmp/cland-suite.lock'",
    "context": "config?.verification.lockPath ?? '/tmp/cland-suite.lock'",
    "reason": "Machine suite locks and owned candidate roots serialize local workers."
  },
  {
    "file": "hub/daemon.ts",
    "expression": "'/tmp/cland-suite.lock'",
    "context": "config.verification.lockPath !== '/tmp/cland-suite.lock'",
    "reason": "Machine suite locks and owned candidate roots serialize local workers."
  },
  {
    "file": "hub/daemon.ts",
    "expression": "'/tmp/cland-suite-nvim.lock'",
    "context": "config?.verification.lockPath && config.verification.lockPath !== '/tmp/cland-suite.lock' ? `${config.verification.lockPath}-nvim` : '/tmp/cland-suite-nvim.lock'",
    "reason": "Machine suite locks and owned candidate roots serialize local workers."
  },
  {
    "file": "hub/suite-worker.ts",
    "expression": "'/tmp/cland-suite.lock'",
    "context": "['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock']",
    "reason": "Machine suite locks and owned candidate roots serialize local workers."
  },
  {
    "file": "hub/suite-worker.ts",
    "expression": "'/tmp/cland-suite-nvim.lock'",
    "context": "['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock']",
    "reason": "Machine suite locks and owned candidate roots serialize local workers."
  },
  {
    "file": "hub/suites.ts",
    "expression": "'/tmp/cland-suite.lock'",
    "context": "['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock']",
    "reason": "Machine suite locks and owned candidate roots serialize local workers."
  },
  {
    "file": "hub/suites.ts",
    "expression": "'/tmp/cland-suite-nvim.lock'",
    "context": "['/tmp/cland-suite.lock', '/tmp/cland-suite-nvim.lock']",
    "reason": "Machine suite locks and owned candidate roots serialize local workers."
  },
  {
    "file": "init/config.ts",
    "expression": "'/tmp/cland-suite.lock'",
    "context": "lockPath: '/tmp/cland-suite.lock'",
    "reason": "Machine suite locks and owned candidate roots serialize local workers."
  },
  {
    "file": "models.ts",
    "expression": "env.HOME",
    "context": "[harness, account ?? null, env.CODEX_HOME, env.CLAUDE_CONFIG_DIR, env.OPENCODE_DB, env.XDG_DATA_HOME, env.HOME]",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "project.ts",
    "expression": "tmpdir()",
    "context": "join(tmpdir(), name)",
    "reason": "Short Unix socket fallback, bounded by the OS socket path limit."
  },
  {
    "file": "project.ts",
    "expression": "'/tmp'",
    "context": "join('/tmp', name)",
    "reason": "Short Unix socket fallback, bounded by the OS socket path limit."
  },
  {
    "file": "setup/steps/accounts.ts",
    "expression": "env.HOME",
    "context": "env.HOME ?? homedir()",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "setup/steps/accounts.ts",
    "expression": "homedir()",
    "context": "env.HOME ?? homedir()",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "setup/steps/trust.ts",
    "expression": "env.HOME",
    "context": "env.HOME ?? homedir()",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "setup/steps/trust.ts",
    "expression": "homedir()",
    "context": "env.HOME ?? homedir()",
    "reason": "Harness account/configuration discovery in the selected HOME; existing compatibility paths, not hub state."
  },
  {
    "file": "suite-lock.ts",
    "expression": "'/tmp'",
    "context": "realpath('/tmp')",
    "reason": "Machine suite locks and owned candidate roots serialize local workers."
  },
  {
    "file": "termination-owner.ts",
    "expression": "'/tmp'",
    "context": "join('/tmp', `cland-termination-${process.getuid?.() ?? 'user'}`)",
    "reason": "Per-uid machine termination ownership receipts."
  },
  {
    "file": "verification-tree.ts",
    "expression": "tmpdir()",
    "context": "join(tmpdir(), 'cland-candidate-')",
    "reason": "Disposable candidate tree removed after its writers stop."
  },
  {
    "file": "executor/droplet/provision.sh",
    "expression": "cd /tmp",
    "context": "shell line",
    "reason": "Dedicated executor machine temporary filesystem, provisioning workspace and suite lock; no retained per-user state."
  },
  {
    "file": "executor/droplet/temp.sh",
    "expression": "if timeout --kill-after=1s 5s mount -t tmpfs -o \"size=${cap_kib}k,mode=1777,nosuid,nodev\" cland-suite /tmp >/dev/null 2>&1; then",
    "context": "shell line",
    "reason": "Dedicated executor machine temporary filesystem, provisioning workspace and suite lock; no retained per-user state."
  },
  {
    "file": "executor/droplet/temp.sh",
    "expression": "printf '{\"root\":\"/tmp\",\"kind\":\"%s\",\"capBytes\":%s,\"fallback\":%s}\\n' \"$kind\" \"$((cap_kib*1024))\" \"$fallback\" >\"$run/temp.json.tmp\"",
    "context": "shell line",
    "reason": "Dedicated executor machine temporary filesystem, provisioning workspace and suite lock; no retained per-user state."
  },
  {
    "file": "executor/droplet/run.sh",
    "expression": "export TMPDIR=/tmp TMP=/tmp TEMP=/tmp",
    "context": "shell line",
    "reason": "Dedicated executor machine temporary filesystem, provisioning workspace and suite lock; no retained per-user state."
  },
  {
    "file": "executor/droplet/run.sh",
    "expression": "while ! mkdir /tmp/cland-suite.lock 2>/dev/null; do sleep 1; done",
    "context": "shell line",
    "reason": "Dedicated executor machine temporary filesystem, provisioning workspace and suite lock; no retained per-user state."
  },
  {
    "file": "executor/droplet/run.sh",
    "expression": "trap \"rmdir /tmp/cland-suite.lock 2>/dev/null || true\" EXIT",
    "context": "shell line",
    "reason": "Dedicated executor machine temporary filesystem, provisioning workspace and suite lock; no retained per-user state."
  },
  {
    "file": "cli/literal-rm.ts",
    "expression": "}. Claude Code stops such an rm for human approval even under bypass permissions, which stalls this session. Print the path first if you need it, then run rm again with every path written out literally, for example \\`rm -rf /private/tmp/qa-example.AbC123\\`.\\n`",
    "context": "fed ? 'xargs' : 'a command substitution or variable'}. Claude Code stops such an rm for human approval even under bypass permissions, which stalls this session. Print the path first if you need it, then run rm again with every path written out literally, for example \\`rm -rf /private/tmp/qa-example.AbC123\\`.\\n`",
    "reason": "Diagnostic example printed to the user; it performs no filesystem operation."
  },
  {
    "file": "executor/droplet/run.sh",
    "expression": "run=\"$HOME/runs/@RUN_ID@\"",
    "context": "shell line",
    "reason": "Prepared remote executor machine HOME: owned run receipts and provisioned checkout, separate from hub per-user state."
  },
  {
    "file": "executor/droplet/run.sh",
    "expression": "cd \"$HOME/cland\" || exit 1",
    "context": "shell line",
    "reason": "Prepared remote executor machine HOME: owned run receipts and provisioned checkout, separate from hub per-user state."
  },
  {
    "file": "host/records.ts",
    "expression": "tmpdir()",
    "context": "join(tmpdir(), name)",
    "reason": "Per-host short Unix socket directory fallback for the macOS 104-byte limit, like layout().socket; machine runtime only, retained host state remains project-local."
  },
  {
    "file": "host/records.ts",
    "expression": "'/tmp'",
    "context": "join('/tmp', name)",
    "reason": "Per-host short Unix socket directory fallback for the macOS 104-byte limit, like layout().socket; machine runtime only, retained host state remains project-local."
  }
];
