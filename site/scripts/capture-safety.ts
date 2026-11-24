import { assertNoPublicationSecrets } from '../../.agents/skills/qa/secret-scan-policy.ts';

type CapturePhase = 'capture' | 'setup' | 'sign-in' | 'desktop' | 'phone' | 'scan' | 'export' | 'cleanup';
const safeErrors = new WeakSet<Error>();

function failure(phase: CapturePhase): Error {
  const error = new Error(`Screenshot capture failed during ${phase}; private diagnostic withheld.`);
  safeErrors.add(error);
  return error;
}

export function scanCapture(text: string, secret: string): void {
  try { assertNoPublicationSecrets(text, 'capture', secret); }
  catch { throw failure('scan'); }
}

/** Do not serialize or attach the original error: message, stack, cause, assertion
 * actual and arbitrary properties can all hold a one-use URL or private DOM text.
 * Only our own fixed diagnostics may cross the node:test reporter boundary. */
export async function captureStep<T>(phase: CapturePhase, body: () => T | Promise<T>): Promise<T> {
  try { return await body(); }
  catch (error) {
    if (error instanceof Error && safeErrors.has(error)) throw error;
    throw failure(phase);
  }
}
