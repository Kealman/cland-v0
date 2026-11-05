import type { RemoteRedactor } from '../src/remote/redact.ts';

/** Never retain execFile's argv-bearing message. Redact before bounding stderr. */
export function rebootCliFailure(error: unknown, redact: Pick<RemoteRedactor, 'text'>): Error {
  const native = error as {code?: number; signal?: string; stderr?: string};
  const stderr = redact.text(native.stderr ?? 'missing').slice(-8192);
  return new Error(`fake reboot CLI exit ${native.code ?? 'unknown'} signal ${native.signal ?? 'none'}; stderr: ${stderr}`);
}
