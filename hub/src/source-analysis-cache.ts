/** Compact syntax facts only: never retain compiler trees or programs.
 * Keys contain the complete source and all parser options. Bound both entries
 * and retained UTF-16 characters; a changed source always requires new facts. */
export class SourceAnalysisCache<T> {
  readonly #entries = new Map<string, { value: Promise<T>; characters: number }>();
  #characters = 0;
  readonly limit: number;
  readonly characterLimit: number;
  constructor(limit = 4096, characterLimit = 8 * 1024 * 1024) { this.limit = limit; this.characterLimit = characterLimit; }
  async read(key: string, compute: () => Promise<T>): Promise<T> {
    let entry = this.#entries.get(key);
    if (entry) { this.#entries.delete(key); this.#entries.set(key, entry); }
    else {
      const value = Promise.resolve().then(compute);
      entry = { value, characters: key.length };
      if (key.length <= this.characterLimit) {
        this.#entries.set(key, entry); this.#characters += key.length;
        while (this.#entries.size > this.limit || this.#characters > this.characterLimit) {
          const oldest = this.#entries.keys().next().value!;
          this.#characters -= this.#entries.get(oldest)!.characters; this.#entries.delete(oldest);
        }
      }
      const captured = entry;
      void value.catch(() => {
        if (this.#entries.get(key) === captured) { this.#entries.delete(key); this.#characters -= captured.characters; }
      });
    }
    return structuredClone(await entry.value);
  }
}
