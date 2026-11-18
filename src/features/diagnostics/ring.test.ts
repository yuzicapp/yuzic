import { Ring } from './ring';
import type { LogRecord } from './record';

const at = (n: number): LogRecord => ({
  at: n,
  level: 'warn',
  scope: 'playback',
  message: `record ${n}`,
});

const times = (count: number): LogRecord[] =>
  Array.from({ length: count }, (_unused, index) => at(index));

describe('Ring', () => {
  it('holds records in the order they arrived', () => {
    const ring = new Ring(5);
    times(3).forEach(record => ring.push(record));

    expect(ring.toArray().map(r => r.at)).toEqual([0, 1, 2]);
  });

  it('keeps the newest once full, dropping the oldest', () => {
    const ring = new Ring(3);
    times(5).forEach(record => ring.push(record));

    expect(ring.toArray().map(r => r.at)).toEqual([2, 3, 4]);
  });

  it('stays chronological across many wraps', () => {
    const ring = new Ring(4);
    times(103).forEach(record => ring.push(record));

    expect(ring.toArray().map(r => r.at)).toEqual([99, 100, 101, 102]);
  });

  it('is exactly full without wrapping at capacity', () => {
    const ring = new Ring(3);
    times(3).forEach(record => ring.push(record));

    expect(ring.toArray().map(r => r.at)).toEqual([0, 1, 2]);
    expect(ring.size).toBe(3);
  });

  it('never grows past capacity', () => {
    const ring = new Ring(10);
    times(10_000).forEach(record => ring.push(record));

    expect(ring.size).toBe(10);
  });

  it('works at a capacity of one', () => {
    const ring = new Ring(1);
    times(3).forEach(record => ring.push(record));

    expect(ring.toArray().map(r => r.at)).toEqual([2]);
  });

  it('refuses a capacity below one, rather than silently keeping nothing', () => {
    expect(() => new Ring(0)).toThrow(/at least 1/);
  });

  it('empties on clear, and keeps working afterwards', () => {
    const ring = new Ring(3);
    times(5).forEach(record => ring.push(record));
    ring.clear();

    expect(ring.toArray()).toEqual([]);
    expect(ring.size).toBe(0);

    ring.push(at(42));
    expect(ring.toArray().map(r => r.at)).toEqual([42]);
  });

  it('loads stored records back, newest kept when they overflow', () => {
    const ring = new Ring(3);
    ring.load(times(5));

    expect(ring.toArray().map(r => r.at)).toEqual([2, 3, 4]);
  });

  it('keeps wrapping correctly after a load', () => {
    const ring = new Ring(3);
    ring.load(times(3));
    ring.push(at(9));

    expect(ring.toArray().map(r => r.at)).toEqual([1, 2, 9]);
  });

  it('hands out a copy, so a reader cannot mutate the buffer', () => {
    const ring = new Ring(3);
    ring.push(at(1));
    ring.toArray().push(at(2));

    expect(ring.size).toBe(1);
  });
});
