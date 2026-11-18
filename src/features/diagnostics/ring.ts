import type { LogRecord } from './record';

/**
 * A bounded buffer of the most recent records.
 *
 * Bounded by count, not by bytes. A record's `message` is a fixed string and
 * its `fields` are primitives by type, so the size of one is bounded by
 * construction — which is the other half of why `Fields` refuses objects. Were
 * a record allowed to carry arbitrary values, a count limit would be no limit
 * at all, and this would need to measure.
 *
 * The capacity is the number of records worth keeping to explain the failure
 * the user is reporting, which in practice means "the burst", not "the
 * session". The engine's own measurements put a failing stream at 121 failures
 * a minute, so a few hundred records is seconds of a storm — enough to see the
 * shape of one, and little enough that the whole buffer serialises cheaply.
 *
 * Overwrites oldest-first and never grows, so a log left running for a week
 * costs the same as one left running for a minute.
 */
const DEFAULT_CAPACITY = 400;

export class Ring {
  private records: LogRecord[] = [];
  private next = 0;

  constructor(private readonly capacity: number = DEFAULT_CAPACITY) {
    if (capacity < 1) throw new Error('Ring capacity must be at least 1');
  }

  push(record: LogRecord): void {
    if (this.records.length < this.capacity) {
      this.records.push(record);
      this.next = this.records.length % this.capacity;
      return;
    }
    this.records[this.next] = record;
    this.next = (this.next + 1) % this.capacity;
  }

  /**
   * Oldest first.
   *
   * Chronological rather than newest-first because that is the order a reader
   * needs: a failure is explained by what led to it, and an export read from
   * the bottom up is one nobody reads. A view that wants newest-first reverses
   * a copy; the buffer does not keep two orders.
   */
  toArray(): LogRecord[] {
    if (this.records.length < this.capacity) return [...this.records];
    return [...this.records.slice(this.next), ...this.records.slice(0, this.next)];
  }

  /** How many records are held, for a view that says so without serialising. */
  get size(): number {
    return this.records.length;
  }

  clear(): void {
    this.records = [];
    this.next = 0;
  }

  /** Replaces the contents, keeping only the newest `capacity` records. */
  load(records: readonly LogRecord[]): void {
    this.clear();
    for (const record of records.slice(-this.capacity)) this.push(record);
  }
}
