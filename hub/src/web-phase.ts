// Machine prerequisites are separate from executed browser evidence.
export type WebPrerequisite = { available: true; executablePath: string } | { available: false; reason: string };
export type WebPhaseUnavailable = { status: 'not-run'; reason: string };

/** A failed probe is an error; only an explicit unavailable result excuses Web. */
export async function webPhaseAvailable(probe: () => Promise<WebPrerequisite>, emit: (line: string) => void): Promise<boolean> {
  const result = await probe();
  if (result.available === true && typeof result.executablePath === 'string' && result.executablePath.trim()) return true;
  if (result.available !== false || typeof result.reason !== 'string' || !result.reason.trim()) throw new Error('invalid Web prerequisite result');
  const receipt: WebPhaseUnavailable = { status: 'not-run', reason: result.reason.replace(/\s+/g, ' ').trim() };
  emit(`suite web phase ${JSON.stringify(receipt)}`);
  emit(webUnavailableLine(receipt));
  return false;
}

export function webUnavailableLine(receipt: WebPhaseUnavailable): string {
  return `tier Web: not run; Web unavailable on this machine: ${receipt.reason}`;
}

/** The semantic receipt survives bounded log reduction, collection and restart. */
export function unavailableWebPhase(text: string): WebPhaseUnavailable | undefined {
  let receipt: WebPhaseUnavailable | undefined;
  for (const line of text.split('\n')) if (line.startsWith('suite web phase ')) {
    const value = JSON.parse(line.slice('suite web phase '.length));
    if (value.status !== 'not-run' || typeof value.reason !== 'string' || !value.reason.trim()) throw new Error('invalid Web phase receipt');
    receipt = { status: 'not-run', reason: value.reason };
  }
  return receipt;
}
