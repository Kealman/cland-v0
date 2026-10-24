// The project prototype's conservative shell-pattern guard. Here-documents are
// data; this is an approval-stall guard, not a shell parser or security boundary.
/** A local PreToolUse refusal; no command is evaluated and no hub is contacted. */
export function literalRmRefusal(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null;
  const payload = input as { tool_name?: unknown; tool_input?: { command?: unknown } | null };
  const command = payload.tool_name === 'Bash' ? payload.tool_input?.command : undefined;
  if (typeof command !== 'string') return null;
  // Here-document bodies are data written somewhere else, not commands run now.
  const runs = command.replace(/<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n\s*\2(?=\n|$)/g, '<<$2$3');
  // An rm or rmdir at the start of a command (after a separator, a keyword or sudo), or fed by xargs.
  const invocation = /(?:^|[;&|(\n]|\b(?:then|do|else)\b)\s*(?:sudo\s+|command\s+)?(rm|rmdir)\b([^;&|\n)]*)|\bxargs\b[^;&|\n]*?\b(rm|rmdir)\b/g;
  for (const match of runs.matchAll(invocation)) {
    const fed = match[3] !== undefined;
    const args = match[2] ?? '';
    if (fed || /\$\(|`|\$\{?[A-Za-z_]/.test(args)) {
      return `Refused by cland hook literal-rm: \`${match[0].trim()}\` takes its target from ${fed ? 'xargs' : 'a command substitution or variable'}. Claude Code stops such an rm for human approval even under bypass permissions, which stalls this session. Print the path first if you need it, then run rm again with every path written out literally, for example \`rm -rf /private/tmp/qa-example.AbC123\`.\n`;
    }
  }
  return null;
}
