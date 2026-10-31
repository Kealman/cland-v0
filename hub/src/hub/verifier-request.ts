/** A crew verifier request: `review request T-<n>` or `qa request T-<n>` at the start of a message.
 *
 * Text after the item on the first line is detail — the branch, head, criteria or brief a sender puts
 * there — so `review request T-12 — branch and scope` routes exactly like the bare form. The item id
 * ends at its last digit: a letter right after it (`review request T-12abc`) is no request at all,
 * because that is not a form any lead writes. One matcher serves delivery acceptance (pending work),
 * verifier resolution and queueing, and the Lead's subtree refusal, so those four cannot disagree
 * about whether a first line is a request.
 */
export type VerifierRequest = { kind: 'review' | 'qa'; item: string; head?: string };

const REQUEST = /^(review|qa) request ((?:[A-Za-z]-)?[1-9]\d*)(?![0-9A-Za-z])/;

export function verifierRequest(text: string): VerifierRequest | null {
  const match = REQUEST.exec(text);
  if (!match) return null;
  const fields = text.split('\n').filter(line => /^Head:/i.test(line));
  const head = fields.length === 1 ? fields[0]?.match(/^Head: ([a-f0-9]{40}|[a-f0-9]{64})\s*$/i)?.[1]?.toLowerCase() : undefined;
  return { ...(head ? { head } : {}), kind: match[1] === 'review' ? 'review' : 'qa', item: match[2]! };
}

/** One indexed coverage candidate; order is the producer's durable cursor. */
export type VerificationFact = { order: number; head: string | null; at: string; requestSeq?: number };

export const VERIFICATION_PAGE_SIZE = 32;
