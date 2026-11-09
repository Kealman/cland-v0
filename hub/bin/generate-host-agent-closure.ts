import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { runtimePath, agentSourceImportAllowed } from '../src/host/agent/package.ts';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export async function generateAgentClosure(root=fileURLToPath(new URL('../..',import.meta.url))) {

  const files:Array<{path:string;sha256:string}>=[], seen=new Set<string>();
  async function visit(path:string) {
    if(seen.has(path))return;seen.add(path);
    if(!runtimePath(path))throw new Error('agent source escapes runtime boundary');
    const source=await readFile(join(root,path),'utf8');
    files.push({path,sha256:hash(Buffer.from(source))});
    if(!path.endsWith('.ts'))return;
    const imports:string[]=[];
    function walk(node:ts.Node) {
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
      if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||node.expression.getText()==='require')) {
        const arg=node.arguments[0];if(!arg||!ts.isStringLiteral(arg))throw new Error('computed runtime import');imports.push(arg.text);
      }
      if(ts.isNewExpression(node)&&node.expression.getText()==='URL'&&node.arguments?.[1]?.getText()==='import.meta.url') {
        const arg=node.arguments[0];if(!arg||!ts.isStringLiteral(arg))throw new Error('computed runtime URL');
        if(/\.(ts|sh)$/.test(arg.text))imports.push(arg.text);
      }
      ts.forEachChild(node,walk);
    }
    walk(ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true));
    for(const spec of imports) {
      if(spec.startsWith('node:'))continue;
      if(!spec.startsWith('.'))throw new Error('agent runtime package must be vendored before delivery');
      const target=relative(root,resolve(root,dirname(path),spec));
      if(!agentSourceImportAllowed(path,target))throw new Error('agent source escapes runtime boundary');
      await visit(target);
    }
  }
  await visit('hub/src/host/agent/entry.ts');files.sort((a,b)=>a.path.localeCompare(b.path));return {files};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){await writeFile(new URL('../src/host/agent/closure.json',import.meta.url),JSON.stringify(await generateAgentClosure(),null,2)+'\n');}
