// Read source syntax only: a brief must never execute tests to discover their names.
import type { QaLintFinding } from './qa-lint.ts';

const testFiles = (text: string): string[] => [...text.matchAll(/(?<![\w/.-])((?:[\w.-]+\/)*[\w.-]+\.(?:test|spec)\.[cm]?[jt]sx?)\b/g)].map(m => m[1]!);

export function qaBriefNeedsBuild(source: string): boolean {
  return testFiles(source).length > 0 || /\btest(?: title| named| titled)?\s*:?\s*`|\btests(?: titles)?:\s*`|--test-name-pattern|\bselector:\s*`|\b(?:locator|querySelector(?:All)?)\(\s*[\'"]/i.test(source);
}

type Token = { kind: 'word' | 'literal' | 'punct' | 'opaque'; value: string; regexAfter?: boolean; forAwait?: boolean };

// Deliberately lexical: no compiler package is installed in production, and
// evaluating even a test module's top level would run untrusted fixture code.
function sourceTokens(text: string): { tokens: Token[]; ambiguous: boolean } {
  let at = 0;
  let ambiguous = false;
  const tokens: Token[] = [];
  const controlParens: boolean[] = [];
  const quoted = (quote: string): Token => {
    at++;
    let value = '';
    let literal = true;
    while (at < text.length) {
      const char = text[at++]!;
      if (char === quote) return { kind: literal ? 'literal' : 'opaque', value };
      if (quote === '`' && char === '$' && text[at] === '{') {
        literal = false; at++;
        // Skip the interpolation, including strings and nested templates, as a unit.
        let depth = 1;
        let previous: Token = { kind: 'punct', value: '{' };
        while (at < text.length && depth) {
          const token = next(previous);
          previous = token;
          if (token.kind === 'punct' && token.value === '{') depth++;
          if (token.kind === 'punct' && token.value === '}') depth--;
        }
      } else if (char === '\\') {
        const escaped = text[at++] ?? '';
        if (escaped === '\n') continue;
        if (escaped === '\r') { if (text[at] === '\n') at++; continue; }
        const unicode = escaped === 'u' ? /^(?:\{([a-f\d]+)\}|([a-f\d]{4}))/i.exec(text.slice(at)) : escaped === 'x' ? /^([a-f\d]{2})/i.exec(text.slice(at)) : null;
        if (unicode) {
          const point = parseInt(unicode[1] ?? unicode[2]!, 16);
          if (point > 0x10ffff) literal = false;
          else value += String.fromCodePoint(point);
          at += unicode[0].length;
        } else {
          const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
          if (/[1-9]/.test(escaped) || escaped === '0' && /\d/.test(text[at] ?? '')) literal = false;
          value += escapes[escaped] ?? escaped;
        }
      } else {
        if (char === '\r' && quote === '`' && text[at] === '\n') at++;
        value += char === '\r' && quote === '`' ? '\n' : char;
      }
    }
    return { kind: 'punct', value: '' }; // Unterminated input never declares a title.
  };
  const next = (previous = tokens.at(-1)): Token => {
    while (at < text.length) {
      if (/\s/.test(text[at]!)) { at++; continue; }
      if (text.startsWith('//', at)) { const end = text.indexOf('\n', at); at = end < 0 ? text.length : end + 1; continue; }
      if (text.startsWith('/*', at)) { const end = text.indexOf('*/', at + 2); at = end < 0 ? text.length : end + 2; continue; }
      break;
    }
    const char = text[at];
    if (!char) return { kind: 'punct', value: '' };
    if ('"\'`'.includes(char)) return quoted(char);
    // A closing control condition starts a statement; an ordinary call's
    // closing paren ends an expression. Preserve that distinction for division.
    if (char === '(') {
      controlParens.push(previous?.kind === 'word' && (/^(?:if|while|for|with|switch|catch)$/.test(previous.value) || previous.forAwait === true));
    } else if (char === ')') {
      at++; return { kind: 'punct', value: ')', regexAfter: controlParens.pop() ?? false };
    }
    if (text.startsWith('++', at) || text.startsWith('--', at)) {
      const value = text.slice(at, at + 2); at += 2; return { kind: 'punct', value };
    }
    const expressionStart = !previous
      || previous.kind === 'punct' && (/^[=([{,:;!?&|<>+*%~^/-]$/.test(previous.value) || previous.value === '}' || previous.regexAfter)
      || previous.kind === 'word' && /^(?:return|throw|case|else|do|yield|await|void|typeof|delete|in|of|instanceof|new|break|continue|debugger)$/.test(previous.value);
    if (char === '/' && expressionStart) {
      // Without a grammar, a brace can end either a block or an expression.
      // A missing name after this point is unresolved rather than absent.
      if (previous?.value === '}') ambiguous = true;
      // Only a terminated, single-line literal is opaque. An unmatched slash
      // remains punctuation rather than swallowing a subsequent declaration.
      let cursor = at + 1;
      let bracket = false;
      while (cursor < text.length && !/[\r\n]/.test(text[cursor]!)) {
        const part = text[cursor++]!;
        if (part === '\\') { cursor++; continue; }
        if (part === '[') bracket = true;
        if (part === ']') bracket = false;
        if (part === '/' && !bracket) {
          while (/[a-z]/i.test(text[cursor] ?? '')) cursor++;
          at = cursor; return { kind: 'opaque', value: '' };
        }
      }
    }
    const word = /^[\w$]+/.exec(text.slice(at))?.[0];
    if (word) { at += word.length; return { kind: 'word', value: word, ...(word === 'await' && previous?.value === 'for' ? { forAwait: true } : {}) }; }
    at++; return { kind: 'punct', value: char };
  };
  while (at < text.length) tokens.push(next());
  return { tokens, ambiguous };
}

function testTitles(text: string): { names: string[]; ambiguous: boolean } {
  const { tokens, ambiguous } = sourceTokens(text);
  const titles: string[] = [];
  for (let at = 0; at < tokens.length; at++) {
    if (tokens[at]!.kind !== 'word' || !/^(?:test|it|describe)$/.test(tokens[at]!.value) || tokens[at - 1]?.value === '.') continue;
    let open = at + 1;
    if (tokens[open]?.value === '.' && /^(?:skip|todo|only)$/.test(tokens[open + 1]?.value ?? '')) open += 2;
    if (tokens[open]?.value === '(' && tokens[open + 1]?.kind === 'literal' && [',', ')'].includes(tokens[open + 2]?.value ?? '')) titles.push(tokens[open + 1]!.value);
  }
  return { names: titles, ambiguous };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A source-presence check, not a DOM query. Check every literal selector atom.
function selectorPresent(selector: string, web: string): boolean {
  const atoms = selector.match(/\[[^\]]+\]|[.#][\w-]+|[a-zA-Z][\w-]*/g) ?? [];
  return atoms.length > 0 && atoms.every(atom => {
    if (atom.startsWith('[')) {
      const attr = /^\[([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(atom);
      if (!attr) return false;
      const name = escape(attr[1]!);
      return attr[2] === undefined ? new RegExp(`(?<![\\w:-])${name}(?![\\w:-])`).test(web)
        : new RegExp(`(?<![\\w:-])${name}\\s*=\\s*(?:\\{\\s*)?["'\x60]${escape(attr[2])}["'\x60]`).test(web);
    }
    if (atom.startsWith('#')) return new RegExp(`(?<![\\w:-])id\\s*=\\s*(?:\\{\\s*)?["']${escape(atom.slice(1))}["']`).test(web);
    if (atom.startsWith('.')) return new RegExp(`(?:\\.|\\bstyles\\.)${escape(atom.slice(1))}(?![\\w-])`).test(web);
    return new RegExp(`<${escape(atom)}(?:\\s|[/>])`).test(web);
  });
}

export function lintQaReferences(source: string, build: ReadonlyMap<string, string>): QaLintFinding[] {
  const findings: QaLintFinding[] = [];
  const resolveFile = (file: string) => [...build.keys()].filter(path => path === file || !file.includes('/') && path.endsWith('/' + file));
  const mentioned = new Set(testFiles(source).flatMap(resolveFile));
  const titles = new Map<string, ReturnType<typeof testTitles>>();
  const web = [...build].filter(([file]) => file.startsWith('web/src/')).map(([, text]) => text).join('\n');
  const namesIn = (files: string[]) => files.flatMap(file => {
    if (!titles.has(file)) titles.set(file, testTitles(build.get(file)!));
    return titles.get(file)!.names;
  });
  source.split(/\r?\n/).forEach((line, index) => {
    const add = (message: string) => findings.push({ line: index + 1, message });
    const selectors = [
      ...[...line.matchAll(/\bselector:\s*`([^`]+)`/gi)].map(m => m[1]!),
      ...[...line.matchAll(/\b(?:locator|querySelector(?:All)?)\(\s*(?:'([^']+)'|"([^"]+)")/g)].map(m => m[1] ?? m[2]!),
    ];
    for (const selector of selectors) if (!selectorPresent(selector, web)) add(`selector ${JSON.stringify(selector)} is absent from web/src at the build`);
    const files = testFiles(line);
    for (const file of files) {
      const candidates = resolveFile(file);
      if (!candidates.length) add(`test file ${file} is absent from the build`);
      else if (candidates.length > 1) add(`ambiguous test file ${file}; use its full path`);
    }
    const titleRefs = [...line.matchAll(/\btest(?: title| named| titled)?\s*:?\s*`([^`]+)`/gi)].map(m => m[1]!);
    for (const list of line.matchAll(/\btests(?: titles)?:\s*((?:`[^`]+`(?:\s*,\s*|\s+and\s+)?)+)/gi)) {
      titleRefs.push(...[...list[1]!.matchAll(/`([^`]+)`/g)].map(m => m[1]!));
    }
    const patterns = [...line.matchAll(/--test-name-pattern(?:=|\s+)(?:'([^']*)'|"([^"]*)"|([^\s`|]+))/g)].map(m => m[1] ?? m[2] ?? m[3]!);
    if (!titleRefs.length && !patterns.length) return;
    const scope = files.length ? files.flatMap(resolveFile) : mentioned.size ? [...mentioned] : [...build.keys()].filter(file => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));
    const names = namesIn(scope);
    const ambiguous = scope.some(file => titles.get(file)?.ambiguous);
    for (const title of titleRefs.filter(title => !testFiles(title).length)) if (!names.includes(title)) add(ambiguous ? `test title ${JSON.stringify(title)} is unresolved at the build (ambiguous regex/division or brace context); use generated cases` : `test title ${JSON.stringify(title)} is absent from the build's named test files; use declared or generated cases`);
    for (const pattern of patterns) {
      let regexp: RegExp;
      try { regexp = new RegExp(pattern); }
      catch { add(`invalid test pattern ${JSON.stringify(pattern)}`); continue; }
      if (!names.some(name => regexp.test(name))) add(ambiguous ? `test pattern ${JSON.stringify(pattern)} is unresolved at the build (ambiguous regex/division or brace context); use generated cases` : `test pattern ${JSON.stringify(pattern)} matches no declared cases at the build; use generated cases for dynamic titles`);
    }
  });
  return findings;
}
