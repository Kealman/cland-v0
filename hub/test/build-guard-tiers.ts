// Static build-script coverage policy; no package command is executed.
import { posix, matchesGlob } from 'node:path';
import ts from 'typescript';

export function buildGuardFindings(files: ReadonlyMap<string, string>, selected: readonly string[]): string[] {
  const findings = new Set<string>();
  const covered = new Set<string>();
  const local = (dir: string, path: string) => posix.normalize(posix.join(dir, path));
  // Only eager value imports prove execution. Type-only and lazy imports do not.
  const visit = (file: string): void => {
    if (covered.has(file)) return;
    covered.add(file);
    const text = files.get(file);
    if (text === undefined) return;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const node of source.statements) {
      if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      if (ts.isImportDeclaration(node) && (node.importClause?.isTypeOnly || node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && !node.importClause.name && node.importClause.namedBindings.elements.length > 0 && node.importClause.namedBindings.elements.every(element => element.isTypeOnly))) continue;
      if (ts.isExportDeclaration(node) && node.isTypeOnly) continue;
      const name = node.moduleSpecifier.text;
      if (!name.startsWith('.')) continue;
      const path = local(posix.dirname(file), name);
      const target = [path, `${path}.ts`, `${path}.js`, `${path}/index.ts`].find(path => files.has(path));
      if (target) visit(target);
    }
  };
  selected.forEach(visit);
  const packages = new Map<string, { name?: string; scripts?: Record<string, string>; workspaces?: string[] }>();
  for (const [file, text] of files) if (posix.basename(file) === 'package.json') packages.set(posix.dirname(file), JSON.parse(text));
  const guards = (cwd: string, command: string, origin: string) => {
    const tokens = command.match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g)?.map(token => token.replace(/^(['"])(.*)\1$/, '$2')) ?? [];
    const launcher = ['node', 'tsx', 'ts-node', 'bash', 'sh', 'python', 'python3'].includes(tokens[0] ?? '');
    const direct = /\.(?:[cm]?[jt]s|tsx|sh|py)$/.test(tokens[0] ?? '');
    if (!launcher && !direct) {
      if (!['astro', 'vite', 'tsc', 'esbuild', 'rollup', 'webpack'].includes(tokens[0] ?? '')) findings.add(`${origin}: incomplete shell command ${command}`);
      return;
    }
    // Parse execution operands, never incidental argv/preload paths. Restrict
    // supported modes deliberately; every other mode retains an unknown receipt.
    let operands = direct && !launcher ? tokens.slice(0, 1) : tokens.slice(1);
    const testMode = tokens[0] === 'node' && operands[0] === '--test';
    if (testMode) operands = operands.slice(1);
    else {
      if (operands[0] === '--') operands = operands.slice(1);
      operands = operands.slice(0, 1);
    }
    if (!operands.length || operands.some(token => token.startsWith('-') || !/\.(?:[cm]?[jt]s|tsx|sh|py)$/.test(token))) {
      findings.add(`${origin}: incomplete launch mode or file target: ${command}`);
      return;
    }
    for (const token of operands) {
      const pattern = local(cwd, token);
      const targets = [...files.keys()].filter(file => matchesGlob(file, pattern));
      if (!targets.length) findings.add(`${origin}: incomplete guard target ${pattern}`);
      for (const target of targets) if (!covered.has(target)) findings.add(`${origin}: ${target} has no verify tier`);
    }
  };
  const walk = (cwd: string, name: string, trail: string[], active: Set<string>): void => {
    const key = `${cwd}#${name}`;
    if (active.has(key)) { findings.add(`${trail.join(' -> ')}: incomplete script cycle ${key}`); return; }
    const scripts = packages.get(cwd)?.scripts;
    const command = scripts?.[name];
    if (!command) return;
    if (/(?<![|])\|(?![|])|(?<![&])&(?![&])|[<>`$\r\n]/.test(command)) {
      findings.add(`${key}: incomplete shell structure ${command}`);
      return;
    }
    const next = new Set(active).add(key);
    const origin = [...trail, trail.length ? name : `${local(cwd, 'package.json')}#${name}`].join(' -> ');
    let directory = cwd;
    for (const part of command.split(/&&|\|\||;/).map(part => part.trim())) {
      const cd = /^cd\s+([^\s]+)$/.exec(part);
      if (cd) { directory = local(directory, cd[1]!); continue; }
      const npm = /^npm\s+(.*)$/.exec(part);
      if (npm) {
        const args = npm[1]!.match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g)?.map(arg => arg.replace(/^(['"])(.*)\1$/, '$2')) ?? [];
        let prefix = directory;
        const workspaces: string[] = [];
        const positional: string[] = [];
        let ambiguous = false;
        for (let index = 0; index < args.length; index++) {
          const arg = args[index]!;
          if (arg === '--') break;
          const option = /^(--prefix|--workspace|-w)(?:=(.*))?$/.exec(arg);
          if (option) {
            const value = option[2] ?? args[++index];
            if (value === undefined) ambiguous = true;
            else if (option[1] === '--prefix') prefix = local(directory, value);
            else workspaces.push(value);
          } else if (arg.startsWith('-')) ambiguous = true;
          else positional.push(arg);
        }
        const targets = workspaces.length ? workspaces.flatMap(value => {
          const target = [...packages.keys()].find(dir => dir === local(prefix, value) || packages.get(dir)?.name === value);
          if (!target) ambiguous = true;
          return target ? [target] : [];
        }) : [prefix];
        const script = positional[0] === 'run' ? positional[1] : positional[0];
        if (ambiguous || !script) findings.add(`${origin}: incomplete npm command ${part}`);
        if (script) for (const target of new Set(targets)) {
          if (!packages.get(target)?.scripts?.[script]) { findings.add(`${origin}: incomplete npm script ${target}#${script}`); continue; }
          for (const entry of [`pre${script}`, script, `post${script}`]) walk(target, entry, [origin], next);
        }
      } else guards(directory, part, origin);
    }
  };
  for (const [cwd, pkg] of packages) for (const name of Object.keys(pkg.scripts ?? {})) if (/^(?:pre|post)?build(?::|$)/.test(name)) walk(cwd, name, [], new Set());
  return [...findings].sort();
}
