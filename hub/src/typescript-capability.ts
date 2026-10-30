// Optional development compiler: keep ordinary installed hub startup compiler-free.
import { createRequire } from 'node:module';
import type ts from 'typescript';

/** Missing development tooling is a capability refusal, never a source finding. */
export class TypeScriptUnavailableError extends Error {
  constructor(consumer: string) {
    super(`TypeScript compiler unavailable; ${consumer} unknown; use a source installation with development dependencies for this check`);
  }
}

let compiler: typeof ts | undefined;
export function requireTypeScript(consumer: string): typeof ts {
  if (compiler) return compiler;
  try { compiler = createRequire(import.meta.url)('typescript') as typeof ts; }
  catch {
    throw new TypeScriptUnavailableError(consumer);
  }
  return compiler;
}
