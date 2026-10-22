/** A live append may expose an unfinished tail even after a log drain barrier.
 * Keep malformed complete records visible to JSON.parse; only defer the tail. */
export function completeJournalLines(text: string): string[] {
  return text.slice(0, text.lastIndexOf('\n') + 1).split('\n').filter(Boolean);
}
