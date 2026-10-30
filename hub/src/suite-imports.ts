// Tokenize comments and strings as units so examples in either cannot become imports.
// Covers static imports, re-exports and literal dynamic imports. Unresolved
// template imports fail closed rather than hiding a possible shared dependency.
export function importSpecifiers(source: string): string[] {
  const tokens = source.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[\w$]+|[^\s]/g)?.filter(token => !token.startsWith('//') && !token.startsWith('/*')) ?? [];
  const specifiers: string[] = [];
  const literal = (token: string | undefined) => {
    if (!token || !/^["'`]/.test(token)) return undefined;
    if (token.startsWith('`') && token.includes('${')) throw new Error('interpolated dynamic import cannot be resolved safely');
    return token.slice(1, -1).replace(/\\(["'`\\])/g, '$1');
  };
  for (let i = 0; i < tokens.length; i++) {
    const reexport = tokens[i] === 'export' && ['*', '{', 'type'].includes(tokens[i + 1] ?? '');
    if ((tokens[i] !== 'import' && !reexport) || tokens[i - 1] === '.') continue;
    // A default binding named `type` is a value (`import type from ...`).
    if (tokens[i + 1] === 'type' && tokens[i + 2] !== 'from' && tokens[i + 2] !== '=') continue;
    // Inline type specifiers leave an empty import/export that executes the module.
    let specifier = literal(tokens[i + 1]);
    if (tokens[i + 1] === '(') specifier = literal(tokens[i + 2]);
    else if (!specifier && tokens[i + 1] !== '.') {
      for (let j = i + 1; j < tokens.length && tokens[j] !== ';' && tokens[j] !== 'import'; j++) {
        if (tokens[j] === 'from') { specifier = literal(tokens[j + 1]); break; }
      }
    }
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}
