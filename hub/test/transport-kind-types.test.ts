// T2: compiler API checks the public carrier contract without starting processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

test('a new transport kind compiles against the unchanged carrier contract', () => {
  const kindPath = fileURLToPath(new URL('../src/host/transport-kind.ts', import.meta.url));
  const fixturePath = fileURLToPath(new URL('./transport-kind-carrier.ts', import.meta.url));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true,
    noEmit: true, allowImportingTsExtensions: true, skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  host.fileExists = ((original) => path => path === fixturePath || original(path))(host.fileExists.bind(host));
  host.readFile = path => {
    if (path === fixturePath) return `
      import type { Transport, TransportKind } from '../src/transport/transport.ts';
      const kind: TransportKind = 'outbound';
      export const carrier: Transport = {
        kind, host: 'fixture', start: async () => {}, stop: async () => {}, wake() {},
        status: () => ({ name: 'fixture', state: 'down', since: null, lastProbe: null, reconnects: 0 }),
      };
    `;
    const source = readFile(path);
    return path === kindPath ? source?.replace("type TransportKind = 'ssh'", "type TransportKind = 'ssh' | 'outbound'") : source;
  };
  const program = ts.createProgram([fixturePath], options, host);
  // Resolve the full graph; collect diagnostics at the changed public seams.
  const checked = [fixturePath, kindPath,
    fileURLToPath(new URL('../src/transport/transport.ts', import.meta.url)),
    fileURLToPath(new URL('../src/host/pools.ts', import.meta.url))];
  const diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics(),
    ...checked.flatMap(path => {
      const source = program.getSourceFile(path);
      assert.ok(source, path);
      return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
    })];
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path, getCurrentDirectory: host.getCurrentDirectory,
    getNewLine: () => '\n',
  }));
});
