// Optional development compiler: keep ordinary installed hub startup compiler-free.
import { createRequire } from 'node:module';
import type ts from 'typescript';

let compiler: typeof ts | undefined;
export function requireTypeScript(consumer: string): typeof ts {
  if (compiler) return compiler;
  try { compiler = createRequire(import.meta.url)('typescript') as typeof ts; }
  catch {
    throw new Error(`TypeScript compiler unavailable; ${consumer} unknown; use a source installation with development dependencies for this check`);
  }
  return compiler;
}
