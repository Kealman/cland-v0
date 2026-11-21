import { requireTypeScript } from './typescript-capability.ts';

/** Census only: these findings never participate in admission or exit status. */
export function fixedTestWaits(file: string, source: string): Array<{ file: string; line: number; message: string; reportOnly: true }> {
  const ts = requireTypeScript('fixed test wait census');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: ReturnType<typeof fixedTestWaits> = [];
  const numeric = (node: import('typescript').Node | undefined): boolean => !!node &&
    (ts.isNumericLiteral(node) || ts.isParenthesizedExpression(node) && numeric(node.expression)
      || ts.isPrefixUnaryExpression(node) && numeric(node.operand)
      || ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && numeric(node.right));
  const name = (node: import('typescript').Node): string => ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text
    : ts.isPropertyAccessExpression(node) ? node.name.text : '';
  const deadlineName = (value: string) => /^(?:timeout|timeoutMs|deadlineMs)$/.test(value);
  const visit = (node: import('typescript').Node) => {
    let kind = '';
    if (ts.isPropertyAssignment(node) && deadlineName(name(node.name)) && numeric(node.initializer)) kind = name(node.name);
    if (ts.isParameter(node) && deadlineName(name(node.name)) && numeric(node.initializer)) kind = `default ${name(node.name)}`;
    if (ts.isCallExpression(node)) {
      const api = name(node.expression);
      const argument = ['within', 'setTimeout'].includes(api) ? 1
        : ['setDefaultTimeout', 'setDefaultNavigationTimeout'].includes(api)
          || ts.isPropertyAccessExpression(node.expression) && name(node.expression.expression) === 'AbortSignal' && api === 'timeout' ? 0 : -1;
      if (argument >= 0 && numeric(node.arguments[argument])) kind = api;
    }
    if (kind) findings.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      message: `${kind} has a fixed numeric test wait outside the shared helper`, reportOnly: true });
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return findings;
}
