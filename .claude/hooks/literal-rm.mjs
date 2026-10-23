// PreToolUse hook for Bash: refuse an rm/rmdir whose target is computed in the command itself.
// Claude Code asks the human to approve such a command even under bypass permissions ("Dangerous rm
// operation on statically-unresolvable target"), and the prompt stalls the session, a Coordinator's
// whole crew with it. A refusal costs one retry instead: the agent reads the reason and writes the path out.
import { readFileSync } from 'node:fs';

let input;
try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
const command = input?.tool_name === 'Bash' ? input.tool_input?.command : undefined;
if (typeof command !== 'string') process.exit(0);

// Here-document bodies are data written somewhere else, not commands run now.
const runs = command.replace(/<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n\s*\2(?=\n|$)/g, '<<$2$3');
// An rm or rmdir at the start of a command (after a separator, a keyword or sudo), or fed by xargs.
const invocation = /(?:^|[;&|(\n]|\b(?:then|do|else)\b)\s*(?:sudo\s+|command\s+)?(rm|rmdir)\b([^;&|\n)]*)|\bxargs\b[^;&|\n]*?\b(rm|rmdir)\b/g;
for (const match of runs.matchAll(invocation)) {
  const fed = match[3] !== undefined;
  const args = match[2] ?? '';
  if (fed || /\$\(|`|\$\{?[A-Za-z_]/.test(args)) {
    process.stderr.write(`Refused by .claude/hooks/literal-rm.mjs: \`${match[0].trim()}\` takes its target from ${fed ? 'xargs' : 'a command substitution or variable'}. Claude Code stops such an rm for human approval even under bypass permissions, which stalls this session. Print the path first if you need it, then run rm again with every path written out literally, for example \`rm -rf /private/tmp/qa-example.AbC123\`.\n`);
    process.exit(2);
  }
}
process.exit(0);
