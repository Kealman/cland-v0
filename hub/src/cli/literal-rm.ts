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
  const glob = globRm(runs);
  if (glob) return refusal(glob, 'an unquoted glob');
  for (const match of runs.matchAll(invocation)) {
    const fed = match[3] !== undefined;
    const args = match[2] ?? '';
    if (fed || /\$\(|`|\$\{?[A-Za-z_]/.test(args)) {
      return refusal(match[0].trim(), fed ? 'xargs' : 'a command substitution or variable');
    }
  }
  return null;
}

function refusal(invocation: string, source: string): string {
  return `Refused by cland hook literal-rm: \`${invocation}\` takes its target from ${source}. Claude Code stops such an rm for human approval even under bypass permissions, which stalls this session. Print the path first if you need it, then run rm again with every path written out literally, for example \`rm -rf /private/tmp/qa-example.AbC123\`, or leave a fresh \`mktemp -d\` directory in place.\n`;
}

/** Track quoting only for glob detection; quoted shell -c words become code again. */
function globRm(script: string): string | null {
  const words: { value: string; pattern: string; separator?: true }[] = [];
  let value = '', pattern = '', quote = '', started = false;
  const finish = () => {
    if (started) words.push({ value, pattern });
    value = ''; pattern = ''; started = false;
  };
  for (let i = 0; i < script.length; i++) {
    const char = script[i]!;
    if (char === '\\' && quote !== "'" && (quote !== '"' || /[$`"\\\n]/.test(script[i + 1] ?? ''))) {
      value += script[++i] ?? ''; pattern += '\0'; started = true;
    } else if (quote) {
      if (char === quote) quote = '';
      else { value += char; pattern += '\0'; }
    } else if (char === "'" || char === '"') {
      quote = char; started = true;
    } else if (/[;&|()\n]/.test(char)) {
      finish(); words.push({ value: ';', pattern: '', separator: true });
    } else if (/\s/.test(char)) {
      finish();
    } else {
      value += char; pattern += char; started = true;
    }
  }
  finish();
  let start = true;
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (word.separator) { start = true; continue; }
    if (!start) continue;
    if (word.pattern === word.value && ['then', 'do', 'else', 'sudo', 'command'].includes(word.value)) continue;
    start = false;
    if (word.value === 'rm' || word.value === 'rmdir') {
      for (let j = i + 1; j < words.length && !words[j]!.separator; j++) {
        if (hasGlob(words[j]!.pattern)) return `${word.value} ${words[j]!.value}`;
      }
    } else if (/(?:^|\/)(?:bash|sh)$/.test(word.value)) {
      for (let j = i + 1; j < words.length && !words[j]!.separator; j++) {
        if (/^-[a-z]*c[a-z]*$/.test(words[j]!.value)) {
          const nested = words[j + 1];
          if (nested) { const found = globRm(nested.value); if (found) return found; }
          break;
        }
      }
    }
  }
  return null;
}

// Quoted/escaped characters are NUL placeholders: members, never glob syntax.
function hasGlob(pattern: string): boolean {
  if (/[*?]/.test(pattern)) return true;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== '[') continue;
    let end = i + 1;
    if (pattern[end] === '!' || pattern[end] === '^') end++;
    // A leading ] is a class member; a later unquoted ] closes the class.
    if (pattern[end] === ']') end++;
    for (; end < pattern.length; end++) {
      if (pattern[end] === ']') return true;
    }
  }
  return false;
}
