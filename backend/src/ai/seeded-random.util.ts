import { createHash } from "crypto";

// Deterministic seeded PRNG used only to fabricate plausible demo invoice
// data from a filename hash (see ai.service.ts `demoExtractInvoice`).
// Mirrors the *behavior* of Python's `random.Random(seed)` (deterministic,
// same filename -> same fields every time) but does not reproduce Python's
// Mersenne Twister bit-for-bit — that's not required for API/UI parity, only
// "plausible, deterministic, varied" output is.

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    // xorshift32 needs a non-zero seed
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  private next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0xffffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  choice<T>(items: T[]): T {
    return items[this.nextInt(0, items.length - 1)];
  }
}

export function md5Seed(input: string): number {
  const hash = createHash("md5").update(input).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}
