import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('returns fallback for empty or undefined values', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined, { fallback: '—' })).toBe('—');
    expect(formatDate('', { fallback: 'N/A' })).toBe('N/A');
  });

  it('passes 4-digit years through unchanged', () => {
    expect(formatDate('2026')).toBe('2026');
    expect(formatDate(' 1999 ')).toBe(' 1999 ');
    expect(formatDate('2026', { short: true })).toBe('2026');
  });

  it('formats short dates for options sheets', () => {
    const d = new Date(2026, 0, 5); // Jan 5, 2026 in local time
    const month = d.toLocaleString('default', { month: 'short' });
    expect(formatDate(d, { short: true })).toBe(`${month} 5, 2026`);
  });

  it('formats default dates using toLocaleDateString', () => {
    const d = new Date(2026, 0, 5);
    expect(formatDate(d)).toBe(d.toLocaleDateString());
  });

  it('handles invalid dates gracefully with fallback', () => {
    expect(formatDate('invalid-date')).toBe('');
    expect(formatDate('invalid-date', { fallback: '—' })).toBe('—');
  });
});
