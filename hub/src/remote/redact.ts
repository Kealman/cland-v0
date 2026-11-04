import type { HubFrame } from '../protocol.ts';
import { mapStrings } from '../host/agent/redact.ts';
export { remoteRedactor, redactValue } from '../host/agent/redact.ts';
export type { RemoteRedactor } from '../host/agent/redact.ts';

const CONTENT_FIELDS = new Set(['caption', 'text', 'reason', 'error', 'note', 'title', 'question', 'body', 'description', 'content', 'summary', 'command']);

/** Never rewrite an action, identifier or correlation to a different operation. */
export function redactFrame<T>(input: T, redact: (text: string) => string): T {
  return mapStrings(input, (text, key) => {
    const masked = redact(text);
    if (masked !== text && !CONTENT_FIELDS.has(key)) throw new Error('remote output would alter protocol routing');
    return masked;
  });
}

/** Hub-owned endpoint/display metadata is never remote input or an action target. */
export function redactHubFrame(input: HubFrame, redact: (text: string) => string): HubFrame {
  return mapStrings(input, (text, key) => {
    const masked = redact(text);
    if (masked !== text && !CONTENT_FIELDS.has(key) && key !== 'harnessId' && key !== 'attach')
      throw new Error('remote output would alter protocol routing');
    return masked;
  });
}
