// Admission is infrastructure, never an assertion result or a quarantine candidate.
export class AdmissionTimeout extends Error {
  readonly code = 'CLAND_ADMISSION_TIMEOUT';
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`admission timed out after ${timeoutMs / 1000} s: project hub busy; not a test result`);
    this.timeoutMs = timeoutMs;
    this.name = 'AdmissionTimeout';
  }
}

export type AdmissionTimeoutReceipt = { file?: string; message: string };

/** Node wraps a before-hook error; reporters receive its serialized cause. */
export function admissionTimeoutMessage(error: unknown): string | null {
  const seen = new Set<unknown>();
  while (error && typeof error === 'object' && !seen.has(error)) {
    seen.add(error);
    if ('code' in error && error.code === 'CLAND_ADMISSION_TIMEOUT' && 'message' in error && typeof error.message === 'string') return error.message;
    error = 'cause' in error ? error.cause : undefined;
  }
  return null;
}

export function suiteAdmissionTimeouts(log: string): AdmissionTimeoutReceipt[] {
  return log.split('\n').filter(line => line.startsWith('suite admission timeouts ')).flatMap(line => JSON.parse(line.slice('suite admission timeouts '.length)) as AdmissionTimeoutReceipt[]);
}
