import ts from 'typescript';

export function compareGitCommandCallSites(a: { file: string; call: string }, b: { file: string; call: string }): number {
  const left = `${a.file}\0${a.call}`, right = `${b.file}\0${b.call}`;
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Frozen argv census includes literal producers and explicit forwarding seams.
 * Samples replace only dynamic operand values; option spellings stay exact. */
export function gitCommandCallSites(file: string, source: string) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const native = new Set(['territoryGitAsync']);
  for (const statement of tree.statements) if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
    for (const binding of statement.importClause.namedBindings.elements) if ((binding.propertyName ?? binding.name).text === 'territoryGitAsync') native.add(binding.name.text);
  }
  const calls: Array<{ file: string; call: string; argv: string[] | null }> = [];
  function sample(value: ts.Expression): string[] | null {
    if (ts.isStringLiteralLike(value)) return [value.text];
    if (ts.isTemplateExpression(value)) return [value.head.text + value.templateSpans.map(part => `fixture${part.literal.text}`).join('')];
    if (ts.isNumericLiteral(value)) return [value.text];
    return null;
  }
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(tree);
      const direct = native.has(name) || /\.territoryGitAsync$/.test(name);
      // Include the modules' local Git wrappers and injected repository methods;
      // over-inclusion is explicit, rather than hiding an indirect producer.
      if (direct || /^(?:git|runGit|execute|run)$/.test(name) || /(?:\.|#)(?:git|rootGit)$/.test(name)) {
        const argument = node.arguments[direct ? 1 : ts.isArrayLiteralExpression(node.arguments[0] ?? tree) ? 0 : ts.isArrayLiteralExpression(node.arguments[1] ?? tree) ? 1 : 0];
        let argv: string[] | null = null;
        if (argument && ts.isArrayLiteralExpression(argument)) {
          argv = [];
          for (const part of argument.elements) {
            const values = ts.isSpreadElement(part) ? ['fixture'] : sample(part as ts.Expression);
            argv.push(...(values ?? ['fixture']));
          }
          if (!argument.elements.length || !ts.isStringLiteralLike(argument.elements[0]!)) argv = null;
        } else if (!direct && argument && ts.isStringLiteralLike(argument)) {
          argv = node.arguments.flatMap(part => ts.isSpreadElement(part) ? ['fixture'] : sample(part) ?? ['fixture']);
        }
        calls.push({ file, call: node.getText(tree).replace(/\s+/g, ' '), argv });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return calls;
}
